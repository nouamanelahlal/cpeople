import type { JSX } from 'react';
import type { IconName, Tone } from '../../../lib/home-data';
import { Icon } from '../../_shell/icons';

/** One thing waiting, already worded and already pointed at its file. */
export interface TaskView {
  readonly id: string;
  readonly icon: IconName;
  readonly tone: Tone;
  readonly title: string;
  readonly detail: string;
  readonly status: string;
  readonly action: string;
  readonly href: string;
}

const TONES: Record<Tone, string> = {
  warning: 'bg-warning-bg text-warning-ink',
  info: 'bg-info-bg text-info-ink',
  neutral: 'bg-neutral-bg text-neutral-ink',
};

/**
 * What this person has to deal with today, soonest first (HR-01 spec 6.12).
 *
 * Every row is real: a fixed term about to run out, an onboarding step past its
 * date, a document that has expired. The button opens the file it belongs to,
 * which is the whole point of the list.
 */
export function Tasks({
  tasks,
  title,
  openInbox,
  empty,
  inboxHref,
}: {
  tasks: readonly TaskView[];
  title: string;
  openInbox: string;
  empty: string;
  inboxHref: string;
}): JSX.Element {
  return (
    <section
      aria-labelledby="tasks-title"
      className="min-w-0 shrink grow-[2] basis-[560px] rounded-[20px] border border-card-border bg-white p-6"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="tasks-title" className="text-lg font-semibold text-navy">
          {title}
        </h2>
        <a href={inboxHref} className="text-sm font-semibold">
          {openInbox}
        </a>
      </div>

      {tasks.length === 0 ? (
        <p className="border-t border-line py-6 text-sm text-body">{empty}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line py-3.5"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-quiet text-navy">
                <Icon name={task.icon} size={18} width={1.8} />
              </span>

              <span className="flex min-w-0 shrink grow basis-[240px] flex-col gap-[3px]">
                <span className="text-sm font-semibold text-navy">{task.title}</span>
                <span className="num text-[13px] text-body">{task.detail}</span>
              </span>

              <span
                className={`rounded-full px-2.5 py-[5px] text-xs font-semibold ${TONES[task.tone]}`}
              >
                {task.status}
              </span>

              <a
                href={task.href}
                className="quiet-button h-10 border-button-border px-4 text-[13px] font-semibold text-navy"
              >
                {task.action}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
