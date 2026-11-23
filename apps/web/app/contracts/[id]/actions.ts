'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiPost, apiSend } from '../../../lib/api';

/**
 * What can be done to a contract (HR-01 spec 6.6).
 *
 * Each of these is one decision with consequences — a document produced, an
 * employment ended — so each is its own form and its own button, and none of
 * them is retried. The API decides who may; these only carry the answer back to
 * the page.
 */
export async function generateContract(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (id === '') redirect('/contracts');

  // Only the optional clauses are sent; the mandatory ones are not a choice.
  const clauses = formData.getAll('clauses').map((value) => String(value));

  try {
    await apiPost(`/contracts/${id}/generate`, { clauses });
  } catch (error) {
    fail(error, id, 'generate');
  }

  revalidatePath(`/contracts/${id}`);
  redirect(`/contracts/${id}?generated=1`);
}

export async function signContract(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (id === '') redirect('/contracts');

  const file = formData.get('file');
  const body = new FormData();

  if (file instanceof File) {
    body.set('file', file, file.name);
  }

  try {
    await apiSend(`/contracts/${id}/sign`, body);
  } catch (error) {
    fail(error, id, 'sign');
  }

  revalidatePath(`/contracts/${id}`);
  redirect(`/contracts/${id}?signed=1`);
}

export async function renewContract(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (id === '') redirect('/contracts');

  let next = '';

  try {
    // The answer is the new draft's own preview, so its contract is where to go.
    const answer = await apiPost<{ contract: { id: string } }>(`/contracts/${id}/renew`, {
      endDate: String(formData.get('endDate') ?? ''),
    });
    next = answer.contract.id;
  } catch (error) {
    fail(error, id, 'renew');
  }

  revalidatePath(`/contracts/${id}`);
  // Straight to the new draft: generating it is the next thing to do.
  redirect(`/contracts/${next === '' ? id : next}?renewed=1`);
}

export async function endContract(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  if (id === '') redirect('/contracts');

  try {
    await apiPost(`/contracts/${id}/end`, {
      endDate: String(formData.get('endDate') ?? ''),
      reason: String(formData.get('reason') ?? 'other'),
    });
  } catch (error) {
    fail(error, id, 'end');
  }

  revalidatePath(`/contracts/${id}`);
  redirect(`/contracts/${id}?ended=1`);
}

/** Sends the reader back to the contract with something to read. */
function fail(error: unknown, id: string, what: string): never {
  console.error(`contract ${what} failed`, error);
  redirect(`/contracts/${id}?error=${what}`);
}
