import type { JSX } from 'react';
import type { Formatter } from '../../../lib/format';
import type { Connection } from '../../../lib/home-data';
import { Icon } from '../../_shell/icons';

/**
 * The declarations and the systems CPeople talks to (M16, M17, M18, M10).
 *
 * Each one says when it last worked and what it is waiting for, because the first
 * question on a payroll morning is whether yesterday's data went where it should.
 */
export function Connections({
  connections,
  f,
}: {
  connections: readonly Connection[];
  f: Formatter;
}): JSX.Element {
  const t = f.t.home.connections;

  return (
    <section
      aria-labelledby="connections-title"
      className="flex flex-col gap-4 rounded-[20px] border border-card-border bg-white p-6"
    >
      <h2 id="connections-title" className="text-lg font-semibold text-navy">
        {t.title}
      </h2>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {connections.map((connection) => (
          <div
            key={connection.key}
            className="flex items-start gap-3.5 rounded-[14px] bg-surface-sunk p-4"
          >
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full ${
                connection.state === 'ok' ? 'bg-ok-bg text-ok-ink' : 'bg-warning-bg text-warning-ink'
              }`}
            >
              <Icon
                name={connection.state === 'ok' ? 'check' : 'alert'}
                size={15}
                width={2.4}
              />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-semibold text-navy">{t[connection.key]}</span>
              <span className="num text-[13px] leading-[1.45] text-body">
                {f.text(t[`${connection.key}Note` as 'sapNote'], connection.values)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
