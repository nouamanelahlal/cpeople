import { describe, expect, it } from 'vitest';
import type { OvertimeBand } from '@cpeople/shared';
import {
  WorkDayBuilderService,
  fingerprint,
  type BuildContext,
} from '../src/modules/attendance/workday-builder.service.js';

/**
 * A worked day carries its premium minutes as well as its overtime (HR-02 open
 * point 17).
 *
 * The arithmetic itself is tested in packages/shared/test/overtime.spec.ts.
 * What this tests is the wiring: that a rule row marked `all_hours` reaches the
 * day that is written, in its own field, without disturbing the overtime that
 * was already there. The two have separate columns because the same minute can
 * appear in both, and a day that merged them would be paid twice.
 *
 * None of the rates here is a legal value. They are invented for the test.
 */
const BANDS: OvertimeBand[] = [
  { bandCode: 'OT_DAY', dayType: 'working', timeFrom: '06:00', timeTo: '21:00', ratePercent: 25 },
  { bandCode: 'OT_NIGHT', dayType: 'working', timeFrom: '21:00', timeTo: '06:00', ratePercent: 50 },
];

const NIGHT_PREMIUM: OvertimeBand = {
  bandCode: 'NIGHT_PREMIUM',
  dayType: 'working',
  timeFrom: '21:00',
  timeTo: '06:00',
  ratePercent: 25,
  appliesTo: 'all_hours',
};

/** The pastry rota: four in the morning until noon, no break deducted. */
const PASTRY = {
  start: '04:00',
  end: '12:00',
  breakMinutes: 0,
  crossesMidnight: false,
};

function context(bands: OvertimeBand[]): BuildContext {
  return {
    bands,
    settings: {
      normalDailyMinutes: 8 * 60,
      normalWeeklyMinutes: 44 * 60,
      // No rounding, so the figures below are the punches and nothing else.
      roundingMinutes: 1,
      roundingDirection: 'up',
      latenessToleranceMin: 10,
      dailyMaxMinutes: 12 * 60,
    },
    holidays: new Set<string>(),
    calcVersion: 'test',
    ruleIds: bands.map((band) => `rule-${band.bandCode}`),
  };
}

/** A day's punches, in and out, on the day the shift started. Hours, as "04". */
function punches(from: string, to: string): { at: Date; direction: 'in' | 'out' }[] {
  return [
    { at: new Date(`2026-11-09T${from}:00:00.000Z`), direction: 'in' },
    { at: new Date(`2026-11-09T${to}:00:00.000Z`), direction: 'out' },
  ];
}

describe('a worked day and its premium', () => {
  const builder = new WorkDayBuilderService();

  it('carries the premium on scheduled hours that are not overtime', () => {
    const day = builder.build({
      employeeId: 'e1',
      date: '2026-11-09',
      punches: punches('04', '12'),
      shift: PASTRY,
      scheduled: true,
      restDay: false,
      context: context([...BANDS, NIGHT_PREMIUM]),
    });

    // Eight ordinary hours: no overtime at all, and two hours of premium for
    // the part of the shift before six in the morning.
    expect(day.workedMin).toBe(8 * 60);
    expect(day.overtime).toEqual({});
    expect(day.premium).toEqual({ NIGHT_PREMIUM: 120 });
  });

  it('keeps the premium and the overtime in separate fields', () => {
    const day = builder.build({
      employeeId: 'e1',
      date: '2026-11-09',
      punches: punches('04', '13'),
      shift: PASTRY,
      scheduled: true,
      restDay: false,
      context: context([...BANDS, NIGHT_PREMIUM]),
    });

    expect(day.overtime).toEqual({ OT_DAY: 60 });
    expect(day.premium).toEqual({ NIGHT_PREMIUM: 120 });
  });

  it('writes an empty premium where no band is paid on all hours', () => {
    // Today's seeded rules, none of which is `all_hours`. The day must be
    // exactly what it was before premiums existed.
    const day = builder.build({
      employeeId: 'e1',
      date: '2026-11-09',
      punches: punches('04', '13'),
      shift: PASTRY,
      scheduled: true,
      restDay: false,
      context: context(BANDS),
    });

    expect(day.premium).toEqual({});
    expect(day.overtime).toEqual({ OT_DAY: 60 });
  });

  it('names the rules it was built from, even on a day nobody worked', () => {
    // The ids travel onto the day the way a leave calculation keeps the rule
    // and holidays it applied, so "which rules made this figure" always has an
    // answer — including for the days that are only an absence.
    const worked = builder.build({
      employeeId: 'e1',
      date: '2026-11-09',
      punches: punches('04', '12'),
      shift: PASTRY,
      scheduled: true,
      restDay: false,
      context: context([...BANDS, NIGHT_PREMIUM]),
    });

    expect(worked.overtimeRuleIds).toEqual([
      'rule-OT_DAY',
      'rule-OT_NIGHT',
      'rule-NIGHT_PREMIUM',
    ]);
  });

  it('writes an empty premium on a day nobody worked', () => {
    const day = builder.build({
      employeeId: 'e1',
      date: '2026-11-09',
      punches: [],
      shift: PASTRY,
      scheduled: true,
      restDay: false,
      context: context([...BANDS, NIGHT_PREMIUM]),
    });

    expect(day.premium).toEqual({});
    expect(day.exceptions.map((e) => e.code)).toContain('ABSENT_NO_LEAVE');
  });
});

describe('the version a day records', () => {
  // `calcVersion` is what tells a reader whether a day is still calculated the
  // way today's rules would calculate it. That is only true if two different
  // rule sets can never share a version — so this tests the thing that would
  // otherwise be assumed.
  const RULE = {
    id: '0193c0de-0000-7000-8000-00000000000a',
    bandCode: 'OT_DAY',
    dayType: 'working',
    timeFrom: '06:00',
    timeTo: '21:00',
    ratePercent: '25',
    appliesTo: 'overtime',
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
  };

  const SETTINGS = {
    thresholdMode: 'both',
    normalDailyHours: '8',
    normalWeeklyHours: '44',
    roundingMinutes: 15,
    roundingDirection: 'up',
    latenessToleranceMin: 10,
    dailyMaxHours: '12',
  };

  it('is the same for the same rules, whatever order they arrive in', () => {
    const second = { ...RULE, id: '0193c0de-0000-7000-8000-00000000000b', bandCode: 'OT_NIGHT' };

    expect(fingerprint([RULE, second], SETTINGS)).toBe(fingerprint([second, RULE], SETTINGS));
  });

  it('changes when a rate changes', () => {
    const dearer = { ...RULE, ratePercent: '50' };

    expect(fingerprint([dearer], SETTINGS)).not.toBe(fingerprint([RULE], SETTINGS));
  });

  it('changes when a band is added, closed or removed', () => {
    const extra = { ...RULE, id: '0193c0de-0000-7000-8000-00000000000c', bandCode: 'OT_NIGHT' };
    const closed = { ...RULE, effectiveTo: new Date('2026-06-30T00:00:00.000Z') };

    const one = fingerprint([RULE], SETTINGS);

    expect(fingerprint([RULE, extra], SETTINGS)).not.toBe(one);
    expect(fingerprint([closed], SETTINGS)).not.toBe(one);
    expect(fingerprint([], SETTINGS)).not.toBe(one);
  });

  it('changes when a band starts applying to all hours', () => {
    // The whole point of open point 17: switching a band to `all_hours` changes
    // what every day is worth, so no day may keep claiming the old version.
    const premium = { ...RULE, appliesTo: 'all_hours' };

    expect(fingerprint([premium], SETTINGS)).not.toBe(fingerprint([RULE], SETTINGS));
  });

  it('changes when the normal week changes, though no rule did', () => {
    // A forty-hour week makes overtime of hours that were ordinary yesterday.
    // Hashing only the rules would miss it and leave every day claiming a
    // version it no longer matches.
    const shorter = { ...SETTINGS, normalWeeklyHours: '40' };

    expect(fingerprint([RULE], shorter)).not.toBe(fingerprint([RULE], SETTINGS));
  });

  it('changes when rounding or the tolerance changes', () => {
    const one = fingerprint([RULE], SETTINGS);

    expect(fingerprint([RULE], { ...SETTINGS, roundingMinutes: 5 })).not.toBe(one);
    expect(fingerprint([RULE], { ...SETTINGS, roundingDirection: 'down' })).not.toBe(one);
    expect(fingerprint([RULE], { ...SETTINGS, latenessToleranceMin: 0 })).not.toBe(one);
    expect(fingerprint([RULE], { ...SETTINGS, thresholdMode: 'daily' })).not.toBe(one);
    expect(fingerprint([RULE], { ...SETTINGS, dailyMaxHours: '10' })).not.toBe(one);
  });

  it('is a sha-256, named for what it is', () => {
    expect(fingerprint([RULE], SETTINGS)).toMatch(/^ot:[0-9a-f]{64}$/);
  });
});
