import { addDays } from './documents.js';

/**
 * How many days a leave request actually costs (M08 / HR-04).
 *
 * One rule, in one place, because five things ask it: the request form while
 * somebody is still typing, the balance that is checked before it is sent, the
 * approver's screen, the balance once it is approved, and the days handed to
 * payroll. If any two of those disagreed, nobody would trust the number — and
 * the number is somebody's pay.
 *
 * Three things decide it, and all three are data rather than law written into
 * code:
 *
 *  - **the working week**, which belongs to the site: an outlet that trades on
 *    Saturday counts Saturday, the head office does not;
 *  - **the public holidays**, which are entered and never calculated, because
 *    several Moroccan holidays move with the lunar calendar;
 *  - **the leave type's basis**: annual leave is counted in working days, while
 *    maternity leave in most agreements runs in calendar days and does not stop
 *    for a weekend.
 *
 * Half-days attach to the first and the last day of a request. A single day can
 * be half: a morning off is 0.5, which is why the count is a number with a
 * fraction and not an integer.
 */
export type DayBasis = 'working' | 'calendar';

/** Which part of the first or last day is taken. */
export type DayPart = 'full' | 'morning' | 'afternoon';

export interface LeaveSpan {
  /** Plain dates, "2026-12-07". The first day is never after the last. */
  readonly from: string;
  readonly to: string;
  readonly firstDayPart?: DayPart;
  readonly lastDayPart?: DayPart;
}

export interface LeaveCalendar {
  /** Days this person's site works: 0 is Sunday, 6 is Saturday. */
  readonly workingDays: readonly number[];
  /** Public holidays as plain dates. A Set is faster and reads the same. */
  readonly holidays: ReadonlySet<string> | readonly string[];
  readonly dayBasis: DayBasis;
}

/** One day of a request, and what it is worth. */
export interface LeaveDay {
  readonly date: string;
  readonly part: DayPart;
  /** 1, 0.5, or 0 for a day that does not count at all. */
  readonly days: number;
  readonly reason?: 'weekend' | 'holiday';
}

/** The most days a single request may span, as a guard against a typo. */
export const MAX_SPAN_DAYS = 400;

/**
 * Every day of the span, with what each one costs.
 *
 * The caller gets the detail rather than only a total, because the screens show
 * it: "7 December to 11 December, 4.5 days — 9 December is a public holiday" is
 * an answer somebody can check, and "4.5" alone is one they have to trust.
 */
export function leaveDaysDetail(span: LeaveSpan, calendar: LeaveCalendar): LeaveDay[] {
  if (!isPlainDate(span.from) || !isPlainDate(span.to) || span.to < span.from) {
    return [];
  }

  const holidays = calendar.holidays instanceof Set ? calendar.holidays : new Set(calendar.holidays);
  const working = new Set(calendar.workingDays);
  const days: LeaveDay[] = [];

  for (let date = span.from; date <= span.to && days.length < MAX_SPAN_DAYS; date = addDays(date, 1)) {
    const first = date === span.from;
    const last = date === span.to;

    const part: DayPart = first
      ? (span.firstDayPart ?? 'full')
      : last
        ? (span.lastDayPart ?? 'full')
        : 'full';

    // A calendar-day type counts everything; a working-day type skips the days
    // this person would not have worked anyway.
    if (calendar.dayBasis === 'working') {
      if (holidays.has(date)) {
        days.push({ date, part: 'full', days: 0, reason: 'holiday' });
        continue;
      }

      if (!working.has(weekday(date))) {
        days.push({ date, part: 'full', days: 0, reason: 'weekend' });
        continue;
      }
    }

    days.push({ date, part, days: part === 'full' ? 1 : 0.5 });
  }

  return days;
}

/** The total, which is what a balance moves by. */
export function leaveDays(span: LeaveSpan, calendar: LeaveCalendar): number {
  const total = leaveDaysDetail(span, calendar).reduce((sum, day) => sum + day.days, 0);

  // Halves only: 2.5 is a real answer, 2.4999999 is a floating-point artefact.
  return Math.round(total * 2) / 2;
}

/**
 * Whether a half-day marker makes sense on this span.
 *
 * A single day may be a morning or an afternoon. Across several days only the
 * ends can be half: "the afternoon of the 10th to the morning of the 12th" is a
 * sentence; "the morning of every day" is a different request.
 */
export function halfDayAllowed(span: Pick<LeaveSpan, 'from' | 'to'>, which: 'first' | 'last'): boolean {
  if (span.from === span.to) {
    // On one day the two markers are the same marker, so only the first is used.
    return which === 'first';
  }

  return true;
}

/** Days as a person writes them: 1, 2.5, 0.5. */
export function formatLeaveDays(days: number, locale: 'en' | 'fr'): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    maximumFractionDigits: 1,
  }).format(days);
}

/** 0 for Sunday through 6 for Saturday, read as a plain day with no timezone. */
export function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function isPlainDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
