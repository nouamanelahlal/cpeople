import type { JSX } from 'react';
import type { Formatter } from '../../../lib/format';
import type { HomeData } from '../../../lib/home-data';

/** Who is off this week, and what today is (M08 / M09, HR-04). */
export function Away({ data, f }: { data: HomeData; f: Formatter }): JSX.Element {
  const t = f.t.home.away;

  return (
    <section
      aria-labelledby="away-title"
      className="flex min-w-0 shrink grow basis-[300px] flex-col gap-4 rounded-[20px] border border-card-border bg-white p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="away-title" className="text-lg font-semibold text-navy">
          {t.title}
        </h2>
        <a href="#" className="text-sm font-semibold">
          {t.calendar}
        </a>
      </div>

      <ul className="m-0 grid list-none grid-cols-5 gap-1.5 p-0">
        {data.week.map((day) => (
          <li
            key={day.iso}
            className={`flex flex-col items-center gap-1 rounded-xl py-2.5 ${
              day.holiday ? 'bg-blue text-white' : 'bg-surface-quiet text-navy'
            }`}
          >
            <span className="text-xs">{f.weekday(day.iso)}</span>
            <span className="num text-lg font-semibold">{f.dayOfMonth(day.iso)}</span>
            <span className="num text-xs">
              {day.holiday
                ? t.holiday
                : f.text(t.count, { count: { kind: 'count', value: day.away } })}
            </span>
          </li>
        ))}
      </ul>

      <p className="num text-[13px] text-body">
        {f.text(t.holidayNote, {
          holiday: { kind: 'text', value: t.holidays[data.holiday.key] },
          count: { kind: 'count', value: data.holiday.working },
        })}
      </p>

      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {data.away.map((person) => (
          <li key={person.name} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-tint text-xs font-semibold text-navy"
            >
              {initials(person.name)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold text-navy">{person.name}</span>
              <span className="text-xs text-body">{t.types[person.type]}</span>
            </span>
            <span className="num text-[13px] text-navy">
              {f.text(t.range, {
                from: { kind: 'dayOfMonth', iso: person.from },
                to: { kind: 'dateShort', iso: person.to },
              })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** First letters of the first two words, which is what the design shows. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
