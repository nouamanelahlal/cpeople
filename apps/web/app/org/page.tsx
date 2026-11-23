import type { JSX } from 'react';
import { apiGetOrNull } from '../../lib/api';
import { formatter, type Formatter } from '../../lib/format';
import { AppPage, appContext } from '../_shell/app-page';

const TIME_ZONE = 'Africa/Casablanca';

/** The colour band down a card, by department: five, in the brand's own palette. */
const BANDS = ['bg-cyan', 'bg-blue', 'bg-light-cyan', 'bg-amber-ink', 'bg-violet-ink'] as const;

interface ChartNode {
  readonly id: string;
  readonly name: string;
  readonly initials: string;
  readonly position: string;
  readonly department: { readonly code: string; readonly name: string };
  readonly status: string;
  readonly reports: number;
  readonly children: readonly ChartNode[];
}

interface Chart {
  readonly roots: readonly ChartNode[];
  readonly total: number;
  readonly departments: readonly { readonly code: string; readonly name: string }[];
  readonly department?: string;
  readonly scope: 'all' | 'team' | 'own';
}

/**
 * The organisation chart (HR-01 spec 6.9).
 *
 * The tree people work in, drawn as a tree: nested lists, each branch a
 * `<details>` that opens and closes without any script at all. 148 people is a
 * long page, not a slow one, and a chart that works with the keyboard and the
 * browser's own find is worth more at a workshop than one that pans and zooms.
 *
 * A manager's chart begins with them, because that is the part of the company
 * that is theirs: the scope comes from the API, not from a filter here.
 */
export default async function OrgChartPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  const query = await searchParams;
  const department = one(query['department']) ?? '';
  const find = (one(query['q']) ?? '').trim();

  const f = formatter(context.locale, t, TIME_ZONE);
  const chart = await apiGetOrNull<Chart>(
    `/organisation/chart${department === '' ? '' : `?department=${encodeURIComponent(department)}`}`,
  );

  if (chart === null) {
    return (
      <AppPage context={context} current="orgChart" title={t.chart.title} subtitle={t.chart.unavailable}>
        <section className="rounded-[20px] border border-card-border bg-white p-6">
          <p className="m-0 text-sm text-body">{t.chart.unavailable}</p>
        </section>
      </AppPage>
    );
  }

  const bands = new Map(
    chart.departments.map((item, index) => [item.code, BANDS[index % BANDS.length] ?? BANDS[0]]),
  );

  const matches = find === '' ? null : found(chart.roots, find.toLowerCase());

  return (
    <AppPage
      context={context}
      current="orgChart"
      title={t.chart.title}
      subtitle={f.plain(chart.scope === 'all' ? t.chart.subtitle : t.chart.subtitleTeam, {
        count: f.count(chart.total),
      })}
    >
      <section className="flex flex-col gap-5 rounded-[20px] border border-card-border bg-white p-6">
        <form method="get" action="/org" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-body">{t.chart.department}</span>
            <select
              name="department"
              defaultValue={department}
              className="h-11 rounded-xl border border-field-border bg-white px-3 text-sm text-navy"
            >
              <option value="">{t.chart.everyDepartment}</option>
              {chart.departments.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 shrink grow basis-[260px] flex-col gap-1.5">
            <span className="text-xs font-semibold text-body">{t.chart.search}</span>
            <input
              type="search"
              name="q"
              defaultValue={find}
              placeholder={t.chart.searchPlaceholder}
              className="h-11 rounded-xl border border-field-border bg-white px-3.5 text-sm text-navy"
            />
          </label>

          <button
            type="submit"
            className="quiet-button h-11 border-button-border px-4 text-[13px] font-semibold text-navy"
          >
            {t.chart.search}
          </button>
        </form>

        {matches !== null && matches.length === 0 && (
          <p className="m-0 text-sm text-body">{t.chart.noMatch}</p>
        )}

        {matches !== null && matches.length > 0 && (
          <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
            {matches.map((node) => (
              <li key={node.id}>
                <Card node={node} band={bands.get(node.department.code) ?? BANDS[0]} f={f} />
              </li>
            ))}
          </ul>
        )}

        {chart.roots.length === 0 ? (
          <p className="m-0 text-sm text-body">{t.chart.empty}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {chart.roots.map((node) => (
              <li key={node.id}>
                <Branch node={node} bands={bands} f={f} depth={0} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppPage>
  );
}

/**
 * One person and everyone under them.
 *
 * `<details>` is the whole of "collapse and expand": it keeps its state, it is
 * reachable by keyboard, the browser's own find opens it, and it needs no
 * script. The first two levels start open, which is where a workshop looks.
 */
function Branch({
  node,
  bands,
  f,
  depth,
}: {
  node: ChartNode;
  bands: Map<string, string>;
  f: Formatter;
  depth: number;
}): JSX.Element {
  const band = bands.get(node.department.code) ?? BANDS[0];

  if (node.children.length === 0) {
    return <Card node={node} band={band} f={f} />;
  }

  return (
    <details open={depth < 2} className="group">
      <summary className="cursor-pointer list-none">
        <Card node={node} band={band} f={f} inSummary />
      </summary>

      <ul className="m-0 ms-6 mt-3 flex list-none flex-col gap-3 border-s border-line ps-5 p-0">
        {node.children.map((child) => (
          <li key={child.id}>
            <Branch node={child} bands={bands} f={f} depth={depth + 1} />
          </li>
        ))}
      </ul>
    </details>
  );
}

function Card({
  node,
  band,
  f,
  inSummary = false,
}: {
  node: ChartNode;
  band: string;
  f: Formatter;
  inSummary?: boolean;
}): JSX.Element {
  const t = f.t.chart;

  return (
    <div className="flex w-fit min-w-[260px] items-center gap-3 overflow-hidden rounded-2xl border border-card-border bg-white ps-0 transition-[box-shadow] duration-200 ease-out hover:shadow-[0_8px_20px_rgba(15,25,55,0.07)]">
      <span aria-hidden="true" className={`h-14 w-1.5 shrink-0 ${band}`} />

      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-full bg-tint text-[13px] font-semibold text-blue"
      >
        {node.initials}
      </span>

      <span className="flex min-w-0 flex-col gap-0.5 py-2.5 pe-4">
        <a
          href={`/employees/${node.id}`}
          aria-label={f.plain(t.open, { name: node.name })}
          className="text-sm font-semibold text-navy no-underline"
        >
          {node.name}
        </a>
        <span className="text-xs text-body">
          {node.position} · {node.department.name}
        </span>
        <span className="num text-xs text-muted">
          {node.reports === 0
            ? t.noReports
            : node.reports === 1
              ? t.oneReport
              : f.plain(t.reports, { count: f.count(node.reports) })}
          {node.status === 'onboarding' ? ` · ${t.onboarding}` : ''}
        </span>
      </span>

      {inSummary && (
        <span aria-hidden="true" className="ms-auto pe-4 text-xs text-muted">
          ▾
        </span>
      )}
    </div>
  );
}

/** Everyone whose name contains what was typed, wherever they are in the tree. */
function found(nodes: readonly ChartNode[], text: string): ChartNode[] {
  const hits: ChartNode[] = [];

  const walk = (list: readonly ChartNode[]): void => {
    for (const node of list) {
      if (node.name.toLowerCase().includes(text)) {
        hits.push(node);
      }
      walk(node.children);
    }
  };

  walk(nodes);
  return hits.slice(0, 12);
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
