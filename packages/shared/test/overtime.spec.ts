import { describe, expect, it } from 'vitest';
import {
  bandAt,
  overtimeFor,
  roundMinutes,
  toMinutes,
  toTime,
  weeklyOvertime,
  type OvertimeBand,
} from '../src/overtime.js';

/**
 * What a worked day is worth (M10 / HR-04, build spec §5.6).
 *
 * The cases here are the four the spec names, plus the ones that decide whether
 * somebody is paid correctly: an hour must belong to exactly one band, and a
 * week over its limit must not pay twice for an hour a day already counted.
 *
 * None of the rates are law. They are the seeded demo values, and the tests are
 * about the arithmetic rather than the figures.
 */

/** The seeded bands, all "to confirm". */
const BANDS: OvertimeBand[] = [
  { bandCode: 'OT_DAY', dayType: 'working', timeFrom: '06:00', timeTo: '21:00', ratePercent: 25 },
  { bandCode: 'OT_NIGHT', dayType: 'working', timeFrom: '21:00', timeTo: '06:00', ratePercent: 50 },
  { bandCode: 'OT_REST_DAY', dayType: 'rest', timeFrom: '06:00', timeTo: '21:00', ratePercent: 50 },
  { bandCode: 'OT_REST_NIGHT', dayType: 'rest', timeFrom: '21:00', timeTo: '06:00', ratePercent: 100 },
  { bandCode: 'OT_REST_DAY', dayType: 'holiday', timeFrom: '06:00', timeTo: '21:00', ratePercent: 50 },
  { bandCode: 'OT_REST_NIGHT', dayType: 'holiday', timeFrom: '21:00', timeTo: '06:00', ratePercent: 100 },
];

const EIGHT_HOURS = 8 * 60;

describe('reading a clock', () => {
  it('turns a time into minutes and back', () => {
    expect(toMinutes('07:30')).toBe(450);
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('21:00')).toBe(1260);
    expect(toTime(450)).toBe('07:30');
    expect(toTime(1260)).toBe('21:00');
  });

  it('wraps past midnight', () => {
    // 02:00 the following morning, counted from the day the shift started.
    expect(toTime(1560)).toBe('02:00');
  });
});

describe('which band an hour falls in', () => {
  it('puts the afternoon in the day band', () => {
    expect(bandAt(toMinutes('14:00'), 'working', BANDS)?.bandCode).toBe('OT_DAY');
  });

  it('puts ten at night in the night band', () => {
    expect(bandAt(toMinutes('22:00'), 'working', BANDS)?.bandCode).toBe('OT_NIGHT');
  });

  it('puts four in the morning in the night band', () => {
    // The night band runs 21:00 to 06:00, through midnight.
    expect(bandAt(toMinutes('04:00'), 'working', BANDS)?.bandCode).toBe('OT_NIGHT');
  });

  it('uses the holiday bands on a holiday', () => {
    expect(bandAt(toMinutes('14:00'), 'holiday', BANDS)?.bandCode).toBe('OT_REST_DAY');
    expect(bandAt(toMinutes('23:00'), 'holiday', BANDS)?.bandCode).toBe('OT_REST_NIGHT');
  });
});

describe('a working day', () => {
  it('splits overtime across the day and night bands', () => {
    // The spec's case: 19:00 to 23:00 of overtime on a working day is
    // 2 hours at the day rate and 2 at the night rate.
    const answer = overtimeFor({
      spans: [{ from: toMinutes('19:00'), to: toMinutes('23:00') }],
      dayType: 'working',
      bands: BANDS,
      normalMinutes: 0,
    });

    expect(answer.bands['OT_DAY']).toBe(120);
    expect(answer.bands['OT_NIGHT']).toBe(120);
    expect(answer.overtimeTotal).toBe(240);
  });

  it('pays the ordinary day first, whenever it happens', () => {
    // 08:00 to 19:00 is eleven hours: eight ordinary, three of overtime, all of
    // it inside the day band.
    const answer = overtimeFor({
      spans: [{ from: toMinutes('08:00'), to: toMinutes('19:00') }],
      dayType: 'working',
      bands: BANDS,
      normalMinutes: EIGHT_HOURS,
    });

    expect(answer.normal).toBe(EIGHT_HOURS);
    expect(answer.bands['OT_DAY']).toBe(180);
    expect(answer.bands['OT_NIGHT']).toBeUndefined();
  });

  it('does not put the pastry shift’s early start on a night rate', () => {
    // The spec's case. 04:00 to 12:00 is eight hours, all ordinary: starting
    // early is not overtime, and the first two hours being inside the night
    // band does not make them so.
    const answer = overtimeFor({
      spans: [{ from: toMinutes('04:00'), to: toMinutes('12:00') }],
      dayType: 'working',
      bands: BANDS,
      normalMinutes: EIGHT_HOURS,
    });

    expect(answer.normal).toBe(EIGHT_HOURS);
    expect(answer.overtimeTotal).toBe(0);
    expect(answer.bands).toEqual({});
  });

  it('pays the pastry shift’s night hours when it runs long', () => {
    // 04:00 to 14:00 is ten hours: eight ordinary, two over — and the two over
    // are at the end, in daylight, not at the start.
    const answer = overtimeFor({
      spans: [{ from: toMinutes('04:00'), to: toMinutes('14:00') }],
      dayType: 'working',
      bands: BANDS,
      normalMinutes: EIGHT_HOURS,
    });

    expect(answer.bands['OT_DAY']).toBe(120);
    expect(answer.bands['OT_NIGHT']).toBeUndefined();
  });

  it('counts a shift that runs past midnight on the day it started', () => {
    // 22:00 to 02:00: four hours, all of them night.
    const answer = overtimeFor({
      spans: [{ from: toMinutes('22:00'), to: toMinutes('22:00') + 240 }],
      dayType: 'working',
      bands: BANDS,
      normalMinutes: 0,
    });

    expect(answer.bands['OT_NIGHT']).toBe(240);
    expect(answer.workedTotal).toBe(240);
  });

  it('handles a split shift as two spans', () => {
    const answer = overtimeFor({
      spans: [
        { from: toMinutes('10:00'), to: toMinutes('14:00') },
        { from: toMinutes('18:00'), to: toMinutes('22:00') },
      ],
      dayType: 'working',
      bands: BANDS,
      normalMinutes: EIGHT_HOURS,
    });

    // Eight hours in all, so nothing is overtime even though it ends at ten.
    expect(answer.workedTotal).toBe(EIGHT_HOURS);
    expect(answer.overtimeTotal).toBe(0);
  });
});

describe('a holiday or a rest day', () => {
  it('pays every minute, because none of it is ordinary', () => {
    // The spec's case: a public holiday. Nobody owes these hours.
    const answer = overtimeFor({
      spans: [{ from: toMinutes('08:00'), to: toMinutes('16:00') }],
      dayType: 'holiday',
      bands: BANDS,
      normalMinutes: 0,
    });

    expect(answer.normal).toBe(0);
    expect(answer.bands['OT_REST_DAY']).toBe(EIGHT_HOURS);
    expect(answer.overtimeTotal).toBe(EIGHT_HOURS);
  });

  it('splits a holiday evening across its two bands', () => {
    const answer = overtimeFor({
      spans: [{ from: toMinutes('19:00'), to: toMinutes('23:00') }],
      dayType: 'holiday',
      bands: BANDS,
      normalMinutes: 0,
    });

    expect(answer.bands['OT_REST_DAY']).toBe(120);
    expect(answer.bands['OT_REST_NIGHT']).toBe(120);
  });

  it('never counts an hour in two bands', () => {
    const answer = overtimeFor({
      spans: [{ from: toMinutes('06:00'), to: toMinutes('23:59') }],
      dayType: 'rest',
      bands: BANDS,
      normalMinutes: 0,
    });

    const summed = Object.values(answer.bands).reduce((sum, value) => sum + value, 0);
    expect(summed).toBe(answer.workedTotal);
    expect(summed).toBe(answer.overtimeTotal);
  });
});

describe('the weekly threshold', () => {
  it('owes nothing for a week inside the limit', () => {
    expect(
      weeklyOvertime({
        workedMinutes: 44 * 60,
        dailyOvertimeMinutes: 0,
        normalWeeklyMinutes: 44 * 60,
      }),
    ).toBe(0);
  });

  it('owes the excess where no single day was over', () => {
    // Six nine-hour days: fifty-four hours, ten over a forty-four-hour week,
    // and not one day above the daily threshold.
    expect(
      weeklyOvertime({
        workedMinutes: 54 * 60,
        dailyOvertimeMinutes: 0,
        normalWeeklyMinutes: 44 * 60,
      }),
    ).toBe(10 * 60);
  });

  it('does not pay twice for an hour a day already counted', () => {
    // The spec's case. Fifty-four hours worked, six of them already counted as
    // daily overtime: the week owes the remaining four, not another ten.
    expect(
      weeklyOvertime({
        workedMinutes: 54 * 60,
        dailyOvertimeMinutes: 6 * 60,
        normalWeeklyMinutes: 44 * 60,
      }),
    ).toBe(4 * 60);
  });

  it('owes nothing more when the days have already covered it', () => {
    expect(
      weeklyOvertime({
        workedMinutes: 50 * 60,
        dailyOvertimeMinutes: 8 * 60,
        normalWeeklyMinutes: 44 * 60,
      }),
    ).toBe(0);
  });
});

describe('rounding', () => {
  it('rounds up, which is the employee’s favour', () => {
    expect(roundMinutes(487, 15, 'up')).toBe(495);
    expect(roundMinutes(480, 15, 'up')).toBe(480);
  });

  it('rounds down and to the nearest where the company says so', () => {
    expect(roundMinutes(487, 15, 'down')).toBe(480);
    expect(roundMinutes(487, 15, 'nearest')).toBe(480);
    expect(roundMinutes(493, 15, 'nearest')).toBe(495);
  });

  it('leaves the minutes alone where there is no rounding', () => {
    expect(roundMinutes(487, 1, 'up')).toBe(487);
    expect(roundMinutes(487, 0, 'up')).toBe(487);
  });
});
