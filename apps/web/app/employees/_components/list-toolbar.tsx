import type { JSX } from 'react';
import {
  href,
  isFiltered,
  type EmployeeList,
  type EmployeeSearch,
  type FilterChoice,
  type View,
} from '../../../lib/employee-list';
import type { Formatter } from '../../../lib/format';
import { FilterForm } from './filter-form';

/**
 * Searching and filtering the list (HR-01 spec 6.2).
 *
 * The two views the home screen opens — papers running out, fixed terms running
 * out — are the first two things here, as buttons, because they are the two
 * questions this screen is opened to answer. Everything else is a filter, and
 * each one says how many files it holds, counted over what this reader may see.
 */
export function ListToolbar({
  list,
  search,
  f,
}: {
  list: EmployeeList;
  search: EmployeeSearch;
  f: Formatter;
}): JSX.Element {
  const t = f.t.employees;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ViewChip view="documents-expiring" label={t.views.documentsExpiring} search={search} />
        <ViewChip view="contracts-ending" label={t.views.contractsEnding} search={search} />

        {isFiltered(search) && (
          <a href="/employees" className="ms-auto text-[13px] font-semibold">
            {t.clear}
          </a>
        )}
      </div>

      <FilterForm label={t.filters} className="flex flex-wrap items-end gap-3">
        {/* The sort travels with the filters: narrowing a list should not undo how
            it was ordered. The page does not — see lib/employee-list.ts. */}
        {search.sort !== 'name' && <input type="hidden" name="sort" value={search.sort} />}
        {search.dir !== 'asc' && <input type="hidden" name="dir" value={search.dir} />}
        {search.view && <input type="hidden" name="view" value={search.view} />}

        <label className="flex min-w-0 shrink grow basis-[280px] flex-col gap-1.5">
          <span className="text-xs font-semibold text-body">{t.search}</span>
          <input
            type="search"
            name="q"
            defaultValue={search.q}
            placeholder={
              list.searchesIdentifiers ? t.searchPlaceholderIdentifiers : t.searchPlaceholder
            }
            className="h-11 rounded-xl border border-field-border bg-white px-3.5 text-sm text-navy"
          />
        </label>

        <Choice
          name="department"
          label={f.t.employees.columns.department}
          any={t.anyDepartment}
          value={search.department}
          choices={list.facets.departments}
          f={f}
        />

        {list.facets.sites.length > 1 && (
          <Choice
            name="site"
            label={f.t.employees.columns.site}
            any={t.anySite}
            value={search.site}
            choices={list.facets.sites}
            f={f}
          />
        )}

        <Choice
          name="contractType"
          label={f.t.employees.columns.contract}
          any={t.anyContractType}
          value={search.contractType}
          choices={list.facets.contractTypes}
          f={f}
        />

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-body">{f.t.employees.columns.status}</span>
          <select
            name="status"
            defaultValue={search.status ?? ''}
            className="h-11 rounded-xl border border-field-border bg-white px-3 text-sm text-navy"
          >
            <option value="">{t.anyStatus}</option>
            <option value="active">{t.status.active}</option>
            <option value="onboarding">{t.status.onboarding}</option>
            <option value="left">{t.status.left}</option>
          </select>
        </label>

        <label className="flex h-11 items-center gap-2 text-[13px] text-body">
          <input
            type="checkbox"
            name="includeLeavers"
            value="true"
            defaultChecked={search.includeLeavers}
            className="size-4 accent-[var(--color-blue)]"
          />
          {t.withLeavers}
        </label>

        {/* Pressed by anyone whose browser is not applying a choice for them. */}
        <button
          type="submit"
          className="quiet-button h-11 border-button-border px-4 text-[13px] font-semibold text-navy"
        >
          {t.apply}
        </button>
      </FilterForm>

      {list.searchesIdentifiers && <p className="m-0 text-xs text-muted">{t.searchHint}</p>}
    </div>
  );
}

/** One of the two lists the home screen opens, on or off. */
function ViewChip({
  view,
  label,
  search,
}: {
  view: View;
  label: string;
  search: EmployeeSearch;
}): JSX.Element {
  const on = search.view === view;

  return (
    <a
      href={href(search, { view: on ? undefined : view, page: 1 })}
      aria-pressed={on}
      className={`quiet-button h-9 px-3.5 text-[13px] font-semibold no-underline ${
        on ? 'border-blue bg-tint text-blue' : 'border-button-border text-navy'
      }`}
    >
      {label}
    </a>
  );
}

function Choice({
  name,
  label,
  any,
  value,
  choices,
  f,
}: {
  name: string;
  label: string;
  any: string;
  value?: string;
  choices: readonly FilterChoice[];
  f: Formatter;
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-body">{label}</span>
      <select
        name={name}
        defaultValue={value ?? ''}
        className="h-11 rounded-xl border border-field-border bg-white px-3 text-sm text-navy"
      >
        <option value="">{any}</option>
        {choices.map((choice) => (
          <option key={choice.code} value={choice.code}>
            {choice.name} ({f.count(choice.count)})
          </option>
        ))}
      </select>
    </label>
  );
}
