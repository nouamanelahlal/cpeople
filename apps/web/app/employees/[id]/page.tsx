import type { JSX } from 'react';
import { MASK, type Messages } from '@cpeople/shared';
import { apiGetOrNull } from '../../../lib/api';
import {
  readTab,
  seniorityParts,
  tabHref,
  type AuditEvent,
  type EmployeeFile,
  type Tab,
} from '../../../lib/employee-file';
import { formatter, type Formatter } from '../../../lib/format';
import { AppPage, appContext } from '../../_shell/app-page';
import { EditChoice, EditField, EditForm, EditGrid, EditSwitch } from './_components/edit-form';
import { FileHeader } from './_components/file-header';
import { FieldList, Masked, Panel, Pill, type Field } from './_components/file-parts';
import { HistoryList } from './_components/history-list';

const TIME_ZONE = 'Africa/Casablanca';

/**
 * One employee's file (HR-01 spec 6.3).
 *
 * Eight tabs in the spec; six of them here, because documents and onboarding are
 * steps of their own. Which tab is open is in the address, and so is whether the
 * edit form is: a file can be linked to, shared and reloaded in the state it was
 * being read in.
 *
 * Nothing on this page decides what may be seen. The API sends a file with the
 * sensitive part either in it or not, and the mask drawn here is drawn over
 * nothing — there is no value behind it to inspect.
 */
export default async function EmployeeFilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  const { id } = await params;
  const query = await searchParams;
  const tab = readTab(query['tab']);
  const f = formatter(context.locale, t, TIME_ZONE);

  const file = await apiGetOrNull<EmployeeFile>(`/employees/${id}`);

  if (file === null) {
    return (
      <AppPage
        context={context}
        current="employees"
        title={t.employeeFile.notFound}
        subtitle={t.employeeFile.notFoundNote}
      >
        <Panel title={t.employeeFile.notFound} note={t.employeeFile.notFoundNote}>
          <a href="/employees" className="text-sm font-semibold">
            {t.employeeFile.back}
          </a>
        </Panel>
      </AppPage>
    );
  }

  const mayEdit = file.can.edit || file.can.editOwnContact;
  const editing = mayEdit && one(query['edit']) === '1' && tab !== 'history' && tab !== 'contracts';

  const history =
    tab === 'history' && file.can.seeHistory
      ? ((await apiGetOrNull<AuditEvent[]>(`/employees/${id}/history`)) ?? [])
      : [];

  return (
    <AppPage
      context={context}
      current="employees"
      title={`${file.firstName} ${file.lastName}`}
      subtitle={`${file.employeeNumber} · ${file.position.name}`}
    >
      <FileHeader
        file={file}
        tab={tab}
        f={f}
        actions={
          editing || !mayEdit ? null : (
            <a
              href={tabHref(file.id, tab, { edit: true })}
              className="quiet-button h-11 shrink-0 border-button-border px-4 text-[13px] font-semibold text-navy"
            >
              {file.can.edit ? t.employeeFile.edit : t.employeeFile.editContact}
            </a>
          )
        }
      />

      <Notice query={query} t={t} />

      {editing ? (
        <EditTab file={file} tab={tab} f={f} />
      ) : (
        <ReadTab file={file} tab={tab} history={history} f={f} />
      )}
    </AppPage>
  );
}

/** What the last save did, or why it could not be done. */
function Notice({
  query,
  t,
}: {
  query: Record<string, string | string[] | undefined>;
  t: Messages;
}): JSX.Element | null {
  const error = one(query['error']);

  if (one(query['saved']) === '1') {
    return (
      <p className="m-0 rounded-2xl border border-success-border bg-success-bg px-4 py-3 text-sm text-success-ink">
        {t.employeeFile.saved}
      </p>
    );
  }

  if (error === 'duplicate-cin') {
    const id = one(query['withId']);

    return (
      <p
        role="alert"
        className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-ink"
      >
        {t.employeeFile.duplicateCin}
        {id !== undefined && (
          <a href={`/employees/${id}`} className="font-semibold text-danger-ink underline">
            {t.employeeFile.duplicateCinOpen
              .replace('{name}', one(query['withName']) ?? '')
              .replace('{number}', one(query['withNumber']) ?? '')}
          </a>
        )}
      </p>
    );
  }

  if (error === 'saving-failed') {
    return (
      <p
        role="alert"
        className="m-0 rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-ink"
      >
        {t.employeeFile.savingFailed}
      </p>
    );
  }

  return null;
}

/** The tab as it reads. */
function ReadTab({
  file,
  tab,
  history,
  f,
}: {
  file: EmployeeFile;
  tab: Tab;
  history: readonly AuditEvent[];
  f: Formatter;
}): JSX.Element {
  const t = f.t.employeeFile;

  switch (tab) {
    case 'overview':
      return (
        <Panel title={t.tabs.overview} {...(file.can.seeSensitive ? {} : { note: t.maskedNote })}>
          <FieldList fields={identityFields(file, f)} f={f} />
        </Panel>
      );

    case 'job':
      return (
        <Panel title={t.tabs.job}>
          <FieldList fields={jobFields(file, f)} f={f} />
        </Panel>
      );

    case 'pay':
      return (
        <Panel
          title={t.tabs.pay}
          note={file.can.seeSensitive ? t.payNote : `${t.payNote} ${t.maskedNote}`}
        >
          <FieldList fields={payFields(file, f)} f={f} />
        </Panel>
      );

    case 'family':
      return (
        <Panel title={t.tabs.family} {...(file.can.seeSensitive ? {} : { note: t.maskedNote })}>
          <Family file={file} f={f} />
        </Panel>
      );

    case 'contracts':
      return (
        <Panel title={t.tabs.contracts}>
          <Contracts file={file} f={f} />
        </Panel>
      );

    case 'history':
      return (
        <Panel title={t.tabs.history}>
          {file.can.seeHistory ? (
            <HistoryList events={history} f={f} />
          ) : (
            <p className="m-0 text-sm text-body">{t.historyOnlyHr}</p>
          )}
        </Panel>
      );
  }
}

/** The same tab, with inputs in place of the values this person may change. */
function EditTab({ file, tab, f }: { file: EmployeeFile; tab: Tab; f: Formatter }): JSX.Element {
  const t = f.t.employeeFile;
  const everything = file.can.edit;

  return (
    <Panel title={t.tabs[tab]} {...(tab === 'pay' ? { note: t.payNote } : {})}>
      <EditForm
        id={file.id}
        tab={tab}
        cancelHref={tabHref(file.id, tab)}
        save={t.save}
        cancel={t.cancel}
        warning={t.unsaved}
      >
        <EditGrid>
          {tab === 'overview' && (
            <>
              {everything && (
                <>
                  <EditField
                    name="firstName"
                    label={t.fields.firstName}
                    defaultValue={file.firstName}
                    required
                  />
                  <EditField
                    name="lastName"
                    label={t.fields.lastName}
                    defaultValue={file.lastName}
                    required
                  />
                  <EditChoice
                    name="maritalStatus"
                    label={t.fields.maritalStatus}
                    defaultValue={file.maritalStatus}
                    options={(['single', 'married', 'divorced', 'widowed'] as const).map(
                      (value) => ({ value, label: t.maritalStatus[value] }),
                    )}
                  />
                  {file.sensitive && (
                    <EditField
                      name="nationalId"
                      label={t.fields.nationalId}
                      defaultValue={file.sensitive.nationalId}
                      required
                    />
                  )}
                </>
              )}

              <EditField name="phone" label={t.fields.phone} defaultValue={file.phone ?? ''} />
              <EditField
                name="email"
                label={t.fields.email}
                type="email"
                defaultValue={file.email ?? ''}
              />
              {file.sensitive && (
                <EditField
                  name="address"
                  label={t.fields.address}
                  defaultValue={file.sensitive.address ?? ''}
                  wide
                />
              )}
            </>
          )}

          {tab === 'pay' && file.sensitive && (
            <>
              <EditField
                name="baseSalary"
                label={t.fields.baseSalaryMinor}
                type="text"
                defaultValue={(file.sensitive.baseSalaryMinor / 100).toFixed(2)}
              />
              <EditField
                name="socialSecurityNumber"
                label={t.fields.socialSecurityNumber}
                defaultValue={file.sensitive.socialSecurityNumber ?? ''}
              />
              <EditSwitch
                name="pensionMember"
                label={t.fields.pensionMember}
                defaultChecked={file.pensionMember}
              />
              <EditField
                name="bankName"
                label={t.fields.bankName}
                defaultValue={file.sensitive.bankName ?? ''}
              />
              <EditField
                name="bankAccount"
                label={t.fields.bankAccount}
                defaultValue={file.sensitive.bankAccount ?? ''}
                wide
              />
            </>
          )}

          {(tab === 'job' || tab === 'family') && (
            <p className="col-span-full m-0 text-sm text-body">{t.laterStep}</p>
          )}
        </EditGrid>
      </EditForm>
    </Panel>
  );
}

function identityFields(file: EmployeeFile, f: Formatter): Field[] {
  const t = f.t.employeeFile;
  const s = file.sensitive;

  return [
    { label: t.fields.firstName, value: file.firstName },
    { label: t.fields.lastName, value: file.lastName },
    { label: t.fields.employeeNumber, value: file.employeeNumber },
    { label: t.fields.gender, value: t.gender[file.gender as keyof typeof t.gender] ?? file.gender },
    secret(t.fields.birthDate, s && f.dateMedium(s.birthDate), s !== undefined),
    { label: t.fields.nationality, value: countryName(file.nationality, f) },
    secret(t.fields.nationalId, s?.nationalId, s !== undefined),
    {
      label: t.fields.maritalStatus,
      value: t.maritalStatus[file.maritalStatus as keyof typeof t.maritalStatus] ?? file.maritalStatus,
    },
    { label: t.fields.phone, value: file.phone ?? t.none },
    { label: t.fields.email, value: file.email ?? t.none },
    { ...secret(t.fields.address, s?.address ?? t.none, s !== undefined), wide: true },
  ];
}

function jobFields(file: EmployeeFile, f: Formatter): Field[] {
  const t = f.t.employeeFile;
  const seniority = seniorityParts(file.seniorityMonths);

  return [
    { label: t.fields.position, value: file.position.name },
    { label: t.fields.department, value: file.department.name },
    { label: t.fields.site, value: file.site?.name ?? t.none },
    {
      label: t.fields.costCentre,
      value: file.costCentre ? `${file.costCentre.code} · ${file.costCentre.name}` : t.none,
      note: file.costCentreOverride ? t.overridden : t.fromDepartment,
    },
    {
      label: t.fields.manager,
      value: file.manager ? (
        <a href={`/employees/${file.manager.id}`}>{file.manager.name}</a>
      ) : (
        t.none
      ),
    },
    { label: t.fields.hireDate, value: f.dateMedium(file.hireDate) },
    { label: t.fields.seniorityDate, value: f.dateMedium(file.seniorityDate) },
    {
      label: t.fields.seniority,
      value:
        seniority.years === 0
          ? f.plain(t.seniorityMonths, { months: f.count(seniority.months) })
          : f.plain(t.seniorityYears, {
              years: f.count(seniority.years),
              months: f.count(seniority.months),
            }),
    },
    ...(file.leftOn ? [{ label: t.fields.leftOn, value: f.dateMedium(file.leftOn) }] : []),
  ];
}

function payFields(file: EmployeeFile, f: Formatter): Field[] {
  const t = f.t.employeeFile;
  const s = file.sensitive;

  return [
    secret(t.fields.baseSalaryMinor, s && f.money(s.baseSalaryMinor), s !== undefined),
    secret(t.fields.socialSecurityNumber, s?.socialSecurityNumber ?? t.none, s !== undefined),
    { label: t.fields.pensionMember, value: file.pensionMember ? t.yes : t.no },
    secret(t.fields.bankName, s?.bankName ?? t.none, s !== undefined),
    { ...secret(t.fields.bankAccount, s?.bankAccount ?? t.none, s !== undefined), wide: true },
  ];
}

/**
 * A country as the reader's language names it.
 *
 * The file stores the two-letter code, because that is what a country is to a
 * database; "MA" is not what anyone calls it.
 */
function countryName(code: string, f: Formatter): string {
  try {
    const names = new Intl.DisplayNames([f.locale === 'fr' ? 'fr-FR' : 'en-GB'], {
      type: 'region',
    });
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

/** A field that is only there for a reader allowed it. */
function secret(label: string, value: string | undefined, visible: boolean): Field {
  return visible && value !== undefined
    ? { label, value }
    : { label, value: <Masked />, masked: true };
}

function Family({ file, f }: { file: EmployeeFile; f: Formatter }): JSX.Element {
  const t = f.t.employeeFile;

  if (!file.sensitive) {
    return (
      <p className="m-0 text-sm text-muted" title={t.maskedValue}>
        {MASK}
      </p>
    );
  }

  if (file.sensitive.dependents.length === 0) {
    return <p className="m-0 text-sm text-body">{t.noDependents}</p>;
  }

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {file.sensitive.dependents.map((dependent) => (
        <li
          key={dependent.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line py-3 first:border-t-0 first:pt-0"
        >
          <span className="text-sm font-semibold text-navy">{dependent.firstName}</span>
          <Pill>{t.relation[dependent.relation as keyof typeof t.relation] ?? dependent.relation}</Pill>
          <span className="num text-[13px] text-body">{f.dateMedium(dependent.birthDate)}</span>
        </li>
      ))}
    </ul>
  );
}

function Contracts({ file, f }: { file: EmployeeFile; f: Formatter }): JSX.Element {
  const t = f.t.employeeFile;

  if (file.contracts.length === 0) {
    return <p className="m-0 text-sm text-body">{t.noContracts}</p>;
  }

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {file.contracts.map((contract) => (
        <li
          key={contract.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line py-3.5 first:border-t-0 first:pt-0"
        >
          <span className="text-sm font-semibold text-navy">{contract.type.name}</span>
          <Pill tone={contract.status === 'signed' ? 'tint' : 'quiet'}>
            {t.contractStatus[contract.status]}
          </Pill>

          <span className="num text-[13px] text-body">
            {contract.endDate
              ? f.plain(t.contractPeriod, {
                  from: f.dateMedium(contract.startDate),
                  to: f.dateMedium(contract.endDate),
                })
              : f.plain(t.contractOpenEnded, { from: f.dateMedium(contract.startDate) })}
          </span>

          {contract.trialEndDate && (
            <span className="num text-[13px] text-muted">
              {f.plain(t.trialEnds, { date: f.dateMedium(contract.trialEndDate) })}
            </span>
          )}

          {contract.salaryMinor !== undefined && (
            <span className="num ms-auto text-[13px] font-semibold text-navy">
              {f.money(contract.salaryMinor)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
