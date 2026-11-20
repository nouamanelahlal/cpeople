import { useEffect, useState, type JSX, type ReactNode } from 'react';
import type { KcContext } from '../KcContext';
import type { I18n } from '../i18n';
import { AlertIcon, ChevronDownIcon, GlobeIcon } from './Icons';
import { Showcase } from './Showcase';
import cpeopleIcon from '../../assets/cpeople-icon.png';
import cpeopleWordmark from '../../assets/cpeople-wordmark.png';

/** Where "Book a demo" points, set per environment on the Keycloak container. */
function bookADemoUrl(kcContext: KcContext): string {
  return kcContext.properties.CPEOPLE_BOOK_A_DEMO_URL || 'https://consap.ma/cpeople';
}

function LanguageSwitch(props: { kcContext: KcContext; i18n: I18n }): JSX.Element | null {
  const { kcContext, i18n } = props;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  if (!kcContext.realm.internationalizationEnabled || kcContext.locale === undefined) {
    return null;
  }

  const { currentLanguageTag, supported } = kcContext.locale;
  const current = supported.find((language) => language.languageTag === currentLanguageTag);

  return (
    <div className="cp-language" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="cp-language-button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={i18n.msgStr('cpLanguage', current?.label ?? currentLanguageTag)}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <GlobeIcon />
        {currentLanguageTag.toUpperCase()}
        <ChevronDownIcon />
      </button>

      {open && (
        <ul className="cp-language-menu" role="menu">
          {supported.map(({ languageTag, label, url }) => (
            <li key={languageTag} role="none">
              <a role="menuitem" href={url} lang={languageTag}>
                {label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The frame every sign-in page sits in: the brand header, the form column, the
 * footer with the language switch, and the showcase panel beside it.
 */
export function SignInLayout(props: {
  kcContext: KcContext;
  i18n: I18n;
  /** The round badge above the heading. */
  badge: ReactNode;
  headline: string;
  subhead?: ReactNode;
  /** A "back" link above the badge, where the page has somewhere to go back to. */
  back?: { href: string; label: string } | undefined;
  children: ReactNode;
  footnote?: ReactNode;
  documentTitle?: string;
}): JSX.Element {
  const { kcContext, i18n, badge, headline, subhead, back, children, footnote, documentTitle } =
    props;

  useEffect(() => {
    document.title = documentTitle ?? `${headline} · CPeople`;
  }, [documentTitle, headline]);

  return (
    <div className="cp-shell">
      <main className="cp-main">
        <header className="cp-header">
          <a className="cp-logo" href={kcContext.url.loginUrl} aria-label={i18n.msgStr('cpHome')}>
            <img src={cpeopleIcon} alt="" width={40} height={40} />
            <img
              className="cp-logo-wordmark"
              src={cpeopleWordmark}
              alt="CPeople by ConSAP"
            />
          </a>

          <div className="cp-header-cta">
            <span>{i18n.msgStr('cpNewToCPeople')}</span>
            <a
              className="cp-button cp-button--light cp-button--header"
              href={bookADemoUrl(kcContext)}
            >
              {i18n.msgStr('cpBookADemo')}
            </a>
          </div>
        </header>

        <div className="cp-center">
          <div className="cp-card">
            {back && (
              <a className="cp-back" href={back.href}>
                <ChevronStart />
                {back.label}
              </a>
            )}

            <span className="cp-badge">{badge}</span>

            <div className="cp-heading">
              <h1>{headline}</h1>
              {subhead !== undefined && <p>{subhead}</p>}
            </div>

            {children}

            {footnote !== undefined && <p className="cp-legal">{footnote}</p>}
          </div>
        </div>

        <footer className="cp-footer">
          <span>{i18n.msgStr('cpCopyright', String(new Date().getFullYear()))}</span>
          <LanguageSwitch kcContext={kcContext} i18n={i18n} />
        </footer>
      </main>

      <Showcase i18n={i18n} iconUrl={cpeopleIcon} />
    </div>
  );
}

function ChevronStart(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

/** A message in the house style, used for every error and confirmation. */
export function Alert(props: {
  kind: 'error' | 'success' | 'info';
  children: ReactNode;
}): JSX.Element {
  const { kind, children } = props;

  return (
    <div className={`cp-alert cp-alert--${kind}`} role="alert">
      {kind === 'error' && <AlertIcon />}
      <span>{children}</span>
    </div>
  );
}
