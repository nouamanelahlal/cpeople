'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiPost } from '../../lib/api';
import {
  leaveHref,
  type CarryOverResult,
  type ImportReport,
  type LeaveTab,
} from '../../lib/leave';

/**
 * What somebody does to a leave request (M09 / HR-04).
 *
 * Each of these is a decision about a person's time, so each one lands in the
 * audit log and on the request's own history — the API does that, not this file.
 * What happens here is reading the form, sending it, and bringing the reader
 * back to the tab they were on.
 */
export async function askForLeave(formData: FormData): Promise<void> {
  const body = {
    leaveTypeId: String(formData.get('leaveTypeId') ?? ''),
    from: String(formData.get('from') ?? ''),
    to: String(formData.get('to') ?? ''),
    fromPart: part(formData.get('fromPart')),
    toPart: part(formData.get('toPart')),
    ...(String(formData.get('reason') ?? '').trim() === ''
      ? {}
      : { reason: String(formData.get('reason')).trim() }),
  };

  let id: string | undefined;

  try {
    const created = await apiPost<{ id: string }>('/leave/requests', body);
    id = created.id;
  } catch (error) {
    // The sentence the API refused with is the one the form should show, so it
    // travels back in the address rather than being invented again here.
    redirect(`/leave/new?${new URLSearchParams({ ...asQuery(body), error: reasonOf(error) })}`);
  }

  revalidatePath('/leave');
  redirect(id ? `/leave/${id}?sent=1` : leaveHref('mine'));
}

export async function decideLeave(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const decision = String(formData.get('decision') ?? '') === 'approve' ? 'approve' : 'reject';
  const back = String(formData.get('back') ?? 'approvals') as LeaveTab;

  await run(
    () =>
      apiPost(`/leave/requests/${id}/decide`, {
        decision,
        ...(String(formData.get('reason') ?? '').trim() === ''
          ? {}
          : { reason: String(formData.get('reason')).trim() }),
      }),
    id,
    back,
  );

  redirect(`${leaveHref(back)}${leaveHref(back).includes('?') ? '&' : '?'}done=1`);
}

export async function withdrawLeave(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  await run(() => apiPost(`/leave/requests/${id}/withdraw`, {}), id, 'mine');
  redirect(`/leave/${id}?done=1`);
}

export async function askToCancelLeave(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  await run(() => apiPost(`/leave/requests/${id}/cancel`, {}), id, 'mine');
  redirect(`/leave/${id}?done=1`);
}

/** HR agreeing that a settings change should move a request's day count. */
export async function acceptLeaveChange(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  await run(() => apiPost(`/leave/review/${id}/accept`, {}), id, 'review');
  redirect('/leave?tab=review&done=1');
}

async function run(call: () => Promise<unknown>, id: string, back: LeaveTab): Promise<void> {
  try {
    await call();
  } catch (error) {
    console.error('leave action failed', error);
    redirect(`/leave/${id}?error=${reasonOf(error)}`);
  }

  revalidatePath('/leave');
  revalidatePath(`/leave/${id}`);
  void back;
}

/**
 * The API refuses with a named reason rather than a sentence, so that the screen
 * can say it in the reader's language.
 *
 * The name, and any numbers the sentence needs, come back inside the error's
 * body; they are dug out here and carried in the address, where the page that
 * draws the message can read them.
 */
function refusal(error: unknown): { kind: string; values: Record<string, string> } {
  const text = error instanceof Error ? error.message : '';
  const start = text.indexOf('{');

  if (start === -1) return { kind: 'failed', values: {} };

  try {
    const body = JSON.parse(text.slice(start)) as {
      kind?: string;
      values?: Record<string, string>;
    };

    return { kind: body.kind ?? 'failed', values: body.values ?? {} };
  } catch {
    return { kind: 'failed', values: {} };
  }
}

function reasonOf(error: unknown): string {
  const { kind, values } = refusal(error);
  const extra = Object.entries(values)
    .map(([key, value]) => `${key}:${value}`)
    .join('|');

  return extra === '' ? kind : `${kind}~${extra}`;
}

function part(value: FormDataEntryValue | null): 'full' | 'morning' | 'afternoon' {
  const text = String(value ?? 'full');
  return text === 'morning' || text === 'afternoon' ? text : 'full';
}

function asQuery(body: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(body)
      .filter(([key]) => key !== 'reason')
      .map(([key, value]) => [key, String(value ?? '')]),
  );
}

/**
 * HR moving a balance, with a reason.
 *
 * The reason is required by the API, not only by the form: a balance that moved
 * for no recorded reason is the thing this feature exists to prevent.
 */
export async function adjustBalance(formData: FormData): Promise<void> {
  const employeeId = String(formData.get('employeeId') ?? '');
  const back = String(formData.get('back') ?? `/employees/${employeeId}?tab=absences`);

  const body = {
    employeeId,
    leaveTypeId: String(formData.get('leaveTypeId') ?? ''),
    days: Number(String(formData.get('days') ?? '0').replace(',', '.')),
    reason: String(formData.get('reason') ?? ''),
  };

  try {
    await apiPost('/leave/balances/adjust', body);
  } catch (error) {
    console.error('balance adjustment failed', error);
    redirect(`${back}${back.includes('?') ? '&' : '?'}error=${reasonOf(error)}`);
  }

  revalidatePath(back);
  redirect(`${back}${back.includes('?') ? '&' : '?'}adjusted=1`);
}

/**
 * The trial run: reads the file, writes nothing.
 *
 * Called while the page renders rather than from a form, because its answer is
 * what the page is for. Nothing it does can change anything.
 */
export async function tryOpeningBalances(content: string): Promise<ImportReport | null> {
  try {
    return await apiPost<ImportReport>('/leave/balances/import/trial', { content });
  } catch (error) {
    console.error('opening-balance trial failed', error);
    return null;
  }
}

/** The confirmation: all of the file, or none of it. */
export async function confirmOpeningBalances(formData: FormData): Promise<void> {
  const content = String(formData.get('content') ?? '');

  try {
    await apiPost('/leave/balances/import/confirm', { content });
  } catch (error) {
    console.error('opening-balance import failed', error);
    redirect(`/leave/import?error=${reasonOf(error)}`);
  }

  revalidatePath('/leave');
  redirect('/leave/import?done=1');
}

/** Year end, previewed. Touches no balance. */
export async function previewCarryOver(year: number): Promise<CarryOverResult | null> {
  try {
    return await apiPost<CarryOverResult>('/leave/balances/carry-over/preview', { year });
  } catch (error) {
    console.error('carry-over preview failed', error);
    return null;
  }
}

/** Year end, done. Safe to run again. */
export async function applyCarryOver(formData: FormData): Promise<void> {
  const year = Number(formData.get('year') ?? 0);

  try {
    await apiPost('/leave/balances/carry-over/apply', { year });
  } catch (error) {
    console.error('carry-over failed', error);
    redirect(`/leave/carry-over?year=${year}&error=${reasonOf(error)}`);
  }

  revalidatePath('/leave');
  redirect(`/leave/carry-over?year=${year}&done=1`);
}
