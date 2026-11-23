import type { JSX } from 'react';
import type { Messages } from '@cpeople/shared';
import { apiGetOrNull } from '../../../lib/api';
import type { AuditDiff } from '../../../lib/employee-file';
import { formatter, type Formatter } from '../../../lib/format';
import { AppPage, appContext } from '../../_shell/app-page';

const TIME_ZONE = 'Africa/Casablanca';

interface AuditEntry {
  readonly id: string;
  readonly at: string;
  readonly actorName?: string;
  readonly actorRole?: string;
  readonly action: string;
  readonly entity: string;
  readonly entityId?: string;
  readonly summary: string;
  readonly diff: readonly AuditDiff[];
}

interface AuditPage {
  readonly entries: readonly AuditEntry[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pages: number;
}

/**
 * The company's audit log (HR-01 spec 6.11).
 *
 * Everything that has been done, newest first, with who did it and in which
 * role. The rows are the same ones a file's own history shows; this reads them
 * across the company, which is what the 13:30 part of the demo opens to show
 * that the trail is real and not a screenshot.
 *
 * Filters arrive with step 13. Sensitive values in a change are masked for a
 * reader who may not see them — by the API, before they are sent.
 */
export default async function AuditPageScreen({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  const query = await searchParams;
  const asked = Array.isArray(query['page']) ? query['page'][0] : query['page'];
  const page = Number.parseInt(asked ?? '1', 10);

  const f = formatter(context.locale, t, TIME_ZONE);
  const log = await apiGetOrNull<AuditPage>(
    `/audit?page=${Number.isFinite(page) && page > 0 ? page : 1}`,
  );

  if (log === null) {
    return (
      <AppPage
        context={context}
        current="settings"
        title={t.settings.audit.title}
        subtitle={t.settings.notYours}
      >
        <section className="rounded-[20px] border border-card-border bg-white p-6">
          <p className="m-0 text-sm text-body">{t.settings.notYours}</p>
        </section>
      </AppPage>
    );
  }

  const from = (log.page - 1) * log.pageSize + 1;
  const to = Math.min(log.page * log.pageSize, log.total);

  return (
    <AppPage
      context={context}
      current="settings"
      title={t.settings.audit.title}
      subtitle={f.plain(t.settings.audit.showing, {
        from: f.count(from),
        to: f.count(to),
        total: f.count(log.total),
      })}
    >
      <section className="flex flex-col gap-5 rounded-[20px] border border-card-border bg-white p-6">
        <p className="m-0 max-w-prose text-[13px] leading-relaxed text-body">
          {t.settings.audit.note}
        </p>

        {log.entries.length === 0 ? (
          <p className="m-0 border-t border-line py-10 text-sm text-body">
            {t.settings.audit.empty}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">{t.settings.audit.title}</caption>
              <thead>
                <tr>
                  {[
                    t.settings.audit.columns.at,
                    t.settings.audit.columns.who,
                    t.settings.audit.columns.action,
                    t.settings.audit.columns.entity,
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
                {log.entries.map((entry) => (
                  <Row key={entry.id} entry={entry} f={f} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {log.pages > 1 && (
          <nav className="flex items-center gap-3 border-t border-line pt-4">
            {log.page > 1 && (
              <a href={`/settings/audit?page=${log.page - 1}`} className="text-[13px] font-semibold">
                {t.employees.previous}
              </a>
            )}
            <span className="num text-[13px] text-body">
              {f.plain(t.employees.page, {
                page: f.count(log.page),
                pages: f.count(log.pages),
              })}
            </span>
            {log.page < log.pages && (
              <a href={`/settings/audit?page=${log.page + 1}`} className="text-[13px] font-semibold">
                {t.employees.next}
              </a>
            )}
          </nav>
        )}
      </section>
    </AppPage>
  );
}

function Row({ entry, f }: { entry: AuditEntry; f: Formatter }): JSX.Element {
  const t = f.t.settings.audit;

  return (
    <tr className="border-t border-line align-top">
      <td className="num whitespace-nowrap py-3 pe-4 text-body">{f.dateTime(entry.at)}</td>

      <td className="py-3 pe-4 text-navy">
        {entry.actorName ?? '—'}
        {entry.actorRole !== undefined && (
          <span className="block text-xs text-body">{roleName(entry.actorRole, f.t)}</span>
        )}
      </td>

      <td className="py-3 pe-4">
        <span className="font-semibold text-navy">{actionName(entry.action, f.t)}</span>
        {entry.diff.length > 0 && (
          <ul className="m-0 mt-1 flex list-none flex-col gap-0.5 p-0">
            {entry.diff.map((change) => (
              <li
                key={`${entry.id}-${change.field}`}
                className={`num text-xs ${change.masked ? 'text-muted' : 'text-body'}`}
              >
                {change.field}: {change.from === '' ? '—' : change.from} →{' '}
                {change.to === '' ? '—' : change.to}
              </li>
            ))}
          </ul>
        )}
      </td>

      <td className="py-3 pe-4 text-body">
        {entry.entity === 'employee' && entry.entityId !== undefined ? (
          <a href={`/employees/${entry.entityId}`} title={t.openFile}>
            {entry.summary}
          </a>
        ) : (
          entry.summary
        )}
      </td>
    </tr>
  );
}

/** An action, named for a reader rather than for a log file. */
function actionName(action: string, t: Messages): string {
  const named = t.settings.audit.actions as Record<string, string | undefined>;
  return named[action] ?? action;
}

function roleName(role: string, t: Messages): string {
  switch (role) {
    case 'admin':
      return t.roles['platform-admin'];
    case 'hr':
      return t.roles['hr-admin'];
    case 'manager':
      return t.roles.manager;
    default:
      return t.roles.employee;
  }
}
