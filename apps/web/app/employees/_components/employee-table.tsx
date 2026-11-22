import type { JSX, ReactNode } from 'react';
import {
  href,
  type EmployeeList,
  type EmployeeRow,
  type EmployeeSearch,
  type PaperState,
  type Sort,
} from '../../../lib/employee-list';
import type { Formatter } from '../../../lib/format';

/**
 * The employee list itself (HR-01 spec 6.2).
 *
 * A table, because that is what this is: the working surface HR spends its day
 * on, with a sticky header, one row per person and the whole row a link to their
 * file. The columns a phone cannot fit are dropped rather than squeezed, and what
 * is left scrolls inside the card rather than widening the page.
 *
 * Colour is never the only signal: the state of someone's papers is a word with a
 * dot beside it, so it survives being printed, being colour-blind, or being read
 * aloud.
 */

const PAPERS: Record<PaperState, { pill: string; dot: string }> = {
  ok: { pill: 'bg-ok-bg text-ok-ink', dot: 'bg-ok-ink' },
  expiring: { pill: 'bg-warning-bg text-warning-ink', dot: 'bg-warning-ink' },
  expired: { pill: 'bg-danger-bg text-danger-ink', dot: 'bg-danger-ink' },
};

const STATUS: Record<EmployeeRow['status'], string> = {
  active: 'bg-neutral-bg text-neutral-ink',
  onboarding: 'bg-info-bg text-info-ink',
  left: 'bg-surface-sunk text-body',
};

export function EmployeeTable({
  list,
  search,
  f,
}: {
  list: EmployeeList;
  search: EmployeeSearch;
  f: Formatter;
}): JSX.Element {
  const t = f.t.employees;
  const columns = t.columns;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{t.title}</caption>
        <thead>
          <tr className="text-start">
            <SortableHeader column="name" label={columns.name} search={search} f={f} />
            <Header label={columns.employeeNumber} />
            <Header label={columns.position} className="hidden lg:table-cell" />
            <Header label={columns.department} className="hidden md:table-cell" />
            <Header label={columns.site} className="hidden xl:table-cell" />
            <Header label={columns.contract} />
            <SortableHeader
              column="contractEnd"
              label={columns.contractEnd}
              search={search}
              f={f}
              className="hidden sm:table-cell"
            />
            <SortableHeader
              column="hireDate"
              label={columns.hireDate}
              search={search}
              f={f}
              className="hidden xl:table-cell"
            />
            <Header label={columns.status} className="hidden sm:table-cell" />
            <Header label={t.documents.label} />
          </tr>
        </thead>

        <tbody>
          {list.rows.map((row) => (
            <Row key={row.id} row={row} f={f} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ row, f }: { row: EmployeeRow; f: Formatter }): JSX.Element {
  const t = f.t.employees;
  const papers = PAPERS[row.documents];

  return (
    <tr className="border-t border-line transition-colors duration-200 ease-out hover:bg-hover">
      <th scope="row" className="p-0 text-start font-normal">
        {/* The whole name is the link: one target, big enough to hit, and the only
            thing on the row a person wants to press. */}
        <a
          href={`/employees/${row.id}`}
          aria-label={f.plain(t.open, { name: row.name })}
          className="flex min-h-11 items-center gap-3 py-2.5 pe-4 ps-1"
        >
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-tint text-[13px] font-semibold text-blue"
          >
            {row.initials}
          </span>
          <span className="font-semibold text-navy">{row.name}</span>
        </a>
      </th>

      <Cell className="num whitespace-nowrap text-body">{row.employeeNumber}</Cell>
      <Cell className="hidden text-body lg:table-cell">{row.position}</Cell>
      <Cell className="hidden text-body md:table-cell">{row.department.name}</Cell>
      <Cell className="hidden text-body xl:table-cell">{row.site?.name ?? '—'}</Cell>

      <Cell>
        {row.contractType ? (
          <span className="rounded-full bg-sky-bg px-2.5 py-[5px] text-xs font-semibold text-sky-ink">
            {row.contractType.code}
          </span>
        ) : (
          '—'
        )}
      </Cell>

      <Cell className="num hidden whitespace-nowrap text-body sm:table-cell">
        {row.contractEnd ? f.dateMedium(row.contractEnd) : t.permanent}
      </Cell>

      <Cell className="num hidden whitespace-nowrap text-body xl:table-cell">
        {f.dateMedium(row.hireDate)}
      </Cell>

      <Cell className="hidden sm:table-cell">
        <span
          className={`whitespace-nowrap rounded-full px-2.5 py-[5px] text-xs font-semibold ${STATUS[row.status]}`}
        >
          {t.status[row.status]}
        </span>
      </Cell>

      <Cell>
        <span
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[5px] text-xs font-semibold ${papers.pill}`}
          title={f.plain(t.documents[`${row.documents}Note`], { name: row.name })}
        >
          <span aria-hidden="true" className={`size-1.5 rounded-full ${papers.dot}`} />
          {t.documents[row.documents]}
        </span>
      </Cell>
    </tr>
  );
}

function Header({ label, className = '' }: { label: string; className?: string }): JSX.Element {
  return (
    <th
      scope="col"
      className={`whitespace-nowrap border-b border-line pb-2.5 pe-4 text-start text-xs font-semibold uppercase tracking-[0.04em] text-muted ${className}`}
    >
      {label}
    </th>
  );
}

/**
 * A column that can be sorted by, as a link.
 *
 * The sort is in the address, so a sorted list can be shared and the back button
 * walks back through it. `aria-sort` says which way, for a reader who cannot see
 * the arrow.
 */
function SortableHeader({
  column,
  label,
  search,
  f,
  className = '',
}: {
  column: Sort;
  label: string;
  search: EmployeeSearch;
  f: Formatter;
  className?: string;
}): JSX.Element {
  const t = f.t.employees;
  const active = search.sort === column;
  const dir = active && search.dir === 'asc' ? 'desc' : 'asc';

  return (
    <th
      scope="col"
      aria-sort={active ? (search.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`whitespace-nowrap border-b border-line pb-2.5 pe-4 text-start text-xs font-semibold uppercase tracking-[0.04em] text-muted ${className}`}
    >
      <a
        href={href(search, { sort: column, dir, page: 1 })}
        className={`inline-flex items-center gap-1 no-underline ${active ? 'text-navy' : 'text-muted'}`}
        title={f.plain(t.sortBy, { column: label })}
      >
        {label}
        <span aria-hidden="true" className="text-[10px]">
          {active ? (search.dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
        {active && (
          <span className="sr-only">
            {search.dir === 'asc' ? t.sortedAscending : t.sortedDescending}
          </span>
        )}
      </a>
    </th>
  );
}

function Cell({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return <td className={`py-2.5 pe-4 align-middle ${className}`}>{children}</td>;
}

/**
 * What the list says when there is nothing in it.
 *
 * Two different things: a company with no people in it yet, which is a job to do,
 * and a filter that matches nobody, which is a filter to clear. Both say what to
 * do next rather than just reporting the emptiness.
 */
export function ListMessage({
  title,
  action,
}: {
  title: string;
  action?: { label: string; href: string };
}): JSX.Element {
  return (
    <div className="flex flex-col items-start gap-3 border-t border-line py-10">
      <p className="m-0 text-sm text-body">{title}</p>
      {action && (
        <a
          href={action.href}
          className="quiet-button h-10 border-button-border px-4 text-[13px] font-semibold text-navy"
        >
          {action.label}
        </a>
      )}
    </div>
  );
}
