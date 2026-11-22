import type { JSX } from 'react';
import type { Formatter } from '../../../lib/format';
import type { Task, Tone } from '../../../lib/home-data';
import { Icon } from '../../_shell/icons';

const TONES: Record<Tone, string> = {
  warning: 'bg-warning-bg text-warning-ink',
  info: 'bg-info-bg text-info-ink',
  neutral: 'bg-neutral-bg text-neutral-ink',
};

/**
 * What this person has to deal with today, in the order it matters
 * (docs/design/home-dashboard.dc.html).
 *
 * Each row says what it is, what it is waiting for, and the one thing to do about
 * it, so nothing on the list needs opening to be understood.
 */
export function Tasks({ tasks, f }: { tasks: readonly Task[]; f: Formatter }): JSX.Element {
  const t = f.t.home.tasks;

  return (
    <section
      aria-labelledby="tasks-title"
      className="min-w-0 shrink grow-[2] basis-[560px] rounded-[20px] border border-card-border bg-white p-6"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="tasks-title" className="text-lg font-semibold text-navy">
          {t.title}
        </h2>
        <a href="#" className="text-sm font-semibold">
          {t.openInbox}
        </a>
      </div>

      <ul className="m-0 flex list-none flex-col p-0">
        {tasks.map((task) => {
          const copy = t[task.key];
          return (
            <li
              key={task.key}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line py-3.5"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-quiet text-navy">
                <Icon name={task.icon} size={18} width={1.8} />
              </span>

              <span className="flex min-w-0 shrink grow basis-[240px] flex-col gap-[3px]">
                <span className="text-sm font-semibold text-navy">
                  {f.text(copy.title, task.values)}
                </span>
                <span className="num text-[13px] text-body">
                  {f.text(copy.detail, task.values)}
                </span>
              </span>

              <span
                className={`rounded-full px-2.5 py-[5px] text-xs font-semibold ${TONES[task.tone]}`}
              >
                {f.text(copy.status, task.values)}
              </span>

              <button
                type="button"
                className="quiet-button h-10 border-button-border px-4 text-[13px] font-semibold text-navy"
              >
                {copy.action}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
