'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiPatch } from '../../../lib/api';

/**
 * Saving the self-service settings (HR-02 build spec §7.1).
 *
 * An unticked checkbox sends nothing at all, which is why each switch is read
 * as "is it present" rather than "what is its value": the form has to be able to
 * turn something off, and a missing field is how a form says off.
 */
export async function saveSelfService(formData: FormData): Promise<void> {
  const body = {
    employeesSeeSalary: formData.get('employeesSeeSalary') !== null,
    showLeaveTypeToColleagues: formData.get('showLeaveTypeToColleagues') !== null,
    employeesEditContact: formData.get('employeesEditContact') !== null,
    employeeNumberPattern: String(formData.get('employeeNumberPattern') ?? '').trim(),
  };

  try {
    await apiPatch('/settings/self-service', body);
  } catch (error) {
    console.error('self-service settings failed', error);
    redirect('/settings/self-service?error=1');
  }

  // The salary rule is enforced when a file is read, so every page that might
  // show one has to be worked out again.
  revalidatePath('/', 'layout');
  redirect('/settings/self-service?saved=1');
}
