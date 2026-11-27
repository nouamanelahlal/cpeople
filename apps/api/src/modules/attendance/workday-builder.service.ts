import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { TenantClient } from '@cpeople/db';
import {
  BLOCKING_STATUSES,
  overtimeFor,
  roundMinutes,
  toMinutes,
  type OvertimeBand,
} from '@cpeople/shared';
import { plainDate } from '../../common/time/clock.js';

/**
 * Turning punches into days (M10 / HR-04, build spec §5.3 step 4).
 *
 * A day is **derived**, never typed: pair the punches, take the break the shift
 * says, round the way the company says, and ask the overtime rules what the
 * rest is worth. That is why a day can be rebuilt when a rate changes, and why
 * it keeps the version of the rules it was built with — the same promise a
 * leave calculation makes.
 *
 * What it refuses to do is guess. A badge in with no badge out is not a
 * forgotten eight-hour day; it is an exception with somebody's name on it.
 */
export const EXCEPTION_CODES = [
  'UNKNOWN_EMPLOYEE',
  'MISSING_IN',
  'MISSING_OUT',
  'DUPLICATE',
  'NO_SCHEDULE',
  'ABSENT_NO_LEAVE',
  'WORKED_ON_LEAVE',
  'WORKED_REST_DAY',
  'WORKED_HOLIDAY',
  'OVER_DAILY_MAX',
  'OVER_WEEKLY_MAX',
] as const;

export type ExceptionCode = (typeof EXCEPTION_CODES)[number];

export interface BuiltDay {
  readonly employeeId: string;
  readonly date: string;
  readonly scheduledMin: number;
  readonly workedMin: number;
  readonly breakMin: number;
  readonly lateMin: number;
  readonly earlyLeaveMin: number;
  readonly overtime: Record<string, number>;
  /** Minutes owed a premium, per band. Empty until a band is paid on all hours. */
  readonly premium: Record<string, number>;
  /** The overtime rule rows this day was built against. */
  readonly overtimeRuleIds: string[];
  readonly exceptions: { code: ExceptionCode; detail?: string }[];
  readonly leaveRequestId?: string;
  readonly calcVersion: string;
}

export interface DayPunch {
  readonly at: Date;
  readonly direction: 'in' | 'out' | 'unknown';
}

/** Everything the builder needs to know that is not a punch. */
export interface BuildContext {
  readonly bands: OvertimeBand[];
  readonly settings: {
    normalDailyMinutes: number;
    normalWeeklyMinutes: number;
    roundingMinutes: number;
    roundingDirection: 'up' | 'down' | 'nearest';
    latenessToleranceMin: number;
    dailyMaxMinutes: number;
  };
  /** Public holidays in the period, as plain dates. */
  readonly holidays: ReadonlySet<string>;
  readonly calcVersion: string;
  /** The ids of the rule rows in force, so a day can name them. */
  readonly ruleIds: string[];
}

@Injectable()
export class WorkDayBuilderService {
  /** Everything the builder needs, read once for a whole import. */
  async context(tx: TenantClient, asAt: string): Promise<BuildContext> {
    const [rules, settings, holidays] = await Promise.all([
      tx.overtimeRule.findMany({
        where: {
          effectiveFrom: { lte: date(asAt) },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: date(asAt) } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      }),
      tx.overtimeSettings.findFirst(),
      tx.publicHoliday.findMany({ select: { date: true } }),
    ]);

    const bands: OvertimeBand[] = rules.map((rule) => ({
      bandCode: rule.bandCode,
      dayType: rule.dayType as 'working' | 'rest' | 'holiday',
      timeFrom: rule.timeFrom,
      timeTo: rule.timeTo,
      ratePercent: Number(rule.ratePercent),
      appliesTo: rule.appliesTo as 'overtime' | 'all_hours',
    }));

    return {
      bands,
      settings: {
        normalDailyMinutes: Number(settings?.normalDailyHours ?? 8) * 60,
        normalWeeklyMinutes: Number(settings?.normalWeeklyHours ?? 44) * 60,
        roundingMinutes: settings?.roundingMinutes ?? 15,
        roundingDirection: (settings?.roundingDirection ?? 'up') as 'up' | 'down' | 'nearest',
        latenessToleranceMin: settings?.latenessToleranceMin ?? 10,
        dailyMaxMinutes: Number(settings?.dailyMaxHours ?? 12) * 60,
      },
      holidays: new Set(holidays.map((row) => plainDate(row.date))),
      // What this day was built with: a fingerprint of the rules themselves,
      // not of when they were last touched.
      //
      // Counting rows and taking the newest timestamp would catch most changes
      // and collide on the rest — two different rule sets could share a version
      // and a day would claim to have been built from rules it never saw. A
      // hash over the rows and the settings cannot: any add, change or removal
      // gives a different answer, and the same rules always give the same one.
      calcVersion: fingerprint(rules, settings),
      ruleIds: rules.map((rule) => rule.id).sort(),
    };
  }

  /**
   * One person, one day.
   *
   * `punches` are that day's, already deduplicated and in order. The shift and
   * the rota say what was expected; the punches say what happened; the
   * difference is the exceptions.
   */
  build(input: {
    employeeId: string;
    date: string;
    punches: readonly DayPunch[];
    shift?: { start: string; end: string; breakMinutes: number; crossesMidnight: boolean };
    scheduled: boolean;
    restDay: boolean;
    leaveRequestId?: string;
    context: BuildContext;
  }): BuiltDay {
    const { context } = input;
    const exceptions: { code: ExceptionCode; detail?: string }[] = [];

    const holiday = context.holidays.has(input.date);
    const dayType: 'working' | 'rest' | 'holiday' = holiday
      ? 'holiday'
      : input.restDay || !input.scheduled
        ? 'rest'
        : 'working';

    // Nothing at all, on a day somebody was expected: either leave explains it
    // or nothing does.
    if (input.punches.length === 0) {
      if (input.scheduled && !input.restDay && !holiday && input.leaveRequestId === undefined) {
        exceptions.push({ code: 'ABSENT_NO_LEAVE' });
      }

      return {
        employeeId: input.employeeId,
        date: input.date,
        scheduledMin: input.scheduled ? shiftMinutes(input.shift) : 0,
        workedMin: 0,
        breakMin: 0,
        lateMin: 0,
        earlyLeaveMin: 0,
        overtime: {},
        premium: {},
        overtimeRuleIds: context.ruleIds,
        exceptions,
        ...(input.leaveRequestId ? { leaveRequestId: input.leaveRequestId } : {}),
        calcVersion: context.calcVersion,
      };
    }

    // Somebody was here on a day they should not have been.
    if (holiday) exceptions.push({ code: 'WORKED_HOLIDAY' });
    else if (input.restDay) exceptions.push({ code: 'WORKED_REST_DAY' });

    if (input.leaveRequestId !== undefined) exceptions.push({ code: 'WORKED_ON_LEAVE' });
    if (!input.scheduled && !holiday && !input.restDay) exceptions.push({ code: 'NO_SCHEDULE' });

    const { spans, missing } = pair(input.punches, input.date);
    for (const code of missing) exceptions.push({ code });

    const raw = spans.reduce((sum, span) => sum + (span.to - span.from), 0);
    const breakMin = spans.length > 0 ? (input.shift?.breakMinutes ?? 0) : 0;

    const worked = roundMinutes(
      Math.max(raw - breakMin, 0),
      context.settings.roundingMinutes,
      context.settings.roundingDirection,
    );

    // Lateness and leaving early, against the shift, with the tolerance the
    // company allows. Only where there is a shift to be late for.
    let lateMin = 0;
    let earlyLeaveMin = 0;

    if (input.shift && spans.length > 0) {
      const first = spans[0]!.from;
      const last = spans[spans.length - 1]!.to;
      const start = toMinutes(input.shift.start);
      const end = toMinutes(input.shift.end) + (input.shift.crossesMidnight ? 1440 : 0);

      lateMin = Math.max(first - start - context.settings.latenessToleranceMin, 0);
      earlyLeaveMin = Math.max(end - last, 0);
    }

    // Overtime: on a working day the ordinary hours come first, whenever they
    // happen; on a rest day or a holiday every minute is overtime.
    const normalMinutes =
      dayType === 'working' ? Math.min(context.settings.normalDailyMinutes, worked) : 0;

    const overtime = overtimeFor({
      spans: spans.map((span) => ({ from: span.from, to: span.to })),
      dayType,
      bands: context.bands,
      normalMinutes: normalMinutes + breakMin,
    });

    if (worked > context.settings.dailyMaxMinutes) {
      exceptions.push({
        code: 'OVER_DAILY_MAX',
        detail: `${(worked / 60).toFixed(1)} h`,
      });
    }

    return {
      employeeId: input.employeeId,
      date: input.date,
      scheduledMin: input.scheduled ? shiftMinutes(input.shift) : 0,
      workedMin: worked,
      breakMin,
      lateMin,
      earlyLeaveMin,
      overtime: overtime.bands,
      premium: overtime.premiums,
      overtimeRuleIds: context.ruleIds,
      exceptions,
      ...(input.leaveRequestId ? { leaveRequestId: input.leaveRequestId } : {}),
      calcVersion: context.calcVersion,
    };
  }

  /** Who was on approved leave on which day, for a whole period at once. */
  async leaveByDay(
    tx: TenantClient,
    from: string,
    to: string,
  ): Promise<Map<string, string>> {
    const requests = await tx.leaveRequest.findMany({
      where: {
        status: { in: [...BLOCKING_STATUSES] },
        startDate: { lte: date(to) },
        endDate: { gte: date(from) },
      },
      select: { id: true, employeeId: true, startDate: true, endDate: true },
    });

    const map = new Map<string, string>();

    for (const request of requests) {
      let day = plainDate(request.startDate);
      const last = plainDate(request.endDate);

      while (day <= last) {
        map.set(`${request.employeeId}|${day}`, request.id);
        day = nextDay(day);
      }
    }

    return map;
  }
}

/**
 * Pairs a day's punches into worked spans.
 *
 * Where the device said which way somebody was going, that is believed. Where
 * it did not, they are paired in order: in, out, in, out. An odd one out is an
 * exception rather than a guess — the spec is explicit that a missing punch is
 * somebody's to fix, not the software's to invent.
 */
export function pair(
  punches: readonly DayPunch[],
  date: string,
): { spans: { from: number; to: number }[]; missing: ExceptionCode[] } {
  const sorted = [...punches].sort((a, b) => a.at.getTime() - b.at.getTime());
  const spans: { from: number; to: number }[] = [];
  const missing: ExceptionCode[] = [];

  const midnight = new Date(`${date}T00:00:00.000Z`).getTime();
  const minutes = (at: Date): number => Math.round((at.getTime() - midnight) / 60_000);

  let open: number | undefined;

  for (const punch of sorted) {
    const at = minutes(punch.at);

    if (punch.direction === 'out') {
      if (open === undefined) {
        // An out with nothing before it: somebody came in yesterday, or the
        // in was never recorded.
        missing.push('MISSING_IN');
        continue;
      }

      spans.push({ from: open, to: at });
      open = undefined;
      continue;
    }

    if (punch.direction === 'in') {
      if (open !== undefined) {
        // Two ins in a row: the out between them is missing.
        missing.push('MISSING_OUT');
      }

      open = at;
      continue;
    }

    // The device said nothing: alternate.
    if (open === undefined) open = at;
    else {
      spans.push({ from: open, to: at });
      open = undefined;
    }
  }

  if (open !== undefined) missing.push('MISSING_OUT');

  return { spans, missing };
}

/** How long a shift is, break included. */
function shiftMinutes(
  shift?: { start: string; end: string; breakMinutes: number; crossesMidnight: boolean },
): number {
  if (!shift) return 0;

  const start = toMinutes(shift.start);
  const end = toMinutes(shift.end) + (shift.crossesMidnight ? 1440 : 0);

  return Math.max(end - start - shift.breakMinutes, 0);
}

/**
 * A fingerprint of the rules a day was worked out from.
 *
 * Everything that changes the answer goes in, which is why the settings are
 * here in full rather than the four that are most obviously about overtime: the
 * normal day and the normal week decide what *counts* as overtime at all, so a
 * company moving from a 44-hour week to a 40-hour one must not leave days
 * claiming the version they had before.
 *
 * Sorted by id, so the same set of rules always hashes the same way whatever
 * order the database returned them in.
 */
export function fingerprint(
  rules: readonly {
    id: string;
    bandCode: string;
    dayType: string;
    timeFrom: string;
    timeTo: string;
    ratePercent: unknown;
    appliesTo: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
  }[],
  settings: Record<string, unknown> | null,
): string {
  const material = JSON.stringify({
    rules: [...rules]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((rule) => [
        rule.id,
        rule.bandCode,
        rule.dayType,
        rule.timeFrom,
        rule.timeTo,
        String(rule.ratePercent),
        rule.appliesTo,
        plainDate(rule.effectiveFrom),
        rule.effectiveTo === null ? null : plainDate(rule.effectiveTo),
      ]),
    settings:
      settings === null
        ? null
        : {
            thresholdMode: settings['thresholdMode'],
            normalDailyHours: String(settings['normalDailyHours']),
            normalWeeklyHours: String(settings['normalWeeklyHours']),
            roundingMinutes: settings['roundingMinutes'],
            roundingDirection: settings['roundingDirection'],
            latenessToleranceMin: settings['latenessToleranceMin'],
            dailyMaxHours: String(settings['dailyMaxHours']),
          },
  });

  return `ot:${createHash('sha256').update(material, 'utf8').digest('hex')}`;
}

function date(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

function nextDay(iso: string): string {
  const day = new Date(`${iso}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10);
}
