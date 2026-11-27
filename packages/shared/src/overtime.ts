/**
 * What a worked day is worth (M10 / HR-04, build spec §5.6).
 *
 * Pure arithmetic, in one place, because four things ask it and all four have
 * to agree: the timesheet somebody reads, the exception that says a day is too
 * long, the month that closes into payroll variables, and the rebuild that
 * happens when a rate changes.
 *
 * **No rate here is law.** Which hours are night hours, what a holiday hour is
 * worth, how long a normal week is — every one of them is an effective-dated
 * row somebody enters, and every seeded row says it is waiting for SMG and the
 * payroll expert.
 *
 * The one thing this file does insist on is that **an hour is counted once**.
 * An hour worked at ten at night on a public holiday belongs to exactly one
 * overtime band, and a day that is over both the daily and the weekly threshold
 * does not pay the same hour twice.
 *
 * **Premiums are the deliberate exception, and they are kept apart.** A band
 * marked `all_hours` — a night premium, say — is paid for every minute inside
 * its window whether those minutes were ordinary or overtime, and it is paid
 * *on top of* whatever overtime band the same minute already earned. An hour of
 * overtime at eleven at night can therefore be both `OT_NIGHT` and
 * `NIGHT_PREMIUM`. They are returned in their own map rather than mixed into
 * the bands, so that "an hour belongs to one overtime band" stays true, nothing
 * that sums the bands double-counts, and the premium can be shown and paid as
 * the separate line it is.
 */

/** Minutes from midnight. 07:30 is 450. */
export type Minutes = number;

export interface OvertimeBand {
  readonly bandCode: string;
  /** Which kind of day this band applies to. */
  readonly dayType: 'working' | 'rest' | 'holiday';
  /** Local times, "21:00". A band whose end is before its start runs past midnight. */
  readonly timeFrom: string;
  readonly timeTo: string;
  readonly ratePercent: number;
  /**
   * Which minutes the band is paid for.
   *
   * `overtime` — the default, and what every band meant before this existed —
   * pays only minutes beyond the ordinary day. `all_hours` pays every minute in
   * the window, scheduled ones included, on top of any overtime band for the
   * same minute.
   *
   * Whether SMG owes a premium on scheduled night hours is open (HR-02 open
   * point 17). The default is no: there is no `all_hours` row in the seed.
   */
  readonly appliesTo?: 'overtime' | 'all_hours';
}

export interface WorkedSpan {
  /** Minutes from midnight of the day the shift started. May exceed 1440. */
  readonly from: Minutes;
  readonly to: Minutes;
}

export interface OvertimeInput {
  readonly spans: readonly WorkedSpan[];
  readonly dayType: 'working' | 'rest' | 'holiday';
  readonly bands: readonly OvertimeBand[];
  /** Minutes of ordinary time before overtime begins. A rest day has none. */
  readonly normalMinutes: number;
}

export interface OvertimeResult {
  /** Minutes inside the normal day. */
  readonly normal: number;
  /** Overtime minutes per band, keyed by band code. Only bands with minutes appear. */
  readonly bands: Record<string, number>;
  /**
   * Premium minutes per band, for bands paid on all hours.
   *
   * Deliberately not part of `bands`: these minutes are already counted there or
   * in `normal`, and this says they earn something extra as well. Summing both
   * maps would count the same minute twice.
   */
  readonly premiums: Record<string, number>;
  readonly overtimeTotal: number;
  readonly workedTotal: number;
}

/** "07:30" as minutes from midnight. */
export function toMinutes(time: string): Minutes {
  const [hour, minute] = time.split(':').map(Number) as [number, number];
  return hour * 60 + (minute || 0);
}

/** Minutes from midnight as "07:30", wrapping past a day. */
export function toTime(minutes: Minutes): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(wrapped / 60);

  return `${String(hour).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

/**
 * Splits the worked time into ordinary time and overtime bands.
 *
 * The order matters and is the point: **the first `normalMinutes` of work are
 * ordinary**, whenever they happen, and only what is left over is overtime.
 * Somebody who starts at four in the morning is not on a night rate for their
 * first two hours — they are simply at work early.
 *
 * On a rest day or a public holiday `normalMinutes` is zero, so every minute is
 * overtime and the bands decide what kind.
 *
 * Premium bands are worked out separately, over every worked minute, because
 * they are owed whether or not the minute was overtime.
 */
export function overtimeFor(input: OvertimeInput): OvertimeResult {
  const spans = [...input.spans]
    .filter((span) => span.to > span.from)
    .sort((a, b) => a.from - b.from);

  const workedTotal = spans.reduce((sum, span) => sum + (span.to - span.from), 0);

  // Only bands that pay for overtime take part in the walk below. A band left
  // without `appliesTo` is an overtime band, which is what every row meant
  // before premiums existed.
  const overtimeBands = input.bands.filter((band) => (band.appliesTo ?? 'overtime') === 'overtime');

  let ordinaryLeft = Math.max(input.normalMinutes, 0);
  const bands: Record<string, number> = {};
  let overtimeTotal = 0;

  // Minute by minute would be simple and slow; walking the spans and cutting
  // them where a band starts is the same answer and stays readable.
  for (const span of spans) {
    let at = span.from;

    while (at < span.to) {
      const band = bandAt(at, input.dayType, overtimeBands);
      const nextEdge = Math.min(span.to, nextBoundary(at, input.dayType, overtimeBands));
      const length = nextEdge - at;

      if (ordinaryLeft > 0) {
        const ordinary = Math.min(ordinaryLeft, length);
        ordinaryLeft -= ordinary;

        // The rest of this slice, if any, is overtime in the band it falls in.
        const extra = length - ordinary;
        if (extra > 0 && band) {
          bands[band.bandCode] = (bands[band.bandCode] ?? 0) + extra;
          overtimeTotal += extra;
        }
      } else if (band) {
        bands[band.bandCode] = (bands[band.bandCode] ?? 0) + length;
        overtimeTotal += length;
      }

      at = nextEdge;
    }
  }

  return {
    normal: Math.min(workedTotal, Math.max(input.normalMinutes, 0)),
    bands,
    premiums: premiumsFor(spans, input.dayType, input.bands),
    overtimeTotal,
    workedTotal,
  };
}

/**
 * Minutes owed a premium, per band.
 *
 * The same walk as above with the ordinary-hours bookkeeping taken out, which
 * is the whole difference: a premium does not care whether the minute was
 * scheduled or over, only when it was worked. A day with no `all_hours` band —
 * which is every day until SMG says otherwise — returns an empty map and
 * changes nothing.
 */
function premiumsFor(
  spans: readonly WorkedSpan[],
  dayType: OvertimeInput['dayType'],
  allBands: readonly OvertimeBand[],
): Record<string, number> {
  const bands = allBands.filter((band) => band.appliesTo === 'all_hours');
  if (bands.length === 0) return {};

  const premiums: Record<string, number> = {};

  for (const span of spans) {
    let at = span.from;

    while (at < span.to) {
      const band = bandAt(at, dayType, bands);
      const nextEdge = Math.min(span.to, nextBoundary(at, dayType, bands));

      if (band) premiums[band.bandCode] = (premiums[band.bandCode] ?? 0) + (nextEdge - at);

      at = nextEdge;
    }
  }

  return premiums;
}

/**
 * The band covering a minute of a day.
 *
 * A band whose end is before its start — 21:00 to 06:00 — runs through
 * midnight, and the minutes after midnight still belong to the day the shift
 * started on, which is why `at` may be more than 1440.
 */
export function bandAt(
  at: Minutes,
  dayType: OvertimeInput['dayType'],
  bands: readonly OvertimeBand[],
): OvertimeBand | undefined {
  const minute = ((at % 1440) + 1440) % 1440;

  return bands
    .filter((band) => band.dayType === dayType)
    .find((band) => {
      const from = toMinutes(band.timeFrom);
      const to = toMinutes(band.timeTo);

      return from <= to ? minute >= from && minute < to : minute >= from || minute < to;
    });
}

/** The next minute at which the band could change. */
function nextBoundary(
  at: Minutes,
  dayType: OvertimeInput['dayType'],
  bands: readonly OvertimeBand[],
): Minutes {
  const day = Math.floor(at / 1440) * 1440;
  const minute = at - day;

  const edges = bands
    .filter((band) => band.dayType === dayType)
    .flatMap((band) => [toMinutes(band.timeFrom), toMinutes(band.timeTo)])
    .filter((edge) => edge > minute);

  // The end of the day is always an edge: a shift that runs past midnight
  // starts a new day's worth of bands.
  return day + Math.min(...edges, 1440);
}

/**
 * Worked time, rounded the way the company says.
 *
 * "Up, to the quarter hour" is in the employee's favour and is the default; it
 * is a setting because it is a decision, not a law.
 */
export function roundMinutes(
  minutes: number,
  step: number,
  direction: 'up' | 'down' | 'nearest',
): number {
  if (step <= 1) return minutes;

  const blocks = minutes / step;
  const rounded =
    direction === 'up'
      ? Math.ceil(blocks)
      : direction === 'down'
        ? Math.floor(blocks)
        : Math.round(blocks);

  return rounded * step;
}

/**
 * The weekly threshold, without counting an hour twice.
 *
 * A week may be over the weekly limit while no single day was over the daily
 * one — six nine-hour days under a forty-four-hour week, say. What is owed is
 * the larger of the two answers, not their sum: the daily overtime already
 * paid for is taken off the weekly figure before anything more is added.
 */
export function weeklyOvertime(input: {
  readonly workedMinutes: number;
  readonly dailyOvertimeMinutes: number;
  readonly normalWeeklyMinutes: number;
}): number {
  const overWeek = input.workedMinutes - input.normalWeeklyMinutes;
  if (overWeek <= 0) return 0;

  // Whatever the days have already counted as overtime is part of that excess.
  return Math.max(overWeek - input.dailyOvertimeMinutes, 0);
}
