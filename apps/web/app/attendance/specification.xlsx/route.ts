import { NextResponse } from 'next/server';
import { apiGetOrNull } from '../../../lib/api';

/**
 * The attendance file specification (HR-02 build spec §5.1).
 *
 * The document SMG sends to the device provider. The API builds the workbook;
 * this hands it to the browser as a download.
 */
export async function GET(): Promise<NextResponse> {
  const spec = await apiGetOrNull<{ filename: string; base64: string }>(
    '/attendance/file-specification',
  );

  if (spec === null) {
    return new NextResponse('', { status: 403 });
  }

  const body = Buffer.from(spec.base64, 'base64');

  return new NextResponse(new Uint8Array(body), {
    headers: {
      'content-type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${spec.filename}"`,
      'cache-control': 'no-store',
    },
  });
}
