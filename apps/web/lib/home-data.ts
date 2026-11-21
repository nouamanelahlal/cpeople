/**
 * Everything the home screen shows, in one place (NEW / M23).
 *
 * It is fake data for a fake tenant — no real person, salary or client figure is in
 * the repository (CLAUDE.md rule 6) — and it is shaped like the answer an API would
 * give, so that replacing it later is a change to this file and nothing else:
 *
 * - amounts are integer minor units, with the currency named separately (rule 4);
 * - dates and times are ISO strings, formatted for the reader's language on screen;
 * - anything a person reads is a key into `packages/shared` messages, with the
 *   numbers and dates that fill it alongside. Translating is not this file's job,
 *   and a real API would not do it either.
 *
 * The only strings here are the names of made-up people and the tenant, because a
 * name is not translated.
 */

/** Fills a placeholder in a message, formatted for the language on screen. */
export type Value =
  | { readonly kind: 'count'; readonly value: number }
  | { readonly kind: 'money'; readonly minor: number }
  | { readonly kind: 'moneyThousands'; readonly minor: number }
  | { readonly kind: 'percent'; readonly value: number }
  | { readonly kind: 'date'; readonly iso: string }
  | { readonly kind: 'dateShort'; readonly iso: string }
  | { readonly kind: 'month'; readonly iso: string }
  | { readonly kind: 'monthYear'; readonly iso: string }
  /** "30 November": the day and the month written out. */
  | { readonly kind: 'dayMonth'; readonly iso: string }
  /** "24": the day alone, for the first half of a range. */
  | { readonly kind: 'dayOfMonth'; readonly iso: string }
  | { readonly kind: 'time'; readonly iso: string }
  | { readonly kind: 'dateTime'; readonly iso: string }
  /** A department, named in the reader's language from the messages. */
  | { readonly kind: 'department'; readonly key: DepartmentKey }
  /** A name or a reference number: the same in every language. */
  | { readonly kind: 'text'; readonly value: string };

export type Values = Readonly<Record<string, Value>>;

export type DepartmentKey = 'kitchen' | 'outlet' | 'pastry' | 'administration' | 'warehouse';

export type Tone = 'warning' | 'info' | 'neutral';

export type IconName =
  | 'home'
  | 'users'
  | 'onboard'
  | 'contract'
  | 'org'
  | 'clock'
  | 'calendar'
  | 'pay'
  | 'payslip'
  | 'expense'
  | 'declaration'
  | 'sap'
  | 'settings'
  | 'document'
  | 'check'
  | 'alert';

export interface RunStep {
  readonly key: 'opened' | 'variables' | 'calculated' | 'review' | 'hrApproval' | 'lock' | 'post';
  readonly state: 'done' | 'current' | 'todo';
  readonly values: Values;
}

export interface RunFigure {
  readonly key: 'gross' | 'net' | 'charges' | 'tax';
  readonly minor: number;
  readonly values: Values;
}

export interface Kpi {
  readonly key: 'headcount' | 'present' | 'leave' | 'documents';
  readonly value: number;
  readonly icon: IconName;
  readonly values: Values;
}

export interface Task {
  readonly key:
    | 'holidayReview'
    | 'leaveApproval'
    | 'expenseApproval'
    | 'contractEnding'
    | 'unmatchedPunches';
  readonly icon: IconName;
  readonly tone: Tone;
  readonly values: Values;
}

export interface AwayDay {
  readonly iso: string;
  readonly away: number;
  readonly holiday: boolean;
}

export interface AwayPerson {
  readonly name: string;
  readonly type: 'annual' | 'sick' | 'training';
  readonly from: string;
  readonly to: string;
}

export interface CostMonth {
  readonly iso: string;
  readonly grossMinor: number;
  readonly chargesMinor: number;
}

export interface Department {
  readonly key: DepartmentKey;
  readonly count: number;
}

export interface Connection {
  readonly key: 'sap' | 'cnss' | 'tax' | 'devices';
  readonly state: 'ok' | 'attention';
  readonly values: Values;
}

export interface HomeData {
  readonly tenant: {
    readonly name: string;
    readonly city: string;
    readonly country: string;
    /** Where the company's day happens: every date and time below is in it. */
    readonly timeZone: string;
  };
  readonly notifications: number;
  readonly badges: { readonly leave: number; readonly expenses: number };
  readonly run: {
    readonly month: string;
    readonly payDate: string;
    readonly version: number;
    readonly calculatedAt: string;
    readonly employees: number;
    readonly pointsToCheck: number;
    readonly status: 'review';
    readonly figures: readonly RunFigure[];
    readonly steps: readonly RunStep[];
  };
  readonly kpis: readonly Kpi[];
  readonly tasks: readonly Task[];
  readonly week: readonly AwayDay[];
  readonly holiday: { readonly key: 'independence'; readonly working: number };
  readonly away: readonly AwayPerson[];
  readonly cost: readonly CostMonth[];
  readonly headcount: { readonly total: number; readonly fixedTerm: number };
  readonly departments: readonly Department[];
  readonly connections: readonly Connection[];
}

const text = (value: string): Value => ({ kind: 'text', value });
const count = (value: number): Value => ({ kind: 'count', value });

/**
 * The sample tenant: a Rabat company on the Morocco pack, mid-November payroll.
 *
 * Replacing this with `await api.home()` is the whole change when the modules
 * behind it exist.
 */
export function homeData(): HomeData {
  return {
    tenant: { name: 'Demo Company', city: 'Rabat', country: 'Morocco', timeZone: 'Africa/Casablanca' },
    notifications: 4,
    badges: { leave: 7, expenses: 3 },

    run: {
      month: '2026-11-01',
      payDate: '2026-11-30',
      version: 2,
      calculatedAt: '2026-11-18T09:12:00+01:00',
      employees: 148,
      pointsToCheck: 3,
      status: 'review',
      figures: [
        {
          key: 'gross',
          minor: 128_465_000,
          values: { change: { kind: 'percent', value: 1.8 }, month: { kind: 'month', iso: '2026-10-01' } },
        },
        { key: 'net', minor: 101_248_040, values: { count: count(148) } },
        { key: 'charges', minor: 26_890_315, values: {} },
        { key: 'tax', minor: 13_922_760, values: {} },
      ],
      steps: [
        { key: 'opened', state: 'done', values: { date: { kind: 'dateShort', iso: '2026-11-01' } } },
        {
          key: 'variables',
          state: 'done',
          values: { date: { kind: 'dateShort', iso: '2026-11-18' } },
        },
        { key: 'calculated', state: 'done', values: { version: count(2) } },
        { key: 'review', state: 'current', values: { count: count(3) } },
        { key: 'hrApproval', state: 'todo', values: { name: text('Salma Benali') } },
        { key: 'lock', state: 'todo', values: { count: count(148) } },
        { key: 'post', state: 'todo', values: {} },
      ],
    },

    kpis: [
      {
        key: 'headcount',
        value: 148,
        icon: 'users',
        values: { joined: count(3), left: count(1), month: { kind: 'month', iso: '2026-11-01' } },
      },
      {
        key: 'present',
        value: 41,
        icon: 'clock',
        values: { expected: count(42), time: { kind: 'time', iso: '2026-11-18T07:15:00+01:00' } },
      },
      { key: 'leave', value: 7, icon: 'calendar', values: { count: count(2) } },
      {
        key: 'documents',
        value: 5,
        icon: 'document',
        values: { days: count(30), permits: count(2), certificates: count(3) },
      },
    ],

    tasks: [
      {
        key: 'holidayReview',
        icon: 'alert',
        tone: 'warning',
        values: { count: count(42), date: { kind: 'dayMonth', iso: '2026-11-18' } },
      },
      {
        key: 'leaveApproval',
        icon: 'calendar',
        tone: 'info',
        values: {
          name: text('Karim Alaoui'),
          from: { kind: 'dayOfMonth', iso: '2026-11-24' },
          to: { kind: 'dayMonth', iso: '2026-11-28' },
          days: count(4),
        },
      },
      {
        key: 'expenseApproval',
        icon: 'expense',
        tone: 'info',
        values: {
          name: text('Nadia Berrada'),
          amount: { kind: 'money', minor: 64_000 },
          receipts: count(2),
          month: { kind: 'month', iso: '2026-11-01' },
        },
      },
      {
        key: 'contractEnding',
        icon: 'contract',
        tone: 'warning',
        values: {
          name: text('Omar Chraibi'),
          date: { kind: 'dayMonth', iso: '2026-11-30' },
          days: count(12),
        },
      },
      {
        key: 'unmatchedPunches',
        icon: 'clock',
        tone: 'neutral',
        values: {
          count: count(3),
          device: { kind: 'department', key: 'kitchen' },
          time: { kind: 'dateTime', iso: '2026-11-18T07:15:00+01:00' },
        },
      },
    ],

    week: [
      { iso: '2026-11-16', away: 2, holiday: false },
      { iso: '2026-11-17', away: 3, holiday: false },
      { iso: '2026-11-18', away: 0, holiday: true },
      { iso: '2026-11-19', away: 4, holiday: false },
      { iso: '2026-11-20', away: 4, holiday: false },
    ],
    holiday: { key: 'independence', working: 42 },

    away: [
      { name: 'Leila Fassi', type: 'annual', from: '2026-11-16', to: '2026-11-20' },
      { name: 'Mehdi Idrissi', type: 'sick', from: '2026-11-17', to: '2026-11-19' },
      { name: 'Sara Amrani', type: 'training', from: '2026-11-19', to: '2026-11-20' },
      { name: 'Yassine Tazi', type: 'annual', from: '2026-11-19', to: '2026-11-20' },
    ],

    cost: [
      { iso: '2025-12-01', grossMinor: 123_800_000, chargesMinor: 25_900_000 },
      { iso: '2026-01-01', grossMinor: 118_600_000, chargesMinor: 24_800_000 },
      { iso: '2026-02-01', grossMinor: 119_200_000, chargesMinor: 24_900_000 },
      { iso: '2026-03-01', grossMinor: 120_500_000, chargesMinor: 25_200_000 },
      { iso: '2026-04-01', grossMinor: 121_100_000, chargesMinor: 25_300_000 },
      { iso: '2026-05-01', grossMinor: 122_400_000, chargesMinor: 25_600_000 },
      { iso: '2026-06-01', grossMinor: 121_900_000, chargesMinor: 25_500_000 },
      { iso: '2026-07-01', grossMinor: 124_000_000, chargesMinor: 26_000_000 },
      { iso: '2026-08-01', grossMinor: 123_300_000, chargesMinor: 25_800_000 },
      { iso: '2026-09-01', grossMinor: 125_100_000, chargesMinor: 26_200_000 },
      { iso: '2026-10-01', grossMinor: 126_200_000, chargesMinor: 26_400_000 },
      { iso: '2026-11-01', grossMinor: 128_500_000, chargesMinor: 26_900_000 },
    ],

    headcount: { total: 148, fixedTerm: 12 },
    departments: [
      { key: 'kitchen', count: 46 },
      { key: 'outlet', count: 38 },
      { key: 'pastry', count: 29 },
      { key: 'administration', count: 20 },
      { key: 'warehouse', count: 15 },
    ],

    connections: [
      {
        key: 'sap',
        state: 'ok',
        values: {
          month: { kind: 'month', iso: '2026-10-01' },
          date: { kind: 'dateShort', iso: '2026-10-31' },
          entry: text('100000482'),
        },
      },
      {
        key: 'cnss',
        state: 'ok',
        values: {
          month: { kind: 'month', iso: '2026-10-01' },
          next: { kind: 'month', iso: '2026-11-01' },
        },
      },
      { key: 'tax', state: 'ok', values: { month: { kind: 'month', iso: '2026-10-01' } } },
      {
        key: 'devices',
        state: 'attention',
        values: { time: { kind: 'time', iso: '2026-11-18T07:15:00+01:00' }, count: count(3) },
      },
    ],
  };
}
