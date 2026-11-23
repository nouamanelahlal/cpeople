import type { JSX } from 'react';
import type { IconName } from '../../lib/home-data';
import { Icon } from './icons';

/**
 * A module that is not here yet (HR-01, spec 6.13).
 *
 * Every item in the menu goes somewhere, and what it goes to says plainly what the
 * module will do and when it is shown. Nothing on this page pretends to work:
 * the alternative — a link that does nothing — is the thing the HR-01 spec rules
 * out.
 */
export function ModulePlaceholder({
  icon,
  title,
  body,
  when,
}: {
  icon: IconName;
  title: string;
  body: string;
  when: string;
}): JSX.Element {
  return (
    <section className="flex flex-col items-start gap-4 rounded-[20px] border border-card-border bg-white p-8 sm:p-10">
      <span className="grid size-12 place-items-center rounded-2xl bg-tint text-blue">
        <Icon name={icon} size={24} />
      </span>

      <h2 className="text-xl font-semibold text-navy">{title}</h2>
      <p className="max-w-prose text-[15px] leading-relaxed text-body">{body}</p>

      <span className="rounded-full bg-surface-quiet px-3 py-1.5 text-[13px] font-semibold text-body">
        {when}
      </span>
    </section>
  );
}
