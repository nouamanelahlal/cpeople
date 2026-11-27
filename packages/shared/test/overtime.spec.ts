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

describe('a premium on hours that are not overtime', () => {
  // HR-02 open point 17: whether SMG owes a premium on *scheduled* night hours
  // — the pastry shift's 04:00 to 06:00 — is open, and the default is no. These
  // tests are about the arithmetic being ready for either answer, so that the
  // answer is a row in a table rather than a change to this file.
  //
  // The rate is invented, like every other figure here.
  const NIGHT_PREMIUM: OvertimeBand = {
    bandCode: 'NIGHT_PREMIUM',
    dayType: 'working',
    timeFrom: '21:00',
    timeTo: '06:00',
    ratePercent: 25,
    appliesTo: 'all_hours',
  };

  const WITH_PREMIUM = [...BANDS, NIGHT_PREMIUM];

  it('pays the pastry shift’s first two hours, which are not overtime', () => {
    // 04:00 to 12:00 is eight hours, all of them ordinary. Two of them fall
    // inside the night window, so they earn the premium and nothing else: the
    // day is still worth no overtime at all.
    const answer = overtimeFor({
      spans: [{ from: toMinutes('04:00'), to: toMinutes('12:00') }],
      dayType: 'working',
      bands: WITH_PREMIUM,
      normalMinutes: EIGHT_HOURS,
    });

    expect(answer.premiums['NIGHT_PREMIUM']).toBe(120);
    expect(answer.overtimeTotal).toBe(0);
    expect(answer.bands).toEqual({});
    expect(answer.normal).toBe(EIGHT_HOURS);
  });

  it('pays the premium and the overtime separately when the shift runs long', () => {
    // The same morning, plus an hour at midday. The premium is still the two
    // early hours; the extra hour is ordinary overtime in daylight. Neither
    // figure touches the other.
    const answer = overtimeFor({
      spans: [{ from: toMinutes('04:00'), to: toMinutes('13:00') }],
      dayType: 'working',
      bands: WITH_PREMIUM,
      normalMinutes: EIGHT_HOURS,
    });

    expect(answer.premiums['NIGHT_PREMIUM']).toBe(120);
    expect(answer.bands['OT_DAY']).toBe(60);
    expect(answer.overtimeTotal).toBe(60);
  });

  it('pays both on an evening that runs into the night', () => {
    // 14:00 to 23:00: eight ordinary hours, then an hour over. That last hour
    // is after nine, so it is night overtime **and** premium hours — the one
    // case where a minute earns from two bands, which is the point of paying a
    // premium on top rather than instead.
    const answer = overtimeFor({
      spans: [{ from: toMinutes('14:00'), to: toMinutes('23:00') }],
      dayType: 'working',
      bands: WITH_PREMIUM,
      normalMinutes: EIGHT_HOURS,
    });

    expect(answer.bands['OT_NIGHT']).toBe(60);
    expect(answer.premiums['NIGHT_PREMIUM']).toBe(120);
    expect(answer.overtimeTotal).toBe(60);

    // The overtime bands still account for the overtime exactly once; the
    // premium is extra pay on minutes already counted, not extra minutes.
    const banded = Object.values(answer.bands).reduce((sum, value) => sum + value, 0);
    expect(banded).toBe(answer.overtimeTotal);
  });

  it('changes nothing at all where no premium band exists', () => {
    // The guard on the whole feature: with today's seeded rules — none of which
    // is `all_hours` — every answer is the one it was before premiums existed.
    const cases = [
      { from: '04:00', to: '12:00', normal: EIGHT_HOURS },
      { from: '19:00', to: '23:00', normal: 0 },
      { from: '14:00', to: '23:00', normal: EIGHT_HOURS },
      { from: '22:00', to: '26:00', normal: 0 },
    ] as const;

    for (const span of cases) {
      const answer = overtimeFor({
        spans: [{ from: toMinutes(span.from), to: toMinutes(span.to) }],
        dayType: 'working',
        bands: BANDS,
        normalMinutes: span.normal,
      });

      expect(answer.premiums, `${span.from}–${span.to} owes no premium`).toEqual({});
    }

    // And the spec's own case still gives the spec's own answer.
    const evening = overtimeFor({
      spans: [{ from: toMinutes('19:00'), to: toMinutes('23:00') }],
      dayType: 'working',
      bands: BANDS,
      normalMinutes: 0,
    });

    expect(evening.bands['OT_DAY']).toBe(120);
    expect(evening.bands['OT_NIGHT']).toBe(120);
    expect(evening.overtimeTotal).toBe(240);
  });
});
