'use client';

import { useState, type JSX } from 'react';
import { CHART_HEIGHT, CHART_WIDTH, type ChartPoint } from '../../../lib/chart';

export interface CostChartMonth extends ChartPoint {
  /** "Nov" under the chart. */
  readonly label: string;
  /** "November 2026", "MAD 1,285k", in the tooltip. */
  readonly title: string;
  readonly gross: string;
  readonly charges: string;
  /** "Show November 2026", for the button a keyboard reaches. */
  readonly pick: string;
}

/**
 * Payroll cost over a year, with a month under the pointer
 * (docs/design/home-dashboard.dc.html).
 *
 * The paths arrive finished from the server; this only moves the marker line, the
 * two dots and the tooltip, so hovering costs nothing but a repaint. Each month is
 * also a button, so the same figures are reachable by keyboard — and the figures
 * themselves are in the table-shaped description the SVG carries, for anyone who
 * cannot see any of it.
 */
export function CostChart({
  months,
  paths,
  ticks,
  labels,
  description,
}: {
  months: readonly CostChartMonth[];
  paths: { gross: string; grossArea: string; charges: string; chargesArea: string };
  ticks: readonly string[];
  labels: { title: string; subtitle: string; gross: string; charges: string };
  description: string;
}): JSX.Element {
  const [focused, setFocused] = useState(months.length - 1);
  const month = months[focused] ?? months[months.length - 1]!;

  // Late in the year the tooltip would hang off the end, so it flips to the left.
  const flip = focused >= months.length - 4;

  return (
    <section
      aria-labelledby="cost-title"
      className="flex min-w-0 shrink grow-[2] basis-[560px] flex-col gap-5 rounded-[20px] border border-card-border bg-white p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="cost-title" className="text-lg font-semibold text-navy">
            {labels.title}
          </h2>
          <p className="text-[13px] text-body">{labels.subtitle}</p>
        </div>
        <p className="flex gap-4.5 text-[13px] text-body">
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="size-3 rounded-full bg-chart-gross" />
            {labels.gross}
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="size-3 rounded-full bg-chart-charges opacity-60" />
            {labels.charges}
          </span>
        </p>
      </div>

      <div className="flex gap-3">
        <div
          aria-hidden="true"
          className="num -mt-[7px] flex h-[220px] flex-col justify-between text-end text-xs text-body"
        >
          {ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="relative h-[220px]">
            <svg
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={description}
              className="absolute inset-0 size-full overflow-visible"
            >
              <defs>
                <linearGradient id="cp-fill-gross" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--color-chart-gross)" stopOpacity="0.26" />
                  <stop offset="1" stopColor="var(--color-chart-gross)" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="cp-fill-charges" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--color-cyan)" stopOpacity="0.38" />
                  <stop offset="1" stopColor="var(--color-cyan)" stopOpacity="0.04" />
                </linearGradient>
              </defs>

              {[0, 1, 2].map((line) => (
                <line
                  key={line}
                  x1="0"
                  x2={CHART_WIDTH}
                  y1={0.5 + (line * (CHART_HEIGHT - 1)) / 3}
                  y2={0.5 + (line * (CHART_HEIGHT - 1)) / 3}
                  stroke="var(--color-chart-grid)"
                  strokeDasharray="4 6"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <line
                x1="0"
                x2={CHART_WIDTH}
                y1={CHART_HEIGHT - 0.5}
                y2={CHART_HEIGHT - 0.5}
                stroke="var(--color-chart-axis)"
                vectorEffect="non-scaling-stroke"
              />

              <path d={paths.grossArea} fill="url(#cp-fill-gross)" />
              <path d={paths.chargesArea} fill="url(#cp-fill-charges)" />
              <line
                x1={month.x}
                x2={month.x}
                y1="0"
                y2={CHART_HEIGHT}
                stroke="var(--color-chart-gross)"
                strokeOpacity="0.35"
                strokeDasharray="3 4"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={paths.gross}
                fill="none"
                stroke="var(--color-chart-gross)"
                strokeWidth="2.5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d={paths.charges}
                fill="none"
                stroke="var(--color-chart-charges)"
                strokeWidth="2.5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            <span
              aria-hidden="true"
              className="absolute -ms-1.5 -mt-1.5 size-3 rounded-full border-[3px] border-chart-gross bg-white"
              style={{ insetInlineStart: `${month.xPercent}%`, top: month.grossY }}
            />
            <span
              aria-hidden="true"
              className="absolute -ms-1.5 -mt-1.5 size-3 rounded-full border-[3px] border-chart-charges bg-white"
              style={{ insetInlineStart: `${month.xPercent}%`, top: month.chargesY }}
            />

            {/* One target per month: a pointer hovers it, a keyboard tabs to it. */}
            <div className="absolute inset-0 grid grid-cols-12">
              {months.map((entry) => (
                <button
                  key={entry.index}
                  type="button"
                  aria-label={entry.pick}
                  aria-pressed={entry.index === focused}
                  onMouseEnter={() => setFocused(entry.index)}
                  onFocus={() => setFocused(entry.index)}
                  className="h-full cursor-default rounded-sm"
                />
              ))}
            </div>

            <div
              className={`num pointer-events-none absolute top-[72px] flex flex-col gap-1.5 whitespace-nowrap rounded-xl bg-navy px-3.5 py-2.5 text-xs text-white shadow-[0_8px_24px_rgba(15,25,55,0.18)] ${
                flip ? '-translate-x-[calc(100%+16px)]' : 'translate-x-4'
              }`}
              style={{ insetInlineStart: `${month.xPercent}%` }}
            >
              <span className="font-semibold">{month.title}</span>
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="size-2 rounded-full bg-light-cyan" />
                {labels.gross} {month.gross}
              </span>
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="size-2 rounded-full bg-[#9ed8ec]" />
                {labels.charges} {month.charges}
              </span>
            </div>
          </div>

          {/* On a narrow screen only every second month is named: twelve labels in
              300 pixels is a smudge, and the months in between are still readable
              from the ones around them. */}
          <div className="grid grid-cols-12">
            {months.map((entry) => (
              <span
                key={entry.index}
                className={`text-center text-xs max-[900px]:[&:nth-child(odd)]:invisible ${
                  entry.index === focused ? 'font-semibold text-navy' : 'text-body'
                }`}
              >
                {entry.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
