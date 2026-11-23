/**
 * When a document counts as running out (HR-01 spec 6.7).
 *
 * One rule, in one place, because four things ask the same question: the figure
 * on the home screen, the filter on the employee list, the dot on a row and the
 * pill on the documents tab. If they disagree, the demo is explaining itself
 * instead of showing something.
 *
 * How soon is "soon" belongs to the kind of document: a residence permit is
 * flagged sixty days out because renewing one takes that long, a medical
 * certificate thirty. That number is on the document type, set in Settings.
 */
export type DocumentState = 'valid' | 'expiring' | 'expired';

/** The default used when a type does not say: a month's warning. */
export const DEFAULT_ALERT_DAYS = 30;

/**
 * The state of one document, as at a given day.
 *
 * Dates are plain days ("2026-11-23"), compared as text: a day is a day, and
 * turning it into an instant only invites a timezone into a question that has
 * none.
 */
export function documentState(
  expiryDate: string | null | undefined,
  today: string,
  alertDaysBefore: number = DEFAULT_ALERT_DAYS,
): DocumentState {
  if (!expiryDate) {
    return 'valid';
  }

  if (expiryDate < today) {
    return 'expired';
  }

  return expiryDate <= addDays(today, alertDaysBefore) ? 'expiring' : 'valid';
}

/** Whole days from today until a plain date; negative once it has passed. */
export function daysUntil(date: string, today: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** A plain date moved by a number of days, as a plain date. */
export function addDays(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/**
 * The widest alert window in use, for a question asked of every document at once
 * — "how many are running out?" — which cannot filter per type in the database.
 * The rows it returns are then judged one by one.
 */
export function widestAlertWindow(alertDays: readonly number[]): number {
  return alertDays.reduce((widest, days) => Math.max(widest, days), DEFAULT_ALERT_DAYS);
}
