'use client';

import type { FormEvent, JSX, ReactNode } from 'react';

/**
 * The filter bar's form (HR-01 spec 6.2).
 *
 * A plain `GET` form: the filters end up in the address, which is what makes a
 * filtered list something you can share, keep, reload and link to from the home
 * screen's cards. The only thing the browser adds is applying a filter as soon as
 * it is chosen, instead of asking for a second click on a button — and because
 * the form works without that, the button is still there for anyone whose
 * scripting is off or who is working through the keyboard.
 */
export function FilterForm({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  function onChange(event: FormEvent<HTMLFormElement>): void {
    const changed = event.target;

    // Only the controls that are a single decision. A search box fires `change`
    // when it loses focus, and submitting then would take the page out from
    // under someone who was only looking away.
    const settled =
      changed instanceof HTMLSelectElement ||
      (changed instanceof HTMLInputElement && changed.type === 'checkbox');

    if (settled) {
      event.currentTarget.requestSubmit();
    }
  }

  return (
    <form method="get" action="/employees" aria-label={label} className={className} onChange={onChange}>
      {children}
    </form>
  );
}
