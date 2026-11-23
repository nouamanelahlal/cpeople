import { cookies } from 'next/headers';

/** Where the browser tells the server which timezone the person is actually in. */
export const TIME_ZONE_COOKIE = 'cpeople_tz';

/**
 * A fixed "now", for tests only.
 *
 * The home screen says good morning, so its rendering depends on the clock, and a
 * screenshot of it would otherwise change three times a day. A developer's checkout
 * and the end-to-end stack may pin the clock with this cookie; a deployed
 * environment ignores it entirely, the same way it ignores every other local-dev
 * shortcut (CLAUDE.md, "Settings that must never be set in a deployed environment").
 */
const CLOCK_COOKIE = 'cpeople_now';

export interface Clock {
  readonly now: Date;
  /** The reader's own timezone: what makes "good morning" true for them. */
  readonly timeZone: string;
}

export async function viewerClock(fallbackTimeZone: string): Promise<Clock> {
  const store = await cookies();

  const asked = store.get(TIME_ZONE_COOKIE)?.value;
  const timeZone = asked !== undefined && isTimeZone(asked) ? asked : fallbackTimeZone;

  return { now: pinnedNow(store.get(CLOCK_COOKIE)?.value) ?? new Date(), timeZone };
}

function pinnedNow(value: string | undefined): Date | null {
  if (value === undefined || process.env.CPEOPLE_LOCAL_DEV !== 'true') {
    return null;
  }

  const pinned = new Date(value);
  return Number.isNaN(pinned.getTime()) ? null : pinned;
}

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Morning, afternoon or evening where the reader is.
 *
 * Morning until midday, afternoon until six, evening after that — the boundaries
 * English and French both use, and the reason French needs only two greetings:
 * "Bonjour" covers the first two.
 */
export function greetingKey(clock: Clock): 'morning' | 'afternoon' | 'evening' {
  const hour = Number.parseInt(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hour12: false,
      timeZone: clock.timeZone,
    }).format(clock.now),
    10,
  );

  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * The calendar date in a given timezone, as "2026-11-18".
 *
 * Which day it is depends on where you are standing, so working out how many days
 * are left until pay day starts here rather than with a UTC timestamp.
 */
export function isoDateIn(timeZone: string, at: Date): string {
  // en-CA writes dates the way ISO does.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}
