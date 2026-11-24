'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiPatch } from '../../../lib/api';

/**
 * Saving the column mapping (HR-02 build spec §5.1).
 *
 * A provider that names its columns differently is a setting somebody changes
 * in a meeting, which is why this exists at all.
 */
export async function saveMapping(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '');

  const body = {
    mapping: {
      employeeNumber: String(formData.get('employeeNumber') ?? '').trim(),
      timestamp: String(formData.get('timestamp') ?? '').trim(),
      direction: String(formData.get('direction') ?? '').trim(),
      deviceId: String(formData.get('deviceId') ?? '').trim(),
    },
    timezone: String(formData.get('timezone') ?? '').trim(),
    duplicateWindowSeconds: Number(formData.get('duplicateWindowSeconds') ?? 120),
  };

  try {
    await apiPatch(`/attendance/sources/${id}`, body);
  } catch (error) {
    console.error('attendance mapping failed', error);
    redirect('/settings/attendance?error=1');
  }

  revalidatePath('/settings/attendance');
  redirect('/settings/attendance?saved=1');
}
