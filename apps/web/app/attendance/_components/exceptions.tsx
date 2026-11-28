import type { JSX } from 'react';
import type { Messages } from '@cpeople/shared';
import { exceptionText, type ExceptionList, type ExceptionRow } from '../../../lib/attendance';
import type { Formatter } from '../../../lib/format';
import { answerException } from '../actions';

/**
 * What the device could not explain (M10 / HR-04, build spec §5.4).
 *
 * Grouped by kind, because the same question asked forty times has one answer
 * and forty rows: "four people badged in and never badged out" is a morning's
 * work, and reading it as four separate mysteries is not.
 *
 * Every row carries its own form. There is no "resolve all" and no default
 * answer selected — each one is a decision about somebody's pay, and the reason
 * is required because in three months the only thing left will be the reason.
 */
export function Exceptions({
  list,
  f,
  query,
}: {
  list: ExceptionList;
  f: Formatter;
  query: Record<string, string | undefined>;
}): JSX.Element {
  const { t } = f;
  const e = t.attendance.exceptions;

  return (
    <>
      <Card>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-navy">{e.title}</h2>
          <p className="m-0 max-w-prose text-[13px] text-body">{e.note}</p>
          {list.scope === 'team' && (
            <p className="m-0 mt-1 text-[13px] text-muted">{e.teamOnly}</p>
          )}
        </div>

        {/* The kinds, with how many of each are still waiting. A count is a
            link: it is how somebody deals with one kind at a time. */}
        {list.groups.length > 0 && (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {list.groups.map((group) => (
              <li key={group.code}>
                <a
                  href={href({ ...query, tab: 'exceptions', code: group.code })}
                  aria-current={query['code'] === group.code ? 'true' : undefined}
                  className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] no-underline transition-colors duration-200 ease-out ${
                    query['code'] === group.code
                      ? 'border-blue bg-tint text-navy'
                      : 'border-card-border bg-white text-body hover:bg-surface-quiet'
                  }`}
                >
                  <span>{exceptionText(group.code, t)}</span>
                  <span className="num rounded-full bg-cyan px-2 py-[2px] text-xs font-semibold text-navy">
                    {f.count(group.open)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}

        <Filters list={list} query={query} t={t} />
      </Card>

      {list.rows.length === 0 ? (
        <Card>
          <p className="m-0 text-sm text-body">
            {Object.keys(query).length > 1 ? e.noneHere : e.none}
          </p>
        </Card>
      ) : (
        list.rows.map((row) => (
          <Exception key={row.id} row={row} f={f} mayCorrect={list.mayCorrect} />
        ))
      )}
    </>
  );
}

/** Narrowing the list: by department, and by when. */
function Filters({
  list,
  query,
  t,
}: {
  list: ExceptionList;
  query: Record<string, string | undefined>;
  t: Messages;
}): JSX.Element {
  const e = t.attendance.exceptions;

  return (
    <form method="get" action="/attendance" className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="tab" value="exceptions" />
      {query['code'] && <input type="hidden" name="code" value={query['code']} />}

      <Field label={e.department} htmlFor="department">
        <select
          id="department"
          name="department"
          defaultValue={query['department'] ?? ''}
          className={INPUT}
        >
          <option value="">{e.everyDepartment}</option>
          {list.departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label={e.from} htmlFor="from">
        <input id="from" name="from" type="date" defaultValue={query['from'] ?? ''} className={INPUT} />
      </Field>

      <Field label={e.to} htmlFor="to">
        <input id="to" name="to" type="date" defaultValue={query['to'] ?? ''} className={INPUT} />
      </Field>

      <Field label={e.open} htmlFor="status">
        <select id="status" name="status" defaultValue={query['status'] ?? 'open'} className={INPUT}>
          <option value="open">{e.open}</option>
          <option value="fixed">{e.done}</option>
          <option value="all">{e.all}</option>
        </select>
      </Field>

      <button type="submit" className={PRIMARY}>
        {e.apply}
      </button>
      <a href="/attendance?tab=exceptions" className="text-[13px] font-semibold text-blue">
        {e.clear}
      </a>
    </form>
  );
}

/** One question, and the form that answers it. */
function Exception({
  row,
  f,
  mayCorrect,
}: {
  row: ExceptionRow;
  f: Formatter;
  mayCorrect: boolean;
}): JSX.Element {
  const { t } = f;
  const e = t.attendance.exceptions;
  const answered = row.status !== 'open';

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="m-0 text-[15px] font-semibold text-navy">
            {exceptionText(row.code, t)}
          </h3>

          <p className="m-0 text-[13px] text-body">
            {row.employee ? (
              <>
                {row.employee.name}
                <span className="num ms-2 text-muted">{row.employee.employeeNumber}</span>
                {row.employee.department && (
                  <span className="ms-2 text-muted">· {row.employee.department}</span>
                )}
              </>
            ) : (
              <span className="num">{row.detail}</span>
            )}
            {row.date && <span className="num ms-2">· {f.dateMedium(row.date)}</span>}
          </p>
        </div>

        {row.workedMin !== undefined && (
          <dl className="m-0 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
            <Figure label={e.columns.worked} value={hours(row.workedMin, f)} />
            {(row.overtimeMin ?? 0) > 0 && (
              <Figure label={e.columns.overtime} value={hours(row.overtimeMin ?? 0, f)} />
            )}
            {(row.recoveryMin ?? 0) > 0 && (
              <Figure label={e.columns.recovery} value={hours(row.recoveryMin ?? 0, f)} />
            )}
          </dl>
        )}
      </div>

      {answered ? (
        <p className="m-0 rounded-2xl border border-success-border bg-success-bg px-4 py-3 text-[13px] text-success-ink">
          <strong className="font-semibold">
            {e.resolutions[row.resolution as keyof typeof e.resolutions] ?? row.resolution}
          </strong>
          {row.comment && <> — {row.comment}</>}
          {row.resolvedBy && row.resolvedAt && (
            <span className="ms-2 text-muted">
              {f.plain(e.answered, {
                who: row.resolvedBy,
                when: f.dateMedium(row.resolvedAt.slice(0, 10)),
              })}
            </span>
          )}
        </p>
      ) : (
        mayCorrect && <Answer row={row} t={t} />
      )}
    </Card>
  );
}

/** The form. Deliberately plain: a choice, a reason, and what each choice needs. */
function Answer({ row, t }: { row: ExceptionRow; t: Messages }): JSX.Element {
  const e = t.attendance.exceptions;
  const needsPunch = row.resolutions.includes('addPunch');
  const needsPerson = row.resolutions.includes('map');
  const canUndo = row.resolutions.includes('undoRecovery');

  return (
    <form action={answerException} className="flex flex-col gap-3 border-t border-line pt-4">
      <input type="hidden" name="id" value={row.id} />

      <div className="flex flex-wrap gap-3">
        <Field label={e.resolutionLabel} htmlFor={`what-${row.id}`}>
          <select id={`what-${row.id}`} name="resolution" required className={INPUT}>
            <option value="">—</option>
            {row.resolutions.map((name) => (
              <option key={name} value={name}>
                {e.resolutions[name]}
              </option>
            ))}
          </select>
        </Field>

        {needsPerson && (
          <Field label={e.employeeLabel} htmlFor={`who-${row.id}`}>
            <input
              id={`who-${row.id}`}
              name="employeeId"
              placeholder="…"
              className={INPUT}
            />
          </Field>
        )}

        {needsPunch && (
          <>
            <Field label={e.timeLabel} htmlFor={`at-${row.id}`}>
              <input id={`at-${row.id}`} name="at" type="time" className={INPUT} />
            </Field>
            <Field label={e.directionLabel} htmlFor={`dir-${row.id}`}>
              <select id={`dir-${row.id}`} name="direction" defaultValue="out" className={INPUT}>
                <option value="in">{e.directionIn}</option>
                <option value="out">{e.directionOut}</option>
              </select>
            </Field>
          </>
        )}
      </div>

      <Field label={e.reason} htmlFor={`why-${row.id}`}>
        <input
          id={`why-${row.id}`}
          name="comment"
          required
          aria-describedby={`why-note-${row.id}`}
          className={`${INPUT} min-w-[280px] flex-1`}
        />
      </Field>
      <span id={`why-note-${row.id}`} className="-mt-1 text-xs text-body">
        {e.reasonNote}
      </span>

      {canUndo && (
        <label className="flex items-start gap-2 text-[13px] text-body">
          <input type="checkbox" name="override" value="1" className="mt-1" />
          <span>
            <strong className="font-semibold text-navy">{e.override}</strong> — {e.overrideNote}
          </span>
        </label>
      )}

      <button type="submit" className={`${PRIMARY} w-fit`}>
        {e.send}
      </button>
    </form>
  );
}

function Figure({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">{label}</dt>
      <dd className="num m-0 font-semibold text-navy">{value}</dd>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold uppercase tracking-[0.04em] text-muted"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <section className="flex flex-col gap-5 rounded-[20px] border border-card-border bg-white p-6">
      {children}
    </section>
  );
}

/** Minutes as hours and minutes, which is how a shift is spoken about. */
function hours(minutes: number, f: Formatter): string {
  const whole = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${f.count(whole)} h` : `${f.count(whole)} h ${String(rest).padStart(2, '0')}`;
}

function href(query: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) search.set(key, value);

  return `/attendance?${search.toString()}`;
}

const INPUT =
  'h-10 rounded-xl border border-field-border bg-white px-3 text-sm text-navy';
const PRIMARY =
  'h-10 rounded-xl bg-blue px-4 text-[13px] font-semibold text-white transition-[background-color] duration-200 ease-out hover:bg-blue-hover';
