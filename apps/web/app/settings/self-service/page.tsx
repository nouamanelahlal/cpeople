import type { JSX, ReactNode } from 'react';
import { apiGetOrNull } from '../../../lib/api';
import { AppPage, appContext } from '../../_shell/app-page';
import { saveSelfService } from './actions';

export interface SelfServiceSettings {
  readonly employeeNumberPattern: string;
  readonly employeesSeeSalary: boolean;
  readonly showLeaveTypeToColleagues: boolean;
  readonly employeesEditContact: boolean;
  readonly mayManage: boolean;
}

/**
 * Self-service (HR-02 build spec §1 and §7.1).
 *
 * Four decisions that belong to SMG, on one short screen, because they are the
 * kind of thing a workshop changes while everybody watches and then changes
 * back.
 *
 * The first of them is the one worth being careful about: whether an employee
 * may see their own pay. Turning it off does not hide a figure on a screen — the
 * API stops sending it — which is the difference between a privacy setting and
 * a piece of CSS.
 */
export default async function SelfServicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  const query = await searchParams;
  const settings = await apiGetOrNull<SelfServiceSettings>('/settings/self-service');

  if (settings === null) {
    return (
      <AppPage
        context={context}
        current="settings"
        title={t.selfService.title}
        subtitle={t.selfService.notYours}
      >
        <Card>
          <p className="m-0 text-sm text-body">{t.selfService.notYours}</p>
        </Card>
      </AppPage>
    );
  }

  return (
    <AppPage
      context={context}
      current="settings"
      title={t.selfService.title}
      subtitle={t.selfService.subtitle}
    >
      {one(query['saved']) === '1' && (
        <p className="m-0 rounded-2xl border border-success-border bg-success-bg px-4 py-3 text-sm text-success-ink">
          {t.selfService.saved}
        </p>
      )}

      {one(query['error']) === '1' && (
        <p
          role="alert"
          className="m-0 rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-ink"
        >
          {t.selfService.failed}
        </p>
      )}

      <Card>
        <p className="m-0 max-w-prose text-[13px] text-body">{t.selfService.note}</p>

        <form action={saveSelfService} className="flex flex-col gap-5">
          <Switch
            name="employeesSeeSalary"
            label={t.selfService.salary}
            note={t.selfService.salaryNote}
            on={settings.employeesSeeSalary}
            disabled={!settings.mayManage}
          />

          <Switch
            name="showLeaveTypeToColleagues"
            label={t.selfService.leaveType}
            note={t.selfService.leaveTypeNote}
            on={settings.showLeaveTypeToColleagues}
            disabled={!settings.mayManage}
          />

          <Switch
            name="employeesEditContact"
            label={t.selfService.editContact}
            note={t.selfService.editContactNote}
            on={settings.employeesEditContact}
            disabled={!settings.mayManage}
          />

          <div className="flex flex-col gap-1.5 border-t border-line pt-5">
            <label
              htmlFor="employeeNumberPattern"
              className="text-xs font-semibold uppercase tracking-[0.04em] text-muted"
            >
              {t.selfService.numberPattern}
            </label>
            <input
              type="text"
              id="employeeNumberPattern"
              name="employeeNumberPattern"
              defaultValue={settings.employeeNumberPattern}
              disabled={!settings.mayManage}
              aria-describedby="pattern-note"
              className="h-11 max-w-md rounded-xl border border-field-border bg-white px-3.5 font-mono text-sm text-navy"
            />
            <span id="pattern-note" className="max-w-prose text-xs text-body">
              {t.selfService.numberPatternNote}
            </span>
          </div>

          {settings.mayManage && (
            <button
              type="submit"
              className="h-11 w-fit rounded-xl bg-blue px-5 text-sm font-semibold text-white transition-[background-color] duration-200 ease-out hover:bg-blue-hover"
            >
              {t.selfService.save}
            </button>
          )}
        </form>
      </Card>
    </AppPage>
  );
}

function Switch({
  name,
  label,
  note,
  on,
  disabled,
}: {
  name: string;
  label: string;
  note: string;
  on: boolean;
  disabled: boolean;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2.5 text-sm font-semibold text-navy">
        <input
          type="checkbox"
          name={name}
          defaultChecked={on}
          disabled={disabled}
          className="size-4 accent-[var(--color-blue)]"
        />
        {label}
      </label>
      <span className="ms-[26px] max-w-prose text-xs text-body">{note}</span>
    </div>
  );
}

function Card({ children }: { children: ReactNode }): JSX.Element {
  return (
    <section className="flex flex-col gap-5 rounded-[20px] border border-card-border bg-white p-6">
      {children}
    </section>
  );
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
