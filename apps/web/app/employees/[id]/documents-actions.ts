'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError, apiSend } from '../../../lib/api';
import { tabHref } from '../../../lib/employee-file';

/**
 * Adding a document to a file, and taking one off it (HR-01 spec 6.7).
 *
 * The file itself never passes through this process as anything but bytes on
 * their way to the API: what is checked — the kind, the size, whether that kind
 * needs an expiry date — is checked there, because a form is a suggestion and the
 * API is the rule.
 */
export async function uploadDocument(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (id === '') {
    redirect('/employees');
  }

  const file = formData.get('file');
  const body = new FormData();

  if (file instanceof File) {
    body.set('file', file, file.name);
  }

  for (const field of ['type', 'issueDate', 'expiryDate', 'note'] as const) {
    const value = formData.get(field);
    if (value !== null && String(value).trim() !== '') {
      body.set(field, String(value).trim());
    }
  }

  try {
    await apiSend(`/employees/${id}/documents`, body);
  } catch (error) {
    redirect(`${tabHref(id, 'documents', { edit: true })}&error=${encodeURIComponent(why(error))}`);
  }

  revalidatePath(`/employees/${id}`);
  redirect(`${tabHref(id, 'documents')}&uploaded=1`);
}

export async function removeDocument(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const documentId = String(formData.get('documentId') ?? '');

  if (id === '' || documentId === '') {
    redirect('/employees');
  }

  try {
    await apiSend(`/documents/${documentId}`, undefined, 'DELETE');
  } catch (error) {
    redirect(`${tabHref(id, 'documents')}&error=${encodeURIComponent(why(error))}`);
  }

  revalidatePath(`/employees/${id}`);
  redirect(`${tabHref(id, 'documents')}&removed=1`);
}

/**
 * Why the API refused, as a word this application can say in either language.
 *
 * A refusal here is usually something the person can fix — the wrong kind of
 * file, one too large, a missing expiry date — so it is worth telling them
 * which. The API's own sentence is English and belongs to the API; what crosses
 * into the page is a code, and the page has both languages for it.
 */
function why(error: unknown): string {
  if (error instanceof ApiError) {
    // A file over the limit never reaches the handler: the framework stops it.
    if (error.status === 413) return 'too-large';

    const said = error.message.toLowerCase();

    if (said.includes('10 mb')) return 'too-large';
    if (said.includes('pdf')) return 'wrong-type';
    if (said.includes('expiry date')) return 'expiry-required';
    if (error.status === 403) return 'not-allowed';
  }

  console.error('uploading a document failed', error);
  return 'unknown';
}
