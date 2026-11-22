import { DEMO_TODAY } from '@cpeople/db';

/**
 * What day it is, for everything the API counts (HR-01 spec 3.4).
 *
 * The demo is given on a fixed day and its data is written around that day, so
 * the figures only tell their story when "today" is that day. `CPEOPLE_DEMO_TODAY`
 * pins it, and a developer's checkout or a Dev environment is the only place that
 * is honoured: anywhere else the clock is the clock.
 */
export function demoToday(now: Date = new Date()): string {
  const pinned = process.env.CPEOPLE_DEMO_TODAY;

  if (pinned !== undefined && demoClockAllowed()) {
    const parsed = new Date(`${pinned}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return plainDate(parsed);
    }
  }

  return plainDate(now);
}

/** The seeded demo day, for anything that needs to know what the data assumes. */
export const DEMO_DATA_TODAY = DEMO_TODAY;

/**
 * Pinning the clock is a demo convenience, and a way to make a system lie about
 * dates. It is therefore refused outside a developer's checkout and Dev.
 */
export function demoClockAllowed(): boolean {
  return process.env.CPEOPLE_LOCAL_DEV === 'true' || process.env.CPEOPLE_ENV === 'dev';
}

/** A date as the day it is, with no time and no timezone: "2026-11-23". */
export function plainDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
