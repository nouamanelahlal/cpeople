import { describe, expect, it } from 'vitest';
import { addDays, daysUntil, documentState, widestAlertWindow } from '../src/documents.js';

// The rule from the HR-01 spec, section 6.7. The home figure, the list filter,
// the row's dot and the tab's pill all ask this, so this is where it is pinned.

const TODAY = '2026-11-23';

describe('HR-01 document expiry', () => {
  it('calls a document expired the day after it runs out', () => {
    expect(documentState('2026-11-22', TODAY)).toBe('expired');
    expect(documentState('2026-11-23', TODAY)).toBe('expiring');
  });

  it('warns as far ahead as the kind of document asks for', () => {
    // A medical certificate: thirty days.
    expect(documentState('2026-12-20', TODAY, 30)).toBe('expiring');
    expect(documentState('2026-12-24', TODAY, 30)).toBe('valid');

    // A residence permit: sixty, because renewing one takes that long.
    expect(documentState('2026-12-24', TODAY, 60)).toBe('expiring');
    expect(documentState('2027-02-01', TODAY, 60)).toBe('valid');
  });

  it('leaves a document with no expiry alone', () => {
    expect(documentState(null, TODAY)).toBe('valid');
    expect(documentState(undefined, TODAY)).toBe('valid');
    expect(documentState('', TODAY)).toBe('valid');
  });

  it('counts whole days, in both directions', () => {
    expect(daysUntil('2026-11-30', TODAY)).toBe(7);
    expect(daysUntil(TODAY, TODAY)).toBe(0);
    expect(daysUntil('2026-11-13', TODAY)).toBe(-10);
  });

  it('moves a plain date without letting a timezone near it', () => {
    expect(addDays(TODAY, 30)).toBe('2026-12-23');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
  });

  it('knows the widest window any type asks for', () => {
    expect(widestAlertWindow([30, 60, 15])).toBe(60);
    // Never narrower than the default: a question asked of every document at
    // once has to catch everything the per-type rule might then flag.
    expect(widestAlertWindow([7])).toBe(30);
    expect(widestAlertWindow([])).toBe(30);
  });
});
