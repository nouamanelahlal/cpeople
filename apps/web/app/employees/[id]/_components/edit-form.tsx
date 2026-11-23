'use client';

import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import { saveEmployee } from '../actions';

/**
 * The form that changes a file (HR-01 spec 6.3).
 *
 * A plain form posting to a server action: the fields it shows are the fields it
 * sends, and the API decides which of them this person may actually change. The
 * only thing the browser adds is the guard — leaving with something typed and
 * unsaved asks first, which is the one part of "unsaved changes" a server cannot
 * do.
 */
export function EditForm({
  id,
  tab,
  cancelHref,
  save,
  cancel,
  warning,
  children,
}: {
  id: string;
  tab: string;
  cancelHref: string;
  save: string;
  cancel: string;
  warning: string;
  children: ReactNode;
}): JSX.Element {
  const [dirty, setDirty] = useState(false);
  const saving = useRef(false);

  useEffect(() => {
    if (!dirty) {
      return undefined;
    }

    const ask = (event: BeforeUnloadEvent) => {
      if (saving.current) return;
      event.preventDefault();
    };

    window.addEventListener('beforeunload', ask);
    return () => window.removeEventListener('beforeunload', ask);
  }, [dirty]);

  return (
    <form
      action={saveEmployee}
      onInput={() => setDirty(true)}
      onSubmit={() => {
        saving.current = true;
      }}
      className="flex flex-col gap-6"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="tab" value={tab} />

      {children}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="h-11 rounded-xl bg-blue px-5 text-sm font-semibold text-white transition-[background-color,box-shadow] duration-200 ease-out hover:bg-blue-hover"
        >
          {save}
        </button>
        <a
          href={cancelHref}
          className="quiet-button h-11 border-button-border px-4 text-[13px] font-semibold text-navy"
        >
          {cancel}
        </a>
        {dirty && <span className="text-[13px] text-body">{warning}</span>}
      </div>
    </form>
  );
}

/** One labelled input, laid out like the field it replaces. */
export function EditField({
  name,
  label,
  defaultValue,
  type = 'text',
  required = false,
  note,
  wide = false,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  note?: string;
  wide?: boolean;
}): JSX.Element {
  return (
    <label className={`flex flex-col gap-1.5 ${wide ? 'col-span-full' : ''}`}>
      <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue ?? ''}
        required={required}
        className="h-11 rounded-xl border border-field-border bg-white px-3.5 text-sm text-navy"
      />
      {note !== undefined && <span className="text-xs text-body">{note}</span>}
    </label>
  );
}

/** A choice between a short list of values. */
export function EditChoice({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: readonly { value: string; label: string }[];
}): JSX.Element {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue ?? ''}
        className="h-11 rounded-xl border border-field-border bg-white px-3 text-sm text-navy"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A yes or no, which sends nothing at all when it is no. */
export function EditSwitch({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}): JSX.Element {
  return (
    <label className="flex items-center gap-2.5 self-end pb-2.5 text-sm text-navy">
      {/* Says the field was on the form even when the answer is no. */}
      <input type="hidden" name={`${name}Shown`} value="1" />
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-4 accent-[var(--color-blue)]"
      />
      {label}
    </label>
  );
}

/** The grid the fields sit in, matching the one a read-only tab uses. */
export function EditGrid({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-x-8 gap-y-5">
      {children}
    </div>
  );
}
