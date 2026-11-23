'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiSend } from '../../../lib/api';
import { tabHref } from '../../../lib/employee-file';

/**
 * Ticking an onboarding task off, and making a new hire an employee
 * (HR-01 spec 6.8).
 *
 * Who may do either is decided by the API: a manager ticks their own items, HR
 * runs the list, and nobody makes a file active while something required on it
 * is still outstanding.
 */
export async function tickTask(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');
  const taskId = String(formData.get('taskId') ?? '');

  if (id === '' || taskId === '') {
    redirect('/employees');
  }

  try {
    await apiSend(`/employees/${id}/onboarding/${taskId}`);
  } catch (error) {
    console.error('ticking an onboarding task failed', error);
    redirect(`${tabHref(id, 'onboarding')}&error=1`);
  }

  revalidatePath(`/employees/${id}`);
  redirect(tabHref(id, 'onboarding'));
}

export async function activateEmployee(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');

  if (id === '') {
    redirect('/employees');
  }

  try {
    await apiSend(`/employees/${id}/activate`);
  } catch (error) {
    console.error('making an employee active failed', error);
    redirect(`${tabHref(id, 'onboarding')}&error=1`);
  }

  revalidatePath(`/employees/${id}`);
  redirect(`${tabHref(id, 'onboarding')}&activated=1`);
}
