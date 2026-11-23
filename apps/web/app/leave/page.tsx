import type { JSX, ReactNode } from 'react';
import { apiGetOrNull } from '../../lib/api';
import { formatter, type Formatter } from '../../lib/format';
import {
  LEAVE_TABS,
  leaveHref,
  leaveTypeName,
  readLeaveTab,
  warningText,
  type LeaveList,
  type LeaveRequest,
  type LeaveReviewItem,
  type LeaveTab,
} from '../../lib/leave';
import { AppPage, appContext } from '../_shell/app-page';
import { acceptLeaveChange } from './actions';

const TIME_ZONE = 'Africa/Casablanca';

/**
 * Leave (M09 / HR-04).
 *
 * One screen with four tabs, and which of them a reader sees is decided by the
 * API rather than by this file: it answers with the tabs the token entitles
 * them to, and asking for another one by hand gets them the first they may have.
 *
 * Each tab has its own address, so that a link in an e-mail — or the "Leave
 * requests" figure on the home screen — can open the one that is meant.
 */
export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  const query = await searchParams;
  const asked = readLeaveTab(query['tab']);

  const f = formatter(context.locale, t, TIME_ZONE);
  const list = await apiGetOrNull<LeaveList>(`/leave/requests?view=${asked}`);

  if (list === null) {
    return (
      <AppPage context={context} current="leave" title={t.leave.title} subtitle={t.leave.subtitle}>
        <Card>
          <p className="m-0 text-sm text-body">{t.leave.errors.unavailable}</p>
        </Card>
      </AppPage>
    );
  }

  const tab: LeaveTab = (list.tabs as readonly LeaveTab[]).includes(asked)
    ? asked
    : ((list.tabs[0] as LeaveTab) ?? 'mine');

  // The review list is its own call, so the three ordinary tabs stay cheap.
  const review =
    tab === 'review' ? ((await apiGetOrNull<LeaveReviewItem[]>('/leave/review')) ?? []) : [];

  return (
    <AppPage
      context={context}
      current="leave"
      title={t.leave.title}
      subtitle={t.leave.subtitle}
    >
      {one(query['done']) === '1' && (
        <p className="m-0 rounded-2xl border border-success-border bg-success-bg px-4 py-3 text-sm text-success-ink">
          {t.leave.approvals.decided}
        </p>
      )}

      <Card>
        <nav aria-label={t.leave.title} className="-mb-1 flex flex-wrap gap-1">
          {LEAVE_TABS.filter((name) => list.tabs.includes(name)).map((name) => (
            <a
              key={name}
              href={leaveHref(name)}
              aria-current={name === tab ? 'page' : undefined}
              className={`rounded-t-xl border-b-2 px-3.5 py-2.5 text-[13px] font-semibold no-underline transition-colors duration-200 ease-out ${
                name === tab
                  ? 'border-blue text-navy'
                  : 'border-transparent text-body hover:bg-surface-quiet'
              }`}
            >
              {t.leave.tabs[name]}
              {(list.counts[name] ?? 0) > 0 && name !== 'all' && (
                <span className="num ms-2 rounded-full bg-cyan px-2 py-[2px] text-xs font-semibold text-navy">
                  {list.counts[name]}
                </span>
              )}
            </a>
          ))}
        </nav>

        {tab === 'review' ? (
          <Review items={review} f={f} />
        ) : (
          <Requests tab={tab} list={list} f={f} mayRequest={list.mayRequest} />
        )}
      </Card>
    </AppPage>
  );
}

function Requests({
  tab,
  list,
  f,
  mayRequest,
}: {
  tab: LeaveTab;
  list: LeaveList;
  f: Formatter;
  mayRequest: boolean;
}): JSX.Element {
  const t = f.t.leave;
  const section = tab === 'approvals' ? t.approvals : tab === 'all' ? t.all : t.mine;
  const showWho = tab !== 'mine';

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-navy">{section.title}</h2>
          <p className="m-0 max-w-prose text-[13px] text-body">{section.note}</p>
        </div>

        {tab === 'mine' && mayRequest && (
          <a
            href="/leave/new"
            className="h-11 rounded-xl bg-blue px-5 text-sm font-semibold leading-[44px] text-white no-underline transition-[background-color] duration-200 ease-out hover:bg-blue-hover"
          >
            {t.mine.ask}
          </a>
        )}
      </div>

      {list.requests.length === 0 ? (
        <p className="m-0 py-6 text-sm text-body">{section.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {[
                  ...(showWho ? [t.columns.who] : []),
                  t.columns.type,
                  t.columns.dates,
                  t.columns.days,
                  t.columns.status,
                  t.columns.actions,
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
              {list.requests.map((request) => (
                <tr key={request.id} className="border-t border-line align-top">
                  {showWho && (
                    <th scope="row" className="py-3 pe-4 text-start font-semibold text-navy">
                      {request.employee.name}
                      <span className="block text-xs font-normal text-muted">
                        {request.employee.department}
                      </span>
                    </th>
                  )}

                  <td className="py-3 pe-4 text-body">
                    {leaveTypeName(request.leaveType, f.t)}
                  </td>

                  <td className="num whitespace-nowrap py-3 pe-4 text-navy">
                    {span(request, f)}
                  </td>

                  <td className="num py-3 pe-4 text-navy">{f.count(request.dayCount)}</td>

                  <td className="py-3 pe-4">
                    <Status request={request} f={f} />
                    {request.warnings.map((warning, index) => (
                      <span
                        key={index}
                        className="mt-1.5 block max-w-[32ch] text-xs text-warning-ink"
                      >
                        {warningText(warning, f.t)}
                      </span>
                    ))}
                  </td>

                  <td className="py-3 text-end">
                    <a
                      href={`/leave/${request.id}`}
                      className="quiet-button h-9 border-button-border px-3 text-xs font-semibold text-navy"
                    >
                      {f.t.leave.open}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * The requests a settings change has moved (HR-02 spec, point 2).
 *
 * Both numbers are shown, always: what was agreed and what the settings in force
 * work out as. A screen that showed only the new one would be asking HR to
 * approve something they cannot see.
 */
function Review({ items, f }: { items: readonly LeaveReviewItem[]; f: Formatter }): JSX.Element {
  const t = f.t.leave.review;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-navy">{t.title}</h2>
        <p className="m-0 max-w-prose text-[13px] text-body">{t.note}</p>
      </div>

      {items.length === 0 ? (
        <p className="m-0 py-6 text-sm text-body">{t.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {[
                  f.t.leave.columns.who,
                  f.t.leave.columns.dates,
                  t.was,
                  t.now,
                  t.why,
                  f.t.leave.columns.actions,
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
              {items.map((item) => (
                <tr key={item.request.id} className="border-t border-line align-top">
                  <th scope="row" className="py-3 pe-4 text-start font-semibold text-navy">
                    {item.request.employee.name}
                    <span className="block text-xs font-normal text-muted">
                      {leaveTypeName(item.request.leaveType, f.t)}
                    </span>
                  </th>

                  <td className="num whitespace-nowrap py-3 pe-4 text-body">
                    {span(item.request, f)}
                  </td>

                  <td className="num py-3 pe-4 text-muted line-through">{f.count(item.agreed)}</td>
                  <td className="num py-3 pe-4 font-semibold text-navy">{f.count(item.now)}</td>

                  <td className="py-3 pe-4 text-body">
                    {t.reasons[item.because]}
                    <span className="mt-1 block text-xs text-muted">
                      {item.pending ? t.pendingNote : t.approvedNote}
                    </span>
                  </td>

                  <td className="py-3 text-end">
                    {item.pending ? (
                      <a
                        href={`/leave/${item.request.id}`}
                        className="quiet-button h-9 border-button-border px-3 text-xs font-semibold text-navy"
                      >
                        {f.t.leave.open}
                      </a>
                    ) : (
                      <form action={acceptLeaveChange}>
                        <input type="hidden" name="id" value={item.request.id} />
                        <button
                          type="submit"
                          className="h-9 rounded-xl bg-blue px-3.5 text-xs font-semibold text-white transition-[background-color] duration-200 ease-out hover:bg-blue-hover"
                        >
                          {t.accept}
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
    </section>
  );
}

export function Status({ request, f }: { request: LeaveRequest; f: Formatter }): JSX.Element {
  const words = request.mine ? f.t.leave.status : f.t.leave.statusOther;
  const tone = STATUS_TONE[request.status];

  return (
    <span className="flex flex-col gap-1">
      <span
        className={`w-fit whitespace-nowrap rounded-full px-2.5 py-[5px] text-xs font-semibold ${tone}`}
      >
        {words[request.status]}
      </span>
      {request.waitingOn && (
        <span className="text-xs text-muted">
          {f.plain(f.t.leave.with, { name: request.waitingOn.name })}
        </span>
      )}
    </span>
  );
}

const STATUS_TONE: Record<LeaveRequest['status'], string> = {
  pending_n1: 'bg-warning-bg text-warning-ink',
  pending_n2: 'bg-warning-bg text-warning-ink',
  pending_hr: 'bg-warning-bg text-warning-ink',
  approved: 'bg-ok-bg text-ok-ink',
  rejected: 'bg-danger-bg text-danger-ink',
  withdrawn: 'bg-surface-quiet text-muted',
  cancellation_pending: 'bg-warning-bg text-warning-ink',
  cancelled: 'bg-surface-quiet text-muted',
};

/** The dates of a request, with the half-days in words where there are any. */
export function span(request: LeaveRequest, f: Formatter): string {
  const t = f.t.leave;
  const parts = t.parts;

  if (request.from === request.to) {
    return request.fromPart === 'full'
      ? f.plain(t.span.same, { date: f.dateMedium(request.from) })
      : f.plain(t.span.sameHalf, {
          date: f.dateMedium(request.from),
          part: parts[request.fromPart].toLowerCase(),
        });
  }

  if (request.fromPart === 'full' && request.toPart === 'full') {
    return f.plain(t.span.range, {
      from: f.dateMedium(request.from),
      to: f.dateMedium(request.to),
    });
  }

  return f.plain(t.span.rangeParts, {
    from: f.dateMedium(request.from),
    fromPart: parts[request.fromPart].toLowerCase(),
    to: f.dateMedium(request.to),
    toPart: parts[request.toPart].toLowerCase(),
  });
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
