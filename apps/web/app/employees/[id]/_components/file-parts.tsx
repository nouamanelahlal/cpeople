import type { JSX, ReactNode } from 'react';
import { MASK } from '@cpeople/shared';
import type { Formatter } from '../../../../lib/format';

/**
 * The pieces a file is drawn from (HR-01 spec 6.3).
 *
 * A file is a long list of "name: value", so that is one component, used by every
 * tab. A value the reader may not see is drawn as the mask — and it is the mask
 * all the way from the API, not a value with something painted over it.
 */
export interface Field {
  readonly label: string;
  readonly value: ReactNode;
  readonly note?: string;
  readonly masked?: boolean;
  readonly wide?: boolean;
}

export function FieldList({ fields, f }: { fields: readonly Field[]; f: Formatter }): JSX.Element {
  return (
    <dl className="m-0 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-8 gap-y-5">
      {fields.map((field) => (
        <div
          key={field.label}
          className={`flex flex-col gap-1 ${field.wide ? 'col-span-full' : ''}`}
        >
          <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
            {field.label}
          </dt>
          <dd
            className={`num m-0 text-sm ${field.masked ? 'text-muted' : 'text-navy'}`}
            {...(field.masked ? { title: f.t.employeeFile.maskedValue } : {})}
          >
            {field.value}
            {field.masked && <span className="sr-only"> {f.t.employeeFile.maskedValue}</span>}
          </dd>
          {field.note !== undefined && <p className="m-0 text-xs text-body">{field.note}</p>}
        </div>
      ))}
    </dl>
  );
}

/** A value that is on the file but not for this reader. */
export function Masked(): JSX.Element {
  return <span aria-hidden="true">{MASK}</span>;
}

/** One panel of the file: a heading, a sentence of context, and its fields. */
export function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-4 rounded-[20px] border border-card-border bg-white p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-navy">{title}</h2>
        {note !== undefined && <p className="m-0 text-[13px] text-body">{note}</p>}
      </div>
      {children}
    </section>
  );
}

const TONES = {
  active: 'bg-neutral-bg text-neutral-ink',
  onboarding: 'bg-info-bg text-info-ink',
  left: 'bg-surface-sunk text-body',
  quiet: 'bg-surface-quiet text-body',
  tint: 'bg-sky-bg text-sky-ink',
  warning: 'bg-warning-bg text-warning-ink',
} as const;

export function Pill({
  tone = 'quiet',
  children,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
}): JSX.Element {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-[5px] text-xs font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
