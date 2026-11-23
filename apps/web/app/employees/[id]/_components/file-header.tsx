import type { JSX } from 'react';
import { TABS, tabHref, type EmployeeFile, type Tab } from '../../../../lib/employee-file';
import type { Formatter } from '../../../../lib/format';
import { Pill } from './file-parts';

/**
 * Who this file belongs to, and the way into every part of it
 * (HR-01 spec 6.3).
 *
 * The header answers "who am I looking at" in one line — name, number, position,
 * department, status, contract, who they report to — and the tabs are links, so
 * a tab can be shared and the back button walks back through them.
 */
export function FileHeader({
  file,
  tab,
  f,
  actions,
}: {
  file: EmployeeFile;
  tab: Tab;
  f: Formatter;
  actions: JSX.Element | null;
}): JSX.Element {
  const t = f.t.employeeFile;
  const contract = file.contracts[0];
  const initials = `${file.firstName.charAt(0)}${file.lastName.charAt(0)}`.toUpperCase();

  return (
    <section className="flex flex-col gap-5 rounded-[20px] border border-card-border bg-white p-6">
      <div className="flex flex-wrap items-start gap-x-5 gap-y-4">
        <span
          aria-hidden="true"
          className="grid size-14 shrink-0 place-items-center rounded-full bg-tint text-lg font-semibold text-blue"
        >
          {initials}
        </span>

        <div className="flex min-w-0 shrink grow basis-[320px] flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="text-xl font-semibold text-navy">
              {file.firstName} {file.lastName}
            </h2>
            <Pill tone={file.status}>{f.t.employees.status[file.status]}</Pill>
            {contract && <Pill tone="tint">{contract.type.code}</Pill>}
          </div>

          <p className="num m-0 text-[13px] text-body">
            {file.employeeNumber} · {file.position.name} · {file.department.name}
            {file.site ? ` · ${file.site.name}` : ''}
          </p>

          {file.manager && (
            <p className="m-0 text-[13px] text-body">
              {t.fields.manager}:{' '}
              <a href={`/employees/${file.manager.id}`} className="font-semibold">
                {file.manager.name}
              </a>
            </p>
          )}
        </div>

        {actions}
      </div>

      <nav aria-label={t.tabsLabel} className="-mb-1 flex flex-wrap gap-1">
        {TABS.map((name) => {
          const current = name === tab;

          return (
            <a
              key={name}
              href={tabHref(file.id, name)}
              aria-current={current ? 'page' : undefined}
              className={`rounded-t-xl border-b-2 px-3.5 py-2.5 text-[13px] font-semibold no-underline transition-colors duration-200 ease-out ${
                current
                  ? 'border-blue text-navy'
                  : 'border-transparent text-body hover:bg-surface-quiet'
              }`}
            >
              {t.tabs[name]}
            </a>
          );
        })}
      </nav>
    </section>
  );
}
