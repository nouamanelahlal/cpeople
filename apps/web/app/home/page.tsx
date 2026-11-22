import type { JSX } from 'react';
import { CURRENCY, intlLocale } from '@cpeople/shared';
import { costChart } from '../../lib/chart';
import { greetingKey, isoDateIn, viewerClock } from '../../lib/clock';
import { formatter } from '../../lib/format';
import { homeData } from '../../lib/home-data';
import { AppPage, appContext } from '../_shell/app-page';
import { Away } from './_components/away';
import { Connections } from './_components/connections';
import { CostChart, type CostChartMonth } from './_components/cost-chart';
import { Departments } from './_components/departments';
import { KpiCards } from './_components/kpi-cards';
import { PayrollPanel } from './_components/payroll-panel';
import { Tasks } from './_components/tasks';

/**
 * The home screen: the payroll month, the day's figures, and what is waiting
 * (NEW / M23, drawn as docs/design/home-dashboard.dc.html).
 *
 * Everything on it is sample data from lib/home-data.ts, shaped like the API that
 * will replace it. What is real is the person: their name, their role and their
 * language come from the token Keycloak issued.
 */
export default async function HomePage(): Promise<JSX.Element> {
  const context = await appContext();
  const { session, locale, t } = context;

  const data = homeData();
  const clock = await viewerClock(data.tenant.timeZone);
  const f = formatter(locale, t, data.tenant.timeZone);

  const greeting = f.plain(t.home.greeting[greetingKey(clock)], {
    name: firstName(session.name.trim()),
  });
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
    <AppPage context={context} current="home" title={greeting} subtitle={subtitle}>
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
    </AppPage>
  );
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

/** Whole days from one plain date to another, never negative. */
function daysUntil(target: string, today: string): number {
  const days = (Date.parse(`${target}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return Math.max(0, Math.round(days));
}
