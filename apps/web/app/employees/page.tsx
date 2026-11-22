import type { JSX } from 'react';
import { apiGetOrNull } from '../../lib/api';
import { apiQuery, isFiltered, readSearch, type EmployeeList } from '../../lib/employee-list';
import { formatter } from '../../lib/format';
import { AppPage, appContext } from '../_shell/app-page';
import { EmployeeTable, ListMessage } from './_components/employee-table';
import { ListToolbar } from './_components/list-toolbar';
import { Pager } from './_components/pager';

/** How many people a page of the list holds. 148 is six pages. */
const PAGE_SIZE = 25;

/** The timezone the demo company keeps its dates in. */
const TIME_ZONE = 'Africa/Casablanca';

/**
 * The employee list (HR-01 spec 6.2).
 *
 * Everything on the screen comes from the API, counted and filtered over the
 * files the reader is allowed to see: HR's list is the company, a manager's is
 * their own branch of it, and an employee's is their own file. The filters are in
 * the address, so this screen can be linked to — which is how the home screen's
 * cards open it, already narrowed to what they counted.
 */
export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  const search = readSearch(await searchParams);
  const f = formatter(context.locale, t, TIME_ZONE);
  const list = await apiGetOrNull<EmployeeList>(`/employees?${apiQuery(search, PAGE_SIZE)}`);

  const subtitle = list
    ? isFiltered(search)
      ? f.plain(t.employees.subtitle, {
          count: f.count(list.total),
          visible: f.count(list.visible),
        })
      : f.plain(t.employees.subtitleAll, { count: f.count(list.total) })
    : t.employees.unavailable;

  return (
    <AppPage context={context} current="employees" title={t.employees.title} subtitle={subtitle}>
      <section
        aria-labelledby="employees-title"
        className="flex flex-col gap-5 rounded-[20px] border border-card-border bg-white p-6"
      >
        <h2 id="employees-title" className="sr-only">
          {t.employees.title}
        </h2>

        {list === null ? (
          <ListMessage title={t.employees.unavailable} />
        ) : (
          <>
            <ListToolbar list={list} search={search} f={f} />

            {list.rows.length === 0 ? (
              <ListMessage
                title={isFiltered(search) ? t.employees.noMatch : t.employees.noneYet}
                {...(isFiltered(search)
                  ? { action: { label: t.employees.noMatchAction, href: '/employees' } }
                  : {})}
              />
            ) : (
              <EmployeeTable list={list} search={search} f={f} />
            )}

            <Pager list={list} search={search} f={f} />
          </>
        )}
      </section>
    </AppPage>
  );
}
