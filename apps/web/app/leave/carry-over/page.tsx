import type { JSX, ReactNode } from 'react';
import { apiGetOrNull } from '../../../lib/api';
import { formatter, type Formatter } from '../../../lib/format';
import {
  leaveTypeName,
  readRefusal,
  refusalText,
  type CarryOverResult,
  type CarryOverRun,
} from '../../../lib/leave';
import { AppPage, appContext } from '../../_shell/app-page';
import { applyCarryOver, previewCarryOver } from '../actions';

/**
 * Year end (M09 / HR-04).
 *
 * The screen in front of the one operation in leave that moves every balance in
 * the company at once. So: **nothing happens until it has been previewed.** The
 * preview is the same arithmetic as the run, writes nothing, and shows the list
 * person by person — what was left, what carries, and what the rule loses.
 *
 * Running it twice is safe by construction: one row per person per type per
 * year, so a second pass replaces a figure rather than adding to it. That is
 * worth knowing, because the first thing anybody does with a year-end run is
 * wonder whether they pressed it already.
 */
export default async function CarryOverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  const query = await searchParams;
  const f = formatter(context.locale, t, 'Africa/Casablanca');

  const runs = await apiGetOrNull<CarryOverRun[]>('/leave/balances/carry-over');

  if (runs === null) {
    return (
      <AppPage context={context} current="leave" title={t.leave.carryOver.title} subtitle={t.leave.subtitle}>
        <Card>
          <p className="m-0 text-sm text-body">{t.leave.errors.notYours}</p>
        </Card>
      </AppPage>
    );
  }

  const asked = Number.parseInt(one(query['year']) ?? '', 10);
  const year = Number.isFinite(asked) ? asked : new Date().getUTCFullYear() - 1;
  const refused = readRefusal(query['error']);
  const done = one(query['done']) === '1';

  // Previewed while the page renders, because the preview *is* the page.
  const result = one(query['preview']) === '1' ? await previewCarryOver(year) : null;

  return (
    <AppPage
      context={context}
      current="leave"
      title={t.leave.carryOver.title}
      subtitle={t.leave.carryOver.note}
    >
      {done && (
        <p className="m-0 rounded-2xl border border-success-border bg-success-bg px-4 py-3 text-sm text-success-ink">
          {t.leave.carryOver.done}
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
        <form method="get" action="/leave/carry-over" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="preview" value="1" />

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
              {t.leave.carryOver.year}
            </span>
            <input
              type="number"
              name="year"
              min={2000}
              max={2100}
              defaultValue={year}
              className="h-11 w-32 rounded-xl border border-field-border bg-white px-3.5 text-sm text-navy"
            />
          </label>

          <button type="submit" className={PRIMARY}>
            {t.leave.carryOver.preview}
          </button>
        </form>

        <p className="m-0 text-xs text-muted">{t.leave.carryOver.queued}</p>
      </Card>

      {result && <Result result={result} f={f} />}

      {runs.length > 0 && (
        <Card>
          <h2 className="m-0 text-lg font-semibold text-navy">{t.leave.carryOver.lastRuns}</h2>

          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {runs.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl bg-surface-quiet px-3.5 py-2.5 text-[13px] text-body"
              >
                <span className="num font-semibold text-navy">
                  {run.fromYear} → {run.fromYear + 1}
                </span>
                <span>{t.leave.carryOver.runStatus[run.status]}</span>
                <span className="num">
                  {f.plain(t.leave.carryOver.summary, {
                    employees: f.count(run.employees),
                    carried: f.count(run.carried),
                    lost: f.count(run.lost),
                  })}
                </span>
                <span className="ms-auto text-xs text-muted">
                  {run.byName} · {f.dateTime(run.startedAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <a href="/leave?tab=balances" className="text-sm font-semibold text-blue">
        {t.leave.balances.title}
      </a>
    </AppPage>
  );
}

function Result({ result, f }: { result: CarryOverResult; f: Formatter }): JSX.Element {
  const t = f.t.leave.carryOver;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-lg font-semibold text-navy">
            {f.plain(result.status === 'applied' ? t.appliedTitle : t.previewTitle, {
              year: String(result.fromYear),
              next: String(result.toYear),
            })}
          </h2>
          <p className="m-0 text-[13px] text-body">
            {f.plain(t.summary, {
              employees: f.count(result.employees),
              carried: f.count(result.carried),
              lost: f.count(result.lost),
            })}
          </p>
        </div>

        {result.status === 'preview' && result.lines.length > 0 && (
          <form action={applyCarryOver}>
            <input type="hidden" name="year" value={result.fromYear} />
            <button type="submit" className={PRIMARY}>
              {t.apply}
            </button>
          </form>
        )}
      </div>

      {result.lines.length === 0 ? (
        <p className="m-0 py-6 text-sm text-body">{t.nothing}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {[
                  t.columns.employee,
                  t.columns.type,
                  t.columns.leftOver,
                  t.columns.days,
                  t.columns.mode,
                  t.columns.expires,
                ].map((label, index) => (
                  <th
                    key={`${label}-${index}`}
                    scope="col"
                    className={`whitespace-nowrap border-b border-line pb-2.5 pe-4 text-xs font-semibold uppercase tracking-[0.04em] text-muted ${
                      index === 2 || index === 3 ? 'text-end' : 'text-start'
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {result.lines.slice(0, 200).map((line) => (
                <tr
                  key={`${line.employee.id}-${line.leaveType.id}`}
                  className="border-t border-line"
                >
                  <th scope="row" className="py-3 pe-4 text-start font-semibold text-navy">
                    {line.employee.name}
                    <span className="num block text-xs font-normal text-muted">
                      {line.employee.number}
                    </span>
                  </th>
                  <td className="py-3 pe-4 text-body">{leaveTypeName(line.leaveType, f.t)}</td>
                  <td className="num py-3 pe-4 text-end text-body">{f.count(line.leftOver)}</td>
                  <td className="num py-3 pe-4 text-end font-semibold text-navy">
                    {f.count(line.days)}
                  </td>
                  <td className="py-3 pe-4 text-body">{t.modes[line.mode]}</td>
                  <td className="num py-3 pe-4 text-body">
                    {line.expiresOn ? f.dateMedium(line.expiresOn) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
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

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
