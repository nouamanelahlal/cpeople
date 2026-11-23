import type { JSX, ReactNode } from 'react';
import type { Messages } from '@cpeople/shared';
import { apiGetOrNull } from '../../../lib/api';
import { formatter, type Formatter } from '../../../lib/format';
import { AppPage, appContext } from '../../_shell/app-page';
import { DepartmentForm } from './_components/department-form';

const TIME_ZONE = 'Africa/Casablanca';

const TABS = ['departments', 'positions', 'costCentres', 'mapping'] as const;
type Tab = (typeof TABS)[number];

interface NamedThing {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly city?: string;
}

interface CostCentre extends NamedThing {
  readonly sapCostCentre?: string;
  readonly departmentCount: number;
  readonly employeeCount: number;
}

interface Department extends NamedThing {
  readonly site?: NamedThing;
  readonly costCentre?: CostCentre;
  readonly head?: { readonly id: string; readonly name: string };
  readonly headcount: number;
  readonly overrides: number;
}

interface Position {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly department: string;
  readonly reportsTo?: string;
  readonly plannedHeadcount?: number;
  readonly filled: number;
}

interface Organisation {
  readonly departments: readonly Department[];
  readonly positions: readonly Position[];
  readonly costCentres: readonly CostCentre[];
  readonly sites: readonly NamedThing[];
  readonly mayManage: boolean;
}

/**
 * The company's own shape (HR-01 spec 6.5).
 *
 * Four views of the same thing: the departments, the positions in them, the cost
 * centres they cost against, and — the one the workshop is for — the mapping
 * between the first and the third, with its gaps marked. Payroll is posted to
 * SAP by cost centre, so a department pointing at nothing is a payroll that
 * cannot be posted, and this screen says so in those words.
 */
export default async function OrganisationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  const query = await searchParams;
  const tab = readTab(one(query['tab']));
  const editing = one(query['edit']);

  const f = formatter(context.locale, t, TIME_ZONE);
  const organisation = await apiGetOrNull<Organisation>('/organisation');

  if (organisation === null) {
    return (
      <AppPage
        context={context}
        current="settings"
        title={t.settings.organisation.title}
        subtitle={t.settings.notYours}
      >
        <Card>
          <p className="m-0 text-sm text-body">{t.settings.notYours}</p>
        </Card>
      </AppPage>
    );
  }

  const department = organisation.departments.find((row) => row.id === editing);

  return (
    <AppPage
      context={context}
      current="settings"
      title={t.settings.organisation.title}
      subtitle={t.settings.organisation.note}
    >
      <Notice query={query} t={t} f={f} />

      {department && organisation.mayManage ? (
        <Card>
          <h2 className="text-lg font-semibold text-navy">
            {f.plain(t.settings.organisation.editTitle, { name: department.name })}
          </h2>
          <DepartmentForm
            department={{
              id: department.id,
              name: department.name,
              costCentreCode: department.costCentre?.code ?? '',
              siteCode: department.site?.code ?? '',
              headEmployeeId: department.head?.id ?? '',
              headcount: department.headcount,
              overrides: department.overrides,
            }}
            costCentres={organisation.costCentres.map((centre) => ({
              code: centre.code,
              name: centre.name,
            }))}
            sites={organisation.sites.map((site) => ({ code: site.code, name: site.name }))}
            labels={{
              name: t.settings.organisation.columns.name,
              costCentre: t.settings.organisation.columns.costCentre,
              site: t.settings.organisation.columns.site,
              none: t.settings.organisation.noCostCentre,
              apply: f.plain(t.settings.organisation.apply, {
                count: f.count(Math.max(0, department.headcount - department.overrides)),
              }),
              applyNote: t.settings.organisation.applyNote,
              save: t.settings.organisation.save,
              cancel: t.settings.organisation.cancel,
              cancelHref: '/settings/organisation?tab=mapping',
            }}
          />
        </Card>
      ) : (
        <Card>
          <nav aria-label={t.settings.organisation.title} className="-mb-1 flex flex-wrap gap-1">
            {TABS.map((name) => (
              <a
                key={name}
                href={name === 'departments' ? '/settings/organisation' : `/settings/organisation?tab=${name}`}
                aria-current={name === tab ? 'page' : undefined}
                className={`rounded-t-xl border-b-2 px-3.5 py-2.5 text-[13px] font-semibold no-underline transition-colors duration-200 ease-out ${
                  name === tab
                    ? 'border-blue text-navy'
                    : 'border-transparent text-body hover:bg-surface-quiet'
                }`}
              >
                {t.settings.organisation.tabs[name]}
              </a>
            ))}
          </nav>

          {!organisation.mayManage && (
            <p className="m-0 text-[13px] text-body">{t.settings.organisation.readOnly}</p>
          )}

          {tab === 'departments' && <Departments organisation={organisation} f={f} />}
          {tab === 'positions' && <Positions organisation={organisation} f={f} />}
          {tab === 'costCentres' && <CostCentres organisation={organisation} f={f} />}
          {tab === 'mapping' && <Mapping organisation={organisation} f={f} />}

          <p className="m-0 text-xs text-muted">{t.settings.organisation.laterTabs}</p>
        </Card>
      )}
    </AppPage>
  );
}

function Departments({
  organisation,
  f,
}: {
  organisation: Organisation;
  f: Formatter;
}): JSX.Element {
  const t = f.t.settings.organisation;

  return (
    <Table
      columns={[
        t.columns.code,
        t.columns.name,
        t.columns.site,
        t.columns.costCentre,
        t.columns.head,
        t.columns.headcount,
      ]}
    >
      {organisation.departments.map((department) => (
        <tr key={department.id} className="border-t border-line">
          <Cell className="num">{department.code}</Cell>
          <Cell className="font-semibold text-navy">{department.name}</Cell>
          <Cell>{department.site?.name ?? t.none}</Cell>
          <Cell>{department.costCentre?.code ?? t.noCostCentre}</Cell>
          <Cell>
            {department.head ? (
              <a href={`/employees/${department.head.id}`}>{department.head.name}</a>
            ) : (
              t.noHead
            )}
          </Cell>
          <Cell className="num">{f.count(department.headcount)}</Cell>
        </tr>
      ))}
    </Table>
  );
}

function Positions({ organisation, f }: { organisation: Organisation; f: Formatter }): JSX.Element {
  const t = f.t.settings.organisation;

  return (
    <Table
      columns={[
        t.columns.code,
        t.columns.title,
        t.columns.department,
        t.columns.reportsTo,
        t.columns.planned,
        t.columns.filled,
      ]}
    >
      {organisation.positions.map((position) => (
        <tr key={position.id} className="border-t border-line">
          <Cell className="num">{position.code}</Cell>
          <Cell className="font-semibold text-navy">{position.title}</Cell>
          <Cell>{position.department}</Cell>
          <Cell>{position.reportsTo ?? t.none}</Cell>
          <Cell className="num">
            {position.plannedHeadcount === undefined ? t.none : f.count(position.plannedHeadcount)}
          </Cell>
          <Cell className="num">{f.count(position.filled)}</Cell>
        </tr>
      ))}
    </Table>
  );
}

function CostCentres({
  organisation,
  f,
}: {
  organisation: Organisation;
  f: Formatter;
}): JSX.Element {
  const t = f.t.settings.organisation;

  return (
    <Table
      columns={[
        t.columns.code,
        t.columns.name,
        t.columns.sap,
        t.columns.departments,
        t.columns.employees,
      ]}
    >
      {organisation.costCentres.map((centre) => (
        <tr key={centre.id} className="border-t border-line">
          <Cell className="num">{centre.code}</Cell>
          <Cell className="font-semibold text-navy">{centre.name}</Cell>
          <Cell>
            {centre.sapCostCentre ?? (
              <span className="rounded-full bg-amber-bg px-2.5 py-[5px] text-xs font-semibold text-amber-ink">
                {t.sapEmpty}
              </span>
            )}
          </Cell>
          <Cell className="num">{f.count(centre.departmentCount)}</Cell>
          <Cell className="num">{f.count(centre.employeeCount)}</Cell>
        </tr>
      ))}
    </Table>
  );
}

/**
 * One row per department, and what is wrong with it.
 *
 * This is the view the workshop is held around: a department with no cost centre
 * cannot have its payroll posted, and people placed outside their department's
 * cost centre are a deliberate exception worth seeing all in one place.
 */
function Mapping({ organisation, f }: { organisation: Organisation; f: Formatter }): JSX.Element {
  const t = f.t.settings.organisation;

  return (
    <Table
      columns={[
        t.columns.department,
        t.columns.costCentre,
        t.columns.sap,
        t.columns.headcount,
        t.columns.warning,
        '',
      ]}
    >
      {organisation.departments.map((department) => (
        <tr key={department.id} className="border-t border-line align-top">
          <Cell className="font-semibold text-navy">{department.name}</Cell>
          <Cell>{department.costCentre?.code ?? t.noCostCentre}</Cell>
          <Cell>
            {department.costCentre?.sapCostCentre ?? (
              <span className="rounded-full bg-amber-bg px-2.5 py-[5px] text-xs font-semibold text-amber-ink">
                {t.sapEmpty}
              </span>
            )}
          </Cell>
          <Cell className="num">{f.count(department.headcount)}</Cell>
          <Cell>
            {department.costCentre === undefined ? (
              <span className="rounded-full bg-danger-bg px-2.5 py-[5px] text-xs font-semibold text-danger-ink">
                {t.noCostCentreWarning}
              </span>
            ) : department.overrides > 0 ? (
              <span className="rounded-full bg-amber-bg px-2.5 py-[5px] text-xs font-semibold text-amber-ink">
                {f.plain(t.overrides, { count: f.count(department.overrides) })}
              </span>
            ) : (
              <span className="rounded-full bg-ok-bg px-2.5 py-[5px] text-xs font-semibold text-ok-ink">
                {t.inOrder}
              </span>
            )}
          </Cell>
          <Cell>
            {organisation.mayManage && (
              <a
                href={`/settings/organisation?tab=mapping&edit=${department.id}`}
                className="quiet-button h-9 border-button-border px-3 text-xs font-semibold text-navy"
              >
                {t.edit}
              </a>
            )}
          </Cell>
        </tr>
      ))}
    </Table>
  );
}

function Notice({
  query,
  t,
  f,
}: {
  query: Record<string, string | string[] | undefined>;
  t: Messages;
  f: Formatter;
}): JSX.Element | null {
  const saved = one(query['saved']);

  if (saved !== undefined) {
    const count = Number.parseInt(saved, 10);

    return (
      <p className="m-0 rounded-2xl border border-success-border bg-success-bg px-4 py-3 text-sm text-success-ink">
        {Number.isFinite(count) && count > 0
          ? f.plain(t.settings.organisation.saved, { count: f.count(count) })
          : t.settings.organisation.savedNobody}
      </p>
    );
  }

  if (one(query['error']) !== undefined) {
    return (
      <p
        role="alert"
        className="m-0 rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-ink"
      >
        {t.settings.organisation.failed}
      </p>
    );
  }

  return null;
}

function Card({ children }: { children: ReactNode }): JSX.Element {
  return (
    <section className="flex flex-col gap-5 rounded-[20px] border border-card-border bg-white p-6">
      {children}
    </section>
  );
}

function Table({
  columns,
  children,
}: {
  columns: readonly string[];
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th
                key={`${column}-${index}`}
                scope="col"
                className="whitespace-nowrap border-b border-line pb-2.5 pe-4 text-start text-xs font-semibold uppercase tracking-[0.04em] text-muted"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Cell({ children, className = '' }: { children: ReactNode; className?: string }): JSX.Element {
  return <td className={`py-3 pe-4 text-body ${className}`}>{children}</td>;
}

function readTab(value: string | undefined): Tab {
  return (TABS as readonly string[]).includes(value ?? '') ? (value as Tab) : 'departments';
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
