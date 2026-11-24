'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiPatch, apiPost, apiSend } from '../../../lib/api';
import { leaveSettingsHref, type LeaveTab } from '../../../lib/leave-settings';

/**
 * Changing the leave set-up (HR-02 / M08).
 *
 * Each of these is somebody deciding something about the company, so each lands
 * in the audit log on the way through — the API does that, not this file. What
 * happens here is reading the form, sending it, and bringing the reader back to
 * the tab they were on.
 */
export async function saveLeaveType(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (id === '') back('types');

  const body = {
    paid: formData.get('paid') !== null,
    requiresDocument: formData.get('requiresDocument') !== null,
    allowsHalfDays: formData.get('allowsHalfDays') !== null,
    requiresSecondApproval: formData.get('requiresSecondApproval') !== null,
    tracksBalance: formData.get('tracksBalance') !== null,
    active: formData.get('active') !== null,
    dayBasis: String(formData.get('dayBasis') ?? 'working'),
  };

  await send(() => apiPatch(`/leave/settings/types/${id}`, body), 'types');
  back('types', { saved: '1' });
}

/**
 * A new rule from a date — never an edit of the one in force.
 *
 * An empty box means "this type has no such right", which is not the same as
 * zero, so it is sent as null rather than 0.
 */
export async function saveLeaveRule(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (id === '') back('rules');

  const body = {
    effectiveFrom: String(formData.get('effectiveFrom') ?? ''),
    entitlementDays: decimal(formData.get('entitlementDays')),
    accrualPerMonth: decimal(formData.get('accrualPerMonth')),
    carryOverMaxDays: decimal(formData.get('carryOverMaxDays')),
    minNoticeDays: whole(formData.get('minNoticeDays')),
    maxBackdateDays: whole(formData.get('maxBackdateDays')),
    ...(String(formData.get('note') ?? '').trim() === ''
      ? {}
      : { note: String(formData.get('note')).trim() }),
    confirmed: formData.get('confirmed') !== null,
  };

  await send(() => apiPost(`/leave/settings/types/${id}/rules`, body), 'rules');
  back('rules', { saved: '1' });
}

export async function saveWorkWeek(formData: FormData): Promise<void> {
  const body = {
    siteCode: String(formData.get('siteCode') ?? ''),
    workingDays: formData.getAll('workingDays').map((day) => Number(day)),
    effectiveFrom: String(formData.get('effectiveFrom') ?? ''),
    confirmed: formData.get('confirmed') !== null,
  };

  await send(() => apiPost('/leave/settings/work-weeks', body), 'week');
  back('week', { saved: '1' });
}

export async function addHoliday(formData: FormData): Promise<void> {
  const body = {
    date: String(formData.get('date') ?? ''),
    name: String(formData.get('name') ?? ''),
    confirmed: formData.get('confirmed') !== null,
  };

  const year = Number(body.date.slice(0, 4));
  await send(() => apiPost('/leave/settings/holidays', body), 'holidays');
  back('holidays', { saved: '1', ...(Number.isFinite(year) ? { year: String(year) } : {}) });
}

export async function removeHoliday(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const year = String(formData.get('year') ?? '');
  if (id === '') back('holidays');

  await send(() => apiSend(`/leave/settings/holidays/${id}`, undefined, 'DELETE'), 'holidays');
  back('holidays', { removed: '1', year });
}

export async function confirmHolidayYear(formData: FormData): Promise<void> {
  const year = String(formData.get('year') ?? '');

  await send(() => apiPost(`/leave/settings/holidays/confirm/${year}`, {}), 'holidays');
  back('holidays', { confirmed: '1', year });
}

/**
 * "The holidays for this year are finished" (HR-02 spec, point 3).
 *
 * A different statement from confirming the rows that are already there: the
 * moveable religious holidays are announced each year, so a list can be correct
 * and still be missing three days.
 */
export async function setHolidayYearComplete(formData: FormData): Promise<void> {
  const year = String(formData.get('year') ?? '');
  const complete = formData.get('complete') !== null;

  await send(() => apiPost(`/leave/settings/holidays/complete/${year}`, { complete }), 'holidays');
  back('holidays', { saved: '1', year });
}

export async function saveLeavePolicy(formData: FormData): Promise<void> {
  const body = {
    teamOffWarningPercent: whole(formData.get('teamOffWarningPercent')) ?? 33,
    leaveYearStart: String(formData.get('leaveYearStart') ?? '01-01'),
  };

  await send(() => apiPatch('/leave/settings/policy', body), 'policy');
  back('policy', { saved: '1' });
}

/** Runs the call, and sends the reader somewhere useful if it refuses. */
async function send(call: () => Promise<unknown>, tab: LeaveTab): Promise<void> {
  try {
    await call();
  } catch (error) {
    console.error('leave set-up change failed', error);
    back(tab, { error: '1' });
  }

  revalidatePath('/settings/leave');
}

/** `redirect()` throws, which is how it leaves the action. */
function back(tab: LeaveTab, query: Record<string, string> = {}): never {
  const base = leaveSettingsHref(tab, query['year'] ? Number(query['year']) : undefined);
  const rest = Object.entries(query).filter(([key]) => key !== 'year');
  const joined = new URLSearchParams(rest).toString();

  redirect(joined === '' ? base : `${base}${base.includes('?') ? '&' : '?'}${joined}`);
}

/** An empty box is "no such right", which is null and not zero. */
function decimal(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? '').trim();
  if (text === '') return null;

  const parsed = Number.parseFloat(text.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function whole(value: FormDataEntryValue | null): number | undefined {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
