'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiPatch } from '../../../lib/api';

/**
 * Changing a department (HR-01 spec 6.5).
 *
 * The cost centre is the one that matters: payroll is posted to SAP by cost
 * centre, so moving a department's is a decision with money behind it. The form
 * asks whether its people should follow before it is sent, and the answer comes
 * back as a count of who actually did.
 */
export async function saveDepartment(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');

  if (id === '') {
    redirect('/settings/organisation');
  }

  const body: Record<string, string | boolean> = {
    costCentreCode: String(formData.get('costCentreCode') ?? '').trim(),
    siteCode: String(formData.get('siteCode') ?? '').trim(),
    headEmployeeId: String(formData.get('headEmployeeId') ?? '').trim(),
    applyToEmployees: formData.get('applyToEmployees') !== null,
  };

  const name = String(formData.get('name') ?? '').trim();
  if (name !== '') {
    body['name'] = name;
  }

  try {
    const answer = await apiPatch<{ employeesMoved: number }>(
      `/organisation/departments/${id}`,
      body,
    );

    revalidatePath('/settings/organisation');
    redirect(`/settings/organisation?saved=${answer.employeesMoved}`);
  } catch (error) {
    if (isRedirect(error)) {
      throw error;
    }

    console.error('changing a department failed', error);
    redirect('/settings/organisation?error=1');
  }
}

/** `redirect()` works by throwing, so its own error must pass through. */
function isRedirect(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}
