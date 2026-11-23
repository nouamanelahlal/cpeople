import type { JSX, ReactNode } from 'react';
import type { Messages } from '@cpeople/shared';
import { apiGetOrNull } from '../../../lib/api';
import type { ContractPreview } from '../../../lib/contracts';
import { formatter } from '../../../lib/format';
import { AppPage, appContext } from '../../_shell/app-page';
import { endContract, generateContract, renewContract, signContract } from './actions';

const TIME_ZONE = 'Africa/Casablanca';

/**
 * One contract: what it will say, and what can be done with it
 * (HR-01 spec 6.6).
 *
 * The merge data on one side and the clauses on the other, as the spec draws
 * it, with anything the file cannot answer named at the top — a document with a
 * blank where the salary goes is worse than one that was not generated.
 *
 * Generating, signing, renewing and ending are four separate forms, because
 * they are four decisions with different consequences and none of them should
 * be a near-miss of another.
 */
export default async function ContractPage({
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
  const f = formatter(context.locale, t, TIME_ZONE);

  const preview = await apiGetOrNull<ContractPreview>(`/contracts/${id}`);

  if (preview === null) {
    return (
      <AppPage
        context={context}
        current="contracts"
        title={t.contracts.preview.title}
        subtitle={t.contracts.unavailable}
      >
        <Card>
          <p className="m-0 text-sm text-body">{t.contracts.unavailable}</p>
        </Card>
      </AppPage>
    );
  }

  const { contract } = preview;
  const over = contract.status === 'ended' || contract.status === 'renewed';
  // Reading a contract and changing one are different things: a manager may see
  // their team's, and HR is who generates, signs, renews and ends them.
  const mayAct = preview.mayManage && !over;
  const fixedTerm = contract.endDate !== undefined;

  return (
    <AppPage
      context={context}
      current="contracts"
      title={`${contract.employee.name} · ${contract.type.code}`}
      subtitle={t.contracts.preview.note}
    >
      <Notice query={query} fileName={preview.fileName} t={t} />

      <Card>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="text-lg font-semibold text-navy">{preview.title}</h2>
          <span className="whitespace-nowrap rounded-full bg-surface-quiet px-2.5 py-[5px] text-xs font-semibold text-body">
            {t.contracts.status[contract.status]}
          </span>
          <a href={`/employees/${contract.employee.id}`} className="text-[13px] font-semibold">
            {contract.employee.name}
          </a>
          <span className="num text-[13px] text-body">
            {f.dateMedium(contract.startDate)}
            {contract.endDate ? ` → ${f.dateMedium(contract.endDate)}` : ''}
          </span>
        </div>

        {preview.missing.length > 0 && (
          <p
            role="alert"
            className="m-0 rounded-2xl border border-warning-bg bg-warning-bg px-4 py-3 text-sm text-warning-ink"
          >
            {f.plain(t.contracts.preview.missing, { count: f.count(preview.missing.length) })}{' '}
            <span className="num">{preview.missing.join(', ')}</span>
          </p>
        )}

        <p className="m-0 text-xs text-muted">{t.contracts.preview.watermark}</p>
      </Card>

      <div className="flex flex-wrap gap-6">
        <Card className="min-w-0 shrink grow basis-[340px]">
          <h3 className="text-sm font-semibold text-navy">{t.contracts.preview.data}</h3>
          <dl className="m-0 flex flex-col gap-2.5">
            {preview.fields.map((field) => (
              <div key={field.field} className="flex flex-wrap items-baseline gap-x-3">
                <dt className="num min-w-[180px] text-xs text-muted">{field.field}</dt>
                <dd
                  className={`num m-0 text-[13px] ${field.value === '' ? 'text-warning-ink' : 'text-navy'}`}
                >
                  {field.value === '' ? '……………' : field.value}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="min-w-0 shrink grow basis-[420px]">
          <h3 className="text-sm font-semibold text-navy">{t.contracts.preview.clauses}</h3>

          {/* The optional clauses are chosen here and sent with the generate
              request; the mandatory ones are shown but not offered as a choice. */}
          <form action={generateContract} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={contract.id} />

            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {preview.clauses.map((clause) => (
                <li key={clause.key} className="flex flex-col gap-1">
                  {clause.mandatory ? (
                    <span className="text-[13px] font-semibold text-navy">
                      {clause.title}
                      <span className="ms-2 text-xs font-normal text-muted">
                        {t.contracts.preview.mandatory}
                      </span>
                    </span>
                  ) : (
                    <label className="flex items-center gap-2.5 text-[13px] font-semibold text-navy">
                      <input
                        type="checkbox"
                        name="clauses"
                        value={clause.key}
                        defaultChecked={clause.chosen}
                        className="size-4 accent-[var(--color-blue)]"
                      />
                      {clause.title}
                      <span className="text-xs font-normal text-muted">
                        {t.contracts.preview.optional}
                      </span>
                    </label>
                  )}
                </li>
              ))}
            </ul>

            {mayAct && (
              <button
                type="submit"
                className="h-11 w-fit rounded-xl bg-blue px-5 text-sm font-semibold text-white transition-[background-color] duration-200 ease-out hover:bg-blue-hover"
              >
                {contract.generatedAt === undefined
                  ? t.contracts.preview.generate
                  : t.contracts.preview.regenerate}
              </button>
            )}
          </form>
        </Card>
      </div>

      {!preview.mayManage && (
        <Card>
          <p className="m-0 text-sm text-body">{t.contracts.preview.notYours}</p>
        </Card>
      )}

      {mayAct && (
        <div className="flex flex-wrap gap-6">
          <Card className="min-w-0 shrink grow basis-[300px]">
            <h3 className="text-sm font-semibold text-navy">{t.contracts.preview.sign}</h3>
            <p className="m-0 text-[13px] text-body">{t.contracts.preview.signNote}</p>

            <form action={signContract} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={contract.id} />
              <input
                type="file"
                name="file"
                required
                accept="application/pdf,image/jpeg,image/png"
                aria-label={t.contracts.preview.signFile}
                className="rounded-xl border border-field-border bg-white p-2.5 text-sm text-navy file:me-3 file:rounded-lg file:border-0 file:bg-tint file:px-3 file:py-1.5 file:text-[13px] file:font-semibold file:text-blue"
              />
              <button
                type="submit"
                className="quiet-button h-11 w-fit border-button-border px-4 text-[13px] font-semibold text-navy"
              >
                {t.contracts.preview.sign}
              </button>
            </form>
          </Card>

          {fixedTerm && (
            <Card className="min-w-0 shrink grow basis-[300px]">
              <h3 className="text-sm font-semibold text-navy">{t.contracts.preview.renew}</h3>
              <p className="m-0 text-[13px] text-body">{t.contracts.preview.renewNote}</p>

              <form action={renewContract} className="flex flex-col gap-3">
                <input type="hidden" name="id" value={contract.id} />
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
                    {t.contracts.preview.renewEnd}
                  </span>
                  <input
                    type="date"
                    name="endDate"
                    required
                    className="h-11 rounded-xl border border-field-border bg-white px-3.5 text-sm text-navy"
                  />
                </label>
                <button
                  type="submit"
                  className="quiet-button h-11 w-fit border-button-border px-4 text-[13px] font-semibold text-navy"
                >
                  {t.contracts.preview.renew}
                </button>
              </form>
            </Card>
          )}

          <Card className="min-w-0 shrink grow basis-[300px]">
            <h3 className="text-sm font-semibold text-navy">{t.contracts.preview.end}</h3>
            <p className="m-0 text-[13px] text-body">{t.contracts.preview.endNote}</p>

            <form action={endContract} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={contract.id} />

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
                  {t.contracts.preview.endDate}
                </span>
                <input
                  type="date"
                  name="endDate"
                  required
                  defaultValue={contract.endDate ?? ''}
                  className="h-11 rounded-xl border border-field-border bg-white px-3.5 text-sm text-navy"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
                  {t.contracts.preview.endReason}
                </span>
                <select
                  name="reason"
                  className="h-11 rounded-xl border border-field-border bg-white px-3 text-sm text-navy"
                >
                  {(['end-of-term', 'resignation', 'dismissal', 'other'] as const).map((reason) => (
                    <option key={reason} value={reason}>
                      {t.contracts.preview.reasons[reason]}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                className="quiet-button h-11 w-fit border-button-border px-4 text-[13px] font-semibold text-navy"
              >
                {t.contracts.preview.end}
              </button>
            </form>
          </Card>
        </div>
      )}
    </AppPage>
  );
}

function Notice({
  query,
  fileName,
  t,
}: {
  query: Record<string, string | string[] | undefined>;
  fileName: string;
  t: Messages;
}): JSX.Element | null {
  const said = (text: string, tone: 'good' | 'bad' = 'good'): JSX.Element => (
    <p
      {...(tone === 'bad' ? { role: 'alert' as const } : {})}
      className={`m-0 rounded-2xl border px-4 py-3 text-sm ${
        tone === 'good'
          ? 'border-success-border bg-success-bg text-success-ink'
          : 'border-danger-border bg-danger-bg text-danger-ink'
      }`}
    >
      {text}
    </p>
  );

  if (one(query['generated']) === '1') {
    return said(t.contracts.preview.generated.replace('{file}', fileName));
  }
  if (one(query['signed']) === '1') return said(t.contracts.preview.signed);
  if (one(query['renewed']) === '1') return said(t.contracts.preview.renewed);
  if (one(query['ended']) === '1') return said(t.contracts.preview.ended);
  if (one(query['error']) !== undefined) return said(t.contracts.preview.failed, 'bad');

  return null;
}

function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <section
      className={`flex flex-col gap-4 rounded-[20px] border border-card-border bg-white p-6 ${className}`}
    >
      {children}
    </section>
  );
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
