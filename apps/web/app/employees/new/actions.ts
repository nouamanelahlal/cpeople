'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError, apiPost } from '../../../lib/api';

/** What the wizard gets back when something stops it. */
export interface HireResult {
  readonly error: 'duplicate' | 'failed';
  readonly reason?: string;
  readonly employee?: { id: string; name: string; employeeNumber: string };
}

/**
 * Creating the employee the wizard has been filling in (HR-01 spec 6.4).
 *
 * The whole draft is sent at once, and the API decides whether it is a person:
 * a national identifier that belongs to somebody else comes back named, with
 * their file to open, which is the acceptance criterion the spec sets.
 *
 * On success this never returns — it redirects to the new file, which is where
 * the next thing to do is.
 */
export async function hireEmployee(
  _previous: HireResult | null,
  formData: FormData,
): Promise<HireResult | null> {
  const raw = String(formData.get('draft') ?? '');
  let created: { id: string; name: string } | undefined;

  try {
    const body = JSON.parse(raw) as Record<string, unknown>;
    created = await apiPost<{ id: string; name: string }>('/employees', body);
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      const clash = named(error.message);
      return clash ? { error: 'duplicate', employee: clash } : { error: 'duplicate' };
    }

    console.error('creating an employee failed', error);
    return { error: 'failed', ...(said(error) ? { reason: said(error)! } : {}) };
  }

  revalidatePath('/employees');
  redirect(`/employees/${created.id}?created=1`);
}

/** The employee the API named in a 409. */
function named(message: string): { id: string; name: string; employeeNumber: string } | null {
  const body = parse(message);
  const found = body?.['employee'] as
    | { id?: string; name?: string; employeeNumber?: string }
    | undefined;

  return found?.id && found.name && found.employeeNumber
    ? { id: found.id, name: found.name, employeeNumber: found.employeeNumber }
    : null;
}

/** What the API said, when it said something worth repeating. */
function said(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;

  const body = parse(error.message);
  const message = body?.['message'];

  return typeof message === 'string' ? message : undefined;
}

function parse(message: string): Record<string, unknown> | null {
  const start = message.indexOf('{');
  if (start < 0) return null;

  try {
    return JSON.parse(message.slice(start)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
