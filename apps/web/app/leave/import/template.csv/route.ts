import { NextResponse } from 'next/server';
import { apiGetOrNull } from '../../../../lib/api';

/**
 * The opening-balance template, as a file to fill in (M09 / HR-04).
 *
 * The API builds it — with a real employee number and a real leave type in the
 * example row, so the format cannot be guessed wrong — and this hands it to the
 * browser as a download.
 */
export async function GET(): Promise<NextResponse> {
  const template = await apiGetOrNull<{ content: string; filename: string }>(
    '/leave/balances/import/template',
  );

  if (template === null) {
    return new NextResponse('', { status: 403 });
  }

  return new NextResponse(`${BOM}${template.content}`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${template.filename}"`,
      'cache-control': 'no-store',
    },
  });
}

/**
 * The byte-order mark Excel wants.
 *
 * Without it a French Windows opens a UTF-8 file as its own code page and every
 * accented name arrives mangled. Written as an escape rather than as the
 * character itself, which is invisible in a diff.
 */
const BOM = '\uFEFF';
