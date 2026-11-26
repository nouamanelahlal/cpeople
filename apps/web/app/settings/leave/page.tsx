import type { JSX, ReactNode } from 'react';
import type { Messages } from '@cpeople/shared';
import { apiGetOrNull } from '../../../lib/api';
import { formatter, type Formatter } from '../../../lib/format';
import {
  LEAVE_TABS,
  leaveSettingsHref,
  leaveTypeName,
  readLeaveTab,
  type LeaveSettings,
  type LeaveType,
} from '../../../lib/leave-settings';
import { AppPage, appContext } from '../../_shell/app-page';
import {
  addHoliday,
  confirmHolidayYear,
  removeHoliday,
  saveLeavePolicy,
  saveLeaveRule,
  saveLeaveType,
  saveWorkWeek,
  setHolidayYearComplete,
} from './actions';

const TIME_ZONE = 'Africa/Casablanca';

/**
 * Leave set-up (HR-02 / M08).
 *
 * Five tabs, each its own address: what the leave types are, what each is worth
 * and from when, which days each site works, which days are public holidays, and
 * the two decisions that belong to the company.
 *
 * Every figure on this screen arrived as data and says whether anybody has
 * confirmed it. None of it is law, and the screen keeps saying so until SMG and
 * the payroll expert have been through it.
 */
export default async function LeaveSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  const query = await searchParams;
  const tab = readLeaveTab(query['tab']);
  const year = Number.parseInt(one(query['year']) ?? '', 10);

  const f = formatter(context.locale, t, TIME_ZONE);
  const settings = await apiGetOrNull<LeaveSettings>(
    `/leave/settings${Number.isFinite(year) ? `?year=${year}` : ''}`,
  );

  if (settings === null) {
    return (
      <AppPage
        context={context}
        current="settings"
        title={t.leaveSettings.title}
        subtitle={t.leaveSettings.notYours}
      >
        <Card>
          <p className="m-0 text-sm text-body">{t.leaveSettings.notYours}</p>
        </Card>
      </AppPage>
    );
  }

  const editing = one(query['edit']);

  return (
    <AppPage
      context={context}
      current="settings"
      title={t.leaveSettings.title}
      subtitle={t.leaveSettings.subtitle}
    >
      <Notice query={query} t={t} />

      <Card>
        <nav aria-label={t.leaveSettings.title} className="-mb-1 flex flex-wrap gap-1">
          {LEAVE_TABS.map((name) => (
            <a
              key={name}
              href={leaveSettingsHref(name, name === 'holidays' ? settings.year : undefined)}
              aria-current={name === tab ? 'page' : undefined}
              className={`rounded-t-xl border-b-2 px-3.5 py-2.5 text-[13px] font-semibold no-underline transition-colors duration-200 ease-out ${
                name === tab
                  ? 'border-blue text-navy'
                  : 'border-transparent text-body hover:bg-surface-quiet'
              }`}
            >
              {t.leaveSettings.tabs[name]}
            </a>
          ))}
        </nav>

        <p className="m-0 rounded-2xl border border-warning-bg bg-warning-bg px-4 py-3 text-[13px] text-warning-ink">
          {t.leaveSettings.toConfirmNote}
        </p>

        {tab === 'types' && <Types settings={settings} f={f} />}
        {tab === 'rules' && <Rules settings={settings} editing={editing} f={f} />}
        {tab === 'week' && <Week settings={settings} editing={editing} f={f} />}
        {tab === 'holidays' && <Holidays settings={settings} f={f} />}
        {tab === 'policy' && <Policy settings={settings} f={f} />}
      </Card>
    </AppPage>
  );
}

function Types({ settings, f }: { settings: LeaveSettings; f: Formatter }): JSX.Element {
  const t = f.t.leaveSettings.types;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-navy">{t.title}</h2>
        <p className="m-0 max-w-prose text-[13px] text-body">{t.note}</p>
      </div>

      <form action={saveLeaveType} className="flex flex-col gap-4">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {[
                  t.columns.type,
                  t.columns.paid,
                  t.columns.basis,
                  t.columns.halfDays,
                  t.columns.document,
                  t.columns.secondApproval,
                  t.columns.balance,
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
              {settings.types.map((type) => (
                <tr key={type.id} className="border-t border-line">
                  <th scope="row" className="py-3 pe-4 text-start font-semibold text-navy">
                    {leaveTypeName(type, f.t)}
                    <span className="num ms-2 text-xs font-normal text-muted">{type.code}</span>
                  </th>
                  <Flag value={type.paid} t={t} />
                  <td className="py-3 pe-4 text-body">{t.basis[type.dayBasis]}</td>
                  <Flag value={type.allowsHalfDays} t={t} />
                  <Flag value={type.requiresDocument} t={t} />
                  <Flag value={type.requiresSecondApproval} t={t} />
                  <Flag value={type.tracksBalance} t={t} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>
    </section>
  );
}

function Flag({ value, t }: { value: boolean; t: Messages['leaveSettings']['types'] }): JSX.Element {
  return (
    <td className="py-3 pe-4">
      <span
        className={`whitespace-nowrap rounded-full px-2.5 py-[5px] text-xs font-semibold ${
          value ? 'bg-ok-bg text-ok-ink' : 'bg-surface-quiet text-muted'
        }`}
      >
        {value ? t.yes : t.no}
      </span>
    </td>
  );
}

function Rules({
  settings,
  editing,
  f,
}: {
  settings: LeaveSettings;
  editing?: string;
  f: Formatter;
}): JSX.Element {
  const t = f.t.leaveSettings.rules;
  const type = settings.types.find((candidate) => candidate.id === editing);

  if (type && settings.mayManage) {
    return <RuleForm type={type} settings={settings} f={f} />;
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-navy">{t.title}</h2>
        <p className="m-0 max-w-prose text-[13px] text-body">{t.note}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {[
                t.columns.type,
                t.columns.from,
                t.columns.entitlement,
                t.columns.accrual,
                t.columns.carryOver,
                t.columns.notice,
                t.columns.backdate,
                t.columns.state,
                '',
              ].map((label, index) => (
                <th
                  key={`${label}-${index}`}
                  scope="col"
                  className="whitespace-nowrap border-b border-line pb-2.5 pe-4 text-start text-xs font-semibold uppercase tracking-[0.04em] text-muted"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {settings.types.map((item) => (
              <tr key={item.id} className="border-t border-line">
                <th scope="row" className="py-3 pe-4 text-start font-semibold text-navy">
                  {leaveTypeName(item, f.t)}
                </th>
                <td className="num whitespace-nowrap py-3 pe-4 text-body">
                  {item.rule ? f.dateMedium(item.rule.effectiveFrom) : t.none}
                </td>
                <td className="num py-3 pe-4 text-body">{days(item.rule?.entitlementDays, f)}</td>
                <td className="num py-3 pe-4 text-body">{days(item.rule?.accrualPerMonth, f)}</td>
                <td className="num py-3 pe-4 text-body">{days(item.rule?.carryOverMaxDays, f)}</td>
                <td className="num py-3 pe-4 text-body">{days(item.rule?.minNoticeDays, f)}</td>
                <td className="num py-3 pe-4 text-body">{days(item.rule?.maxBackdateDays, f)}</td>
                <td className="py-3 pe-4">
                  <State confirmed={item.rule?.confirmed ?? false} f={f} />
                </td>
                <td className="py-3 text-end">
                  {settings.mayManage && (
                    <a
                      href={`${leaveSettingsHref('rules')}&edit=${item.id}`}
                      className="quiet-button h-9 border-button-border px-3 text-xs font-semibold text-navy"
                    >
                      {t.change}
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RuleForm({
  type,
  settings,
  f,
}: {
  type: LeaveType;
  settings: LeaveSettings;
  f: Formatter;
}): JSX.Element {
  const t = f.t.leaveSettings.rules;
  const rule = type.rule;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-navy">
        {f.plain(t.changeTitle, { type: leaveTypeName(type, f.t) })}
      </h2>
      <p className="m-0 max-w-prose text-[13px] text-body">{t.effectiveNote}</p>

      <form action={saveLeaveRule} className="flex flex-col gap-5">
        <input type="hidden" name="id" value={type.id} />

        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-8 gap-y-5">
          <Field id="effectiveFrom" label={t.effectiveFrom}>
            <input
              type="date"
              id="effectiveFrom"
              name="effectiveFrom"
              required
              defaultValue={settings.today}
              className={INPUT}
            />
          </Field>

          <Field id="entitlementDays" label={t.columns.entitlement}>
            <input
              type="text"
              inputMode="decimal"
              id="entitlementDays"
              name="entitlementDays"
              defaultValue={rule?.entitlementDays ?? ''}
              className={INPUT}
            />
          </Field>

          <Field id="accrualPerMonth" label={t.columns.accrual}>
            <input
              type="text"
              inputMode="decimal"
              id="accrualPerMonth"
              name="accrualPerMonth"
              defaultValue={rule?.accrualPerMonth ?? ''}
              className={INPUT}
            />
          </Field>

          <Field id="carryOverMaxDays" label={t.columns.carryOver}>
            <input
              type="text"
              inputMode="decimal"
              id="carryOverMaxDays"
              name="carryOverMaxDays"
              defaultValue={rule?.carryOverMaxDays ?? ''}
              className={INPUT}
            />
          </Field>

          <Field id="minNoticeDays" label={t.columns.notice}>
            <input
              type="number"
              min={0}
              id="minNoticeDays"
              name="minNoticeDays"
              defaultValue={rule?.minNoticeDays ?? 0}
              className={INPUT}
            />
          </Field>

          <Field id="maxBackdateDays" label={t.columns.backdate}>
            <input
              type="number"
              min={0}
              id="maxBackdateDays"
              name="maxBackdateDays"
              defaultValue={rule?.maxBackdateDays ?? 0}
              className={INPUT}
            />
          </Field>

          <Field id="note" label={t.noteLabel} wide>
            <input type="text" id="note" name="note" defaultValue={rule?.note ?? ''} className={INPUT} />
          </Field>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-navy">
          <input
            type="checkbox"
            name="confirmed"
            defaultChecked={rule?.confirmed ?? false}
            className="size-4 accent-[var(--color-blue)]"
          />
          {f.t.leaveSettings.confirm}
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={PRIMARY}>
            {t.saveRule}
          </button>
          <a href={leaveSettingsHref('rules')} className={QUIET}>
            {f.t.employeeFile.cancel}
          </a>
        </div>
      </form>

      <History type={type} f={f} />
    </section>
  );
}

/**
 * Every rule this type has had, newest first.
 *
 * A parameter that changes is a new row, and the old row stays exactly as it
 * was. Showing them is the only way a reader can tell that: without this, the
 * screen would look as though changing a figure had overwritten it.
 */
function History({ type, f }: { type: LeaveType; f: Formatter }): JSX.Element {
  const t = f.t.leaveSettings.rules;

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-navy">{t.history}</h3>
        <p className="m-0 max-w-prose text-[13px] text-body">{t.historyNote}</p>
      </div>

      {type.rules.length === 0 ? (
        <p className="m-0 text-sm text-body">{t.historyEmpty}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {type.rules.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-surface-quiet px-3.5 py-2.5 text-[13px] text-body"
            >
              <span className="num font-semibold text-navy">
                {f.dateMedium(item.effectiveFrom)}
              </span>
              <span className="num">
                {item.effectiveTo === undefined
                  ? t.inForce
                  : `${t.until} ${f.dateMedium(item.effectiveTo)}`}
              </span>
              <span className="num">
                {t.columns.entitlement}: {days(item.entitlementDays, f)}
              </span>
              <span className="num">
                {t.columns.accrual}: {days(item.accrualPerMonth, f)}
              </span>
              <span className="ms-auto">
                <State confirmed={item.confirmed} f={f} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Week({
  settings,
  editing,
  f,
}: {
  settings: LeaveSettings;
  editing?: string;
  f: Formatter;
}): JSX.Element {
  const t = f.t.leaveSettings.week;
  const week = settings.workWeeks.find((candidate) => candidate.site.code === editing);

  if (week && settings.mayManage) {
    return (
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-navy">
          {f.plain(t.changeTitle, { site: week.site.name })}
        </h2>

        <form action={saveWorkWeek} className="flex flex-col gap-5">
          <input type="hidden" name="siteCode" value={week.site.code} />

          <fieldset className="flex flex-wrap gap-3 border-0 p-0">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
              {t.columns.days}
            </legend>
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <label key={day} className="flex items-center gap-2 text-sm text-navy">
                <input
                  type="checkbox"
                  name="workingDays"
                  value={day}
                  defaultChecked={week.workingDays.includes(day)}
                  className="size-4 accent-[var(--color-blue)]"
                />
                {t.weekdays[String(day) as keyof typeof t.weekdays]}
              </label>
            ))}
          </fieldset>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-8 gap-y-5">
            <Field id="effectiveFrom" label={t.columns.from}>
              <input
                type="date"
                id="effectiveFrom"
                name="effectiveFrom"
                required
                defaultValue={settings.today}
                className={INPUT}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-navy">
            <input
              type="checkbox"
              name="confirmed"
              defaultChecked={week.confirmed}
              className="size-4 accent-[var(--color-blue)]"
            />
            {f.t.leaveSettings.confirm}
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={PRIMARY}>
              {t.save}
            </button>
            <a href={leaveSettingsHref('week')} className={QUIET}>
              {f.t.employeeFile.cancel}
            </a>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-navy">{t.title}</h2>
        <p className="m-0 max-w-prose text-[13px] text-body">{t.note}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {[t.columns.site, t.columns.days, t.columns.from, t.columns.state, ''].map(
                (label, index) => (
                  <th
                    key={`${label}-${index}`}
                    scope="col"
                    className="whitespace-nowrap border-b border-line pb-2.5 pe-4 text-start text-xs font-semibold uppercase tracking-[0.04em] text-muted"
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>

          <tbody>
            {settings.workWeeks.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <th scope="row" className="py-3 pe-4 text-start font-semibold text-navy">
                  {row.site.name}
                </th>
                <td className="py-3 pe-4 text-body">
                  {row.workingDays
                    .map((day) => t.short[String(day) as keyof typeof t.short])
                    .join(' · ')}
                </td>
                <td className="num whitespace-nowrap py-3 pe-4 text-body">
                  {f.dateMedium(row.effectiveFrom)}
                </td>
                <td className="py-3 pe-4">
                  <State confirmed={row.confirmed} f={f} />
                </td>
                <td className="py-3 text-end">
                  {settings.mayManage && (
                    <a
                      href={`${leaveSettingsHref('week')}&edit=${row.site.code}`}
                      className="quiet-button h-9 border-button-border px-3 text-xs font-semibold text-navy"
                    >
                      {t.change}
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Holidays({ settings, f }: { settings: LeaveSettings; f: Formatter }): JSX.Element {
  const t = f.t.leaveSettings.holidays;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-navy">{t.title}</h2>
        <p className="m-0 max-w-prose text-[13px] text-body">{t.note}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <form method="get" action="/settings/leave" className="flex items-end gap-2">
          <input type="hidden" name="tab" value="holidays" />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-body">{t.year}</span>
            <select name="year" defaultValue={settings.year} className={`${INPUT} h-9`}>
              {settings.holidayYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="quiet-button h-9 border-button-border px-3 text-[13px] font-semibold text-navy">
            {t.show}
          </button>
        </form>

        {settings.mayManage && (
          <form action={confirmHolidayYear} className="ms-auto">
            <input type="hidden" name="year" value={settings.year} />
            <button type="submit" className="quiet-button h-9 border-button-border px-3 text-[13px] font-semibold text-navy">
              {f.plain(t.confirmYear, { year: String(settings.year) })}
            </button>
          </form>
        )}
      </div>

      <p className="m-0 rounded-2xl border border-card-border bg-surface-quiet px-4 py-3 text-[13px] text-body">
        {t.missing}
      </p>

      {/* The switch that stops every request in this year carrying a warning. */}
      <div
        className={`flex flex-col gap-2 rounded-2xl border px-4 py-3.5 ${
          settings.yearComplete
            ? 'border-success-border bg-success-bg'
            : 'border-warning-bg bg-warning-bg'
        }`}
      >
        <form action={setHolidayYearComplete} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="year" value={settings.year} />
          <label
            className={`flex items-center gap-2.5 text-sm font-semibold ${
              settings.yearComplete ? 'text-success-ink' : 'text-warning-ink'
            }`}
          >
            <input
              type="checkbox"
              name="complete"
              defaultChecked={settings.yearComplete}
              disabled={!settings.mayManage}
              className="size-4 accent-[var(--color-blue)]"
            />
            {f.plain(t.complete, { year: String(settings.year) })}
          </label>

          {settings.mayManage && (
            <button
              type="submit"
              className="quiet-button h-9 border-button-border px-3 text-[13px] font-semibold text-navy"
            >
              {t.completeSave}
            </button>
          )}
        </form>

        <p
          className={`m-0 max-w-prose text-xs ${
            settings.yearComplete ? 'text-success-ink' : 'text-warning-ink'
          }`}
        >
          {f.plain(t.completeNote, { year: String(settings.year) })}
        </p>
      </div>

      {settings.holidays.length === 0 ? (
        <p className="m-0 py-6 text-sm text-body">{t.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {[t.columns.date, t.columns.day, t.columns.name, t.columns.state, ''].map(
                  (label, index) => (
                    <th
                      key={`${label}-${index}`}
                      scope="col"
                      className="whitespace-nowrap border-b border-line pb-2.5 pe-4 text-start text-xs font-semibold uppercase tracking-[0.04em] text-muted"
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>

            <tbody>
              {settings.holidays.map((holiday) => (
                <tr key={holiday.id} className="border-t border-line">
                  <td className="num whitespace-nowrap py-3 pe-4 text-navy">
                    {f.dateMedium(holiday.date)}
                  </td>
                  <td className="py-3 pe-4 text-body">{f.weekday(holiday.date)}</td>
                  <th scope="row" className="py-3 pe-4 text-start font-semibold text-navy">
                    {holiday.name}
                  </th>
                  <td className="py-3 pe-4">
                    <State confirmed={holiday.confirmed} f={f} />
                  </td>
                  <td className="py-3 text-end">
                    {settings.mayManage && (
                      <form action={removeHoliday}>
                        <input type="hidden" name="id" value={holiday.id} />
                        <input type="hidden" name="year" value={settings.year} />
                        <button
                          type="submit"
                          className="quiet-button h-9 border-button-border px-3 text-xs font-semibold text-navy"
                        >
                          {t.remove}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {settings.mayManage && (
        <form action={addHoliday} className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
          <Field id="date" label={t.date}>
            <input type="date" id="date" name="date" required className={INPUT} />
          </Field>
          <Field id="name" label={t.name}>
            <input type="text" id="name" name="name" required className={INPUT} />
          </Field>
          <button type="submit" className={PRIMARY}>
            {t.save}
          </button>
        </form>
      )}
    </section>
  );
}

function Policy({ settings, f }: { settings: LeaveSettings; f: Formatter }): JSX.Element {
  const t = f.t.leaveSettings.policy;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-navy">{t.title}</h2>
        <p className="m-0 max-w-prose text-[13px] text-body">{t.note}</p>
      </div>

      <form action={saveLeavePolicy} className="flex flex-col gap-5">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-x-8 gap-y-5">
          <Field id="teamOffWarningPercent" label={t.teamOff} note={t.teamOffNote}>
            <input
              type="number"
              min={1}
              max={100}
              id="teamOffWarningPercent"
              name="teamOffWarningPercent"
              defaultValue={settings.policy.teamOffWarningPercent}
              disabled={!settings.mayManage}
              className={INPUT}
            />
          </Field>

          <Field id="leaveYearStart" label={t.yearStart} note={t.yearStartNote}>
            <input
              type="text"
              id="leaveYearStart"
              name="leaveYearStart"
              defaultValue={settings.policy.leaveYearStart}
              disabled={!settings.mayManage}
              className={INPUT}
            />
          </Field>

          <Field id="secondApprover" label={t.secondApprover} note={t.secondApproverNote}>
            <select
              id="secondApprover"
              name="secondApprover"
              defaultValue={settings.policy.secondApprover}
              disabled={!settings.mayManage}
              className={INPUT}
            >
              <option value="hr">{t.secondApproverOptions.hr}</option>
              <option value="manager_of_manager">{t.secondApproverOptions.manager_of_manager}</option>
            </select>
          </Field>
        </div>

        {settings.mayManage && (
          <button type="submit" className={`${PRIMARY} w-fit`}>
            {t.save}
          </button>
        )}
      </form>
    </section>
  );
}

function State({ confirmed, f }: { confirmed: boolean; f: Formatter }): JSX.Element {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-[5px] text-xs font-semibold ${
        confirmed ? 'bg-ok-bg text-ok-ink' : 'bg-warning-bg text-warning-ink'
      }`}
    >
      {confirmed ? f.t.leaveSettings.confirmed : f.t.leaveSettings.toConfirm}
    </span>
  );
}

function Notice({
  query,
  t,
}: {
  query: Record<string, string | string[] | undefined>;
  t: Messages;
}): JSX.Element | null {
  const good = ['saved', 'removed', 'confirmed'].some((key) => one(query[key]) === '1');

  if (good) {
    return (
      <p className="m-0 rounded-2xl border border-success-border bg-success-bg px-4 py-3 text-sm text-success-ink">
        {t.leaveSettings.types.saved}
      </p>
    );
  }

  if (one(query['error']) === '1') {
    return (
      <p
        role="alert"
        className="m-0 rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-ink"
      >
        {t.leaveSettings.failed}
      </p>
    );
  }

  return null;
}

const INPUT = 'h-11 rounded-xl border border-field-border bg-white px-3.5 text-sm text-navy';
const PRIMARY =
  'h-11 rounded-xl bg-blue px-5 text-sm font-semibold text-white transition-[background-color] duration-200 ease-out hover:bg-blue-hover';
const QUIET = 'quiet-button h-11 border-button-border px-4 text-[13px] font-semibold text-navy';

function Field({
  id,
  label,
  note,
  wide = false,
  children,
}: {
  id: string;
  label: string;
  note?: string;
  wide?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className={`flex flex-col gap-1.5 ${wide ? 'col-span-full' : ''}`}>
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
        {label}
      </label>
      {children}
      {note !== undefined && <span className="text-xs text-body">{note}</span>}
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

/** A number of days, or a dash where the type has no such right. */
function days(value: number | undefined, f: Formatter): string {
  return value === undefined ? f.t.leaveSettings.rules.none : f.count(value);
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
