import type { JSX } from 'react';
import { can, ROLES, type Messages, type Role } from '@cpeople/shared';
import { apiGetOrNull } from '../../../lib/api';
import { AppPage, appContext } from '../../_shell/app-page';

interface Me {
  readonly role: Role;
}

/** How one row of the matrix is answered for one role. */
type Answer = 'all' | 'team' | 'own' | 'yes' | 'no' | 'masked' | 'view';

/**
 * Who may see and do what (HR-01 spec 5).
 *
 * Read-only, and drawn from the table the API actually enforces rather than from
 * a picture of it: every cell is `can()` being asked the same question the server
 * asks on every request. A screen that described the intention instead would be
 * the one thing in a workshop about access that nobody could trust.
 *
 * The banner says what it is: a proposal for SMG to confirm, not a decision.
 */
export default async function RolesPage(): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  const me = await apiGetOrNull<Me>('/me');
  const role = me?.role ?? 'employee';

  if (!can(role, 'settings.view')) {
    return (
      <AppPage
        context={context}
        current="settings"
        title={t.settings.roles.title}
        subtitle={t.settings.notYours}
      >
        <section className="rounded-[20px] border border-card-border bg-white p-6">
          <p className="m-0 text-sm text-body">{t.settings.notYours}</p>
        </section>
      </AppPage>
    );
  }

  const rows = matrix(t);

  return (
    <AppPage
      context={context}
      current="settings"
      title={t.settings.roles.title}
      subtitle={t.settings.sections.rolesNote}
    >
      <section className="flex flex-col gap-5 rounded-[20px] border border-card-border bg-white p-6">
        <div className="flex flex-col gap-2">
          <span className="w-fit rounded-full bg-warning-bg px-3 py-1.5 text-xs font-semibold text-warning-ink">
            {t.settings.roles.proposed}
          </span>
          <p className="m-0 max-w-prose text-[13px] leading-relaxed text-body">
            {t.settings.roles.proposedNote}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">{t.settings.roles.title}</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="border-b border-line pb-2.5 pe-4 text-start text-xs font-semibold uppercase tracking-[0.04em] text-muted"
                >
                  {t.settings.roles.capability}
                </th>
                {ROLES.map((name) => (
                  <th
                    key={name}
                    scope="col"
                    className="whitespace-nowrap border-b border-line pb-2.5 pe-4 text-start text-xs font-semibold uppercase tracking-[0.04em] text-muted"
                  >
                    {roleName(name, t)}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-line">
                  <th scope="row" className="py-3 pe-4 text-start font-normal text-navy">
                    {row.label}
                    {row.note !== undefined && (
                      <span className="mt-1 block max-w-prose text-xs text-body">{row.note}</span>
                    )}
                  </th>

                  {ROLES.map((name) => {
                    const answer = row.answer(name);

                    return (
                      <td key={name} className="whitespace-nowrap py-3 pe-4">
                        <span
                          className={`rounded-full px-2.5 py-[5px] text-xs font-semibold ${tone(answer)}`}
                        >
                          {t.settings.roles.values[answer]}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppPage>
  );
}

/**
 * The matrix, as questions rather than as a drawing.
 *
 * Each row asks `can()` what it would answer for that role, so this screen and
 * the API can never disagree: if a grant changes, the table changes with it.
 */
function matrix(t: Messages): { label: string; note?: string; answer: (role: Role) => Answer }[] {
  const rows = t.settings.roles.rows;

  return [
    {
      label: rows.list,
      answer: (role) =>
        can(role, 'employee.list.all')
          ? 'all'
          : can(role, 'employee.list.team')
            ? 'team'
            : can(role, 'employee.read.own')
              ? 'own'
              : 'no',
    },
    {
      label: rows.file,
      answer: (role) =>
        can(role, 'employee.list.all')
          ? 'all'
          : can(role, 'employee.list.team')
            ? 'team'
            : can(role, 'employee.read.own')
              ? 'own'
              : 'no',
    },
    {
      label: rows.sensitive,
      note: t.settings.roles.sensitiveNote,
      answer: (role) => (can(role, 'employee.sensitive.read') ? 'all' : 'masked'),
    },
    { label: rows.create, answer: (role) => yesNo(role, 'employee.create') },
    { label: rows.edit, answer: (role) => yesNo(role, 'employee.edit') },
    { label: rows.editOwn, answer: (role) => yesNo(role, 'employee.edit.own.contact') },
    { label: rows.contract, answer: (role) => yesNo(role, 'contract.manage') },
    { label: rows.documents, answer: (role) => yesNo(role, 'document.upload') },
    {
      label: rows.onboarding,
      answer: (role) =>
        can(role, 'onboarding.manage.all')
          ? 'all'
          : can(role, 'onboarding.manage.team')
            ? 'team'
            : 'no',
    },
    { label: rows.leaveAsk, answer: (role) => yesNo(role, 'leave.request.own') },
    {
      label: rows.leaveApprove,
      answer: (role) =>
        can(role, 'leave.manage.all') ? 'all' : can(role, 'leave.approve') ? 'team' : 'no',
    },
    { label: rows.leaveAll, answer: (role) => yesNo(role, 'leave.manage.all') },
    {
      label: rows.leaveBalances,
      answer: (role) =>
        can(role, 'employee.list.all')
          ? 'all'
          : can(role, 'employee.list.team')
            ? 'team'
            : can(role, 'leave.request.own')
              ? 'own'
              : 'no',
    },
    {
      label: rows.organisation,
      answer: (role) =>
        can(role, 'organisation.manage') ? 'yes' : can(role, 'organisation.view') ? 'view' : 'no',
    },
    { label: rows.templates, answer: (role) => yesNo(role, 'settings.templates.manage') },
    { label: rows.selfService, answer: (role) => yesNo(role, 'settings.company.manage') },
    {
      label: rows.data,
      answer: (role) =>
        can(role, 'data.import') ? 'yes' : can(role, 'data.export') ? 'view' : 'no',
    },
    { label: rows.audit, answer: (role) => yesNo(role, 'audit.read') },
    { label: rows.demo, answer: (role) => yesNo(role, 'demo.manage') },
  ];
}

function yesNo(role: Role, capability: Parameters<typeof can>[1]): Answer {
  return can(role, capability) ? 'yes' : 'no';
}

function roleName(role: Role, t: Messages): string {
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

/** Yes is quiet, no is quieter, and anything partial is worth a second look. */
function tone(answer: Answer): string {
  switch (answer) {
    case 'no':
      return 'bg-surface-quiet text-muted';
    case 'masked':
    case 'team':
    case 'own':
    case 'view':
      return 'bg-amber-bg text-amber-ink';
    default:
      return 'bg-ok-bg text-ok-ink';
  }
}
