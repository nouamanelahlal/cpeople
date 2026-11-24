import type { JSX } from 'react';
import type { Formatter } from '../../../../lib/format';
import {
  leaveTypeName,
  type BalanceHistoryRow,
  type BalanceStatement,
} from '../../../../lib/leave';
import { adjustBalance } from '../../../leave/actions';

/**
 * The Absences tab of an employee file (M09 / HR-04).
 *
 * Three things, in the order somebody asks about them: what this person has
 * now, how it got there, and — for HR — how to move it.
 *
 * The history is the heart of it. Every row that has ever moved this balance,
 * with the reason beside the ones that have one, and nothing on it editable:
 * putting an adjustment right is another adjustment the other way, and both
 * stay. A balance nobody can explain is a balance nobody will trust.
 */
export function AbsencesTab({
  statement,
  history,
  employeeId,
  mayAdjust,
  f,
}: {
  statement: BalanceStatement | null;
  history: readonly BalanceHistoryRow[];
  employeeId: string;
  mayAdjust: boolean;
  f: Formatter;
}): JSX.Element {
  const t = f.t.leave.balances;

  if (statement === null) {
    return <p className="m-0 text-sm text-body">{f.t.leave.errors.unavailable}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
        {statement.lines.map((line) => (
          <div
            key={line.leaveType.id}
            className="flex flex-col gap-1 rounded-2xl border border-card-border bg-surface-quiet px-4 py-3.5"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
              {leaveTypeName(line.leaveType, f.t)}
            </span>
            <span className="num text-2xl font-light text-navy">
              {f.count(line.balance.remaining)}
            </span>
            <span className="num text-xs text-body">
              {t.columns.accrued} {f.count(line.balance.accrued)} · {t.columns.taken}{' '}
              {f.count(line.balance.taken)}
            </span>
            {line.carriedExpiresOn !== undefined && line.balance.carried > 0 && (
              <span className="text-xs text-warning-ink">
                {f.plain(t.mine.expires, { date: f.dateMedium(line.carriedExpiresOn) })}
              </span>
            )}
          </div>
        ))}
      </section>

      {mayAdjust && (
        <section className="flex flex-col gap-3 border-t border-line pt-5">
          <div className="flex flex-col gap-1">
            <h3 className="m-0 text-sm font-semibold text-navy">{t.adjust.title}</h3>
            <p className="m-0 max-w-prose text-[13px] text-body">{t.adjust.reasonNote}</p>
          </div>

          <form action={adjustBalance} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="employeeId" value={employeeId} />

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
                {t.adjust.type}
              </span>
              <select name="leaveTypeId" className={INPUT}>
                {statement.lines.map((line) => (
                  <option key={line.leaveType.id} value={line.leaveType.id}>
                    {leaveTypeName(line.leaveType, f.t)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
                {t.adjust.days}
              </span>
              <input
                type="text"
                inputMode="decimal"
                name="days"
                required
                placeholder="-1"
                aria-describedby="days-note"
                className={`${INPUT} w-28`}
              />
            </label>

            <label className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
                {t.adjust.reason}
              </span>
              <input type="text" name="reason" required maxLength={240} className={INPUT} />
            </label>

            <button
              type="submit"
              className="h-11 rounded-xl bg-blue px-5 text-sm font-semibold text-white transition-[background-color] duration-200 ease-out hover:bg-blue-hover"
            >
              {t.adjust.save}
            </button>

            <span id="days-note" className="basis-full text-xs text-body">
              {t.adjust.daysNote}
            </span>
          </form>
        </section>
      )}

      <section className="flex flex-col gap-3 border-t border-line pt-5">
        <div className="flex flex-col gap-1">
          <h3 className="m-0 text-sm font-semibold text-navy">{t.history.title}</h3>
          <p className="m-0 max-w-prose text-[13px] text-body">{t.history.note}</p>
        </div>

        {history.length === 0 ? (
          <p className="m-0 text-sm text-body">{t.history.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {['', t.columns.type, t.columns.movement, t.adjust.reason].map((label, index) => (
                    <th
                      key={`${label}-${index}`}
                      scope="col"
                      className={`whitespace-nowrap border-b border-line pb-2.5 pe-4 text-xs font-semibold uppercase tracking-[0.04em] text-muted ${
                        index === 2 ? 'text-end' : 'text-start'
                      }`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {history.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="border-t border-line align-top">
                    <th scope="row" className="py-3 pe-4 text-start font-semibold text-navy">
                      {t.history.kinds[row.kind]}
                      <span className="num block text-xs font-normal text-muted">
                        {f.dateMedium(row.on)}
                      </span>
                    </th>

                    <td className="py-3 pe-4 text-body">{leaveTypeName(row.leaveType, f.t)}</td>

                    <td
                      className={`num whitespace-nowrap py-3 pe-4 text-end font-semibold ${
                        row.days < 0 ? 'text-danger-ink' : 'text-ok-ink'
                      }`}
                    >
                      {row.days > 0 ? `+${f.count(row.days)}` : f.count(row.days)}
                    </td>

                    <td className="py-3 text-body">
                      {row.requestId ? (
                        <a href={`/leave/${row.requestId}`}>{f.t.leave.open}</a>
                      ) : (
                        (row.reason ?? '')
                      )}
                      {row.by && (
                        <span className="block text-xs text-muted">{row.by}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const INPUT = 'h-11 rounded-xl border border-field-border bg-white px-3.5 text-sm text-navy';
