import { NextResponse, type NextRequest } from 'next/server';
import { getMessages, toLocale } from '@cpeople/shared';
import { cookies } from 'next/headers';
import { apiGetOrNull } from '../../../lib/api';
import { LOCALE_COOKIE } from '../../../lib/locale';
import { leaveTypeName, type BalanceList } from '../../../lib/leave';

/**
 * The balances table, as a file (M09 / HR-04).
 *
 * The same request the screen makes, so what is downloaded is what is on the
 * screen and not a second opinion — including the scope: a manager downloading
 * this gets their own branch of the organisation, because the API decides that
 * and this route only asks.
 *
 * Semicolons, and a byte-order mark, because the people who open this open it
 * in Excel on a French Windows and a comma-separated file arrives there as one
 * long column.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const asked = request.nextUrl.searchParams;

  const query = new URLSearchParams({
    ...(asked.get('q') ? { q: asked.get('q') as string } : {}),
    ...(asked.get('department') ? { department: asked.get('department') as string } : {}),
    // Everything the reader may see, not just the first page of it.
    limit: '500',
  });

  const list = await apiGetOrNull<BalanceList>(`/leave/balances?${query}`);

  if (list === null) {
    return new NextResponse('', { status: 403 });
  }

  const store = await cookies();
  const t = getMessages(toLocale(store.get(LOCALE_COOKIE)?.value));
  const columns = t.leave.balances.columns;

  const header = [
    columns.employee,
    'Matricule',
    columns.type,
    columns.opening,
    columns.carried,
    columns.accrued,
    columns.taken,
    columns.pending,
    columns.adjusted,
    columns.remaining,
  ];

  const rows = list.employees.flatMap((statement) =>
    statement.lines.map((line) => [
      statement.employee.name,
      statement.employee.number,
      leaveTypeName(line.leaveType, t),
      line.balance.opening,
      line.balance.carried,
      line.balance.accrued,
      line.balance.taken,
      line.balance.pending,
      line.balance.adjusted,
      line.balance.remaining,
    ]),
  );

  const body = [header, ...rows].map((row) => row.map(cell).join(';')).join('\r\n');

  return new NextResponse(`${BOM}${body}\r\n`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="cpeople-balances-${list.today}.csv"`,
      'cache-control': 'no-store',
    },
  });
}

function cell(value: string | number): string {
  const text = String(value);
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The byte-order mark Excel wants.
 *
 * Without it a French Windows opens a UTF-8 file as its own code page and every
 * accented name arrives mangled. Written as an escape rather than as the
 * character itself, which is invisible in a diff.
 */
const BOM = '\uFEFF';
