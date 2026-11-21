import { cookies } from 'next/headers';
import type { JSX } from 'react';
import {
  CURRENCY,
  getMessages,
  intlLocale,
  toLocale,
  type Locale,
  type Messages,
} from '@cpeople/shared';
import { getSession } from '../../lib/auth';
import { costChart } from '../../lib/chart';
import { greetingKey, isoDateIn, viewerClock } from '../../lib/clock';
import { fill, formatter } from '../../lib/format';
import { homeData, type IconName } from '../../lib/home-data';
import { LOCALE_COOKIE } from '../../lib/locale';
import type { Session } from '../../lib/session';
import { AppShell, type NavGroup, type ShellLabels } from './_components/app-shell';
import { Away } from './_components/away';
import { Connections } from './_components/connections';
import { CostChart, type CostChartMonth } from './_components/cost-chart';
import { Departments } from './_components/departments';
import { KpiCards } from './_components/kpi-cards';
import { PayrollPanel } from './_components/payroll-panel';
import { Tasks } from './_components/tasks';
import { TimeZoneSync } from './_components/time-zone-sync';

/**
 * The home screen: the payroll month, the day's figures, and what is waiting
 * (NEW / M23, drawn as docs/design/home-dashboard.dc.html).
 *
 * Everything on it is sample data from lib/home-data.ts, shaped like the API that
 * will replace it. What is real is the person: their name, their role and their
 * language come from the token Keycloak issued.
 */
export default async function HomePage(): Promise<JSX.Element | null> {
  // The gate in proxy.ts already turned anonymous visitors away; this is the page's
  // own guard, so it cannot be reached unauthenticated if the matcher ever changes.
  const session = await getSession();
  if (!session) {
    return null;
  }

  const store = await cookies();
  // The language the person chose, with the one from their token as the start of it
  // (the sign-in callback writes that into the same cookie).
  const locale = toLocale(store.get(LOCALE_COOKIE)?.value ?? session.locale);
  const t = getMessages(locale);

  const data = homeData();
  const clock = await viewerClock(data.tenant.timeZone);
  const f = formatter(locale, t, data.tenant.timeZone);

  const name = session.name.trim();
  const greeting = f.plain(t.home.greeting[greetingKey(clock)], { name: firstName(name) });
  const subtitle = f.plain(t.home.today, {
    // Today where the reader is, not where the payroll is.
    date: new Intl.DateTimeFormat(intlLocale(locale), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: clock.timeZone,
    }).format(clock.now),
    status: f.plain(t.home.runStatus[data.run.status], { month: f.monthName(data.run.month) }),
  });

  const chart = costChart(data.cost);
  const months: CostChartMonth[] = chart.points.map((point) => ({
    ...point,
    label: f.monthName(data.cost[point.index]!.iso).slice(0, 3),
    title: f.monthYear(data.cost[point.index]!.iso),
    gross: f.moneyThousands(data.cost[point.index]!.grossMinor),
    charges: f.moneyThousands(data.cost[point.index]!.chargesMinor),
    pick: f.plain(t.home.cost.month, { month: f.monthYear(data.cost[point.index]!.iso) }),
  }));

  const first = data.cost[0]!;
  const last = data.cost[data.cost.length - 1]!;
  const gross = data.cost.map((month) => month.grossMinor);
  const charges = data.cost.map((month) => month.chargesMinor);

  return (
    <AppShell
      nav={navigation(t, data.badges)}
      labels={shellLabels(t, locale, session, data.notifications)}
      user={{ name, initials: initials(name), role: roleLabel(t, session.roles) }}
      tenant={{
        name: data.tenant.name,
        note: fill(t.shell.tenantNote, { city: data.tenant.city, country: data.tenant.country }),
        initials: initials(data.tenant.name),
      }}
      locale={locale}
      title={greeting}
      subtitle={subtitle}
    >
      <TimeZoneSync assumed={clock.timeZone} />

      <PayrollPanel
        data={data}
        f={f}
        daysToPay={daysUntil(data.run.payDate, isoDateIn(data.tenant.timeZone, clock.now))}
      />

      <KpiCards kpis={data.kpis} f={f} />

      <div className="flex flex-wrap gap-6">
        <Tasks tasks={data.tasks} f={f} />
        <Away data={data} f={f} />
      </div>

      <div className="flex flex-wrap gap-6">
        <CostChart
          months={months}
          paths={{
            gross: chart.grossLine,
            grossArea: chart.grossArea,
            charges: chart.chargesLine,
            chargesArea: chart.chargesArea,
          }}
          ticks={chart.ticks.map((tick) => f.millions(tick))}
          labels={{
            title: t.home.cost.title,
            subtitle: f.plain(t.home.cost.subtitle, { currency: CURRENCY }),
            gross: t.home.cost.gross,
            charges: t.home.cost.charges,
          }}
          description={f.plain(t.home.cost.description, {
            from: f.monthYear(first.iso),
            to: f.monthYear(last.iso),
            grossLow: f.money(Math.min(...gross)),
            grossHigh: f.money(Math.max(...gross)),
            chargesLow: f.money(Math.min(...charges)),
            chargesHigh: f.money(Math.max(...charges)),
          })}
        />
        <Departments data={data} f={f} />
      </div>

      <Connections connections={data.connections} f={f} />
    </AppShell>
  );
}

function navigation(t: Messages, badges: { leave: number; expenses: number }): NavGroup[] {
  const nav = t.shell.nav;
  const item = (key: keyof typeof nav, icon: IconName, badge?: number) => ({
    key,
    label: nav[key],
    icon,
    badge,
    aria:
      badge === undefined
        ? nav[key]
        : fill(t.shell.waiting, { label: nav[key], count: String(badge) }),
  });

  return [
    { key: 'start', items: [{ ...item('home', 'home'), current: true }] },
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
      items: [item('attendance', 'clock'), item('leave', 'calendar', badges.leave)],
    },
    {
      key: 'pay',
      title: t.shell.groups.pay,
      items: [
        item('payroll', 'pay'),
        item('payslips', 'payslip'),
        item('expenses', 'expense', badges.expenses),
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

function shellLabels(
  t: Messages,
  locale: Locale,
  session: Session,
  notifications: number,
): ShellLabels {
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
    notifications: fill(t.shell.notifications, { count: String(notifications) }),
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
function roleLabel(t: Messages, roles: readonly string[]): string {
  const known = ['platform-admin', 'hr-admin', 'payroll-manager', 'manager', 'employee'] as const;
  const held = known.find((role) => roles.includes(role));
  return held === undefined ? '' : t.roles[held];
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/** Whole days from one plain date to another, never negative. */
function daysUntil(target: string, today: string): number {
  const days = (Date.parse(`${target}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return Math.max(0, Math.round(days));
}
