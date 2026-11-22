import type { JSX } from 'react';
import { CURRENCY, intlLocale } from '@cpeople/shared';
import { apiGetOrNull } from '../../lib/api';
import { costChart } from '../../lib/chart';
import { greetingKey, viewerClock } from '../../lib/clock';
import { formatter, type Formatter } from '../../lib/format';
import { homeData } from '../../lib/home-data';
import type { HomeSummary, HomeTask } from '../../lib/home-summary';
import { AppPage, appContext } from '../_shell/app-page';
import { Away } from './_components/away';
import { Connections } from './_components/connections';
import { CostChart, type CostChartMonth } from './_components/cost-chart';
import { Departments } from './_components/departments';
import { KpiCards, type KpiView } from './_components/kpi-cards';
import { PayrollPanel } from './_components/payroll-panel';
import { PreviewTag } from './_components/preview-tag';
import { Tasks, type TaskView } from './_components/tasks';

/**
 * The home screen (HR-01 / M03, drawn as docs/design/home-dashboard.dc.html).
 *
 * The figures and the list of what is waiting are real: the API counts them over
 * the files this person is allowed to see, so an HR manager's "148" and a
 * manager's "46" are both true. The payroll month, the cost chart, who is away
 * and the connections are still sample figures, and each says so on the panel —
 * they are what HR-02 and HR-03 are for.
 */
export default async function HomePage(): Promise<JSX.Element> {
  const context = await appContext();
  const { session, locale, t } = context;

  const data = homeData();
  const clock = await viewerClock(data.tenant.timeZone);
  const f = formatter(locale, t, data.tenant.timeZone);

  // The page draws whatever it has: if the API cannot be reached, the shell, the
  // greeting and the previews still arrive, and the figures say they are missing.
  const summary = await apiGetOrNull<HomeSummary>('/home');

  const greeting = f.plain(t.home.greeting[greetingKey(clock)], {
    name: firstName(session.name.trim()),
  });

  const subtitle = f.plain(t.home.today, {
    // The day the figures are as at, which the demo clock can pin.
    date: summary
      ? f.dateLong(summary.today)
      : new Intl.DateTimeFormat(intlLocale(locale), {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: clock.timeZone,
        }).format(clock.now),
    status: summary?.holiday
      ? f.plain(t.home.away.holidayNote, { holiday: summary.holiday, count: '' }).trim()
      : f.plain(t.home.runStatus[data.run.status], { month: f.monthName(data.run.month) }),
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

  const previewHr02 = (
    <PreviewTag
      label={f.plain(t.home.preview, { workshop: 'HR-02' })}
      title={f.plain(t.home.previewTitle, { workshop: t.modules.hr02 })}
    />
  );
  const previewHr03 = (
    <PreviewTag
      label={f.plain(t.home.preview, { workshop: 'HR-03' })}
      title={f.plain(t.home.previewTitle, { workshop: t.modules.hr03 })}
    />
  );

  return (
    <AppPage context={context} current="home" title={greeting} subtitle={subtitle}>
      <PayrollPanel
        data={data}
        f={f}
        daysToPay={daysUntil(data.run.payDate, summary?.today ?? data.run.month)}
        preview={previewHr03}
      />

      <KpiCards kpis={kpiViews(summary, f)} label={t.home.kpis.label} />

      <div className="flex flex-wrap gap-6">
        <Tasks
          tasks={taskViews(summary, f)}
          title={t.home.tasks.title}
          openInbox={t.home.tasks.openInbox}
          empty={summary ? t.home.tasks.empty : t.home.tasks.unavailable}
          inboxHref="/employees"
        />
        <Away data={data} f={f} preview={previewHr02} />
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
          preview={previewHr03}
        />
        <Departments
          f={f}
          departments={summary?.departments ?? []}
          total={summary?.headcount.value ?? 0}
          fixedTerm={summary?.fixedTerm ?? 0}
        />
      </div>

      <Connections connections={data.connections} f={f} preview={previewHr03} />
    </AppPage>
  );
}

/**
 * The four figures, from what the API counted for this person.
 *
 * Each card links to the list it counts — the same question, asked of the same
 * API, which is what keeps the number and the list agreeing.
 */
function kpiViews(summary: HomeSummary | null, f: Formatter): KpiView[] {
  const t = f.t.home.kpis;
  const unknown = '—';

  return [
    {
      key: 'headcount',
      icon: 'users',
      label: t.headcount,
      value: summary ? f.count(summary.headcount.value) : unknown,
      note: summary
        ? f.plain(t.headcountNote, {
            joined: f.count(summary.joinedThisMonth),
            left: f.count(summary.leftThisMonth),
          })
        : '',
      href: '/employees',
    },
    {
      key: 'onboarding',
      icon: 'onboard',
      label: t.onboarding,
      value: summary ? f.count(summary.onboarding) : unknown,
      suffix: t.onboardingSuffix,
      note: summary ? f.plain(t.onboardingNote, { count: f.count(summary.onboardingOverdue) }) : '',
      href: '/onboarding',
    },
    {
      key: 'contractsEnding',
      icon: 'contract',
      label: t.contractsEnding,
      value: summary ? f.count(summary.contractsEnding) : unknown,
      suffix: f.plain(t.contractsEndingSuffix, { days: f.count(30) }),
      note: t.contractsEndingNote,
      href: '/contracts',
    },
    {
      key: 'documents',
      icon: 'document',
      label: t.documents,
      value: summary ? f.count(summary.documentsExpiring.value) : unknown,
      suffix: f.plain(t.documentsSuffix, { days: f.count(summary?.documentsExpiring.of ?? 30) }),
      note: t.documentsNote,
      href: '/employees?filter=documents-expiring',
    },
  ];
}

/** What is waiting, worded for the reader and pointed at the file it concerns. */
function taskViews(summary: HomeSummary | null, f: Formatter): TaskView[] {
  const t = f.t.home.tasks;

  return (summary?.waiting ?? []).map((task: HomeTask, index) => {
    const copy = t[task.kind];
    const values = {
      name: task.employeeName,
      date: task.date === undefined ? '' : f.dayMonth(task.date),
      what: task.detail ?? '',
      days: f.count(Math.abs(task.days ?? 0)),
    };

    return {
      id: `${task.kind}-${task.employeeId}-${index}`,
      icon: ICONS[task.kind],
      tone: task.kind === 'onboardingOverdue' ? 'info' : 'warning',
      title: f.plain(copy.title, values),
      detail: f.plain(copy.detail, values),
      status: f.plain(copy.status, values),
      action: copy.action,
      href: `/employees/${task.employeeId}`,
    };
  });
}

const ICONS = {
  contractEnding: 'contract',
  onboardingOverdue: 'onboard',
  documentExpired: 'document',
} as const;

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

/** Whole days from one plain date to another, never negative. */
function daysUntil(target: string, today: string): number {
  const days = (Date.parse(`${target}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return Math.max(0, Math.round(days));
}
