import type { JSX } from 'react';
import type { IconName } from '../../../lib/home-data';
import { Icon } from '../../_shell/icons';

/** One figure on the home screen, already counted and already worded. */
export interface KpiView {
  readonly key: 'headcount' | 'leaveRequests' | 'contractsEnding' | 'documents';
  readonly icon: IconName;
  readonly value: string;
  readonly suffix?: string;
  readonly label: string;
  readonly note: string;
  readonly href: string;
}

/** A tint per card, so the four are told apart at a glance and not by reading. */
const TINTS: Record<KpiView['key'], { card: string; ink: string; wash: string }> = {
  headcount: { card: 'bg-sky-bg', ink: 'text-sky-ink', wash: 'bg-sky-wash' },
  // Same tint, same C mark, same size as the card it replaced: only what it
  // counts has changed.
  leaveRequests: { card: 'bg-leaf-bg', ink: 'text-leaf-ink', wash: 'bg-leaf-wash' },
  contractsEnding: { card: 'bg-violet-bg', ink: 'text-violet-ink', wash: 'bg-violet-wash' },
  documents: { card: 'bg-amber-bg', ink: 'text-amber-ink', wash: 'bg-amber-wash' },
};

/**
 * The four figures the day turns on (docs/design/home-dashboard.dc.html).
 *
 * Each one is a link to the list it counts, and the count and that list come
 * from the same question asked of the API, so they cannot disagree.
 */
export function KpiCards({ kpis, label }: { kpis: readonly KpiView[]; label: string }): JSX.Element {
  return (
    <section
      aria-label={label}
      className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]"
    >
      {kpis.map((kpi) => {
        const tint = TINTS[kpi.key];

        return (
          <a
            key={kpi.key}
            href={kpi.href}
            className={`group relative flex flex-col gap-3 overflow-hidden rounded-[18px] border border-navy/[0.06] p-5 text-navy transition-[box-shadow,transform] duration-[250ms] ease-out hover:shadow-[0_10px_26px_rgba(15,25,55,0.08)] motion-safe:hover:-translate-y-0.5 ${tint.card}`}
          >
            {/* The CPeople symbol in the bottom corner, painted in this card's own
                wash: the file gives the shape, the card gives the colour. */}
            <span
              aria-hidden="true"
              className={`cp-symbol-mark pointer-events-none absolute -bottom-3 -end-2.5 size-[170px] transition-transform duration-[350ms] ease-out motion-safe:group-hover:-translate-x-1 motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:-rotate-3 motion-reduce:transition-none ${tint.wash}`}
            />

            <span className="relative flex items-center justify-between">
              <span className="text-sm font-semibold">{kpi.label}</span>
              <span className={`grid size-9 place-items-center rounded-[10px] bg-white ${tint.ink}`}>
                <Icon name={kpi.icon} size={18} width={1.8} />
              </span>
            </span>

            <span className="num relative text-[34px] font-light leading-none tracking-[-0.02em]">
              {kpi.value}
              {kpi.suffix !== undefined && (
                <span className="ms-1.5 text-[15px] text-body">{kpi.suffix}</span>
              )}
            </span>

            <span className="relative text-[13px] text-body">{kpi.note}</span>
          </a>
        );
      })}
    </section>
  );
}
