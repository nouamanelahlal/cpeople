import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { JSX, ReactNode } from 'react';
import { getMessages, toLocale, type Locale, type Messages } from '@cpeople/shared';
import { getSession } from '../../lib/auth';
import { fill } from '../../lib/format';
import type { IconName } from '../../lib/home-data';
import { LOCALE_COOKIE } from '../../lib/locale';
import type { Session } from '../../lib/session';
import { WELCOME_COOKIE } from '../../lib/welcome';
import { AppShell, type NavGroup, type ShellLabels } from './app-shell';
import { TimeZoneSync } from './time-zone-sync';
import { WelcomeOverlay } from './welcome-overlay';

/**
 * Every signed-in page, inside the same shell (HR-01 / M02).
 *
 * It settles who is reading — their session, their language — builds the menu with
 * the current page marked, and puts the page inside the frame the welcome animation
 * settles. A page only has to say which menu item it is and what its heading says.
 */

/** Where each menu item goes. One list, so the menu and the routes cannot drift. */
export const NAV_HREF = {
  home: '/home',
  employees: '/employees',
  onboarding: '/onboarding',
  contracts: '/contracts',
  orgChart: '/org',
  attendance: '/attendance',
  leave: '/leave',
  payroll: '/payroll',
  payslips: '/payslips',
  expenses: '/expenses',
  declarations: '/declarations',
  sapPosting: '/sap-posting',
  settings: '/settings',
} as const;

export type NavKey = keyof typeof NAV_HREF;

export interface AppPageContext {
  readonly session: Session;
  readonly locale: Locale;
  readonly t: Messages;
}

/**
 * The session and language every signed-in page starts from.
 *
 * The gate in proxy.ts already turned anonymous visitors away; this is the page's
 * own guard, so no page can be reached unauthenticated if that matcher ever changes.
 */
export async function appContext(): Promise<AppPageContext> {
  const session = await getSession();
  if (!session) {
    redirect('/api/auth/sign-in');
  }

  const store = await cookies();
  // The language the person chose, with the one from their token as the start of it
  // (the sign-in callback writes that into the same cookie).
  const locale = toLocale(store.get(LOCALE_COOKIE)?.value ?? session.locale);

  return { session, locale, t: getMessages(locale) };
}

export async function AppPage({
  current,
  title,
  subtitle,
  context,
  children,
}: {
  current: NavKey;
  title: string;
  subtitle: string;
  context: AppPageContext;
  children: ReactNode;
}): Promise<JSX.Element> {
  const { session, locale, t } = context;
  const store = await cookies();

  // Set by the sign-in callback and by nothing else, so the animation plays on the
  // way in from Keycloak and never on a refresh, a token refresh or a return later.
  const justSignedIn = store.get(WELCOME_COOKIE)?.value === '1';
  const name = session.name.trim();

  return (
    <>
      <WelcomeOverlay play={justSignedIn} label={t.welcome.announce} skip={t.welcome.skip} />
      {/* Without scripting there is nothing to take the overlay away or to unlock
          the page, so neither happens in the first place. */}
      {justSignedIn && (
        <noscript>
          <style>{`.cp-welcome{display:none}html[data-welcome],html[data-welcome] body{overflow:auto}html[data-welcome] .cp-settle{overflow:visible;max-block-size:none}html[data-welcome] .cp-app{transform:none}`}</style>
        </noscript>
      )}

      {/* The frame the dashboard settles inside while the animation plays: it clips
          what the scale pushes past the window. */}
      <div className="cp-settle">
        <AppShell
          nav={navigation(t, current)}
          labels={shellLabels(t, locale, session)}
          user={{ name, initials: initials(name), role: roleLabel(t, session.roles) }}
          tenant={{
            name: 'Demo Company',
            note: fill(t.shell.tenantNote, { city: 'Rabat', country: 'Morocco' }),
            initials: 'DC',
          }}
          locale={locale}
          title={title}
          subtitle={subtitle}
        >
          <TimeZoneSync assumed="Africa/Casablanca" />
          {children}
        </AppShell>
      </div>
    </>
  );
}

/**
 * The menu.
 *
 * The counts beside Leave and Expenses were on the sample home screen; they belong
 * to the modules that are not built yet, so they are not shown until they can be
 * counted (HR-02, HR-03).
 */
function navigation(t: Messages, current: NavKey): NavGroup[] {
  const nav = t.shell.nav;
  const item = (key: NavKey, icon: IconName) => ({
    key,
    label: nav[key],
    icon,
    href: NAV_HREF[key],
    aria: nav[key],
    current: key === current,
  });

  return [
    { key: 'start', items: [item('home', 'home')] },
    {
      key: 'people',
      title: t.shell.groups.people,
      items: [
        item('employees', 'users'),
        item('onboarding', 'onboard'),
        item('contracts', 'contract'),
        item('orgChart', 'org'),
      ],
    },
    {
      key: 'time',
      title: t.shell.groups.time,
      items: [item('attendance', 'clock'), item('leave', 'calendar')],
    },
    {
      key: 'pay',
      title: t.shell.groups.pay,
      items: [
        item('payroll', 'pay'),
        item('payslips', 'payslip'),
        item('expenses', 'expense'),
        item('declarations', 'declaration'),
      ],
    },
    {
      key: 'company',
      title: t.shell.groups.company,
      items: [item('sapPosting', 'sap'), item('settings', 'settings')],
    },
  ];
}

function shellLabels(t: Messages, locale: Locale, session: Session): ShellLabels {
  const other = locale === 'en' ? t.common.french : t.common.english;

  return {
    home: t.shell.home,
    mainNav: t.shell.mainNav,
    openMenu: t.shell.openMenu,
    closeMenu: t.shell.closeMenu,
    pin: t.shell.pin,
    unpin: t.shell.unpin,
    search: t.shell.search,
    searchPlaceholder: t.shell.searchPlaceholder,
    language: fill(t.shell.languageLabel, { language: other }),
    otherLanguage: other,
    notifications: fill(t.shell.notifications, { count: '0' }),
    account: fill(t.shell.account, { name: session.name }),
    signOut: t.shell.signOut,
  };
}

/**
 * What to call this person's job.
 *
 * Keycloak hands over every role they hold, including the realm's own plumbing;
 * what belongs on screen is the one that says what they do here, and the most
 * senior of those when they hold several.
 */
export function roleLabel(t: Messages, roles: readonly string[]): string {
  const known = ['platform-admin', 'hr-admin', 'payroll-manager', 'manager', 'employee'] as const;
  const held = known.find((role) => roles.includes(role));
  return held === undefined ? '' : t.roles[held];
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
