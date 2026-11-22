import Image from 'next/image';
import type { JSX } from 'react';
import type { Formatter } from '../../../lib/format';
import type { HomeData } from '../../../lib/home-data';
import mark from '../../../public/icon-512.png';
import { Icon } from '../../_shell/icons';

/**
 * The payroll month: where it is, what it costs, and what happens next
 * (M13 / HR-05, drawn as docs/design/home-dashboard.dc.html).
 *
 * The one loud surface on the screen, in brand blue with white text — the only text
 * colour that passes AA on it — so hierarchy inside it is made with size and weight
 * (cpeople-design, "App theme").
 */
export function PayrollPanel({
  data,
  f,
  daysToPay,
}: {
  data: HomeData;
  f: Formatter;
  daysToPay: number;
}): JSX.Element {
  const t = f.t.home.run;
  const { run } = data;

  return (
    <section
      aria-labelledby="run-title"
      className="relative flex flex-col gap-8 overflow-hidden rounded-3xl bg-blue p-[clamp(24px,3vw,40px)] text-white"
    >
      {/* The CPeople mark, bled off the corner so the panel carries the brand
          without a second thing to read. */}
      <Image
        src={mark}
        alt=""
        aria-hidden="true"
        priority
        className="pointer-events-none absolute -bottom-40 -end-24 h-[620px] w-auto max-w-none opacity-[0.13]"
      />

      <div className="relative flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
        <div className="flex max-w-[560px] flex-col gap-2.5">
          <p className="flex items-center gap-2.5 text-[13px]">
            <span aria-hidden="true" className="size-2 rounded-full bg-white" />
            <span className="num">
              {f.text(t.payDate, {
                days: { kind: 'count', value: daysToPay },
                date: { kind: 'dayMonth', iso: run.payDate },
              })}
            </span>
          </p>
          <h2
            id="run-title"
            className="text-[clamp(30px,3.4vw,44px)] font-light leading-[1.1] tracking-[-0.02em]"
          >
            {f.text(t.title, { month: { kind: 'monthYear', iso: run.month } })}
          </h2>
          <p className="num text-[15px] leading-[1.55]">
            {f.text(t.summary, {
              version: { kind: 'count', value: run.version },
              time: { kind: 'time', iso: run.calculatedAt },
              employees: { kind: 'count', value: run.employees },
              points: { kind: 'count', value: run.pointsToCheck },
            })}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="h-12 rounded-xl border border-white/70 px-[22px] text-sm font-semibold text-white transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out hover:border-white hover:bg-white/10 motion-safe:hover:-translate-y-px"
          >
            {t.seeResults}
          </button>
          <button
            type="button"
            className="h-12 rounded-xl bg-white px-6 text-sm font-semibold text-navy transition-[background-color,box-shadow,transform] duration-200 ease-out hover:bg-tint hover:shadow-[0_8px_22px_rgba(6,10,20,0.22)] motion-safe:hover:-translate-y-px"
          >
            {t.continueReview}
          </button>
        </div>
      </div>

      <div className="relative grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        {run.figures.map((figure) => {
          const amount = f.moneyParts(figure.minor);
          return (
            <div
              key={figure.key}
              className="flex flex-col gap-1.5 rounded-2xl border border-white/20 bg-navy/[0.16] px-5 py-[18px]"
            >
              <span className="text-[13px]">{t.figures[figure.key]}</span>
              <span className="num text-[26px] font-light tracking-[-0.01em]">
                {amount.unitFirst && (
                  <span className="me-1.5 text-sm font-medium">{amount.unit}</span>
                )}
                {amount.amount}
                {!amount.unitFirst && (
                  <span className="ms-1.5 text-sm font-medium">{amount.unit}</span>
                )}
              </span>
              <span className="num text-xs">
                {f.text(t.figures[`${figure.key}Note` as const], figure.values)}
              </span>
            </div>
          );
        })}
      </div>

      <ol
        aria-label={t.steps}
        className="relative m-0 grid list-none gap-2.5 overflow-x-auto p-0 [grid-template-columns:repeat(7,minmax(110px,1fr))]"
      >
        {run.steps.map((step) => (
          <li
            key={step.key}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className="flex min-w-[110px] flex-col gap-2.5"
          >
            <span
              aria-hidden="true"
              className={`h-1 rounded ${
                step.state === 'done'
                  ? 'bg-white'
                  : step.state === 'current'
                    ? 'bg-[linear-gradient(90deg,#fff_50%,rgba(255,255,255,0.3)_50%)]'
                    : 'bg-white/30'
              }`}
            />
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              {step.state === 'done' && <Icon name="check" size={16} width={2.4} />}
              {t.step[step.key]}
            </span>
            <span className="num text-xs">
              {f.text(t.step[`${step.key}Note` as const], step.values)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
