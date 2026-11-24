import type { JSX } from 'react';
import type { Formatter } from '../../../lib/format';
import type { AwayThisWeek } from '../../../lib/home-summary';
import { leaveTypeName } from '../../../lib/leave';

/**
 * Who is off this week (M09 / HR-04).
 *
 * Live, from the approved leave requests, and scoped the way everything else
 * is: a manager's week is their own team's and HR's is the company's.
 *
 * Which **kind** of leave somebody is on is a different question from whether
 * they are away, and the API answers it only when the company has said
 * colleagues may see it. Where it has not, this card says that somebody is
 * away and nothing more — which is the honest thing for a screen everybody in
 * the building can see.
 */
export function Away({
  away,
  today,
  f,
}: {
  away: AwayThisWeek | null;
  today: string;
  f: Formatter;
}): JSX.Element {
  const t = f.t.home.away;

  return (
    <section
      aria-labelledby="away-title"
      className="flex min-w-0 shrink grow basis-[300px] flex-col gap-4 rounded-[20px] border border-card-border bg-white p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="away-title" className="flex items-center gap-2 text-lg font-semibold text-navy">
          {t.title}
        </h2>
        <a href="/leave?tab=calendar" className="text-sm font-semibold">
          {t.calendar}
        </a>
      </div>

      {away === null ? (
        <p className="m-0 py-6 text-sm text-body">{f.t.home.tasks.unavailable}</p>
      ) : (
        <>
          <ul className="m-0 grid list-none grid-cols-5 gap-1.5 p-0">
            {away.days.map((day) => (
              <li
                key={day.date}
                className={`flex flex-col items-center gap-1 rounded-xl py-2.5 ${
                  day.holiday
                    ? 'bg-blue text-white'
                    : day.date === today
                      ? 'bg-tint text-navy'
                      : 'bg-surface-quiet text-navy'
                }`}
              >
                <span className="text-xs">{f.weekday(day.date)}</span>
                <span className="num text-lg font-semibold">{f.dayOfMonth(day.date)}</span>
                <span className="num text-xs">
                  {day.holiday ? t.holiday : f.plain(t.count, { count: f.count(day.away) })}
                </span>
              </li>
            ))}
          </ul>

          <p className="num m-0 text-[13px] text-body">
            {holidayLine(away, today, f)}
          </p>

          {away.people.length === 0 ? (
            <p className="m-0 text-sm text-body">{t.empty}</p>
          ) : (
            <ul aria-label={t.people} className="m-0 flex list-none flex-col gap-3.5 p-0">
              {away.people.map((person) => (
                <li key={person.id} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-tint text-xs font-semibold text-navy"
                  >
                    {initials(person.name)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-semibold text-navy">{person.name}</span>
                    <span className="text-xs text-body">
                      {person.leaveTypeCode === undefined
                        ? person.department
                        : leaveTypeName({ code: person.leaveTypeCode, name: '' }, f.t)}
                    </span>
                  </span>
                  <span className="num text-[13px] text-navy">
                    {f.plain(t.range, {
                      from: f.dayOfMonth(person.from),
                      to: f.dateShort(person.to),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/**
 * The line under the week.
 *
 * On a public holiday it says which one and that nobody is expected in;
 * otherwise it says how many people are working today, which is the figure a
 * manager actually wants on a Tuesday morning.
 */
function holidayLine(away: AwayThisWeek, today: string, f: Formatter): string {
  const t = f.t.home.away;
  const holiday = away.days.find((day) => day.date === today && day.holiday);

  return holiday
    ? f.plain(t.holidayNote, {
        holiday: holiday.holidayName ?? t.holiday,
        count: f.count(away.workingToday),
      })
    : f.plain(t.workingNote, { count: f.count(away.workingToday) });
}

/** First letters of the first two words, which is what the design shows. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
