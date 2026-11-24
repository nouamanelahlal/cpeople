'use client';

import {
  cloneElement,
  isValidElement,
  useActionState,
  useState,
  type JSX,
  type ReactElement,
  type ReactNode,
} from 'react';
import { hireEmployee, type HireResult } from '../actions';

/**
 * The hire wizard (HR-01 spec 6.4).
 *
 * Six steps with a draft kept between them, and nothing created until the last
 * one: the API is asked once, with the whole person, so there is never a half
 * employee in the database to clean up.
 *
 * What it offers — positions, sites, contract types, managers — comes from the
 * API, so the wizard cannot invent a department this company does not have. What
 * it refuses it refuses twice: here, to save a round trip, and there, because
 * that is the one that counts.
 */

const STEPS = ['identity', 'job', 'pay', 'family', 'contract', 'review'] as const;
type Step = (typeof STEPS)[number];

interface Options {
  readonly positions: readonly {
    readonly code: string;
    readonly title: string;
    readonly department: string;
    readonly departmentCode: string;
    readonly siteCode?: string;
  }[];
  readonly sites: readonly { readonly code: string; readonly name: string }[];
  readonly contractTypes: readonly {
    readonly code: string;
    readonly name: string;
    readonly requiresEndDate: boolean;
    readonly defaultTrialDays?: number;
  }[];
  readonly managers: readonly {
    readonly id: string;
    readonly name: string;
    readonly departmentCode: string;
  }[];
  readonly today: string;
  readonly nextEmployeeNumber: string;
}

interface Labels {
  step: string;
  steps: Record<Step, string>;
  back: string;
  next: string;
  create: string;
  creating: string;
  edit: string;
  fields: Record<string, string>;
  gender: Record<string, string>;
  maritalStatus: Record<string, string>;
  cnssPending: string;
  ribNote: string;
  ribWarning: string;
  endRequired: string;
  trialNote: string;
  numberNote: string;
  numberHint: string;
  addDependent: string;
  removeDependent: string;
  noDependents: string;
  relation: string;
  spouse: string;
  child: string;
  pickPosition: string;
  pickManager: string;
  pickSite: string;
  duplicate: string;
  duplicateOpen: string;
  failed: string;
  reviewNote: string;
  required: string;
  optional: string;
  currency: string;
}

interface Dependent {
  relation: 'spouse' | 'child';
  firstName: string;
  birthDate: string;
}

interface Draft {
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string;
  nationality: string;
  nationalId: string;
  maritalStatus: string;
  address: string;
  phone: string;
  email: string;
  positionCode: string;
  siteCode: string;
  managerId: string;
  hireDate: string;
  baseSalary: string;
  socialSecurityNumber: string;
  pensionMember: boolean;
  bankName: string;
  bankAccount: string;
  dependents: Dependent[];
  contractTypeCode: string;
  contractEndDate: string;
  trialEndDate: string;
}

export function HireWizard({ options, t }: { options: Options; t: Labels }): JSX.Element {
  const [step, setStep] = useState<Step>('identity');
  const [draft, setDraft] = useState<Draft>(() => ({
    firstName: '',
    lastName: '',
    gender: 'unspecified',
    birthDate: '',
    nationality: 'MA',
    nationalId: '',
    maritalStatus: 'single',
    address: '',
    phone: '',
    email: '',
    positionCode: '',
    siteCode: '',
    managerId: '',
    hireDate: options.today,
    baseSalary: '',
    socialSecurityNumber: '',
    pensionMember: false,
    bankName: '',
    bankAccount: '',
    dependents: [],
    contractTypeCode: options.contractTypes[0]?.code ?? '',
    contractEndDate: '',
    trialEndDate: '',
  }));

  const [result, submit, pending] = useActionState<HireResult | null, FormData>(
    hireEmployee,
    null,
  );

  const set = <K extends keyof Draft>(key: K, value: Draft[K]): void =>
    setDraft((current) => ({ ...current, [key]: value }));

  const position = options.positions.find((item) => item.code === draft.positionCode);
  const contractType = options.contractTypes.find((item) => item.code === draft.contractTypeCode);
  const index = STEPS.indexOf(step);

  const incomplete = missing(step, draft, contractType?.requiresEndDate ?? false);

  return (
    <section className="flex flex-col gap-6 rounded-[20px] border border-card-border bg-white p-6">
      <div className="flex flex-col gap-3">
        <span className="num text-xs font-semibold uppercase tracking-[0.04em] text-muted">
          {t.step.replace('{step}', String(index + 1)).replace('{steps}', String(STEPS.length))} ·{' '}
          {t.steps[step]}
        </span>

        <span aria-hidden="true" className="h-2 overflow-hidden rounded-lg bg-line">
          <span
            className="block h-full rounded-lg bg-cyan transition-[inline-size] duration-300 ease-out"
            style={{ inlineSize: `${((index + 1) / STEPS.length) * 100}%` }}
          />
        </span>
      </div>

      {result?.error === 'duplicate' && (
        <p
          role="alert"
          className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-ink"
        >
          {t.duplicate}
          {result.employee && (
            <a
              href={`/employees/${result.employee.id}`}
              className="font-semibold text-danger-ink underline"
            >
              {t.duplicateOpen
                .replace('{name}', result.employee.name)
                .replace('{number}', result.employee.employeeNumber)}
            </a>
          )}
        </p>
      )}

      {result?.error === 'failed' && (
        <p
          role="alert"
          className="m-0 rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-ink"
        >
          {t.failed.replace('{reason}', result.reason ?? '')}
        </p>
      )}

      {step === 'identity' && (
        <Grid>
          <Field label={t.fields.firstName!} required>
            <input
              type="text"
              value={draft.firstName}
              onChange={(event) => set('firstName', event.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label={t.fields.lastName!} required>
            <input
              type="text"
              value={draft.lastName}
              onChange={(event) => set('lastName', event.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label={t.fields.gender!}>
            <select
              value={draft.gender}
              onChange={(event) => set('gender', event.target.value)}
              className={INPUT}
            >
              {['female', 'male', 'unspecified'].map((value) => (
                <option key={value} value={value}>
                  {t.gender[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.fields.birthDate!} required>
            <input
              type="date"
              value={draft.birthDate}
              onChange={(event) => set('birthDate', event.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label={t.fields.nationality!}>
            <input
              type="text"
              maxLength={2}
              value={draft.nationality}
              onChange={(event) => set('nationality', event.target.value.toUpperCase())}
              className={INPUT}
            />
          </Field>
          <Field label={t.fields.nationalId!} required>
            <input
              type="text"
              value={draft.nationalId}
              onChange={(event) => set('nationalId', event.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label={t.fields.maritalStatus!}>
            <select
              value={draft.maritalStatus}
              onChange={(event) => set('maritalStatus', event.target.value)}
              className={INPUT}
            >
              {['single', 'married', 'divorced', 'widowed'].map((value) => (
                <option key={value} value={value}>
                  {t.maritalStatus[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.fields.phone!}>
            <input
              type="tel"
              value={draft.phone}
              onChange={(event) => set('phone', event.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label={t.fields.email!}>
            <input
              type="email"
              value={draft.email}
              onChange={(event) => set('email', event.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label={t.fields.address!} wide>
            <input
              type="text"
              value={draft.address}
              onChange={(event) => set('address', event.target.value)}
              className={INPUT}
            />
          </Field>
        </Grid>
      )}

      {step === 'job' && (
        <Grid>
          <Field label={t.fields.position!} required>
            <select
              value={draft.positionCode}
              onChange={(event) => {
                const chosen = options.positions.find((item) => item.code === event.target.value);
                set('positionCode', event.target.value);
                // The department, its site and a manager from it follow the
                // position, which is what HR actually chooses.
                if (chosen?.siteCode) set('siteCode', chosen.siteCode);
              }}
              className={INPUT}
            >
              <option value="">{t.pickPosition}</option>
              {options.positions.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.title} · {item.department}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t.fields.department!}>
            <input type="text" value={position?.department ?? ''} readOnly className={READ_ONLY} />
          </Field>

          <Field label={t.fields.site!}>
            <select
              value={draft.siteCode}
              onChange={(event) => set('siteCode', event.target.value)}
              className={INPUT}
            >
              <option value="">{t.pickSite}</option>
              {options.sites.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t.fields.manager!}>
            <select
              value={draft.managerId}
              onChange={(event) => set('managerId', event.target.value)}
              className={INPUT}
            >
              <option value="">{t.pickManager}</option>
              {options.managers
                .filter(
                  (manager) =>
                    position === undefined || manager.departmentCode === position.departmentCode,
                )
                .map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name}
                  </option>
                ))}
            </select>
          </Field>

          <Field label={t.fields.hireDate!} required>
            <input
              type="date"
              value={draft.hireDate}
              onChange={(event) => set('hireDate', event.target.value)}
              className={INPUT}
            />
          </Field>

          <Field label={t.fields.employeeNumber!} note={t.numberHint}>
            <input
              type="text"
              value={options.nextEmployeeNumber}
              readOnly
              className={READ_ONLY}
            />
          </Field>
        </Grid>
      )}

      {step === 'pay' && (
        <Grid>
          <Field label={`${t.fields.baseSalary!} (${t.currency})`} required>
            <input
              type="text"
              inputMode="decimal"
              value={draft.baseSalary}
              onChange={(event) => set('baseSalary', event.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label={t.fields.socialSecurityNumber!} note={t.cnssPending}>
            <input
              type="text"
              value={draft.socialSecurityNumber}
              onChange={(event) => set('socialSecurityNumber', event.target.value)}
              className={INPUT}
            />
          </Field>
          <label className="flex items-center gap-2.5 self-end pb-2.5 text-sm text-navy">
            <input
              type="checkbox"
              checked={draft.pensionMember}
              onChange={(event) => set('pensionMember', event.target.checked)}
              className="size-4 accent-[var(--color-blue)]"
            />
            {t.fields.pensionMember}
          </label>
          <Field label={t.fields.bankName!}>
            <input
              type="text"
              value={draft.bankName}
              onChange={(event) => set('bankName', event.target.value)}
              className={INPUT}
            />
          </Field>
          <Field
            label={t.fields.bankAccount!}
            wide
            note={
              draft.bankAccount !== '' && draft.bankAccount.replace(/\D/g, '').length !== 24
                ? t.ribWarning
                : t.ribNote
            }
          >
            <input
              type="text"
              value={draft.bankAccount}
              onChange={(event) => set('bankAccount', event.target.value)}
              className={INPUT}
            />
          </Field>
        </Grid>
      )}

      {step === 'family' && (
        <div className="flex flex-col gap-4">
          {draft.dependents.length === 0 && (
            <p className="m-0 text-sm text-body">{t.noDependents}</p>
          )}

          {draft.dependents.map((dependent, position_) => (
            <div key={position_} className="flex flex-wrap items-end gap-3">
              <Field label={t.relation}>
                <select
                  value={dependent.relation}
                  onChange={(event) =>
                    set(
                      'dependents',
                      draft.dependents.map((item, index_) =>
                        index_ === position_
                          ? { ...item, relation: event.target.value as 'spouse' | 'child' }
                          : item,
                      ),
                    )
                  }
                  className={INPUT}
                >
                  <option value="child">{t.child}</option>
                  <option value="spouse">{t.spouse}</option>
                </select>
              </Field>

              <Field label={t.fields.firstName!}>
                <input
                  type="text"
                  value={dependent.firstName}
                  onChange={(event) =>
                    set(
                      'dependents',
                      draft.dependents.map((item, index_) =>
                        index_ === position_ ? { ...item, firstName: event.target.value } : item,
                      ),
                    )
                  }
                  className={INPUT}
                />
              </Field>

              <Field label={t.fields.birthDate!}>
                <input
                  type="date"
                  value={dependent.birthDate}
                  onChange={(event) =>
                    set(
                      'dependents',
                      draft.dependents.map((item, index_) =>
                        index_ === position_ ? { ...item, birthDate: event.target.value } : item,
                      ),
                    )
                  }
                  className={INPUT}
                />
              </Field>

              <button
                type="button"
                onClick={() =>
                  set(
                    'dependents',
                    draft.dependents.filter((_, index_) => index_ !== position_),
                  )
                }
                className="quiet-button h-11 border-button-border px-4 text-[13px] font-semibold text-navy"
              >
                {t.removeDependent}
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              set('dependents', [
                ...draft.dependents,
                { relation: 'child', firstName: '', birthDate: '' },
              ])
            }
            className="quiet-button h-11 w-fit border-button-border px-4 text-[13px] font-semibold text-navy"
          >
            {t.addDependent}
          </button>
        </div>
      )}

      {step === 'contract' && (
        <Grid>
          <Field label={t.fields.contractType!} required>
            <select
              value={draft.contractTypeCode}
              onChange={(event) => set('contractTypeCode', event.target.value)}
              className={INPUT}
            >
              {options.contractTypes.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label={t.fields.contractEnd!}
            required={contractType?.requiresEndDate ?? false}
            {...(contractType?.requiresEndDate ? { note: t.endRequired } : {})}
          >
            <input
              type="date"
              value={draft.contractEndDate}
              onChange={(event) => set('contractEndDate', event.target.value)}
              className={INPUT}
            />
          </Field>

          <Field label={t.fields.trialEnd!} note={t.trialNote}>
            <input
              type="date"
              value={draft.trialEndDate}
              onChange={(event) => set('trialEndDate', event.target.value)}
              className={INPUT}
            />
          </Field>

          <Field label={`${t.fields.baseSalary!} (${t.currency})`}>
            <input type="text" value={draft.baseSalary} readOnly className={READ_ONLY} />
          </Field>
        </Grid>
      )}

      {step === 'review' && (
        <div className="flex flex-col gap-5">
          <p className="m-0 max-w-prose text-[13px] text-body">{t.reviewNote}</p>

          <dl className="m-0 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-8 gap-y-4">
            <Summary label={t.fields.firstName!} value={`${draft.firstName} ${draft.lastName}`} />
            <Summary label={t.fields.nationalId!} value={draft.nationalId} />
            <Summary label={t.fields.birthDate!} value={draft.birthDate} />
            <Summary label={t.fields.position!} value={position?.title ?? ''} />
            <Summary label={t.fields.department!} value={position?.department ?? ''} />
            <Summary label={t.fields.hireDate!} value={draft.hireDate} />
            <Summary label={`${t.fields.baseSalary!} (${t.currency})`} value={draft.baseSalary} />
            <Summary label={t.fields.contractType!} value={contractType?.name ?? ''} />
            {draft.contractEndDate !== '' && (
              <Summary label={t.fields.contractEnd!} value={draft.contractEndDate} />
            )}
            <Summary
              label={t.fields.employeeNumber!}
              value={t.numberNote.replace('{number}', options.nextEmployeeNumber)}
            />
          </dl>

          <form action={submit}>
            <input type="hidden" name="draft" value={JSON.stringify(body(draft))} />
            <button
              type="submit"
              disabled={pending}
              className="h-11 rounded-xl bg-blue px-5 text-sm font-semibold text-white transition-[background-color] duration-200 ease-out hover:bg-blue-hover disabled:opacity-60"
            >
              {pending ? t.creating : t.create}
            </button>
          </form>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => setStep(STEPS[Math.max(0, index - 1)]!)}
          className="quiet-button h-11 border-button-border px-4 text-[13px] font-semibold text-navy disabled:opacity-50"
        >
          {t.back}
        </button>

        {step !== 'review' && (
          <button
            type="button"
            disabled={incomplete}
            onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, index + 1)]!)}
            className="h-11 rounded-xl bg-blue px-5 text-sm font-semibold text-white transition-[background-color] duration-200 ease-out hover:bg-blue-hover disabled:opacity-60"
          >
            {t.next}
          </button>
        )}

        {incomplete && <span className="text-[13px] text-body">{t.required}</span>}
      </div>
    </section>
  );
}

const INPUT =
  'h-11 rounded-xl border border-field-border bg-white px-3.5 text-sm text-navy';
const READ_ONLY = `${INPUT} bg-surface-quiet text-body`;

/** Whether this step still wants something before it can be left. */
function missing(step: Step, draft: Draft, endRequired: boolean): boolean {
  switch (step) {
    case 'identity':
      return (
        draft.firstName.trim() === '' ||
        draft.lastName.trim() === '' ||
        draft.birthDate === '' ||
        draft.nationalId.trim() === ''
      );
    case 'job':
      return draft.positionCode === '' || draft.hireDate === '';
    case 'pay':
      return draft.baseSalary.trim() === '';
    case 'contract':
      return draft.contractTypeCode === '' || (endRequired && draft.contractEndDate === '');
    default:
      return false;
  }
}

/** The draft as the API wants it: money in minor units, empty fields dropped. */
function body(draft: Draft): Record<string, unknown> {
  const amount = Number.parseFloat(draft.baseSalary.replace(/\s/g, '').replace(',', '.'));

  return {
    firstName: draft.firstName,
    lastName: draft.lastName,
    gender: draft.gender,
    birthDate: draft.birthDate,
    nationality: draft.nationality,
    nationalId: draft.nationalId,
    maritalStatus: draft.maritalStatus,
    address: draft.address,
    phone: draft.phone,
    email: draft.email,
    positionCode: draft.positionCode,
    siteCode: draft.siteCode,
    managerId: draft.managerId,
    hireDate: draft.hireDate,
    baseSalaryMinor: Number.isFinite(amount) ? Math.round(amount * 100) : 0,
    socialSecurityNumber: draft.socialSecurityNumber,
    pensionMember: draft.pensionMember,
    bankName: draft.bankName,
    bankAccount: draft.bankAccount,
    dependents: draft.dependents.filter(
      (dependent) => dependent.firstName.trim() !== '' && dependent.birthDate !== '',
    ),
    contractTypeCode: draft.contractTypeCode,
    contractEndDate: draft.contractEndDate,
    trialEndDate: draft.trialEndDate,
  };
}

function Grid({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-8 gap-y-5">
      {children}
    </div>
  );
}

/**
 * One labelled control.
 *
 * The label points at the field by id rather than wrapping it, and the required
 * mark and the hint sit outside the label. A wrapped control takes everything
 * inside the label into its name — the star, the hint, and for a `<select>` the
 * option that happens to be chosen — and a field called "Kind of contract
 * *Contrat à durée déterminée" is a field nobody can ask for by name.
 *
 * The id is made from the label, so no call site has to invent one.
 */
function Field({
  label,
  children,
  note,
  required = false,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  note?: string;
  required?: boolean;
  wide?: boolean;
}): JSX.Element {
  const id = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string; 'aria-describedby'?: string }>, {
        id,
        ...(note === undefined ? {} : { 'aria-describedby': `${id}-note` }),
      })
    : children;

  return (
    <div className={`flex flex-col gap-1.5 ${wide ? 'col-span-full' : ''}`}>
      <label
        htmlFor={id}
        className="text-xs font-semibold uppercase tracking-[0.04em] text-muted"
      >
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {control}
      {note !== undefined && (
        <span id={`${id}-note`} className="text-xs text-body">
          {note}
        </span>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">{label}</dt>
      <dd className="num m-0 text-sm text-navy">{value === '' ? '—' : value}</dd>
    </div>
  );
}
