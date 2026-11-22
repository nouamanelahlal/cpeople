import type { JSX } from 'react';
import { href, type EmployeeList, type EmployeeSearch } from '../../../lib/employee-list';
import type { Formatter } from '../../../lib/format';

/**
 * Paging, as two links and a sentence (HR-01 spec 6.2).
 *
 * 148 people is six pages, and a page is a link so the browser's own back button
 * and a shared address both work. The sentence says where you are in the whole
 * list, which is the thing a scrollbar cannot tell you.
 */
export function Pager({
  list,
  search,
  f,
}: {
  list: EmployeeList;
  search: EmployeeSearch;
  f: Formatter;
}): JSX.Element | null {
  const t = f.t.employees;

  if (list.pages <= 1) {
    return null;
  }

  const from = (list.page - 1) * list.pageSize + 1;
  const to = Math.min(list.page * list.pageSize, list.total);

  return (
    <nav
      aria-label={f.plain(t.page, { page: f.count(list.page), pages: f.count(list.pages) })}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4"
    >
      <p className="num m-0 text-[13px] text-body">
        {f.plain(t.showing, {
          from: f.count(from),
          to: f.count(to),
          total: f.count(list.total),
        })}
      </p>

      <div className="ms-auto flex items-center gap-2">
        <Step
          label={t.previous}
          to={list.page > 1 ? href(search, { page: list.page - 1 }) : undefined}
          glyph="‹"
        />
        <span className="num text-[13px] font-semibold text-navy">
          {f.plain(t.page, { page: f.count(list.page), pages: f.count(list.pages) })}
        </span>
        <Step
          label={t.next}
          to={list.page < list.pages ? href(search, { page: list.page + 1 }) : undefined}
          glyph="›"
        />
      </div>
    </nav>
  );
}

/**
 * One step through the list.
 *
 * At either end there is nowhere to go, and a link to nowhere is worse than no
 * link: it is drawn as a disabled control instead, so the row keeps its shape.
 */
function Step({
  label,
  to,
  glyph,
}: {
  label: string;
  to?: string;
  glyph: string;
}): JSX.Element {
  const shape = 'grid size-10 place-items-center rounded-xl border text-base no-underline';

  if (to === undefined) {
    return (
      <span aria-hidden="true" className={`${shape} border-line text-muted opacity-50`}>
        {glyph}
      </span>
    );
  }

  return (
    <a href={to} aria-label={label} className={`quiet-button ${shape} border-button-border text-navy`}>
      <span aria-hidden="true">{glyph}</span>
    </a>
  );
}
