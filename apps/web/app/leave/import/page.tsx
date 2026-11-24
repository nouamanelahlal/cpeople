import type { JSX, ReactNode } from 'react';
import { apiGetOrNull } from '../../../lib/api';
import { formatter } from '../../../lib/format';
import { readRefusal, refusalText } from '../../../lib/leave';
import { AppPage, appContext } from '../../_shell/app-page';
import { confirmOpeningBalances, tryOpeningBalances } from '../actions';

/**
 * Bringing in the balances people already had (M09 / HR-04).
 *
 * Three steps on one page, in the order they have to happen: take the template,
 * try the filled-in file, and only then confirm it. The middle step is the point
 * — a file is read and checked in full and **nothing is written**, so every
 * problem is seen at once instead of one per attempt.
 *
 * The trial's answer is kept in the form, so confirming sends exactly the file
 * that was checked and not whatever is in the box by then.
 */
export default async function ImportBalancesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  const query = await searchParams;
  const f = formatter(context.locale, t, 'Africa/Casablanca');

  // Asked for its own sake: it is also how this page finds out whether the
  // reader may import at all.
  const template = await apiGetOrNull<{ content: string }>('/leave/balances/import/template');

  if (template === null) {
    return (
      <AppPage context={context} current="leave" title={t.leave.import.title} subtitle={t.leave.subtitle}>
        <Card>
          <p className="m-0 text-sm text-body">{t.leave.errors.notYours}</p>
        </Card>
      </AppPage>
    );
  }

  const refused = readRefusal(query['error']);
  const content = one(query['content']) ?? '';
  const report = content === '' ? null : await tryOpeningBalances(content);
  const done = one(query['done']) === '1';

  return (
    <AppPage
      context={context}
      current="leave"
      title={t.leave.import.title}
      subtitle={t.leave.import.note}
    >
      {done && (
        <p className="m-0 rounded-2xl border border-success-border bg-success-bg px-4 py-3 text-sm text-success-ink">
          {t.leave.import.done}
        </p>
      )}

      {refused && (
        <p
          role="alert"
          className="m-0 rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-ink"
        >
          {refusalText(refused, t)}
        </p>
      )}

      <Card>
        <Step title={t.leave.import.step1} note={t.leave.import.step1Note}>
          <a href="/leave/import/template.csv" className={QUIET}>
            {t.leave.import.template}
          </a>
        </Step>
      </Card>

      <Card>
        <Step title={t.leave.import.step2} note={t.leave.import.step2Note}>
          <form method="get" action="/leave/import" className="flex flex-col gap-3">
            <label htmlFor="content" className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
              {t.leave.import.file}
            </label>
            <textarea
              id="content"
              name="content"
              rows={8}
              defaultValue={content}
              aria-describedby="content-note"
              className="w-full rounded-xl border border-field-border bg-white px-3.5 py-3 font-mono text-[13px] text-navy"
            />
            <span id="content-note" className="text-xs text-body">
              {t.leave.import.fileNote}
            </span>

            <button type="submit" className={`${PRIMARY} w-fit`}>
              {t.leave.import.trial}
            </button>
          </form>
        </Step>
      </Card>

      {report && (
        <Card>
          <div className="flex flex-col gap-4">
            {report.problems.length > 0 ? (
              <>
                <h2 className="m-0 text-lg font-semibold text-danger-ink">
                  {f.plain(t.leave.import.problems, { count: String(report.problems.length) })}
                </h2>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        {[t.leave.import.columns.line, t.leave.import.columns.problem, ''].map(
                          (label, index) => (
                            <th
                              key={`${label}-${index}`}
                              scope="col"
                              className="border-b border-line pb-2.5 pe-4 text-start text-xs font-semibold uppercase tracking-[0.04em] text-muted"
                            >
                              {label}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {report.problems.map((problem) => (
                        <tr key={`${problem.line}-${problem.kind}`} className="border-t border-line">
                          <th scope="row" className="num py-3 pe-4 text-start font-semibold text-navy">
                            {problem.line}
                          </th>
                          <td className="py-3 pe-4 text-body">{reason(problem.kind, t)}</td>
                          <td className="py-3 font-mono text-[13px] text-muted">{problem.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <h2 className="m-0 text-lg font-semibold text-navy">{t.leave.import.noProblems}</h2>
            )}

            <Step title={t.leave.import.step3} note={t.leave.import.step3Note}>
              <p className="m-0 text-sm text-body">
                {f.plain(t.leave.import.accepted, { count: String(report.accepted.length) })}
              </p>

              <form action={confirmOpeningBalances}>
                <input type="hidden" name="content" value={content} />
                <button
                  type="submit"
                  disabled={report.problems.length > 0 || report.accepted.length === 0}
                  className={`${PRIMARY} mt-3 disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {t.leave.import.confirm}
                </button>
              </form>
            </Step>

            {report.accepted.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {[
                        t.leave.import.columns.line,
                        t.leave.import.columns.employee,
                        t.leave.import.columns.type,
                        t.leave.import.columns.days,
                        t.leave.import.columns.balanceAt,
                      ].map((label, index) => (
                        <th
                          key={`${label}-${index}`}
                          scope="col"
                          className="border-b border-line pb-2.5 pe-4 text-start text-xs font-semibold uppercase tracking-[0.04em] text-muted"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.accepted.map((row) => (
                      <tr key={row.line} className="border-t border-line">
                        <th scope="row" className="num py-3 pe-4 text-start font-semibold text-navy">
                          {row.line}
                        </th>
                        <td className="py-3 pe-4 text-body">
                          {row.employee}
                          <span className="num ms-2 text-xs text-muted">{row.employeeNumber}</span>
                        </td>
                        <td className="py-3 pe-4 text-body">{row.leaveType}</td>
                        <td className="num py-3 pe-4 text-navy">{f.count(row.days)}</td>
                        <td className="num py-3 pe-4 text-body">{f.dateMedium(row.balanceAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      <a href="/leave?tab=balances" className="text-sm font-semibold text-blue">
        {t.leave.balances.title}
      </a>
    </AppPage>
  );
}

function reason(kind: string, t: { leave: { import: { reasons: Record<string, string> } } }): string {
  return t.leave.import.reasons[kind] ?? kind;
}

function Step({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-navy">{title}</h2>
        <p className="m-0 max-w-prose text-[13px] text-body">{note}</p>
      </div>
      {children}
    </section>
  );
}

function Card({ children }: { children: ReactNode }): JSX.Element {
  return (
    <section className="flex flex-col gap-5 rounded-[20px] border border-card-border bg-white p-6">
      {children}
    </section>
  );
}

const PRIMARY =
  'h-11 rounded-xl bg-blue px-5 text-sm font-semibold text-white transition-[background-color] duration-200 ease-out hover:bg-blue-hover';
const QUIET =
  'quiet-button h-11 w-fit border-button-border px-4 text-[13px] font-semibold text-navy no-underline';

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
