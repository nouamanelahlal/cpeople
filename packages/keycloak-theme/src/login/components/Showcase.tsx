import { useEffect, useState, type JSX } from 'react';
import type { I18n } from '../i18n';
import { CheckIcon } from './Icons';

const TILE_COUNT = 16;
const CYCLE_MS = 3200;

/**
 * The panel beside the form.
 *
 * Everything in it is decoration and sample text: the activity lines are written in
 * the message files and translated like any other string, so no client's data —
 * real or recognisable — ever appears on a sign-in page (CLAUDE.md rule 6).
 *
 * It is hidden below 900px by the stylesheet, and holds still when the visitor has
 * asked for reduced motion.
 */
export function Showcase(props: { i18n: I18n; iconUrl: string }): JSX.Element {
  const { i18n, iconUrl } = props;
  const { msgStr } = i18n;

  const activity = [
    msgStr('cpActivity1'),
    msgStr('cpActivity2'),
    msgStr('cpActivity3'),
    msgStr('cpActivity4'),
    msgStr('cpActivity5'),
  ];

  const [tick, setTick] = useState(0);

  useEffect(() => {
    const stillness = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (stillness?.matches) {
      return;
    }

    const interval = window.setInterval(() => setTick((previous) => previous + 1), CYCLE_MS);
    return () => window.clearInterval(interval);
  }, []);

  const lines = [0, 1, 2].map((offset) => ({
    text: activity[(((tick - offset) % activity.length) + activity.length) % activity.length]!,
    working: offset === 0,
    opacity: offset === 2 ? 0.5 : offset === 1 ? 0.85 : 1,
  }));

  return (
    <aside className="cp-showcase" aria-label={msgStr('cpShowcaseAria')}>
      <div className="cp-showcase-panel">
        <div className="cp-showcase-top">
          <div className="cp-tiles-area" aria-hidden="true">
            <div className="cp-tiles">
              {Array.from({ length: TILE_COUNT }, (_, index) => (
                <div key={index} className="cp-tile" />
              ))}
            </div>
          </div>

          <img className="cp-float" src={iconUrl} alt="" aria-hidden="true" />

          <div className="cp-showcase-copy">
            <h2>{msgStr('cpShowcaseTitle')}</h2>
            <p>{msgStr('cpShowcaseBody')}</p>
          </div>
        </div>

        <ul className="cp-activity" aria-label={msgStr('cpActivityAria')}>
          {lines.map((line, index) => (
            <li key={index} style={{ opacity: line.opacity }}>
              <span className="cp-activity-avatar" aria-hidden="true" />
              <span className="cp-activity-text">{line.text}</span>
              <span className="cp-activity-state">
                {line.working ? (
                  <>
                    {msgStr('cpActivityWorking')}
                    <span className="cp-dot" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    {msgStr('cpActivityDone')}
                    <span style={{ color: 'var(--cp-done)', display: 'flex' }}>
                      <CheckIcon />
                    </span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
