import { Injectable } from '@nestjs/common';
import type { TenantClient } from '@cpeople/db';
import { BLOCKING_STATUSES } from '@cpeople/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { plainDate } from '../../common/time/clock.js';

/**
 * The sample device export (HR-02 build spec §5.2).
 *
 * SMG sends this to their device provider so that the provider can say "yes,
 * ours looks like that" or "no, ours looks like this" — which is the whole
 * point of P09. So it has to be a file that could plausibly have come off a
 * turnstile, not a tidy specimen.
 *
 * It is generated from the seeded company every time rather than stored,
 * because a stored file goes stale the moment anybody reseeds and then the
 * demo shows one set of names while the screens show another.
 *
 * It carries exactly the anomalies the spec asks for, because the import
 * screen's job is to find them and the workshop's job is to watch it happen:
 *
 *   - three **unknown numbers**: 9001 and 9002, which belong to nobody, and
 *     one real number carrying a leading zero (1009 sent as 01009), which is
 *     the employee-number format question SMG still has to answer (HR-01
 *     open point 4);
 *   - four **missing OUT** punches: somebody who badged in and went home;
 *   - two **duplicates** a few seconds apart: the first beep was not heard;
 *   - **thirty people working on 18 November**, a public holiday;
 *   - **early starts** on the pastry shift, which begins at four in the morning;
 *   - **two people punching while on approved leave**;
 *   - **one person absent for two days** with no leave request behind it.
 */
export interface SampleRow {
  readonly employeeNumber: string;
  readonly at: string;
  readonly direction: 'IN' | 'OUT';
  readonly deviceId: string;
}

/** What the sample contains, for the screen that offers it. */
export interface SampleSummary {
  readonly rows: number;
  readonly from: string;
  readonly to: string;
  readonly unknownNumbers: string[];
  readonly missingOut: number;
  readonly duplicates: number;
  readonly holidayWorkers: number;
  readonly nightShiftPeople: number;
  readonly workedOnLeave: number;
  readonly absentWithoutLeave: number;
}

/** The days the sample covers: the first three working weeks of November. */
const FROM = '2026-11-02';
const TO = '2026-11-23';

/** The holiday thirty people work on purpose. Others in the window are quiet. */
const HOLIDAY = '2026-11-18';

/** Sites that have a device. The head office signs people in at a desk. */
const DEVICE_SITES = ['OUTLET', 'KITCHEN', 'PASTRY', 'WAREHOUSE'] as const;

@Injectable()
export class SampleExportService {
  constructor(private readonly prisma: PrismaService) {}

  async build(tenantId: string): Promise<{ rows: SampleRow[]; summary: SampleSummary }> {
    return this.prisma.forTenant(tenantId, (tx) => this.#build(tx));
  }

  async #build(tx: TenantClient): Promise<{ rows: SampleRow[]; summary: SampleSummary }> {
    const people = await tx.employee.findMany({
      where: {
        status: { in: ['active', 'onboarding'] },
        site: { code: { in: [...DEVICE_SITES] } },
      },
      select: {
        id: true,
        employeeNumber: true,
        site: { select: { code: true } },
        employeeSchedules: {
          orderBy: { validFrom: 'desc' },
          take: 1,
          select: {
            weeklyRestDay: true,
            schedule: { select: { days: { select: { weekday: true, working: true } } } },
            defaultShift: { select: { start: true, end: true, crossesMidnight: true } },
          },
        },
      },
      orderBy: { employeeNumber: 'asc' },
    });

    // Who is on approved leave on which day: two of them will punch anyway,
    // and the rest are quietly absent, as they should be.
    const leave = await tx.leaveRequest.findMany({
      where: {
        status: { in: [...BLOCKING_STATUSES] },
        startDate: { lte: day(TO) },
        endDate: { gte: day(FROM) },
      },
      select: { employeeId: true, startDate: true, endDate: true },
    });

    // **Every** public holiday in the window, not the one this file is built
    // around. November 2026 has two — Green March Day and Independence Day —
    // and a sample that sent the whole company to work on the first of them
    // would be found by the import and contradict its own summary. The company
    // is off on all of them; the deliberate anomaly is the thirty who are not.
    const holidays = new Set(
      (
        await tx.publicHoliday.findMany({
          where: { date: { gte: day(FROM), lte: day(TO) } },
          select: { date: true },
        })
      ).map((row) => plainDate(row.date)),
    );

    const onLeave = (employeeId: string, date: string): boolean =>
      leave.some(
        (row) =>
          row.employeeId === employeeId &&
          plainDate(row.startDate) <= date &&
          date <= plainDate(row.endDate),
      );

    const rows: SampleRow[] = [];

    // A generator that gives the same file every time: a sample that changed
    // between two downloads would be impossible to discuss with a provider.
    let seed = 0x5a_17_03;
    const noise = (spread: number): number => {
      seed = (seed * 1_103_515_245 + 12_345) & 0x7f_ff_ff_ff;
      return ((seed % (spread * 2 + 1)) - spread) | 0;
    };

    let missingOut = 0;
    let duplicates = 0;
    let holidayWorkers = 0;
    let nightShiftPeople = 0;
    let workedOnLeave = 0;

    // One person is simply absent for two days with nothing to explain it.
    const absentee = people.find((person) => person.site?.code === 'OUTLET');
    const absentDays = ['2026-11-12', '2026-11-13'];

    for (let date = FROM; date <= TO; date = next(date)) {
      const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
      const holiday = holidays.has(date);

      for (const person of people) {
        const rota = person.employeeSchedules[0];
        const works = rota?.schedule.days.find((row) => row.weekday === weekday)?.working ?? false;
        const resting = rota?.weeklyRestDay === weekday;

        if (!works || resting) continue;

        // A holiday: the company is off. Thirty people work Independence Day,
        // which is the anomaly this file is carrying on purpose; on any other
        // holiday nobody badges at all.
        if (holiday) {
          if (date !== HOLIDAY || holidayWorkers >= 30) continue;
          holidayWorkers += 1;
        }

        const away = onLeave(person.id, date);

        // Two people punch while on approved leave, which the import will flag.
        if (away) {
          if (workedOnLeave >= 2) continue;
          workedOnLeave += 1;
        }

        if (absentee && person.id === absentee.id && absentDays.includes(date)) {
          continue;
        }

        const shift = rota?.defaultShift;
        const start = shift?.start ?? '08:00';
        const end = shift?.end ?? '17:00';
        const device = `${person.site?.code ?? 'SITE'}-01`;

        if (start < '06:00') nightShiftPeople += 1;

        const inAt = shiftTime(date, start, noise(10));
        rows.push({ employeeNumber: person.employeeNumber, at: inAt, direction: 'IN', deviceId: device });

        // Four people badge in and never badge out.
        if (missingOut < 4 && date === '2026-11-10' && rows.length % 3 === 0) {
          missingOut += 1;
          continue;
        }

        // A shift that ends before it starts ended on the following day.
        const outDate = shift?.crossesMidnight ? next(date) : date;
        rows.push({
          employeeNumber: person.employeeNumber,
          at: shiftTime(outDate, end, noise(12)),
          direction: 'OUT',
          deviceId: device,
        });

        // Two people badge twice within a minute: the first beep was not heard.
        //
        // The second badge is placed a few seconds after the **first one they
        // actually made**, not a few seconds after the shift starts — those are
        // minutes apart once the arrival noise is applied, and a pair minutes
        // apart is not a duplicate by any reading. The import and this file
        // have to mean the same thing by the word.
        if (duplicates < 2 && date === '2026-11-05' && rows.length % 7 === 0) {
          duplicates += 1;
          rows.push({
            employeeNumber: person.employeeNumber,
            at: secondsLater(inAt, 9),
            direction: 'IN',
            deviceId: device,
          });
        }
      }
    }

    // The three numbers that match nobody. 0107 is the interesting one: it is a
    // real employee number with a leading zero, which is the question SMG has
    // not yet answered.
    const known = people[6]?.employeeNumber ?? '1007';

    for (const [index, number] of ['9001', '9002', `0${known}`].entries()) {
      rows.push({
        employeeNumber: number,
        at: shiftTime('2026-11-16', '07:02', index),
        direction: 'IN',
        deviceId: 'OUTLET-01',
      });
      rows.push({
        employeeNumber: number,
        at: shiftTime('2026-11-16', '15:04', index),
        direction: 'OUT',
        deviceId: 'OUTLET-01',
      });
    }

    rows.sort((a, b) => a.at.localeCompare(b.at) || a.employeeNumber.localeCompare(b.employeeNumber));

    return {
      rows,
      summary: {
        rows: rows.length,
        from: FROM,
        to: TO,
        unknownNumbers: ['9001', '9002', `0${known}`],
        missingOut,
        duplicates,
        holidayWorkers,
        nightShiftPeople,
        workedOnLeave,
        absentWithoutLeave: absentee ? 1 : 0,
      },
    };
  }

  /** The file itself, in the format the mapping describes. */
  toCsv(rows: readonly SampleRow[]): string {
    const header = 'employee_number;timestamp;direction;device_id';
    const body = rows.map((row) => [row.employeeNumber, row.at, row.direction, row.deviceId].join(';'));

    return `${[header, ...body].join('\r\n')}\r\n`;
  }
}

/** "2026-11-23 06:58:41" — the device's own clock, with no timezone on it. */
function shiftTime(date: string, time: string, minutes: number): string {
  const [hour, minute] = time.split(':').map(Number) as [number, number];
  const at = new Date(Date.UTC(0, 0, 1, hour, minute + minutes, 0));

  const pad = (value: number): string => String(value).padStart(2, '0');
  const seconds = (Math.abs(minutes) * 7) % 60;

  return `${date} ${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}:${pad(seconds)}`;
}

/** The same stamp, a few seconds on. Keeps the file's own format. */
function secondsLater(stamp: string, seconds: number): string {
  const [date, time] = stamp.split(' ') as [string, string];
  const at = new Date(`${date}T${time}Z`);
  at.setUTCSeconds(at.getUTCSeconds() + seconds);

  return `${at.toISOString().slice(0, 10)} ${at.toISOString().slice(11, 19)}`;
}

function next(iso: string): string {
  const day = new Date(`${iso}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}
