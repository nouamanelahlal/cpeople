import { Injectable } from '@nestjs/common';
import { isPending } from '@cpeople/shared';
import { CurrentUserService } from '../../common/access/current-user.service.js';
import { employeeScope, visibleEmployeeIds } from '../../common/access/visible-employees.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { TenantSettingsService } from '../../common/settings/tenant-settings.service.js';
import { demoToday, plainDate } from '../../common/time/clock.js';
import { date } from './leave-calendar.service.js';

/**
 * The month, as a grid (HR-02 build spec §4.3).
 *
 * One row per person, one column per day. What each cell has to carry is
 * decided by what somebody reading it needs to know, in this order:
 *
 *  - **who is away**, which is the point of the screen;
 *  - **whether it is settled**, because a pending request is a plan and an
 *    approved one is a fact — drawn hatched rather than solid, and carrying a
 *    letter either way so that colour is never the only difference;
 *  - **which kind of leave**, but only where the company has said colleagues
 *    may see it. An employee looking at the team's month sees that Nadia is
 *    away; they do not see that it is sick leave.
 *
 * Rest days and public holidays are shaded, because "nobody is in on Sunday" is
 * not an absence and a calendar that counted it as one would be lying twice.
 */
export interface CalendarCell {
  /** The letter drawn in the cell: the leave type's initial, or "·". */
  readonly letter: string;
  readonly code?: string;
  readonly pending: boolean;
  readonly half: boolean;
  readonly requestId: string;
}

export interface CalendarRow {
  readonly employee: { id: string; name: string; number: string; department: string };
  /** Keyed by day, "2026-11-24". */
  readonly days: Record<string, CalendarCell>;
}

export interface CalendarMonth {
  readonly month: string;
  readonly days: { date: string; weekday: number; holiday?: string; rest: boolean }[];
  readonly rows: CalendarRow[];
  readonly departments: { code: string; name: string }[];
  /** True when the reader is being shown the kind of leave, not only that there is some. */
  readonly showsType: boolean;
  readonly today: string;
  readonly total: number;
}

@Injectable()
export class LeaveCalendarViewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: CurrentUserService,
    private readonly settings: TenantSettingsService,
  ) {}

  async month(input: { month?: string; department?: string }): Promise<CalendarMonth> {
    const user = await this.users.withEmployee();
    const today = demoToday();
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(input.month ?? '')
      ? (input.month as string)
      : today.slice(0, 7);

    const [first, last] = bounds(month);

    return this.prisma.forTenant(user.tenantId, async (tx) => {
      const visible = await visibleEmployeeIds(tx, user);
      const settings = await this.settings.read(tx);

      // The reader always sees the kind of their own leave; whether they see
      // anybody else's is the company's decision.
      const showsType =
        settings.showLeaveTypeToColleagues || this.users.may(user, 'leave.manage.all');

      const where = {
        ...employeeScope(visible),
        status: { in: ['active' as const, 'onboarding' as const] },
        ...(input.department ? { department: { code: input.department } } : {}),
      };

      const [people, total, holidays, departments] = await Promise.all([
        tx.employee.findMany({
          where,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeNumber: true,
            siteId: true,
            department: { select: { name: true } },
          },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          take: 60,
        }),
        tx.employee.count({ where }),
        tx.publicHoliday.findMany({
          where: { date: { gte: date(first), lte: date(last) } },
          select: { date: true, name: true },
        }),
        tx.department.findMany({ select: { code: true, name: true }, orderBy: { name: 'asc' } }),
      ]);

      const ids = people.map((person) => person.id);

      const requests = await tx.leaveRequest.findMany({
        where: {
          employeeId: { in: ids },
          status: { in: ['approved', 'cancellation_pending', 'pending_n1', 'pending_n2', 'pending_hr'] },
          startDate: { lte: date(last) },
          endDate: { gte: date(first) },
        },
        include: {
          leaveType: { select: { code: true } },
          calculations: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { startDate: 'asc' },
      });

      // The working week of each site, to shade the rest days. One query for
      // the lot rather than one per person.
      const weeks = await tx.siteWorkWeek.findMany({
        where: { effectiveFrom: { lte: date(last) } },
        orderBy: { effectiveFrom: 'desc' },
      });

      const weekBySite = new Map<string, number[]>();
      for (const week of weeks) {
        if (!weekBySite.has(week.siteId)) weekBySite.set(week.siteId, week.workingDays);
      }

      const holidayOn = new Map(holidays.map((row) => [plainDate(row.date), row.name]));

      const days: CalendarMonth['days'] = [];
      for (let day = first; day <= last; day = next(day)) {
        const name = holidayOn.get(day);

        days.push({
          date: day,
          weekday: weekday(day),
          ...(name ? { holiday: name } : {}),
          // Shaded where nobody works it — read from the sites, so an outlet
          // that trades on Saturday is not shaded with the head office.
          rest: [...weekBySite.values()].every((working) => !working.includes(weekday(day))),
        });
      }

      const rows = people.map((person) => {
        const cells: Record<string, CalendarCell> = {};

        for (const request of requests.filter((row) => row.employeeId === person.id)) {
          const stored = request.calculations[0];
          const detail = Array.isArray(stored?.days)
            ? (stored.days as unknown as { date: string; days: number }[])
            : [];

          for (const day of days) {
            const inSpan =
              plainDate(request.startDate) <= day.date && day.date <= plainDate(request.endDate);
            if (!inSpan) continue;

            const counted = detail.find((row) => row.date === day.date);
            if (detail.length > 0 && (counted === undefined || counted.days === 0)) continue;

            cells[day.date] = {
              // A letter, never colour alone: a calendar that only differed by
              // hue is unreadable to one man in twelve.
              letter: showsType ? request.leaveType.code.charAt(0) : '•',
              ...(showsType ? { code: request.leaveType.code } : {}),
              pending: isPending(request.status),
              half: (counted?.days ?? 1) === 0.5,
              requestId: request.id,
            };
          }
        }

        return {
          employee: {
            id: person.id,
            name: `${person.firstName} ${person.lastName}`,
            number: person.employeeNumber,
            department: person.department?.name ?? '',
          },
          days: cells,
        };
      });

      return { month, days, rows, departments, showsType, today, total };
    });
  }
}

/** The first and last day of a month. */
function bounds(month: string): [string, string] {
  const [year, index] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(year, index, 0)).getUTCDate();

  return [`${month}-01`, `${month}-${String(last).padStart(2, '0')}`];
}

function next(iso: string): string {
  const day = new Date(`${iso}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}

function weekday(iso: string): number {
  return new Date(`${iso}T00:00:00.000Z`).getUTCDay();
}
