import type { CostMonth } from './home-data';

/** The drawing area, in the chart's own coordinates. */
export const CHART_WIDTH = 1000;
export const CHART_HEIGHT = 220;

/** Four grid lines: 0, half, one, one and a half million dirhams. */
export const GRID_STEPS = 4;

export interface ChartPoint {
  readonly index: number;
  /** Where the month sits across the chart, as a percentage of its width. */
  readonly xPercent: number;
  readonly x: number;
  readonly grossY: number;
  readonly chargesY: number;
}

export interface CostChart {
  readonly max: number;
  readonly points: readonly ChartPoint[];
  readonly grossLine: string;
  readonly grossArea: string;
  readonly chargesLine: string;
  readonly chargesArea: string;
  /** The values the y axis is labelled with, highest first, in major units. */
  readonly ticks: readonly number[];
}

/**
 * The payroll-cost chart, worked out once on the server.
 *
 * A Catmull-Rom spline through the monthly totals, written as cubic Béziers: twelve
 * months of payroll move gently, and straight segments between them would invent
 * corners that the figures do not have. The browser is handed finished paths, so
 * hovering a month only moves a line and a tooltip.
 */
export function costChart(months: readonly CostMonth[]): CostChart {
  const major = months.map((month) => ({
    gross: month.grossMinor / 100,
    charges: month.chargesMinor / 100,
  }));

  // A round ceiling above the tallest month, so the grid lines are readable
  // numbers rather than whatever the data happens to reach.
  const tallest = Math.max(...major.map((month) => month.gross));
  const step = 500_000;
  const max = Math.max(step, Math.ceil(tallest / step) * step);

  const x = (index: number) => ((index + 0.5) / months.length) * CHART_WIDTH;
  const y = (value: number) => CHART_HEIGHT - (value / max) * CHART_HEIGHT;

  const points = major.map((month, index) => ({
    index,
    x: x(index),
    xPercent: (x(index) / CHART_WIDTH) * 100,
    grossY: y(month.gross),
    chargesY: y(month.charges),
  }));

  const gross = spline(points.map((point) => [point.x, point.grossY]));
  const charges = spline(points.map((point) => [point.x, point.chargesY]));

  const ticks = Array.from({ length: GRID_STEPS }, (_, index) => max - (index * max) / (GRID_STEPS - 1));

  return {
    max,
    points,
    grossLine: gross.line,
    grossArea: gross.area,
    chargesLine: charges.line,
    chargesArea: charges.area,
    ticks,
  };
}

function spline(points: readonly (readonly [number, number])[]): { line: string; area: string } {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  let line = `M${round(first[0])},${round(first[1])}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const before = points[index - 1] ?? points[index]!;
    const from = points[index]!;
    const to = points[index + 1]!;
    const after = points[index + 2] ?? to;

    const c1x = from[0] + (to[0] - before[0]) / 6;
    const c1y = from[1] + (to[1] - before[1]) / 6;
    const c2x = to[0] - (after[0] - from[0]) / 6;
    const c2y = to[1] - (after[1] - from[1]) / 6;

    line += ` C${round(c1x)},${round(c1y)} ${round(c2x)},${round(c2y)} ${round(to[0])},${round(to[1])}`;
  }

  return {
    line,
    area: `${line} L${round(last[0])},${CHART_HEIGHT} L${round(first[0])},${CHART_HEIGHT} Z`,
  };
}

function round(value: number): string {
  return value.toFixed(1);
}
