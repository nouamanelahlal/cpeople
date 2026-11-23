import type { JSX } from 'react';
import { apiGetOrNull } from '../../lib/api';
import {
  CONTRACT_VIEWS,
  contractQuery,
  contractsHref,
  readContractView,
  type ContractList,
  type ContractRow,
} from '../../lib/contracts';
import { formatter, type Formatter } from '../../lib/format';
import { AppPage, appContext } from '../_shell/app-page';

const TIME_ZONE = 'Africa/Casablanca';

/**
 * The contracts list (HR-01 spec 6.6).
 *
 * Running contracts first, with the fixed terms showing how long they have
 * left, because that is the question this screen is opened to answer — and the
 * one the home screen's "Fixed terms ending" card arrives here asking.
 *
 * Scoped like every other list: a manager sees their own branch's contracts.
 */
export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  const query = await searchParams;
  const view = readContractView(query['view'] ?? query['filter']);
  const type = one(query['type']) ?? '';

  const f = formatter(context.locale, t, TIME_ZONE);
  const list = await apiGetOrNull<ContractList>(`/contracts${contractQuery(view, type)}`);

  if (list === null) {
    return (
      <AppPage
        context={context}
        current="contracts"
        title={t.contracts.title}
        subtitle={t.contracts.unavailable}
      >
        <section className="rounded-[20px] border border-card-border bg-white p-6">
          <p className="m-0 text-sm text-body">{t.contracts.unavailable}</p>
        </section>
      </AppPage>
    );
  }

  return (
    <AppPage
      context={context}
      current="contracts"
      title={t.contracts.title}
      subtitle={f.plain(t.contracts.subtitle, { count: f.count(list.rows.length) })}
    >
      <section className="flex flex-col gap-5 rounded-[20px] border border-card-border bg-white p-6">
        <div className="flex flex-wrap items-center gap-2">
          {CONTRACT_VIEWS.map((name) => (
            <a
              key={name}
              href={contractsHref(name, type)}
              aria-pressed={name === view}
              className={`quiet-button h-9 px-3.5 text-[13px] font-semibold no-underline ${
                name === view ? 'border-blue bg-tint text-blue' : 'border-button-border text-navy'
              }`}
            >
              {t.contracts.views[name]}
            </a>
          ))}

          <form method="get" action="/contracts" className="ms-auto flex items-center gap-2">
            {view !== 'running' && <input type="hidden" name="view" value={view} />}
            <label className="flex items-center gap-2 text-[13px] text-body">
              <span className="sr-only">{t.contracts.columns.type}</span>
              <select
                name="type"
                defaultValue={type}
                className="h-9 rounded-xl border border-field-border bg-white px-3 text-[13px] text-navy"
              >
                <option value="">{t.contracts.everyType}</option>
                {list.types.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="quiet-button h-9 border-button-border px-3 text-[13px] font-semibold text-navy"
            >
              {t.employees.apply}
            </button>
          </form>
        </div>

        {list.rows.length === 0 ? (
          <p className="m-0 border-t border-line py-10 text-sm text-body">{t.contracts.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t.contracts.title}</caption>
              <thead>
                <tr>
                  {[
                    t.contracts.columns.employee,
                    t.contracts.columns.type,
                    t.contracts.columns.start,
                    t.contracts.columns.end,
                    t.contracts.columns.left,
                    t.contracts.columns.status,
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="whitespace-nowrap border-b border-line pb-2.5 pe-4 text-start text-xs font-semibold uppercase tracking-[0.04em] text-muted"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {list.rows.map((row) => (
                  <Row key={row.id} row={row} f={f} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppPage>
  );
}

function Row({ row, f }: { row: ContractRow; f: Formatter }): JSX.Element {
  const t = f.t.contracts;

  return (
    <tr className="border-t border-line transition-colors duration-200 ease-out hover:bg-hover">
      <th scope="row" className="py-3 pe-4 text-start font-normal">
        <a href={`/contracts/${row.id}`} className="font-semibold text-navy">
          {row.employee.name}
        </a>
        <span className="num ms-2 text-xs text-muted">{row.employee.employeeNumber}</span>
      </th>

      <td className="py-3 pe-4">
        <span className="whitespace-nowrap rounded-full bg-sky-bg px-2.5 py-[5px] text-xs font-semibold text-sky-ink">
          {row.type.code}
        </span>
      </td>

      <td className="num whitespace-nowrap py-3 pe-4 text-body">{f.dateMedium(row.startDate)}</td>

      <td className="num whitespace-nowrap py-3 pe-4 text-body">
        {row.endDate ? f.dateMedium(row.endDate) : t.noEnd}
      </td>

      <td className="num whitespace-nowrap py-3 pe-4">
        {row.daysLeft === undefined ? (
          <span className="text-muted">—</span>
        ) : row.daysLeft < 0 ? (
          <span className="text-muted">
            {f.plain(t.endedDays, { days: f.count(Math.abs(row.daysLeft)) })}
          </span>
        ) : (
          <span
            className={`rounded-full px-2.5 py-[5px] text-xs font-semibold ${
              row.daysLeft <= 30 ? 'bg-warning-bg text-warning-ink' : 'bg-surface-quiet text-body'
            }`}
          >
            {row.daysLeft === 0 ? t.endsToday : f.plain(t.daysLeft, { days: f.count(row.daysLeft) })}
          </span>
        )}
      </td>

      <td className="py-3 pe-4">
        <span
          className={`whitespace-nowrap rounded-full px-2.5 py-[5px] text-xs font-semibold ${
            row.status === 'signed'
              ? 'bg-ok-bg text-ok-ink'
              : row.status === 'draft'
                ? 'bg-info-bg text-info-ink'
                : 'bg-surface-quiet text-body'
          }`}
        >
          {t.status[row.status]}
        </span>
      </td>
    </tr>
  );
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
