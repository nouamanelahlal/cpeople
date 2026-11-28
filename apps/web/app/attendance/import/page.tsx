import type { JSX, ReactNode } from 'react';
import { apiGetOrNull, apiGetResult } from '../../../lib/api';
import {
  exceptionText,
  importRefusalText,
  problemText,
  type ImportReport,
} from '../../../lib/attendance';
import { formatter, type Formatter } from '../../../lib/format';
import { AppPage, appContext } from '../../_shell/app-page';
import { confirmPunchFile, tryPunchFile } from '../actions';

/**
 * Bringing in a month of badge data (M10 / HR-04, build spec §5.3).
 *
 * Three steps on one page, in the order they have to happen: take the sample,
 * try the real file, and only then write it. The middle step is the whole point
 * — the file is read in full, the days are built, the exceptions are raised,
 * and **nothing is written**. What the reader sees before the button is exactly
 * what the button will do.
 *
 * The screen is deliberately blunt about what it could not match. A number the
 * company does not know is not a rounding error: it is somebody whose month is
 * missing, and it is better seen now than found in payroll.
 */
export default async function AttendanceImportPage({
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
  const allowed = await apiGetResult<{ rows: number }>('/attendance/sample');

  if (!allowed.ok) {
    return (
      <AppPage
        context={context}
        current="attendance"
        title={t.attendance.import.title}
        subtitle={t.attendance.import.note}
      >
        <Card>
          <p className="m-0 text-sm text-body">
            {allowed.refused ? t.attendance.notYours : t.attendance.unavailable}
          </p>
        </Card>
      </AppPage>
    );
  }

  // The trial left the file with its import row; the page comes back holding
  // only an id and asks what that file would do.
  const importId = one(query['import']);
  const report =
    importId === undefined
      ? null
      : await apiGetOrNull<ImportReport>(`/attendance/imports/${importId}`);

  const refused = one(query['error']);
  const done = one(query['done']) === '1';

  return (
    <AppPage
      context={context}
      current="attendance"
      title={t.attendance.import.title}
      subtitle={t.attendance.import.note}
    >
      {done && (
        <p className="m-0 rounded-2xl border border-success-border bg-success-bg px-4 py-3 text-sm text-success-ink">
          {t.attendance.import.done}
        </p>
      )}

      {refused && (
        <p
          role="alert"
          className="m-0 rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-ink"
        >
          {importRefusalText(refused.split('~')[0] ?? 'failed', t)}
        </p>
      )}

      <Card>
        <Step title={t.attendance.import.step1} note={t.attendance.import.step1Note}>
          <div className="flex flex-wrap gap-3">
            <a href="/attendance/sample.csv" className={QUIET}>
              {t.attendance.import.sample}
            </a>
            <a href="/attendance/specification.xlsx" className={QUIET}>
              {t.attendance.import.spec}
            </a>
          </div>
        </Step>
      </Card>

      <Card>
        <Step title={t.attendance.import.step2} note={t.attendance.import.step2Note}>
          <form action={tryPunchFile} className="flex flex-col gap-3">
            <label
              htmlFor="fileName"
              className="text-xs font-semibold uppercase tracking-[0.04em] text-muted"
            >
              {t.attendance.import.fileNameLabel}
            </label>
            <input
              id="fileName"
              name="fileName"
              defaultValue={report?.fileName ?? 'attendance.csv'}
              className="w-full max-w-md rounded-xl border border-field-border bg-white px-3.5 py-2.5 text-sm text-navy"
            />

            <label
              htmlFor="content"
              className="mt-2 text-xs font-semibold uppercase tracking-[0.04em] text-muted"
            >
              {t.attendance.import.file}
            </label>
            <textarea
              id="content"
              name="content"
              rows={8}
              aria-describedby="content-note"
              className="w-full rounded-xl border border-field-border bg-white px-3.5 py-3 font-mono text-[13px] text-navy"
            />
            <span id="content-note" className="text-xs text-body">
              {t.attendance.import.fileNote}
            </span>

            <button type="submit" className={`${PRIMARY} w-fit`}>
              {t.attendance.import.trial}
            </button>
          </form>
        </Step>
      </Card>

      {report && <Trial report={report} f={f} />}

      <a href="/attendance" className="text-sm font-semibold text-blue">
        {t.attendance.title}
      </a>
    </AppPage>
  );
}

/** What the file would do, before it does it. */
function Trial({ report, f }: { report: ImportReport; f: Formatter }): JSX.Element {
  const { t } = f;
  const i = t.attendance.import;

  const unreadable = report.rows === 0;

  return (
    <>
      <Card>
        <h2 className="m-0 text-lg font-semibold text-navy">{i.read}</h2>

        {unreadable ? (
          <p
            role="alert"
            className="m-0 rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-ink"
          >
            {report.problems.length > 0
              ? problemText(report.problems[0]!.kind, t)
              : importRefusalText('importEmpty', t)}
          </p>
        ) : (
          <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-8 gap-y-4">
            <Figure label={i.counts.rows} value={f.count(report.rows)} />
            <Figure label={i.counts.matched} value={f.count(report.matched)} />
            <Figure label={i.counts.unknown} value={f.count(report.unknown)} />
            <Figure label={i.counts.duplicates} value={f.count(report.duplicates)} />
            <Figure label={i.counts.days} value={f.count(report.daysBuilt)} />
            {report.from && report.to && (
              <Figure
                label={i.counts.period}
                value={`${f.dateMedium(report.from)} – ${f.dateMedium(report.to)}`}
              />
            )}
          </dl>
        )}
      </Card>

      {/* A number nobody recognises, and the person it is probably meant to be.
          The suggestion is shown, never applied: a wrong guess puts somebody
          else's hours on somebody's payslip. */}
      {report.unknownNumbers.length > 0 && (
        <Card>
          <h2 className="m-0 text-lg font-semibold text-danger-ink">
            {f.plain(i.unknownTitle, { count: f.count(report.unknownNumbers.length) })}
          </h2>
          <p className="m-0 max-w-prose text-[13px] text-body">{i.unknownNote}</p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {[i.columns.number, i.columns.punches, i.columns.looksLike].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="border-b border-line pb-2.5 pe-4 text-start text-xs font-semibold uppercase tracking-[0.04em] text-muted"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.unknownNumbers.map((row) => (
                  <tr key={row.employeeNumber} className="border-t border-line">
                    <th
                      scope="row"
                      className="num py-3 pe-4 text-start font-semibold text-navy"
                    >
                      {row.employeeNumber}
                    </th>
                    <td className="num py-3 pe-4 text-body">{f.count(row.punches)}</td>
                    <td className="py-3 pe-4 text-body">
                      {row.suggestion ? (
                        <>
                          {row.suggestion.name}
                          <span className="num ms-2 text-xs text-muted">
                            {row.suggestion.employeeNumber}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">{i.noMatch}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {report.problems.length > 0 && !unreadable && (
        <Card>
          <h2 className="m-0 text-lg font-semibold text-danger-ink">
            {f.plain(i.problems, { count: f.count(report.problems.length) })}
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {[i.columns.line, i.columns.problem, ''].map((label, index) => (
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
                {report.problems.slice(0, 50).map((problem) => (
                  <tr key={`${problem.line}-${problem.kind}`} className="border-t border-line">
                    <th scope="row" className="num py-3 pe-4 text-start font-semibold text-navy">
                      {problem.line}
                    </th>
                    <td className="py-3 pe-4 text-body">{problemText(problem.kind, t)}</td>
                    <td className="py-3 font-mono text-[13px] text-muted">{problem.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* The exceptions, by kind, before anything is written. This is the list
          the workshop reads: the sample's problems, found rather than told. */}
      {report.exceptionsByCode.length > 0 && (
        <Card>
          <h2 className="m-0 text-lg font-semibold text-navy">
            {f.plain(i.exceptionsTitle, {
              count: f.count(report.exceptionsByCode.reduce((sum, row) => sum + row.count, 0)),
            })}
          </h2>

          <ul
            aria-label={i.exceptionsTitle}
            className="m-0 flex list-none flex-col gap-2 p-0 text-[13px]"
          >
            {report.exceptionsByCode.map((row) => (
              <li
                key={row.code}
                data-code={row.code}
                className="flex items-center justify-between gap-4 rounded-xl bg-surface-quiet px-3.5 py-2.5"
              >
                <span className="text-body">{exceptionText(row.code, t)}</span>
                <span className="num font-semibold text-navy">{f.count(row.count)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <Step title={i.step3} note={i.step3Note}>
          {report.manualDaysKept > 0 && (
            <p className="m-0 rounded-2xl border border-tint-border bg-tint px-4 py-3 text-[13px] text-navy">
              {f.plain(i.manualKept, { count: f.count(report.manualDaysKept) })}
            </p>
          )}

          <form action={confirmPunchFile}>
            <input type="hidden" name="importId" value={report.importId} />
            <button
              type="submit"
              disabled={unreadable || report.applied}
              className={`${PRIMARY} mt-1 disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {i.confirm}
            </button>
          </form>
        </Step>
      </Card>
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">{label}</dt>
      <dd className="num m-0 text-2xl font-light text-navy">{value}</dd>
    </div>
  );
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
  'quiet-button h-11 w-fit border-button-border px-4 text-[13px] font-semibold leading-[44px] text-navy no-underline';

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
