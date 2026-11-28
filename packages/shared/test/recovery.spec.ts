import { describe, expect, it } from 'vitest';
import {
  convertToRecovery,
  recoveryBalance,
  recoveryCostOfDay,
  recoveryMinutes,
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
