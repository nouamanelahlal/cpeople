import type { JSX, ReactNode } from 'react';
import { apiGetResult } from '../../lib/api';
import { exceptionRefusalText, type ExceptionList } from '../../lib/attendance';
import { Exceptions } from './_components/exceptions';
import { formatter, type Formatter } from '../../lib/format';
import { AppPage, appContext } from '../_shell/app-page';

/** What the sample export carries, from the API that generates it. */
export interface SampleSummary {
  readonly rows: number;
  readonly from: string;
  readonly to: string;
  readonly unknownNumbers: readonly string[];
  readonly missingOut: number;
  readonly duplicates: number;
  readonly holidayWorkers: number;
  readonly nightShiftPeople: number;
  readonly workedOnLeave: number;
  readonly absentWithoutLeave: number;
}

/**
 * Attendance (M10 / HR-04, build spec §5).
 *
 * One tab today, and it is the honest one: the format, a sample of it, and the
 * specification to send to the device provider. The import, the exceptions and
 * the timesheets each arrive with their own step, and each gets its tab then —
 * an empty tab that promises something is worse than no tab at all.
 */
export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element> {
  const context = await appContext();
  const { t } = context;

  const raw = await searchParams;
  const query = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  ) as Record<string, string | undefined>;

  const tab = query['tab'] === 'exceptions' ? 'exceptions' : 'import';

  const f = formatter(context.locale, t, 'Africa/Casablanca');

  // Only the import tab needs the sample, and asking for it needs
  // `attendance.import` — which a manager does not have. Gating the whole
  // screen on it shut managers out of their own team's exceptions, which is
  // exactly what `attendance.view` is for.
  const loaded =
    tab === 'import'
      ? await apiGetResult<SampleSummary>('/attendance/sample')
      : ({ ok: true, value: null } as const);

  if (!loaded.ok) {
    // Refused and unavailable are different things, and saying the wrong one
    // sends somebody to ask for a permission they already have.
    return (
      <AppPage
        context={context}
        current="attendance"
        title={t.attendance.title}
        subtitle={t.attendance.subtitle}
      >
        <Card>
          <p className="m-0 text-sm text-body">
            {loaded.refused ? t.attendance.notYours : t.attendance.unavailable}
          </p>
        </Card>
      </AppPage>
    );
  }

  // Inside the import branch below, the sample has been fetched: the tab and
  // the fetch are decided by the same condition.
  const sample = loaded.value as SampleSummary;

  // Only the tab being read is fetched: the exceptions list is a query across
  // every worked day, and the import screen has no use for it.
  const exceptions =
    tab === 'exceptions'
      ? await apiGetResult<ExceptionList>(`/attendance/exceptions${search(query)}`)
      : null;

  const refused = query['error'];

  return (
    <AppPage
      context={context}
      current="attendance"
      title={t.attendance.title}
      subtitle={t.attendance.subtitle}
    >
      <Card>
        <nav aria-label={t.attendance.title} className="-mb-1 flex flex-wrap gap-1">
          {(['import', 'exceptions'] as const).map((name) => (
            <a
              key={name}
              href={`/attendance?tab=${name}`}
              aria-current={name === tab ? 'page' : undefined}
              className={`rounded-t-xl border-b-2 px-3.5 py-2.5 text-[13px] font-semibold no-underline transition-colors duration-200 ease-out ${
                name === tab
                  ? 'border-blue text-navy'
                  : 'border-transparent text-body hover:bg-surface-quiet'
              }`}
            >
              {t.attendance.tabs[name]}
            </a>
          ))}
        </nav>
      </Card>

      {query['answered'] === '1' && (
        <p className="m-0 rounded-2xl border border-success-border bg-success-bg px-4 py-3 text-sm text-success-ink">
          {t.attendance.exceptions.send}
        </p>
      )}

      {refused && (
        <p
          role="alert"
          className="m-0 rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-ink"
        >
          {exceptionRefusalText(refused.split('~')[0] ?? 'failed', t, used(refused))}
        </p>
      )}

      {tab === 'exceptions' ? (
        exceptions === null || !exceptions.ok ? (
          <Card>
            {/* Refused and unavailable are different things here too: an
                employee may not read attendance at all, and saying the wrong
                one sends them to ask for a permission nobody will give. */}
            <p className="m-0 text-sm text-body">
              {exceptions !== null && exceptions.refused
                ? t.attendance.notYours
                : t.attendance.unavailable}
            </p>
          </Card>
        ) : (
          <Exceptions list={exceptions.value} f={f} query={query} />
        )
      ) : (
        <>
      <Card>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-navy">{t.attendance.import.title}</h2>
          <p className="m-0 max-w-prose text-[13px] text-body">{t.attendance.import.note}</p>
        </div>

        <p className="m-0 rounded-2xl border border-warning-bg bg-warning-bg px-4 py-3 text-[13px] text-warning-ink">
          {t.attendance.import.planned}
        </p>

        <div className="flex flex-wrap gap-3">
          <a href="/attendance/import" className={PRIMARY}>
            {t.attendance.import.open}
          </a>
          <a href="/attendance/sample.csv" className={QUIET}>
            {t.attendance.import.sample}
          </a>
          <a href="/attendance/specification.xlsx" className={QUIET}>
            {t.attendance.import.spec}
          </a>
        </div>

        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-x-8 gap-y-2 text-[13px]">
          <Note label={t.attendance.import.sample} text={t.attendance.import.sampleNote} />
          <Note label={t.attendance.import.spec} text={t.attendance.import.specNote} />
        </dl>
      </Card>

      <Card>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-navy">{t.attendance.import.contains}</h2>
          <p className="num m-0 text-[13px] text-body">
            {f.plain(t.attendance.import.rows, {
              count: f.count(sample.rows),
              from: f.dateMedium(sample.from),
              to: f.dateMedium(sample.to),
            })}
          </p>
        </div>

        {/* Said out loud, because the point of the sample is the problems in it:
            a provider reading this knows what we will be checking for. */}
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] text-body">
          {anomalies(sample, f).map((line) => (
            <li key={line} className="rounded-xl bg-surface-quiet px-3.5 py-2.5">
              {line}
            </li>
          ))}
        </ul>
      </Card>

      <a href="/settings/attendance" className="text-sm font-semibold text-blue">
        {t.attendance.source.title}
      </a>
        </>
      )}
    </AppPage>
  );
}

/** The sample's contents, in sentences rather than a table of counts. */
function anomalies(sample: SampleSummary, f: Formatter): string[] {
  const t = f.t.attendance.import.anomalies;

  return [
    f.plain(t.unknown, {
      count: f.count(sample.unknownNumbers.length),
      numbers: sample.unknownNumbers.join(', '),
    }),
    f.plain(t.missingOut, { count: f.count(sample.missingOut) }),
    f.plain(t.duplicates, { count: f.count(sample.duplicates) }),
    f.plain(t.holiday, { count: f.count(sample.holidayWorkers) }),
    f.plain(t.night, { count: f.count(sample.nightShiftPeople) }),
    f.plain(t.onLeave, { count: f.count(sample.workedOnLeave) }),
    f.plain(t.absent, { count: f.count(sample.absentWithoutLeave) }),
  ];
}

function Note({ label, text }: { label: string; text: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">{label}</dt>
      <dd className="m-0 max-w-prose text-body">{text}</dd>
    </div>
  );
}

function Card({ children }: { children: ReactNode }): JSX.Element {
  return (
    <section className="flex flex-col gap-5 rounded-[20px] border border-card-border bg-white p-6">
      {children}
    </section>
  );
}

const PRIMARY =
  'h-11 rounded-xl bg-blue px-5 text-sm font-semibold leading-[44px] text-white no-underline transition-[background-color] duration-200 ease-out hover:bg-blue-hover';
const QUIET =
  'quiet-button h-11 border-button-border px-4 text-[13px] font-semibold leading-[44px] text-navy no-underline';

/** The filters, as the API expects them. */
function search(query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();

  for (const key of ['code', 'department', 'from', 'to', 'status'] as const) {
    if (query[key]) params.set(key, query[key] as string);
  }

  if (!params.has('status')) params.set('status', 'open');

  return `?${params.toString()}`;
}

/** The numbers a refusal needs, carried back in the address with it. */
function used(refused: string): Record<string, string> {
  const [, rest] = refused.split('~');
  if (!rest) return {};

  return Object.fromEntries(
    rest
      .split('|')
      .filter(Boolean)
      .map((pair) => {
        const at = pair.indexOf(':');
        return [pair.slice(0, at), pair.slice(at + 1)];
      }),
  );
}
