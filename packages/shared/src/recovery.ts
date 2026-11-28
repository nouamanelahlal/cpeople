/**
 * Time owed back instead of paid (M10 / HR-04, HR-02 open point 18).
 *
 * An hour worked on a public holiday or a rest day can be settled two ways: in
 * money, as overtime, or in time, as recovery. The company picks one per day.
 * **Never both** — that is the whole of this file, and the reason the two sides
 * are worked out here rather than in whichever screen happens to need them.
 *
 * Minutes throughout. A recovery balance is not days: four hours owed from a
 * Sunday morning is not "half a day" to somebody whose shift is twelve hours,
 * and it is spent against the scheduled hours of the day it is taken.
 *
 * **No rate here is law.** What an hour is worth in time off — one for one, or
 * the holiday rate — is open point 18, and the ratio is a setting seeded at 1.
 */

/** What a day looks like to this file: the minutes, and what they earned. */
export interface DayToConvert {
  /** Minutes actually worked on the day. */
  readonly workedMin: number;
  /** Overtime minutes per band, as the day stores them. */
  readonly overtime: Readonly<Record<string, number>>;
  /** Premium minutes per band, which are a rate on hours, not hours of their own. */
  readonly premium?: Readonly<Record<string, number>>;
}

/** What converting a day to recovery does to it. */
export interface Converted {
  /** Minutes credited to the recovery balance. */
  readonly creditedMin: number;
  /** What the day is worth in money afterwards: nothing. */
  readonly overtime: Record<string, number>;
  readonly premium: Record<string, number>;
}

/**
 * How many minutes of time off a worked day is worth.
 *
 * The minutes worked, times the ratio, rounded to the minute. Rounded **half
 * up**, which is the employee's favour and the same direction the worked-time
 * rounding already takes.
 */
export function recoveryMinutes(input: { workedMin: number; ratio: number }): number {
  if (input.workedMin <= 0 || input.ratio <= 0) return 0;

  return Math.round(input.workedMin * input.ratio);
}

/**
 * Converting a day: the credit, and the pay it replaces.
 *
 * The overtime and premium maps come back **empty**, because the company has
 * agreed to settle this day in time. Leaving a band behind here is how an hour
 * gets paid twice, and no later screen would notice: the payslip would simply
 * be bigger than it should be, every month, for everybody it happened to.
 */
export function convertToRecovery(input: {
  day: DayToConvert;
  ratio: number;
}): Converted {
  return {
    creditedMin: recoveryMinutes({ workedMin: input.day.workedMin, ratio: input.ratio }),
    overtime: {},
    premium: {},
  };
}

/**
 * Undoing it: the minutes go back into pay, and the credit is taken away.
 *
 * The pay is **not** reconstructed here — a day is rebuilt from its punches and
 * the rules in force, which is the only answer that stays true when a rate has
 * changed in between. What this returns is the movement that cancels the
 * credit, which is a new row and never an edit of the old one.
 */
export function undoRecovery(input: { creditedMin: number }): { minutes: number } {
  return { minutes: -input.creditedMin };
}

/** What undoing a conversion would do, once the time may already be spent. */
export interface UndoPlan {
  /** Minutes of this credit that have already been taken as leave. */
  readonly usedMin: number;
  /** Whether this needs HR to override, because the balance would go negative. */
  readonly blocked: boolean;
  /** The movement that cancels the credit. Always the whole of it. */
  readonly movementMin: number;
  /** What the balance becomes: below zero when some of it is spent. */
  readonly balanceAfterMin: number;
  /**
   * The worked minutes whose pay comes back.
   *
   * Less than the day where time has already been taken for it — that part is
   * settled, and paying it as well is the double payment this guards against.
   */
  readonly restoredWorkedMin: number;
}

/**
 * Undoing a conversion when some of the time is already spent.
 *
 * The simple case is somebody changing their mind the same afternoon: nothing
 * taken, the credit cancels, the overtime comes back whole. The awkward one is
 * a fortnight later, after three of the eight hours have been taken as leave —
 * and the awkward one is the one that reaches payroll.
 *
 * **It is blocked by default.** The balance would go below zero, which means
 * taking back time somebody has already had, and that is a conversation rather
 * than a button. HR can override it with a reason, and then:
 *
 *  - the credit is cancelled **in full**, so the balance goes negative by what
 *    was spent and the debt is visible on the employee's balance rather than
 *    quietly absorbed;
 *  - the overtime comes back **only for the part not already taken**. Three
 *    hours settled in time plus five paid is the eight that were worked. Paying
 *    all eight would be paying twice for the three.
 *
 * Whether a conversion should be undoable at all once the time is spent is
 * HR-02 open point 19, for SMG.
 */
export function planUndo(input: {
  creditedMin: number;
  /** The employee's balance now, across every credit they hold. */
  balanceMin: number;
  /** The day's worked minutes, which is what the pay was built from. */
  workedMin: number;
  /** The ratio this credit was made at — not today's setting. */
  ratio: number;
  /** HR has said to do it anyway, and given a reason. */
  override?: boolean;
}): UndoPlan {
  // What cannot be handed back, because the balance no longer holds it.
  const usedMin = Math.max(input.creditedMin - Math.max(input.balanceMin, 0), 0);
  const spent = Math.min(usedMin, input.creditedMin);

  // Back through the ratio: an hour of leave taken at time-and-a-half settled
  // forty minutes of work, not sixty.
  const settledWorkedMin = input.ratio > 0 ? Math.round(spent / input.ratio) : 0;

  return {
    usedMin: spent,
    blocked: spent > 0 && input.override !== true,
    movementMin: -input.creditedMin,
    balanceAfterMin: input.balanceMin - input.creditedMin,
    restoredWorkedMin: Math.max(input.workedMin - settledWorkedMin, 0),
  };
}

/**
 * What somebody has, from the movements that made it.
 *
 * A sum, deliberately: the balance is never stored, so it cannot drift from the
 * rows that explain it, and "why do I have this many hours" is answered by
 * reading them.
 */
export function recoveryBalance(movements: readonly { minutes: number }[]): number {
  return movements.reduce((total, movement) => total + movement.minutes, 0);
}

/**
 * What taking recovery leave costs, for one day.
 *
 * The scheduled hours of **that day**, not an average and not a fixed day: an
 * eight-hour day costs eight hours and a twelve-hour day costs twelve. A day
 * somebody was not scheduled to work costs nothing, which is also why recovery
 * cannot be taken on one.
 */
export function recoveryCostOfDay(input: { scheduledMin: number }): number {
  return Math.max(input.scheduledMin, 0);
}

/**
 * Spreading a total across bands, in whole minutes that actually add up.
 *
 * Scaling each band on its own and rounding loses or invents a minute: three
 * bands of a 7 h 23 min day scaled to 180 minutes round to 179. A minute is not
 * much until it is somebody's minute, at a holiday rate, every month.
 *
 * So the floors are handed out first and the remainder goes to the bands with
 * the **largest fractional parts** — the oldest apportionment rule there is,
 * and the one that keeps the total exact while staying closest to the
 * proportions. Ties break on the larger band and then on the code, so the same
 * input always gives the same answer.
 *
 * Which hours should count as already settled — proportionally, as here, or the
 * dearest first, or the cheapest — is HR-02 open point 20, for the payroll
 * expert. It is a setting waiting to happen, not a fork in the code.
 */
export function apportion(
  bands: Readonly<Record<string, number>>,
  targetMin: number,
): Record<string, number> {
  const entries = Object.entries(bands).filter(([, minutes]) => minutes > 0);
  const total = entries.reduce((sum, [, minutes]) => sum + minutes, 0);

  if (total <= 0 || targetMin <= 0) return {};
  if (targetMin >= total) return Object.fromEntries(entries);

  const shares = entries.map(([code, minutes]) => {
    const exact = (minutes * targetMin) / total;
    const whole = Math.floor(exact);

    return { code, minutes, whole, fraction: exact - whole };
  });

  let left = targetMin - shares.reduce((sum, share) => sum + share.whole, 0);

  const order = [...shares].sort(
    (a, b) => b.fraction - a.fraction || b.minutes - a.minutes || a.code.localeCompare(b.code),
  );

  for (const share of order) {
    if (left <= 0) break;
    share.whole += 1;
    left -= 1;
  }

  return Object.fromEntries(
    shares.filter((share) => share.whole > 0).map((share) => [share.code, share.whole]),
  );
}

/**
 * What a day is still worth in money after part of it was taken as time.
 *
 * Both maps are cut by the same proportion, because both were earned by the
 * same hours: a night premium on a day half settled in time is half owed. The
 * overtime lands exactly on the unsettled minutes; the premium keeps the same
 * share of itself, apportioned the same way so it also adds up.
 */
export function restoreAfterUndo(input: {
  overtime: Readonly<Record<string, number>>;
  premium?: Readonly<Record<string, number>>;
  /** Minutes of the day that are still owed in money. */
  restoredWorkedMin: number;
  /** Minutes the day was worth before any of it was settled in time. */
  workedMin: number;
}): { overtime: Record<string, number>; premium: Record<string, number> } {
  const share = input.workedMin > 0 ? input.restoredWorkedMin / input.workedMin : 0;

  const overtimeTotal = Object.values(input.overtime).reduce((sum, value) => sum + value, 0);

  // On a holiday or a rest day every minute is overtime, which is the only kind
  // of day a conversion applies to — so this target is the unsettled minutes
  // themselves. The `min` keeps it honest on any other shape of day.
  const overtimeTarget = Math.min(input.restoredWorkedMin, overtimeTotal);

  const premiumTotal = Object.values(input.premium ?? {}).reduce((sum, value) => sum + value, 0);

  return {
    overtime: apportion(input.overtime, overtimeTarget),
    premium: apportion(input.premium ?? {}, Math.round(premiumTotal * share)),
  };
}
