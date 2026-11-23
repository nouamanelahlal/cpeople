import type { JSX } from 'react';
import { can, type Role } from '@cpeople/shared';
import { apiGetOrNull } from '../../lib/api';
import { AppPage, appContext } from '../_shell/app-page';

/** What `GET /api/me` says about the person reading. */
interface Me {
  readonly role: Role;
}

/**
 * Settings (HR-01 spec 6.5, 6.10, 6.11, 6.14).
 *
 * A way in to each part rather than a screen of its own. The parts that are not
 * built yet are listed and say when they arrive, because a demo that hides half
 * its menu is harder to follow than one that admits what is coming.
 */
export default async function SettingsPage(): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  const me = await apiGetOrNull<Me>('/me');
  const role = me?.role ?? 'employee';

  const sections = [
    {
      href: '/settings/roles',
      title: t.settings.sections.roles,
      note: t.settings.sections.rolesNote,
      ready: true,
    },
    {
      href: '/settings/audit',
      title: t.settings.sections.audit,
      note: t.settings.sections.auditNote,
      ready: can(role, 'audit.read'),
    },
    {
      href: '/settings/organisation',
      title: t.settings.sections.organisation,
      note: t.settings.sections.organisationNote,
      ready: true,
    },
    {
      href: '/settings/data',
      title: t.settings.sections.data,
      note: t.settings.sections.dataNote,
      ready: false,
    },
    {
      href: '/settings/demo',
      title: t.settings.sections.demo,
      note: t.settings.sections.demoNote,
      ready: false,
    },
  ];

  if (!can(role, 'settings.view')) {
    return (
      <AppPage context={context} current="settings" title={t.settings.title} subtitle={t.settings.notYours}>
        <section className="rounded-[20px] border border-card-border bg-white p-6">
          <p className="m-0 text-sm text-body">{t.settings.notYours}</p>
        </section>
      </AppPage>
    );
  }

  return (
    <AppPage
      context={context}
      current="settings"
      title={t.settings.title}
      subtitle={t.settings.subtitle}
    >
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5 p-0">
        {sections.map((section) => (
          <li key={section.href}>
            {section.ready ? (
              <a
                href={section.href}
                className="flex h-full flex-col gap-2 rounded-[20px] border border-card-border bg-white p-6 no-underline transition-[box-shadow,transform] duration-200 ease-out hover:shadow-[0_10px_26px_rgba(15,25,55,0.08)] motion-safe:hover:-translate-y-0.5"
              >
                <span className="text-base font-semibold text-navy">{section.title}</span>
                <span className="text-[13px] text-body">{section.note}</span>
              </a>
            ) : (
              <div className="flex h-full flex-col gap-2 rounded-[20px] border border-card-border bg-surface-quiet p-6">
                <span className="text-base font-semibold text-navy">{section.title}</span>
                <span className="text-[13px] text-body">{section.note}</span>
                <span className="mt-1 w-fit rounded-full bg-white px-2.5 py-[5px] text-xs font-semibold text-body">
                  {t.settings.later}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </AppPage>
  );
}
