import { createHash } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { TenantClient } from '@cpeople/db';
import { CurrentUserService, type CurrentUser } from '../../common/access/current-user.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { plainDate } from '../../common/time/clock.js';
import { readMapping, type SourceMapping } from './attendance-source.service.js';
import {
  WorkDayBuilderService,
  type BuiltDay,
  type DayPunch,
  type ExceptionCode,
} from './workday-builder.service.js';

/**
 * Reading a device file (M10 / HR-04, build spec §5.3).
 *
 * The shape is the one the spec asks for and the one HR-01 set: **try it, then
 * commit it.** The trial reads the whole file, matches it against the company,
 * builds the days it would build and raises the exceptions it would raise — and
 * writes nothing at all. Only then is there a button.
 *
 * Two promises the commit keeps:
 *
 *  - **re-importing a period replaces the device's punches and keeps the
 *    corrections somebody made by hand.** A week imported twice because the
 *    first file was short must not quietly undo an afternoon that HR fixed.
 *  - **a punch is never edited.** Duplicates are not deleted; they are written
 *    marked as duplicates, so that "why is this not counted" has an answer.
 *
 * TODO(M18): the spec asks for this to run in a BullMQ job. It runs inside the
 * request today — three weeks of a 44-person company is fourteen hundred
 * punches and seven hundred days, in a handful of statements — and the shape
 * here is already what a worker would want: an import row carrying its own
 * status, its own counts and the file it read. The queue is worth having when a
 * file is a year of a thousand people, or when the wait wants a progress bar;
 * it is not worth a worker process that somebody can forget to start before a
 * workshop.
 */
export interface ImportRow {
  readonly line: number;
  readonly employeeNumber: string;
  readonly at: Date;
  readonly direction: 'in' | 'out' | 'unknown';
  readonly deviceId?: string;
}

export interface ImportProblemRow {
  readonly line: number;
  readonly kind: 'notATime' | 'noNumber' | 'noColumns';
  readonly value: string;
}

export interface UnknownNumber {
  readonly employeeNumber: string;
  readonly punches: number;
  /** The employee this looks like, where one does: "0107" is probably 107. */
  readonly suggestion?: { id: string; name: string; employeeNumber: string };
}

export interface ImportReport {
  readonly importId: string;
  readonly fileName: string;
  readonly from?: string;
  readonly to?: string;
  readonly rows: number;
  readonly matched: number;
  readonly unknown: number;
  readonly duplicates: number;
  readonly daysBuilt: number;
  readonly problems: ImportProblemRow[];
  readonly unknownNumbers: UnknownNumber[];
  readonly exceptionsByCode: { code: ExceptionCode; count: number }[];
  /** Days already in the period that were corrected by hand, and will be kept. */
  readonly manualDaysKept: number;
  readonly applied: boolean;
}

@Injectable()
export class AttendanceImportService {
  readonly #log = new Logger(AttendanceImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
    private readonly audit: AuditService,
    private readonly builder: WorkDayBuilderService,
  ) {}

  /**
   * A trial already run, read again by its id.
   *
   * The report is recomputed from the stored file rather than kept as a blob of
   * counts, which costs a second and buys the thing that matters: the page can
   * never show a trial that disagrees with what the confirmation would do.
   */
  async report(importId: string): Promise<ImportReport> {
    const user = await this.#mayImport();

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const row = await tx.attendanceImport.findFirst({
        where: { id: importId },
        select: { fileName: true, content: true, contentSha256: true, status: true },
      });

      const read = await this.#read(tx, row?.fileName ?? '', this.#fileOf(row));

      return {
        ...read,
        importId,
        applied: row?.status === 'committed',
      };
    });
  }

  /** Reads the file and says what would happen. Writes one import row, nothing else. */
  async preview(fileName: string, content: string): Promise<ImportReport> {
    const user = await this.#mayImport();

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const report = await this.#read(tx, fileName, content);

      const row = await tx.attendanceImport.create({
        data: {
          tenantId: user.tenantId,
          fileName,
          // The file is kept with its import: the confirmation re-reads the
          // bytes the trial checked rather than trusting that what is in a box
          // on a screen is still the same file.
          content,
          contentSha256: sha256(content),
          status: 'previewed',
          ...(report.from ? { periodFrom: date(report.from) } : {}),
          ...(report.to ? { periodTo: date(report.to) } : {}),
          rows: report.rows,
          matched: report.matched,
          unknown: report.unknown,
          duplicates: report.duplicates,
          daysBuilt: report.daysBuilt,
          exceptions: report.exceptionsByCode.reduce((sum, row) => sum + row.count, 0),
          createdBy: user.name,
          createdRole: user.role,
        },
      });

      return { ...report, importId: row.id };
    });
  }

  /**
   * Writes it: the punches, the days built from them, and the exceptions.
   *
   * All of it or none of it — a half-imported fortnight is harder to find and
   * put right than a file to upload again.
   */
  async commit(importId: string): Promise<ImportReport> {
    const user = await this.#mayImport();

    const report = await this.prisma.forTenant(user.tenantId, async (tx) => {
      const row = await tx.attendanceImport.findFirst({
        where: { id: importId },
        select: { fileName: true, content: true, contentSha256: true, status: true },
      });

      if (row?.status === 'committed') {
        throw new BadRequestException({ kind: 'importDone', values: {} });
      }

      // The bytes are hashed again here, and the days are built from these
      // bytes, so what is written is what was shown.
      const content = this.#fileOf(row);
      const fileName = row!.fileName;
      const read = await this.#read(tx, fileName, content);

      if (read.rows === 0) {
        throw new BadRequestException({ kind: 'importEmpty', values: {} });
      }

      const from = read.from as string;
      const to = read.to as string;

      // Everything the device said before, for this period, steps aside. What
      // somebody corrected by hand stays exactly where it is.
      await tx.attendanceImport.updateMany({
        where: {
          status: 'committed',
          periodFrom: { lte: date(to) },
          periodTo: { gte: date(from) },
        },
        data: { status: 'replaced' },
      });

      const context = await this.builder.context(tx, to);
      const days = await this.#build(tx, read.parsed, from, to, context);

      // The punches, exactly as the file had them, duplicates marked rather
      // than dropped so that a question about one has an answer.
      await tx.punch.createMany({
        data: read.parsed.punches.map((punch) => ({
          tenantId: user.tenantId,
          importId,
          employeeNumber: punch.employeeNumber,
          ...(punch.employeeId ? { employeeId: punch.employeeId } : {}),
          at: punch.at,
          direction: punch.direction,
          ...(punch.deviceId ? { deviceId: punch.deviceId } : {}),
          source: 'device' as const,
          duplicate: punch.duplicate,
          createdBy: user.name,
        })),
      });

      // Writing the days in batches rather than one at a time.
      //
      // A month for forty-four people is seven hundred days, and a round trip
      // each for "does it exist", "write it", "clear its exceptions" and "write
      // them" is three thousand of them: a button that sits there for a minute
      // with nothing to show. The same work reads what is there once, writes
      // the new days in one statement and their exceptions in another.
      const existing = await tx.workDay.findMany({
        where: { date: { gte: date(from), lte: date(to) } },
        select: { id: true, employeeId: true, date: true, source: true },
      });

      const before = new Map(
        existing.map((row) => [`${row.employeeId}|${plainDate(row.date)}`, row]),
      );

      // A day somebody fixed by hand is not overwritten by a re-import.
      const writable = days.filter((day) => {
        const was = before.get(`${day.employeeId}|${day.date}`);
        return !was || (was.source !== 'manual' && was.source !== 'mixed');
      });

      const fresh = writable.filter((day) => !before.has(`${day.employeeId}|${day.date}`));
      const again = writable.filter((day) => before.has(`${day.employeeId}|${day.date}`));

      const written = await tx.workDay.createManyAndReturn({
        data: fresh.map((day) => ({
          tenantId: user.tenantId,
          employeeId: day.employeeId,
          date: date(day.date),
          scheduledMin: day.scheduledMin,
          workedMin: day.workedMin,
          breakMin: day.breakMin,
          lateMin: day.lateMin,
          earlyLeaveMin: day.earlyLeaveMin,
          overtime: day.overtime,
          premium: day.premium,
          overtimeRuleIds: day.overtimeRuleIds,
          status: day.exceptions.length > 0 ? ('exception' as const) : ('ok' as const),
          source: 'device' as const,
          ...(day.leaveRequestId ? { leaveRequestId: day.leaveRequestId } : {}),
          calcVersion: day.calcVersion,
        })),
        select: { id: true, employeeId: true, date: true },
      });

      for (const row of written) {
        before.set(`${row.employeeId}|${plainDate(row.date)}`, {
          id: row.id,
          employeeId: row.employeeId,
          date: row.date,
          source: 'device',
        });
      }

      // A day the device already had is rebuilt in place. There is no statement
      // that writes a different row of values to each of many rows, so these
      // stay one at a time — and on a period being imported for the first time
      // there are none of them.
      for (const day of again) {
        await tx.workDay.update({
          where: {
            tenantId_employeeId_date: {
              tenantId: user.tenantId,
              employeeId: day.employeeId,
              date: date(day.date),
            },
          },
          data: {
            scheduledMin: day.scheduledMin,
            workedMin: day.workedMin,
            breakMin: day.breakMin,
            lateMin: day.lateMin,
            earlyLeaveMin: day.earlyLeaveMin,
            overtime: day.overtime,
            premium: day.premium,
            overtimeRuleIds: day.overtimeRuleIds,
            status: day.exceptions.length > 0 ? 'exception' : 'ok',
            source: 'device',
            leaveRequestId: day.leaveRequestId ?? null,
            calcVersion: day.calcVersion,
            builtAt: new Date(),
          },
        });
      }

      // The days' exceptions are rebuilt with them: an open one from a previous
      // import of the same day is no longer true.
      const rebuilt = writable
        .map((day) => before.get(`${day.employeeId}|${day.date}`)?.id)
        .filter((id): id is string => id !== undefined);

      await tx.attendanceException.deleteMany({
        where: { workDayId: { in: rebuilt }, status: 'open' },
      });

      await tx.attendanceException.createMany({
        data: writable.flatMap((day) => {
          const id = before.get(`${day.employeeId}|${day.date}`)?.id;
          if (id === undefined) return [];

          return day.exceptions.map((exception) => ({
            tenantId: user.tenantId,
            workDayId: id,
            code: exception.code,
            ...(exception.detail ? { detail: exception.detail } : {}),
          }));
        }),
      });

      const built = writable.length;

      // The numbers that match nobody are exceptions of their own: they belong
      // to no day, because there is no person to hang a day on.
      await tx.attendanceException.createMany({
        data: read.unknownNumbers.map((unknown) => ({
          tenantId: user.tenantId,
          code: 'UNKNOWN_EMPLOYEE' as const,
          detail: unknown.employeeNumber,
        })),
      });

      const exceptions =
        read.exceptionsByCode.reduce((sum, row) => sum + row.count, 0) + read.unknownNumbers.length;

      await tx.attendanceImport.update({
        where: { id: importId },
        data: {
          status: 'committed',
          committedAt: new Date(),
          rows: read.rows,
          matched: read.matched,
          unknown: read.unknown,
          duplicates: read.duplicates,
          daysBuilt: built,
          exceptions,
        },
      });

      await this.audit.record(tx, user, {
        action: 'attendance.imported',
        entity: 'attendanceImport',
        entityId: importId,
        summary: `${fileName}: ${read.rows} punches, ${built} days, ${exceptions} exceptions`,
        diff: [
          { field: 'period', from: '', to: `${from} → ${to}` },
          { field: 'matched', from: '', to: String(read.matched) },
          { field: 'unknown', from: '', to: String(read.unknown) },
          { field: 'duplicates', from: '', to: String(read.duplicates) },
        ],
      });

      this.#log.log(`Attendance import ${fileName}: ${built} days, ${exceptions} exceptions`);

      return { ...read, importId, daysBuilt: built, applied: true };
    });

    return report;
  }

  // --- the work --------------------------------------------------------

  async #read(
    tx: TenantClient,
    fileName: string,
    content: string,
  ): Promise<
    ImportReport & {
      parsed: {
        punches: {
          employeeNumber: string;
          employeeId?: string;
          at: Date;
          direction: 'in' | 'out' | 'unknown';
          deviceId?: string;
          duplicate: boolean;
        }[];
      };
    }
  > {
    const source = await tx.attendanceSource.findFirst({ where: { type: 'file' } });
    const mapping = readMapping(source?.mapping);
    const window = (source?.duplicateWindowSeconds ?? 120) * 1000;

    const { rows, problems } = parsePunchFile(content, mapping);

    const [employees, aliases] = await Promise.all([
      tx.employee.findMany({
        select: { id: true, employeeNumber: true, firstName: true, lastName: true },
      }),
      tx.employeeNumberAlias.findMany({ select: { alias: true, employeeId: true } }),
    ]);

    const byNumber = new Map(employees.map((row) => [row.employeeNumber, row]));
    const byAlias = new Map(aliases.map((row) => [row.alias, row.employeeId]));

    const punches = [];
    const unknownCounts = new Map<string, number>();
    let matched = 0;

    for (const row of rows) {
      const employee =
        byNumber.get(row.employeeNumber) ??
        employees.find((person) => person.id === byAlias.get(row.employeeNumber));

      if (employee) matched += 1;
      else unknownCounts.set(row.employeeNumber, (unknownCounts.get(row.employeeNumber) ?? 0) + 1);

      punches.push({
        employeeNumber: row.employeeNumber,
        ...(employee ? { employeeId: employee.id } : {}),
        at: row.at,
        direction: row.direction,
        ...(row.deviceId ? { deviceId: row.deviceId } : {}),
        duplicate: false,
      });
    }

    // Two badges by one person inside the window are one badge. The later one
    // is marked rather than dropped.
    punches.sort((a, b) => a.employeeNumber.localeCompare(b.employeeNumber) || a.at.getTime() - b.at.getTime());

    let duplicates = 0;

    for (let index = 1; index < punches.length; index += 1) {
      const previous = punches[index - 1]!;
      const current = punches[index]!;

      if (
        current.employeeNumber === previous.employeeNumber &&
        !previous.duplicate &&
        current.at.getTime() - previous.at.getTime() <= window
      ) {
        current.duplicate = true;
        duplicates += 1;
      }
    }

    const dates = punches.map((punch) => plainDate(punch.at)).sort();
    const from = dates[0];
    const to = dates[dates.length - 1];

    const unknownNumbers: UnknownNumber[] = [...unknownCounts.entries()].map(([number, count]) => {
      // "0107" is almost certainly 107 with the zeros a device pads with.
      const trimmed = number.replace(/^0+/, '');
      const looksLike = trimmed === number ? undefined : byNumber.get(trimmed);

      return {
        employeeNumber: number,
        punches: count,
        ...(looksLike
          ? {
              suggestion: {
                id: looksLike.id,
                name: `${looksLike.firstName} ${looksLike.lastName}`,
                employeeNumber: looksLike.employeeNumber,
              },
            }
          : {}),
      };
    });

    // Build the days without writing them, to count what would be raised.
    const context = from && to ? await this.builder.context(tx, to) : undefined;
    const days = context && from && to ? await this.#build(tx, { punches }, from, to, context) : [];

    const counts = new Map<ExceptionCode, number>();
    for (const day of days) {
      for (const exception of day.exceptions) {
        counts.set(exception.code, (counts.get(exception.code) ?? 0) + 1);
      }
    }

    const manualDaysKept =
      from && to
        ? await tx.workDay.count({
            where: {
              date: { gte: date(from), lte: date(to) },
              source: { in: ['manual', 'mixed'] },
            },
          })
        : 0;

    return {
      importId: '',
      fileName,
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      rows: rows.length,
      matched,
      unknown: [...unknownCounts.values()].reduce((sum, count) => sum + count, 0),
      duplicates,
      daysBuilt: days.length,
      problems,
      unknownNumbers,
      exceptionsByCode: [...counts.entries()]
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count),
      manualDaysKept,
      applied: false,
      parsed: { punches },
    };
  }

  /** Every day the file covers, for every person it mentions. */
  async #build(
    tx: TenantClient,
    parsed: {
      punches: {
        employeeId?: string;
        at: Date;
        direction: 'in' | 'out' | 'unknown';
        duplicate: boolean;
      }[];
    },
    from: string,
    to: string,
    context: Awaited<ReturnType<WorkDayBuilderService['context']>>,
  ): Promise<BuiltDay[]> {
    const byDay = new Map<string, DayPunch[]>();

    for (const punch of parsed.punches) {
      if (!punch.employeeId || punch.duplicate) continue;

      const key = `${punch.employeeId}|${plainDate(punch.at)}`;
      const list = byDay.get(key) ?? [];

      list.push({ at: punch.at, direction: punch.direction });
      byDay.set(key, list);
    }

    const ids = [...new Set(parsed.punches.map((punch) => punch.employeeId).filter(Boolean))] as string[];

    const [people, leave] = await Promise.all([
      tx.employee.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          employeeSchedules: {
            orderBy: { validFrom: 'desc' },
            take: 1,
            select: {
              weeklyRestDay: true,
              schedule: { select: { days: { select: { weekday: true, working: true } } } },
              defaultShift: {
                select: { start: true, end: true, breakMinutes: true, crossesMidnight: true },
              },
            },
          },
        },
      }),
      this.builder.leaveByDay(tx, from, to),
    ]);

    const days: BuiltDay[] = [];

    for (const person of people) {
      const rota = person.employeeSchedules[0];

      for (let day = from; day <= to; day = nextDay(day)) {
        const punches = byDay.get(`${person.id}|${day}`) ?? [];
        const weekday = new Date(`${day}T00:00:00.000Z`).getUTCDay();

        const scheduled =
          rota?.schedule.days.find((row) => row.weekday === weekday)?.working ?? false;
        const restDay = rota?.weeklyRestDay === weekday;

        // A day with nothing on it that nobody expected is not a day at all.
        if (punches.length === 0 && (!scheduled || restDay)) continue;

        const leaveId = leave.get(`${person.id}|${day}`);

        days.push(
          this.builder.build({
            employeeId: person.id,
            date: day,
            punches,
            ...(rota?.defaultShift ? { shift: rota.defaultShift } : {}),
            scheduled,
            restDay,
            ...(leaveId ? { leaveRequestId: leaveId } : {}),
            context,
          }),
        );
      }
    }

    return days;
  }

  /**
   * The file an import read, checked against the hash taken when it was read.
   *
   * The two can only disagree if the stored bytes changed after the trial, and
   * they cannot: the runtime role has no UPDATE on either column. So this is a
   * belt to the database's braces — and the one place that would notice if a
   * future migration, or a restore from a backup of a different row, quietly
   * broke that promise. Refusing is the only safe answer: the days would be
   * built from bytes nobody was shown.
   */
  #fileOf(
    row: { content: string | null; contentSha256: string | null } | null,
  ): string {
    if (row === null || row.content === null) {
      throw new BadRequestException({ kind: 'importGone', values: {} });
    }

    if (row.contentSha256 !== null && sha256(row.content) !== row.contentSha256) {
      this.#log.error('an imported file no longer matches the hash taken when it was read');
      throw new BadRequestException({ kind: 'importChanged', values: {} });
    }

    return row.content;
  }

  async #mayImport(): Promise<CurrentUser> {
    const user = await this.users.withEmployee();

    if (!this.users.may(user, 'attendance.import')) {
      throw new ForbiddenException({ kind: 'notYours', values: {} });
    }

    return user;
  }
}

/**
 * Reads a device file into punches.
 *
 * Semicolons or commas, a header in whatever case somebody typed it, and the
 * two timestamp formats the specification allows. A row it cannot read is a
 * listed problem rather than a silent omission.
 */
export function parsePunchFile(
  content: string,
  mapping: SourceMapping,
): { rows: ImportRow[]; problems: ImportProblemRow[] } {
  const lines = content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.trim() !== '');

  if (lines.length === 0) return { rows: [], problems: [] };

  const separator = (lines[0]?.includes(';') ?? false) ? ';' : ',';
  const header = (lines[0] as string).split(separator).map((cell) => cell.trim().toLowerCase());

  const at = {
    employeeNumber: header.indexOf(mapping.employeeNumber.toLowerCase()),
    timestamp: header.indexOf(mapping.timestamp.toLowerCase()),
    direction: header.indexOf(mapping.direction.toLowerCase()),
    deviceId: header.indexOf(mapping.deviceId.toLowerCase()),
  };

  const rows: ImportRow[] = [];
  const problems: ImportProblemRow[] = [];

  if (at.employeeNumber === -1 || at.timestamp === -1) {
    return {
      rows,
      problems: [{ line: 1, kind: 'noColumns', value: lines[0] as string }],
    };
  }

  for (let index = 1; index < lines.length; index += 1) {
    const cells = (lines[index] as string).split(separator).map((cell) => cell.trim());
    const line = index + 1;

    const number = cells[at.employeeNumber] ?? '';
    if (number === '') {
      problems.push({ line, kind: 'noNumber', value: lines[index] as string });
      continue;
    }

    const stamp = cells[at.timestamp] ?? '';
    const parsed = parseStamp(stamp);

    if (parsed === undefined) {
      problems.push({ line, kind: 'notATime', value: stamp });
      continue;
    }

    const raw = (at.direction === -1 ? '' : (cells[at.direction] ?? '')).toUpperCase();
    const direction = raw === 'IN' ? 'in' : raw === 'OUT' ? 'out' : 'unknown';

    rows.push({
      line,
      employeeNumber: number,
      at: parsed,
      direction,
      ...(at.deviceId === -1 ? {} : { deviceId: cells[at.deviceId] ?? '' }),
    });
  }

  return { rows, problems };
}

/**
 * The two timestamp formats the specification allows.
 *
 * Both are local time at the site, with no zone on them, which is what a device
 * writes. They are read as UTC so that the day a punch belongs to is the day
 * the device thought it was — converting to a zone here would move a 23:50
 * punch into tomorrow.
 */
export function parseStamp(value: string): Date | undefined {
  const iso = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);

  if (iso) {
    const [, year, month, day, hour, minute, second] = iso;
    return new Date(
      `${year}-${month}-${day}T${hour}:${minute}:${second ?? '00'}.000Z`,
    );
  }

  const french = /^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);

  if (french) {
    const [, day, month, year, hour, minute, second] = french;
    return new Date(
      `${year}-${month}-${day}T${hour}:${minute}:${second ?? '00'}.000Z`,
    );
  }

  return undefined;
}

/** A file's SHA-256, as hex. What it is read as is what is hashed. */
function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function date(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function nextDay(iso: string): string {
  const day = new Date(`${iso}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}
