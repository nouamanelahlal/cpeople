'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ApiError, apiPatch } from '../../../lib/api';
import { readTab, tabHref } from '../../../lib/employee-file';

/** What a form on the file may send, by the name the API knows it as. */
const TEXT_FIELDS = [
  'firstName',
  'lastName',
  'phone',
  'email',
  'address',
  'maritalStatus',
  'nationalId',
  'socialSecurityNumber',
  'bankName',
  'bankAccount',
] as const;

/**
 * Saves a change to an employee file (HR-01 spec 6.3).
 *
 * The form sends only the fields it showed, and the API accepts only the fields
 * this person may change, so neither side is trusted to be the only guard. What
 * comes back is the file as it now is; what is recorded is the before and after
 * of everything that actually changed.
 *
 * A refusal lands back on the form with something to act on rather than a stack
 * trace: a national identifier that belongs to someone else names them, with a
 * link to their file.
 */
export async function saveEmployee(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const tab = readTab(String(formData.get('tab') ?? ''));

  if (id === '') {
    redirect('/employees');
  }

  const body: Record<string, string | number | boolean> = {};

  for (const field of TEXT_FIELDS) {
    const value = formData.get(field);
    if (value !== null) {
      body[field] = String(value).trim();
    }
  }

  // A salary is typed in whole dirhams and stored in minor units (rule 4).
  const salary = formData.get('baseSalary');
  if (salary !== null && String(salary).trim() !== '') {
    const amount = Number.parseFloat(String(salary).replace(/\s/g, '').replace(',', '.'));
    if (Number.isFinite(amount) && amount >= 0) {
      body['baseSalaryMinor'] = Math.round(amount * 100);
    }
  }

  // An unchecked checkbox sends nothing, which is how it says "no".
  if (formData.get('pensionMemberShown') !== null) {
    body['pensionMember'] = formData.get('pensionMember') !== null;
  }

  try {
    await apiPatch(`/employees/${id}`, body);
  } catch (error) {
    redirect(`${tabHref(id, tab, { edit: true })}&${problem(error)}`);
  }

  revalidatePath(`/employees/${id}`);
  redirect(`${tabHref(id, tab)}${tabHref(id, tab).includes('?') ? '&' : '?'}saved=1`);
}

/**
 * The query string that tells the form what went wrong.
 *
 * `redirect` throws, so it must not be caught here; everything else is turned
 * into something the page can say in the reader's own language.
 */
function problem(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) {
    const clash = duplicate(error.message);

    if (clash) {
      const query = new URLSearchParams({
        error: 'duplicate-cin',
        withId: clash.id,
        withName: clash.name,
        withNumber: clash.employeeNumber,
      });
      return query.toString();
    }
  }

  console.error('saving an employee file failed', error);
  return 'error=saving-failed';
}

/** The employee the API named in a 409, when it named one. */
function duplicate(message: string): { id: string; name: string; employeeNumber: string } | null {
  const start = message.indexOf('{');
  if (start < 0) return null;

  try {
    const body = JSON.parse(message.slice(start)) as {
      employee?: { id?: string; name?: string; employeeNumber?: string };
    };
    const found = body.employee;

    return found?.id && found.name && found.employeeNumber
      ? { id: found.id, name: found.name, employeeNumber: found.employeeNumber }
      : null;
  } catch {
    return null;
  }
}
