'use client';

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type JSX,
} from 'react';
import { WELCOME_COOKIE, WELCOME_LAYERS, WELCOME_WORDMARK } from '../../lib/welcome';

/**
 * The welcome animation, played once after a sign-in
 * (docs/welcome-animation/design/welcome-animation.dc.html).
 *
 * The icon builds itself: the tile arrives, the C draws along its curve, the three
 * people pop in, and the whole thing becomes the original artwork with the wordmark
 * beside it. Then it gets out of the way.
 *
 * It is only ever decoration over a page that has already loaded. Nothing here
 * waits for it: the dashboard is underneath from the first frame, a click or a key
 * skips it, and if anything goes wrong the overlay leaves anyway (the stylesheet
 * has a last-resort rule that removes it after six seconds).
 */

/** When each step starts, in milliseconds. The last one ends at 2.7s. */
const STEPS = {
  tile: 40,
  sweep: 400,
  people: 1_000,
  logo: 1_550,
  leave: 2_250,
  gone: 2_700,
} as const;

/** Reduced motion: the finished logo, held, then gone. No drawing, no bouncing. */
const STILL = { show: 0, hold: 600, gone: 900 } as const;

/** Where each person springs from, as the README gives them. */
const PIVOTS = ['18.4% 59.2%', '41.2% 44.7%', '68.8% 40%'] as const;

/** Whether this person wants movement at all, watched rather than sampled once. */
const STILLNESS = '(prefers-reduced-motion: reduce)';

function subscribeToMotion(listener: () => void): () => void {
  const query = window.matchMedia(STILLNESS);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

const wantsMotion = () => !window.matchMedia(STILLNESS).matches;

type Phase = 'start' | 'tile' | 'sweep' | 'people' | 'logo' | 'leave' | 'gone';

const ORDER: Phase[] = ['start', 'tile', 'sweep', 'people', 'logo', 'leave', 'gone'];
const reached = (phase: Phase, step: Phase) => ORDER.indexOf(phase) >= ORDER.indexOf(step);

export function WelcomeOverlay({
  play,
  label,
  skip,
}: {
  play: boolean;
  label: string;
  skip: string;
}): JSX.Element | null {
  // Decided once, at mount, and never again. The page re-renders for its own
  // reasons while this is playing — the timezone correction is one — and by then
  // the cookie that started it is gone; reading the prop again would take the
  // animation off the screen half way through.
  const [playing] = useState(play);
  const [phase, setPhase] = useState<Phase>('start');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // The server cannot know; it assumes movement and the browser corrects it before
  // anything has moved.
  const motion = useSyncExternalStore(subscribeToMotion, wantsMotion, () => true);

  useEffect(() => {
    if (!playing) {
      return undefined;
    }

    // Consumed on sight: from here on this is a page like any other, and a reload
    // shows the dashboard with no ceremony.
    document.cookie = `${WELCOME_COOKIE}=; path=/; max-age=0; samesite=lax`;

    const still = !wantsMotion();

    const after = (ms: number, go: Phase) => {
      timers.current.push(setTimeout(() => setPhase(go), ms));
    };

    if (still) {
      // Locked, like the moving version, but never scaled.
      document.documentElement.dataset.welcome = 'still';
      after(STILL.show, 'logo');
      after(STILL.hold, 'leave');
      after(STILL.gone, 'gone');
    } else {
      document.documentElement.dataset.welcome = 'playing';
      // One frame later, so the browser has something to move away from.
      timers.current.push(setTimeout(() => setPhase('tile'), STEPS.tile));
      after(STEPS.sweep, 'sweep');
      after(STEPS.people, 'people');
      after(STEPS.logo, 'logo');
      after(STEPS.leave, 'leave');
      after(STEPS.gone, 'gone');
    }

    return () => {
      for (const timer of timers.current) clearTimeout(timer);
      timers.current = [];
      delete document.documentElement.dataset.welcome;
    };
  }, [playing]);

  // Leaving: the dashboard settles as the overlay fades, and the keyboard lands on
  // the page that is now in front of the person.
  useEffect(() => {
    if (phase === 'leave') {
      document.documentElement.dataset.welcome = 'settling';
    }

    if (phase === 'gone') {
      delete document.documentElement.dataset.welcome;
      document.getElementById('main')?.focus({ preventScroll: true });
    }
  }, [phase]);

  function skipToEnd(): void {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
    setPhase('leave');
    timers.current.push(setTimeout(() => setPhase('gone'), 250));
  }

  useEffect(() => {
    if (phase === 'gone') return undefined;

    const onKey = (event: KeyboardEvent) => {
      if (['Escape', 'Enter', ' ', 'Spacebar'].includes(event.key)) skipToEnd();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  if (!playing || phase === 'gone') {
    return null;
  }

  const [tile, c, personLeft, personMiddle, personRight, finalIcon] = WELCOME_LAYERS;
  const people = [personLeft, personMiddle, personRight] as const;

  const shown = reached(phase, 'tile');
  const drawn = reached(phase, 'sweep');
  const popped = reached(phase, 'people');
  const finished = reached(phase, 'logo');
  const leaving = reached(phase, 'leave');

  return (
    <div
      className={`cp-welcome${motion ? ' cp-welcome--motion' : ''}`}
      data-state={leaving ? 'leaving' : 'playing'}
      role="status"
      aria-live="polite"
      onClick={skipToEnd}
    >
      <span className="sr-only">{label}</span>

      <div
        className="cp-welcome-tile"
        aria-hidden="true"
        style={{
          opacity: shown || !motion ? 1 : 0,
          transform: `scale(${shown || !motion ? 1 : 0.9})`,
        }}
      >
        {/* The gradient tile, then the C and the people as a faint outline: the
            shape of what is about to be drawn. */}
        <img className="cp-welcome-layer" src={tile} alt="" />
        <div className="cp-welcome-layer cp-welcome-ghost">
          <img className="cp-welcome-layer" src={c} alt="" />
          {people.map((person) => (
            <img key={person} className="cp-welcome-layer" src={person} alt="" />
          ))}
        </div>

        <img
          className="cp-welcome-layer cp-welcome-c"
          src={c}
          alt=""
          style={{ '--sweep': drawn ? '200deg' : '0deg' } as CSSProperties}
        />

        {people.map((person, index) => (
          <img
            key={person}
            className="cp-welcome-layer cp-welcome-person"
            src={person}
            alt=""
            style={{
              opacity: popped ? 1 : 0,
              transform: `scale(${popped ? 1 : 0.2})`,
              transformOrigin: PIVOTS[index],
              transitionDelay: `${index * 0.11}s`,
            }}
          />
        ))}

        {/* The finished artwork, which is what the last frame is made of. */}
        <img
          className="cp-welcome-layer cp-welcome-final"
          src={finalIcon}
          alt=""
          style={{ opacity: finished ? 1 : 0 }}
        />
      </div>

      <img
        className="cp-welcome-word"
        src={WELCOME_WORDMARK}
        alt=""
        aria-hidden="true"
        style={{
          clipPath: finished ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)',
          opacity: finished ? 1 : 0,
          transform: `translateY(${finished ? 0 : 8}px)`,
        }}
      />

      {/* A way out for someone who reaches for the keyboard rather than the mouse,
          and the reason the overlay is allowed to swallow a click. */}
      <button type="button" className="sr-only" onClick={skipToEnd}>
        {skip}
      </button>
    </div>
  );
}
