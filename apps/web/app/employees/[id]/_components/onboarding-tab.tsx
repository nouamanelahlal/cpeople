import type { JSX } from 'react';
import type { Onboarding, OnboardingTask } from '../../../../lib/employee-file';
import type { Formatter } from '../../../../lib/format';
import { activateEmployee, tickTask } from '../onboarding-actions';
import { Pill } from './file-parts';

/**
 * What has to happen before somebody starts (HR-01 spec 6.8).
 *
 * Grouped by who does it, because that is how it gets done: HR collects the
 * papers, the manager does the induction, an administrator makes the account.
 * Each line says when it is due and, once it is done, who did it and when —
 * "it was done" and "somebody says it was done" are different claims, and a
 * checklist is only worth keeping if it records the second.
 *
 * The file becomes active when everything required has happened, and not
 * before: that is the whole point of the list.
 */
const OWNERS = ['hr', 'manager', 'admin', 'employee'] as const;

export function OnboardingTab({
  data,
  employeeId,
  name,
  f,
}: {
  data: Onboarding;
  employeeId: string;
  name: string;
  f: Formatter;
}): JSX.Element {
  const t = f.t.onboarding;
  const waiting = data.tasks.filter((task) => task.mandatory && task.status === 'todo').length;

  if (data.tasks.length === 0) {
    return <p className="m-0 text-sm text-body">{t.empty}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="num text-sm font-semibold text-navy">
          {f.plain(t.progress, { done: f.count(data.done), total: f.count(data.total) })}
        </span>
        <span
          aria-hidden="true"
          className="h-2 min-w-[160px] flex-1 overflow-hidden rounded-lg bg-line"
        >
          <span
            className="block h-full rounded-lg bg-cyan"
            style={{ inlineSize: `${Math.round((data.done / Math.max(1, data.total)) * 100)}%` }}
          />
        </span>
      </div>

      {OWNERS.map((owner) => {
        const tasks = data.tasks.filter((task) => task.ownerRole === owner);
        if (tasks.length === 0) return null;

        return (
          <section key={owner} className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">
              {t.owner[owner]}
            </h3>

            <ul className="m-0 flex list-none flex-col p-0">
              {tasks.map((task) => (
                <Task key={task.id} task={task} employeeId={employeeId} f={f} />
              ))}
            </ul>
          </section>
        );
      })}

      {data.status === 'onboarding' && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          {data.mayActivate ? (
            <>
              <form action={activateEmployee}>
                <input type="hidden" name="id" value={employeeId} />
                <button
                  type="submit"
                  className="h-11 rounded-xl bg-blue px-5 text-sm font-semibold text-white transition-[background-color] duration-200 ease-out hover:bg-blue-hover"
                >
                  {t.activate}
                </button>
              </form>
              <span className="text-[13px] text-body">{t.activateNote}</span>
            </>
          ) : (
            <span className="text-[13px] text-body">
              {f.plain(t.waiting, { count: f.count(waiting) })}
            </span>
          )}
        </div>
      )}

      {data.status === 'active' && (
        <p className="m-0 border-t border-line pt-4 text-[13px] text-body">
          {f.plain(t.activated, { name })}
        </p>
      )}
    </div>
  );
}

function Task({
  task,
  employeeId,
  f,
}: {
  task: OnboardingTask;
  employeeId: string;
  f: Formatter;
}): JSX.Element {
  const t = f.t.onboarding;
  const late = task.status === 'todo' && task.daysLeft < 0;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line py-3 first:border-t-0">
      <span className="flex min-w-0 shrink grow basis-[280px] flex-col gap-0.5">
        <span
          className={`text-sm ${task.status === 'done' ? 'text-body line-through' : 'font-semibold text-navy'}`}
        >
          {task.title}
        </span>
        <span className="num text-xs text-body">
          {task.status === 'done' && task.doneAt
            ? f.plain(t.doneBy, { name: task.doneBy ?? '', date: f.dateTime(task.doneAt) })
            : f.plain(t.due, { date: f.dateMedium(task.dueDate) })}
        </span>
      </span>

      {task.status === 'todo' && late && (
        <Pill tone="warning">{f.plain(t.late, { days: f.count(Math.abs(task.daysLeft)) })}</Pill>
      )}
      {task.status === 'todo' && !task.mandatory && <Pill>{t.optional}</Pill>}

      {task.status === 'done' ? (
        <Pill tone="active">✓</Pill>
      ) : task.mayTick ? (
        <form action={tickTask}>
          <input type="hidden" name="id" value={employeeId} />
          <input type="hidden" name="taskId" value={task.id} />
          <button
            type="submit"
            className="quiet-button h-10 border-button-border px-4 text-[13px] font-semibold text-navy"
          >
            {t.tick}
          </button>
        </form>
      ) : (
        <span className="text-xs text-muted">{t.notYours}</span>
      )}
    </li>
  );
}
