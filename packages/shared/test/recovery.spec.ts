import { describe, expect, it } from 'vitest';
import {
  apportion,
  convertToRecovery,
  recoveryBalance,
  recoveryCostOfDay,
  planUndo,
  recoveryMinutes,
  restoreAfterUndo,
  undoRecovery,
} from '../src/recovery.js';

/**
 * Time owed back instead of paid (HR-02 open point 18).
 *
 * The rule these tests exist for is **no double payment**, in both directions:
 * a day settled in time stops being worth money, and undoing that puts the
 * money back. It is the one place in attendance where a mistake quietly doubles
 * somebody's day, and neither direction is visible on a payslip until the
 * payslip is wrong.
 *
 * The ratio is a seeded setting, not a law (open point 18). 1.5 appears below
 * because it is the answer SMG might give, not because anybody has said so.
 */
describe('what a worked holiday is worth in time off', () => {
  it('gives an hour for an hour at the default ratio', () => {
    expect(recoveryMinutes({ workedMin: 8 * 60, ratio: 1 })).toBe(480);
  });

  it('gives the holiday rate where the company gives one', () => {
    // If SMG answers open point 18 with "the holiday rate", eight hours worked
    // become twelve owed. The same setting, a different number, no code change.
    expect(recoveryMinutes({ workedMin: 8 * 60, ratio: 1.5 })).toBe(720);
  });

  it('rounds to the minute, in the employee’s favour', () => {
    // 90 minutes at 1.5 is 135 exactly; 91 at 1.5 is 136.5, which rounds up.
    expect(recoveryMinutes({ workedMin: 90, ratio: 1.5 })).toBe(135);
    expect(recoveryMinutes({ workedMin: 91, ratio: 1.5 })).toBe(137);
  });

  it('owes nothing for a day nobody worked', () => {
    expect(recoveryMinutes({ workedMin: 0, ratio: 1.5 })).toBe(0);
    expect(recoveryMinutes({ workedMin: -60, ratio: 1 })).toBe(0);
  });
});

describe('no double payment — converting to recovery', () => {
  const holiday = {
    workedMin: 8 * 60,
    // A holiday pays every minute, so the whole day sits in a band.
    overtime: { OT_REST_DAY: 8 * 60 },
    premium: { NIGHT_PREMIUM: 60 },
  };

  it('credits the time and leaves nothing to pay', () => {
    const answer = convertToRecovery({ day: holiday, ratio: 1 });

    expect(answer.creditedMin).toBe(480);

    // The point of the whole exercise: the day is worth no money afterwards.
    expect(answer.overtime).toEqual({});
    expect(answer.premium).toEqual({});
  });

  it('clears the pay whatever the ratio is', () => {
    // A generous ratio does not leave the overtime behind as well. The two are
    // alternatives, and "more time off" is not "time off and the money too".
    const answer = convertToRecovery({ day: holiday, ratio: 1.5 });

    expect(answer.creditedMin).toBe(720);
    expect(answer.overtime).toEqual({});
    expect(answer.premium).toEqual({});
  });

  it('clears a premium even on a day with no overtime band', () => {
    const scheduled = { workedMin: 6 * 60, overtime: {}, premium: { NIGHT_PREMIUM: 120 } };
    const answer = convertToRecovery({ day: scheduled, ratio: 1 });

    expect(answer.creditedMin).toBe(360);
    expect(answer.premium).toEqual({});
  });
});

describe('no double payment — undoing it', () => {
  it('cancels the credit with a movement, not an edit', () => {
    // The first row stays exactly where it is. The balance changes because a
    // second row says so, which is what makes the history readable afterwards.
    const credited = convertToRecovery({ day: { workedMin: 480, overtime: {} }, ratio: 1 });
    const undone = undoRecovery({ creditedMin: credited.creditedMin });

    expect(undone.minutes).toBe(-480);
    expect(recoveryBalance([{ minutes: credited.creditedMin }, undone])).toBe(0);
  });

  it('cancels exactly what was credited, not what today’s ratio would give', () => {
    // The ratio may have changed since. Undoing must reverse the row that
    // exists, or the balance drifts by the difference every time somebody
    // changes their mind after a settings change.
    const credited = convertToRecovery({ day: { workedMin: 480, overtime: {} }, ratio: 1.5 });
    const undone = undoRecovery({ creditedMin: credited.creditedMin });

    expect(credited.creditedMin).toBe(720);
    expect(undone.minutes).toBe(-720);
    expect(recoveryBalance([{ minutes: credited.creditedMin }, undone])).toBe(0);
  });
});

describe('the balance, and what spending it costs', () => {
  it('is the sum of the movements and nothing else', () => {
    const balance = recoveryBalance([
      { minutes: 480 },
      { minutes: 240 },
      { minutes: -480 },
      { minutes: 90 },
    ]);

    expect(balance).toBe(330);
  });

  it('is zero when nothing has happened', () => {
    expect(recoveryBalance([])).toBe(0);
  });

  it('costs the scheduled hours of the day it is taken', () => {
    // Not an average, and not a fixed day: a twelve-hour shift costs twelve.
    expect(recoveryCostOfDay({ scheduledMin: 8 * 60 })).toBe(480);
    expect(recoveryCostOfDay({ scheduledMin: 12 * 60 })).toBe(720);
  });

  it('costs nothing on a day nobody was scheduled', () => {
    // Which is also why recovery cannot be taken on one: there is nothing to
    // be absent from.
    expect(recoveryCostOfDay({ scheduledMin: 0 })).toBe(0);
  });
});

describe('undoing a conversion after some of the time is spent', () => {
  // The simple case is somebody changing their mind the same afternoon. The
  // awkward one is a fortnight later, when three of the eight hours have
  // already been taken as leave — and the awkward one is the one that reaches
  // payroll. Whether it should be possible at all is open point 19.
  const EIGHT = 8 * 60;

  it('is not blocked when none of it has been taken', () => {
    const plan = planUndo({ creditedMin: EIGHT, balanceMin: EIGHT, workedMin: EIGHT, ratio: 1 });

    expect(plan.blocked).toBe(false);
    expect(plan.usedMin).toBe(0);
    expect(plan.movementMin).toBe(-EIGHT);
    expect(plan.balanceAfterMin).toBe(0);
    // Nothing was settled in time, so the whole day comes back as pay.
    expect(plan.restoredWorkedMin).toBe(EIGHT);
  });

  it('is blocked by default once part of it has been taken, and says how much', () => {
    // 480 credited, 300 taken, 180 left. Taking back time somebody has already
    // had is a conversation, not a button.
    const plan = planUndo({ creditedMin: EIGHT, balanceMin: 180, workedMin: EIGHT, ratio: 1 });

    expect(plan.blocked).toBe(true);
    expect(plan.usedMin).toBe(300);
  });

  it('with HR’s override, cancels in full and pays only what was not taken', () => {
    const plan = planUndo({
      creditedMin: EIGHT,
      balanceMin: 180,
      workedMin: EIGHT,
      ratio: 1,
      override: true,
    });

    expect(plan.blocked).toBe(false);

    // The credit goes in full, so the debt is visible rather than absorbed.
    expect(plan.movementMin).toBe(-EIGHT);
    expect(plan.balanceAfterMin).toBe(-300);

    // And the pay comes back only for the part not already settled in time:
    // three hours taken plus five paid is the eight that were worked.
    expect(plan.restoredWorkedMin).toBe(180);
  });

  it('pays nothing back when the whole credit has been taken', () => {
    const plan = planUndo({
      creditedMin: EIGHT,
      balanceMin: 0,
      workedMin: EIGHT,
      ratio: 1,
      override: true,
    });

    expect(plan.usedMin).toBe(EIGHT);
    expect(plan.balanceAfterMin).toBe(-EIGHT);
    // Every minute was settled in time. Paying any of it would be paying twice.
    expect(plan.restoredWorkedMin).toBe(0);
  });

  it('converts what was spent back through the ratio it was earned at', () => {
    // At time-and-a-half, 720 minutes were credited for 480 worked. An hour of
    // leave taken settles forty minutes of work, not sixty — so 360 minutes
    // taken settles 240 worked, and 240 worked minutes are still owed in pay.
    const plan = planUndo({
      creditedMin: 720,
      balanceMin: 360,
      workedMin: 480,
      ratio: 1.5,
      override: true,
    });

    expect(plan.usedMin).toBe(360);
    expect(plan.restoredWorkedMin).toBe(240);
    expect(plan.balanceAfterMin).toBe(-360);
  });

  it('treats a balance already below zero as nothing left to hand back', () => {
    const plan = planUndo({
      creditedMin: EIGHT,
      balanceMin: -60,
      workedMin: EIGHT,
      ratio: 1,
      override: true,
    });

    expect(plan.usedMin).toBe(EIGHT);
    expect(plan.restoredWorkedMin).toBe(0);
    expect(plan.balanceAfterMin).toBe(-540);
  });
});

describe('restoring pay in whole minutes that add up', () => {
  // Scaling each band on its own and rounding loses or invents a minute. A
  // minute is not much until it is somebody's minute, at a holiday rate, every
  // month — so the restored bands have to total the unsettled minutes exactly.

  it('spreads an awkward total without losing a minute', () => {
    // 7 h 23 min worked (443), of which 180 are still owed in money.
    // The exact shares are 81.264, 58.104 and 40.632 — the floors come to 179,
    // and the spare minute goes to the largest fraction, which is OT_DAY.
    const bands = { OT_REST_DAY: 200, OT_REST_NIGHT: 143, OT_DAY: 100 };
    const out = apportion(bands, 180);

    expect(out).toEqual({ OT_REST_DAY: 81, OT_REST_NIGHT: 58, OT_DAY: 41 });
    expect(Object.values(out).reduce((a, b) => a + b, 0)).toBe(180);
  });

  it('adds up exactly whatever the split and whatever the target', () => {
    // The property that matters, over every awkward target of a 443-minute day.
    const bands = { A: 200, B: 143, C: 100 };

    for (let target = 1; target <= 443; target += 1) {
      const out = apportion(bands, target);
      const total = Object.values(out).reduce((a, b) => a + b, 0);

      expect(total, `target ${target}`).toBe(target);
    }
  });

  it('gives the same answer every time, ties and all', () => {
    // Two identical bands: the tie breaks on the code, so the answer does not
    // wander between runs.
    const once = apportion({ B_BAND: 50, A_BAND: 50 }, 75);
    const twice = apportion({ A_BAND: 50, B_BAND: 50 }, 75);

    expect(once).toEqual(twice);
    expect(Object.values(once).reduce((a, b) => a + b, 0)).toBe(75);
  });

  it('gives everything back when nothing was settled, and nothing when all was', () => {
    const bands = { OT_REST_DAY: 200, OT_DAY: 100 };

    expect(apportion(bands, 300)).toEqual(bands);
    expect(apportion(bands, 999)).toEqual(bands);
    expect(apportion(bands, 0)).toEqual({});
    expect(apportion({}, 100)).toEqual({});
  });

  it('cuts the night premium by the same proportion, and that adds up too', () => {
    // A holiday of 443 minutes, half of it already taken as time. The premium
    // was earned by the same hours, so half of it is still owed.
    const restored = restoreAfterUndo({
      overtime: { OT_REST_DAY: 300, OT_REST_NIGHT: 143 },
      premium: { NIGHT_PREMIUM: 143 },
      restoredWorkedMin: 180,
      workedMin: 443,
    });

    const overtimeTotal = Object.values(restored.overtime).reduce((a, b) => a + b, 0);
    expect(overtimeTotal).toBe(180);

    // 143 x 180/443 is 58.1, so 58 minutes of premium are still owed.
    expect(restored.premium).toEqual({ NIGHT_PREMIUM: 58 });
  });

  it('leaves a day with no premium alone', () => {
    const restored = restoreAfterUndo({
      overtime: { OT_REST_DAY: 480 },
      restoredWorkedMin: 180,
      workedMin: 480,
    });

    expect(restored.overtime).toEqual({ OT_REST_DAY: 180 });
    expect(restored.premium).toEqual({});
  });

  it('owes nothing at all when the whole day was taken as time', () => {
    const restored = restoreAfterUndo({
      overtime: { OT_REST_DAY: 480 },
      premium: { NIGHT_PREMIUM: 120 },
      restoredWorkedMin: 0,
      workedMin: 480,
    });

    expect(restored.overtime).toEqual({});
    expect(restored.premium).toEqual({});
  });
});
