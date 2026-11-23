import type { JSX, ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { apiGetOrNull } from '../../../lib/api';
import { formatter, type Formatter } from '../../../lib/format';
import {
  leaveTypeName,
  readRefusal,
  refusalText,
  warningText,
  type LeaveCalculation,
  type LeaveRequestDetail,
} from '../../../lib/leave';
import { AppPage, appContext } from '../../_shell/app-page';
import { askToCancelLeave, decideLeave, withdrawLeave } from '../actions';
import { Status, span } from '../page';

const TIME_ZONE = 'Africa/Casablanca';

/**
 * One leave request (M09 / HR-04).
 *
 * The page that has to be able to answer "why is it 4.5 days?" a year later. It
 * shows what was agreed, every count that has ever been made of it with the
 * rule, the working week and the holidays behind each one, and everything
 * anybody has done to it.
 *
 * The buttons are drawn from what the API says this reader may do, not from
 * their role as this file guesses it — and the API checks again when one is
 * pressed.
 */
export default async function LeaveRequestPage({
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

  const request = await apiGetOrNull<LeaveRequestDetail>(`/leave/requests/${id}`);
  if (request === null) notFound();

  const f = formatter(context.locale, t, TIME_ZONE);
  const refused = readRefusal(query['error']);

  return (
    <AppPage
      context={context}
      current="leave"
      title={leaveTypeName(request.leaveType, t)}
      subtitle={span(request, f)}
    >
      {one(query['sent']) === '1' && (
        <p className="m-0 rounded-2xl border border-success-border bg-success-bg px-4 py-3 text-sm text-success-ink">
          {request.waitingOn
            ? f.plain(t.leave.form.sent, { name: request.waitingOn.name })
            : t.leave.form.sentHr}
        </p>
      )}

      {refused && (
        <p
          role="alert"
          className="m-0 rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-ink"
        >
          {refusalText(refused, t, f.dateMedium)}
        </p>
      )}

      {request.recalculatedAt && request.recalculatedFrom !== undefined && (
        <p className="m-0 rounded-2xl border border-warning-bg bg-warning-bg px-4 py-3 text-sm text-warning-ink">
          {f.plain(t.leave.notice.recalculated, {
            date: f.dateMedium(request.recalculatedAt.slice(0, 10)),
            from: f.count(request.recalculatedFrom),
            to: f.count(request.dayCount),
          })}
        </p>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-5">
        <Card>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
            <Term label={t.leave.columns.who}>{request.employee.name}</Term>
            <Term label={t.leave.columns.type}>{leaveTypeName(request.leaveType, t)}</Term>
            <Term label={t.leave.columns.dates}>{span(request, f)}</Term>
            <Term label={t.leave.columns.days}>
              <span className="num font-semibold text-navy">{f.count(request.dayCount)}</span>
            </Term>
            <Term label={t.leave.columns.status}>
              <Status request={request} f={f} />
            </Term>
            <Term label={t.leave.columns.asked}>
              {f.dateMedium(request.submittedAt.slice(0, 10))}
            </Term>
            {request.reason && <Term label={t.leave.form.reason}>{request.reason}</Term>}
          </dl>

          {request.warnings.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="m-0 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
                {t.leave.warnings.title}
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {request.warnings.map((warning, index) => (
                  <li
                    key={index}
                    className="rounded-xl border border-warning-bg bg-warning-bg px-3.5 py-2.5 text-[13px] text-warning-ink"
                  >
                    {warningText(warning, t)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Actions request={request} f={f} />
        </Card>

        <Card>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-navy">{t.leave.detail.history}</h2>
          </div>

          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {request.decisions.map((decision) => (
              <li key={decision.id} className="flex flex-col gap-0.5 border-s-2 border-line ps-3.5">
                <span className="text-sm font-semibold text-navy">
                  {kind(decision.kind, f)}
                </span>
                <span className="text-xs text-muted">
                  {decision.byName} · {f.dateTime(decision.at)}
                </span>
                {decision.reason && (
                  <span className="text-[13px] text-body">{decision.reason}</span>
                )}
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-navy">{t.leave.detail.calculations}</h2>
          <p className="m-0 max-w-prose text-[13px] text-body">
            {t.leave.detail.calculationNote}
          </p>
        </div>

        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {request.calculations.map((calculation) => (
            <Calculation key={calculation.id} calculation={calculation} request={request} f={f} />
          ))}
        </ul>
      </Card>

      <a href="/leave" className="text-sm font-semibold text-blue">
        {t.leave.detail.back}
      </a>
    </AppPage>
  );
}

/**
 * One count, with its evidence.
 *
 * The holidays that took a day off it are named rather than counted, because
 * "11 November is a public holiday" is checkable and "one holiday" is not.
 */
function Calculation({
  calculation,
  request,
  f,
}: {
  calculation: LeaveCalculation;
  request: LeaveRequestDetail;
  f: Formatter;
}): JSX.Element {
  const t = f.t.leave.detail;
  const used = request.holidays.filter((holiday) => calculation.holidayIds.includes(holiday.id));

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-card-border bg-surface-quiet px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-navy">
          {t.calculationKinds[calculation.kind]}
        </span>
        <span className="num text-sm font-semibold text-navy">
          {f.count(calculation.dayCount)}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-body">
        <span>{f.t.leaveSettings.types.basis[calculation.dayBasis]}</span>
        <span className="num">
          {calculation.workingDays
            .map((day) => f.t.leaveSettings.week.short[String(day) as '0'])
            .join(' · ')}
        </span>
        <span>{f.dateTime(calculation.at)}</span>
        {!calculation.holidaysComplete && (
          <span className="text-warning-ink">{f.t.leaveSettings.toConfirm}</span>
        )}
      </div>

      <p className="m-0 text-xs text-muted">
        {used.length === 0
          ? t.noHolidays
          : `${f.plain(t.holidaysApplied, { count: String(used.length) })}: ${used
              .map((holiday) => `${f.dateMedium(holiday.date)} ${holiday.name}`)
              .join(' · ')}`}
      </p>

      {calculation.note && <p className="m-0 text-xs text-muted">{calculation.note}</p>}
    </li>
  );
}

/** What this reader may do about it, as the API says. */
function Actions({ request, f }: { request: LeaveRequestDetail; f: Formatter }): JSX.Element | null {
  const t = f.t.leave;
  const cancelling = request.status === 'cancellation_pending';

  if (!request.mayDecide && !request.mayWithdraw) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 border-t border-line pt-4">
      {request.mayDecide && (
        <form action={decideLeave} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={request.id} />
          <input type="hidden" name="back" value={request.mine ? 'mine' : 'approvals'} />

          {request.wouldOverride && (
            <p className="m-0 rounded-xl border border-warning-bg bg-warning-bg px-3.5 py-2.5 text-[13px] text-warning-ink">
              {t.all.overrideNote}
            </p>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
              {request.wouldOverride ? t.all.overrideReason : t.approvals.reason}
            </span>
            <input
              type="text"
              name="reason"
              maxLength={240}
              required={request.wouldOverride}
              className="h-11 rounded-xl border border-field-border bg-white px-3.5 text-sm text-navy"
            />
            <span className="text-xs text-body">{t.approvals.reasonNote}</span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              name="decision"
              value="approve"
              className="h-11 rounded-xl bg-blue px-5 text-sm font-semibold text-white transition-[background-color] duration-200 ease-out hover:bg-blue-hover"
            >
              {cancelling ? t.approvals.approveCancellation : t.approvals.approve}
            </button>
            <button
              type="submit"
              name="decision"
              value="reject"
              className="quiet-button h-11 border-button-border px-4 text-[13px] font-semibold text-navy"
            >
              {cancelling ? t.approvals.rejectCancellation : t.approvals.reject}
            </button>
          </div>
        </form>
      )}

      {request.mayWithdraw && (
        <form action={request.status === 'approved' ? askToCancelLeave : withdrawLeave}>
          <input type="hidden" name="id" value={request.id} />
          <button
            type="submit"
            className="quiet-button h-11 border-button-border px-4 text-[13px] font-semibold text-navy"
          >
            {request.status === 'approved' ? t.detail.askCancellation : t.detail.withdraw}
          </button>
          {request.status === 'approved' && (
            <span className="ms-3 text-xs text-body">{t.detail.cancellationNote}</span>
          )}
        </form>
      )}
    </div>
  );
}

function kind(value: string, f: Formatter): string {
  const kinds = f.t.leave.detail.kinds as Record<string, string | undefined>;
  return kinds[value] ?? value;
}

function Term({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <>
      <dt className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.04em] text-muted">
        {label}
      </dt>
      <dd className="m-0 text-navy">{children}</dd>
    </>
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
