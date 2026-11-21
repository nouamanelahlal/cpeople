import type { JSX } from 'react';
import type { Formatter } from '../../../lib/format';
import type { Kpi } from '../../../lib/home-data';
import { Icon } from './icons';

/** A tint per card, so the four are told apart at a glance and not by reading. */
const TINTS: Record<Kpi['key'], { card: string; ink: string }> = {
  headcount: { card: 'bg-sky-bg', ink: 'text-sky-ink' },
  present: { card: 'bg-leaf-bg', ink: 'text-leaf-ink' },
  leave: { card: 'bg-violet-bg', ink: 'text-violet-ink' },
  documents: { card: 'bg-amber-bg', ink: 'text-amber-ink' },
};

/** The four figures the day turns on (docs/design/home-dashboard.dc.html). */
export function KpiCards({ kpis, f }: { kpis: readonly Kpi[]; f: Formatter }): JSX.Element {
  const t = f.t.home.kpis;

  return (
    <section
      aria-label={t.label}
      className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]"
    >
      {kpis.map((kpi) => {
        const tint = TINTS[kpi.key];
        const suffixKey = `${kpi.key}Suffix` as const;
        const suffix = suffixKey in t ? f.text(t[suffixKey as 'presentSuffix'], kpi.values) : '';

        return (
          <a
            key={kpi.key}
            href="#"
            className={`relative flex flex-col gap-3 overflow-hidden rounded-[18px] border border-navy/[0.06] p-5 text-navy transition-[box-shadow,transform] duration-[250ms] ease-out hover:shadow-[0_10px_26px_rgba(15,25,55,0.08)] motion-safe:hover:-translate-y-0.5 ${tint.card}`}
          >
            <span className="relative flex items-center justify-between">
              <span className="text-sm font-semibold">{t[kpi.key]}</span>
              <span className={`grid size-9 place-items-center rounded-[10px] bg-white ${tint.ink}`}>
                <Icon name={kpi.icon} size={18} width={1.8} />
              </span>
            </span>

            <span className="num relative text-[34px] font-light leading-none tracking-[-0.02em]">
              {f.count(kpi.value)}
              {suffix !== '' && <span className="ms-1.5 text-[15px] text-body">{suffix}</span>}
            </span>

            <span className="relative text-[13px] text-body">
              {f.text(t[`${kpi.key}Note` as 'headcountNote'], kpi.values)}
            </span>
          </a>
        );
      })}
    </section>
  );
}
