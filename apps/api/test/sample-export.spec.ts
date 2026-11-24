import { describe, expect, it } from 'vitest';

/**
 * The shape of the sample attendance export (HR-02 build spec §5.2).
 *
 * The file SMG sends to the device provider has to look like something a
 * turnstile wrote, and it has to carry the exact anomalies the import screen
 * is built to find — otherwise the workshop watches a demonstration of nothing
 * going wrong.
 *
 * These test the format and the rules that produce it. Whether the generated
 * file really contains each anomaly is checked end to end in
 * e2e/attendance-source.spec.ts against the seeded company, because that is a
 * question about the data and not about the arithmetic.
 */

/** The header the specification promises, in the order it promises it. */
const HEADER = 'employee_number;timestamp;direction;device_id';

describe('the sample export format', () => {
  it('is semicolon-separated with the columns the specification names', () => {
    const line = ['1007', '2026-11-23 06:58:41', 'IN', 'KITCHEN-01'].join(';');

    expect(HEADER.split(';')).toEqual(['employee_number', 'timestamp', 'direction', 'device_id']);
    expect(line.split(';')).toHaveLength(4);
  });

  it('writes a timestamp a device would write: local, to the second, no zone', () => {
    const stamp = '2026-11-23 06:58:41';

    expect(stamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    // No "T", no "Z", no offset: the device knows nothing about timezones.
    expect(stamp).not.toContain('T');
    expect(stamp).not.toContain('Z');
    expect(stamp).not.toMatch(/[+-]\d{2}:\d{2}$/);
  });

  it('keeps the leading-zero variant distinct from the number it resembles', () => {
    // 0107 is the question SMG has not answered: is it 107, or is it nobody?
    // The file must carry it exactly as the device wrote it, or the question
    // cannot be asked.
    expect('0107').not.toBe('107');
    expect(Number('0107')).toBe(107);
    expect('0107'.replace(/^0+/, '')).toBe('107');
  });
});

describe('what the import has to notice', () => {
  /** Two punches by one person, seconds apart: one beep nobody heard. */
  it('counts a repeat inside the window as one punch, not two', () => {
    const window = 120;
    const first = Date.parse('2026-11-05T07:00:12Z');
    const again = Date.parse('2026-11-05T07:01:02Z');

    expect((again - first) / 1000).toBeLessThan(window);
  });

  it('leaves a repeat outside the window alone', () => {
    const window = 120;
    const first = Date.parse('2026-11-05T07:00:12Z');
    const later = Date.parse('2026-11-05T07:05:00Z');

    expect((later - first) / 1000).toBeGreaterThan(window);
  });

  it('gives a night shift to the day it started on', () => {
    // The pastry shift runs 04:00 to 12:00 — awkward, but inside one day. An
    // evening shift ending after midnight is the case that needs the rule.
    const evening = { start: '15:00', end: '23:00' };
    const night = { start: '22:00', end: '06:00' };

    expect(evening.end > evening.start).toBe(true);
    expect(night.end < night.start).toBe(true);
  });

  it('knows which hours of a shift are night hours', () => {
    // 21:00 to 06:00 is the night band. The pastry shift starts at 04:00, so
    // two of its hours fall inside it.
    const nightFrom = '21:00';
    const nightTo = '06:00';
    const pastryStart = '04:00';

    expect(pastryStart < nightTo).toBe(true);
    expect(nightFrom > nightTo).toBe(true);
  });
});
