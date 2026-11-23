import type { JSX, ReactNode } from 'react';
import { apiGetOrNull } from '../../../lib/api';
import { formatter } from '../../../lib/format';
import {
  leaveTypeName,
  readRefusal,
  refusalText,
  type LeaveOption,
} from '../../../lib/leave';
import { AppPage, appContext } from '../../_shell/app-page';
import { askForLeave } from '../actions';

/**
 * Asking for leave (M09 / HR-04).
 *
 * A short form, and deliberately so: the type, the days, which halves of the
 * first and last ones, and a reason nobody but the people deciding will ever
 * read. What it costs is worked out by the API when it arrives — the same
 * arithmetic that will be used to approve it, so the figure cannot disagree with
 * itself between the two screens.
 */
export default async function NewLeavePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  const query = await searchParams;
  const f = formatter(context.locale, t, 'Africa/Casablanca');
  const types = await apiGetOrNull<LeaveOption[]>('/leave/types');

  if (types === null) {
    return (
      <AppPage context={context} current="leave" title={t.leave.form.title} subtitle={t.leave.subtitle}>
        <Card>
          <p className="m-0 text-sm text-body">{t.leave.errors.unavailable}</p>
        </Card>
      </AppPage>
    );
  }

  const refused = readRefusal(query['error']);
  const chosen = one(query['leaveTypeId']) ?? types[0]?.id ?? '';

  return (
    <AppPage
      context={context}
      current="leave"
      title={t.leave.form.title}
      subtitle={t.leave.subtitle}
    >
      {refused && (
        <p
          role="alert"
          className="m-0 rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-ink"
        >
          {refusalText(refused, t, f.dateMedium)}
        </p>
      )}

      <Card>
        <form action={askForLeave} className="flex flex-col gap-5">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-8 gap-y-5">
            <Field id="leaveTypeId" label={t.leave.form.type} wide>
              <select id="leaveTypeId" name="leaveTypeId" defaultValue={chosen} className={INPUT}>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {leaveTypeName(type, t)}
                    {type.requiresSecondApproval ? ` — ${t.leaveSettings.types.columns.secondApproval}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field id="from" label={t.leave.form.from}>
              <input
                type="date"
                id="from"
                name="from"
                required
                defaultValue={one(query['from']) ?? ''}
                className={INPUT}
              />
            </Field>

            <Field id="fromPart" label={t.leave.form.fromPart}>
              <select
                id="fromPart"
                name="fromPart"
                defaultValue={one(query['fromPart']) ?? 'full'}
                className={INPUT}
              >
                {(['full', 'morning', 'afternoon'] as const).map((part) => (
                  <option key={part} value={part}>
                    {t.leave.parts[part]}
                  </option>
                ))}
              </select>
            </Field>

            <Field id="to" label={t.leave.form.to}>
              <input
                type="date"
                id="to"
                name="to"
                required
                defaultValue={one(query['to']) ?? ''}
                className={INPUT}
              />
            </Field>

            <Field id="toPart" label={t.leave.form.toPart}>
              <select
                id="toPart"
                name="toPart"
                defaultValue={one(query['toPart']) ?? 'full'}
                className={INPUT}
              >
                {(['full', 'morning', 'afternoon'] as const).map((part) => (
                  <option key={part} value={part}>
                    {t.leave.parts[part]}
                  </option>
                ))}
              </select>
            </Field>

            <Field id="reason" label={t.leave.form.reason} note={t.leave.form.reasonNote} wide>
              <input type="text" id="reason" name="reason" maxLength={240} className={INPUT} />
            </Field>
          </div>

          {/* Said before anybody types, rather than after they are refused. */}
          {types.some((type) => type.requiresDocument) && (
            <p className="m-0 rounded-xl bg-surface-quiet px-3.5 py-2.5 text-[13px] text-body">
              {t.leave.form.document}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={PRIMARY}>
              {t.leave.form.submit}
            </button>
            <a href="/leave" className={QUIET}>
              {t.leave.form.cancel}
            </a>
          </div>
        </form>
      </Card>

      <p className="m-0 text-xs text-muted">{t.leaveSettings.toConfirmNote}</p>
    </AppPage>
  );
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

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
