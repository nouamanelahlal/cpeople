'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiPost } from '../../lib/api';
import type { ImportReport } from '../../lib/attendance';

/**
 * Bringing a device file in (M10 / HR-04, build spec §5.3).
 *
 * The same two steps the opening balances use, for the same reason: the trial
 * reads the whole file and writes nothing, so every problem in it is seen at
 * once rather than one per attempt.
 *
 * What is different here is where the file lives between the two steps. A month
 * of punches is eighty kilobytes, which no address bar will carry, so the trial
 * leaves the file with its import row and the page comes back holding only an
 * id. That is also the honest arrangement: the confirmation writes the bytes
 * that were actually checked, not whatever is in the box by then.
 */
export async function tryPunchFile(formData: FormData): Promise<void> {
  const fileName = String(formData.get('fileName') ?? '').trim() || 'attendance.csv';
  const content = String(formData.get('content') ?? '');

  if (content.trim() === '') redirect('/attendance/import');

  let importId: string;

  try {
    const report = await apiPost<ImportReport>('/attendance/imports/preview', {
      fileName,
      content,
    });
    importId = report.importId;
  } catch (error) {
    console.error('attendance trial failed', error);
    redirect(`/attendance/import?error=${reasonOf(error)}`);
  }

  redirect(`/attendance/import?import=${importId}`);
}

/** Writes it: the punches, the days built from them, and the exceptions. */
export async function confirmPunchFile(formData: FormData): Promise<void> {
  const importId = String(formData.get('importId') ?? '');

  try {
    await apiPost(`/attendance/imports/${importId}/commit`, {});
  } catch (error) {
    console.error('attendance import failed', error);
    redirect(`/attendance/import?import=${importId}&error=${reasonOf(error)}`);
  }

  revalidatePath('/attendance');
  redirect(`/attendance/import?import=${importId}&done=1`);
}

/**
 * The refusal the API gave, as something that survives an address bar.
 *
 * The API refuses with a named reason rather than a sentence, so that the
 * screen can say it in the reader's own language.
 */
function reasonOf(error: unknown): string {
  const text = error instanceof Error ? error.message : '';
  const start = text.indexOf('{');

  if (start === -1) return 'failed';

  try {
    const body = JSON.parse(text.slice(start)) as { kind?: string };
    return body.kind ?? 'failed';
  } catch {
    return 'failed';
  }
}

/**
 * Answering one exception.
 *
 * The reason is required by the API, not only by the form: a day changed by
 * hand has to be able to say why, months later, to somebody disputing a
 * payslip. The refusal travels back in the address so the screen can say it in
 * the reader's language.
 */
export async function answerException(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');

  const body = {
    resolution: String(formData.get('resolution') ?? ''),
    comment: String(formData.get('comment') ?? ''),
    ...(formData.get('employeeId') ? { employeeId: String(formData.get('employeeId')) } : {}),
    ...(formData.get('at') ? { at: String(formData.get('at')) } : {}),
    ...(formData.get('direction') ? { direction: String(formData.get('direction')) } : {}),
    ...(formData.get('override') === '1' ? { override: true } : {}),
  };

  try {
    await apiPost(`/attendance/exceptions/${id}/resolve`, body);
  } catch (error) {
    console.error('answering an exception failed', error);
    redirect(`/attendance?tab=exceptions&error=${reasonOf(error)}`);
  }

  revalidatePath('/attendance');
  redirect('/attendance?tab=exceptions&answered=1');
}
