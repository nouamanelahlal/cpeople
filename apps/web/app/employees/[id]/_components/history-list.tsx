import type { JSX } from 'react';
import type { AuditEvent } from '../../../../lib/employee-file';
import type { Formatter } from '../../../../lib/format';

/**
 * What has happened to this file, newest first (HR-01 spec 6.11).
 *
 * Each entry says who made the change, in which role, when, and what changed —
 * field by field, before and after. A field the reader may not see keeps its
 * name and loses its values, so a manager can see that a salary was changed
 * without learning what it was changed to. That is decided by the API; this only
 * draws what it is given.
 */
export function HistoryList({
  events,
  f,
}: {
  events: readonly AuditEvent[];
  f: Formatter;
}): JSX.Element {
  const t = f.t.employeeFile;

  if (events.length === 0) {
    return <p className="m-0 text-sm text-body">{t.historyEmpty}</p>;
  }

  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {events.map((event) => (
        <li key={event.id} className="flex flex-col gap-2 border-t border-line py-4 first:border-t-0 first:pt-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-sm font-semibold text-navy">{event.summary}</span>
            <span className="num text-[13px] text-body">{f.dateTime(event.at)}</span>
          </div>

          <p className="m-0 text-[13px] text-body">
            {f.plain(t.historyBy, {
              name: event.actorName ?? t.none,
              role: event.actorRole === undefined ? t.none : roleName(event.actorRole, f),
            })}
          </p>

          {event.diff.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {event.diff.map((change) => (
                <li
                  key={`${event.id}-${change.field}`}
                  className={`num text-[13px] ${change.masked ? 'text-muted' : 'text-navy'}`}
                >
                  {f.plain(t.changed, {
                    field: fieldName(change.field, f),
                    from: displayValue(change, change.from, f),
                    to: displayValue(change, change.to, f),
                  })}
                  {change.masked && <span className="sr-only"> {t.maskedValue}</span>}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

/**
 * A recorded value, written the way the file writes it.
 *
 * The trail stores what the column stores — a salary as integer minor units,
 * a date as a plain date — because that is what is true. Reading it is where it
 * becomes "6 500,00 MAD": the entry says what a person did, so it should read the
 * way the screen they did it on reads.
 */
function displayValue(
  change: { field: string; masked: boolean },
  raw: string,
  f: Formatter,
): string {
  if (raw === '') {
    return f.t.employeeFile.changedEmpty;
  }

  if (change.masked) {
    return raw;
  }

  if (change.field === 'baseSalaryMinor') {
    const minor = Number.parseInt(raw, 10);
    return Number.isFinite(minor) ? f.money(minor) : raw;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return f.dateMedium(raw);
  }

  if (raw === 'true' || raw === 'false') {
    return raw === 'true' ? f.t.employeeFile.yes : f.t.employeeFile.no;
  }

  return raw;
}

/** A field's name as the file calls it, or the raw name if it is new here. */
function fieldName(field: string, f: Formatter): string {
  const fields = f.t.employeeFile.fields as Record<string, string | undefined>;
  return fields[field] ?? field;
}

/** The role someone was acting in, named the way the rest of the app names it. */
function roleName(role: string, f: Formatter): string {
  switch (role) {
    case 'admin':
      return f.t.roles['platform-admin'];
    case 'hr':
      return f.t.roles['hr-admin'];
    case 'manager':
      return f.t.roles.manager;
    default:
      return f.t.roles.employee;
  }
}
