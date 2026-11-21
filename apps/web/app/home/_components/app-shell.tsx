'use client';

import Image from 'next/image';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FocusEvent,
  type JSX,
  type ReactNode,
} from 'react';
import type { Locale } from '@cpeople/shared';
import type { IconName } from '../../../lib/home-data';
import icon from '../../../public/icon-192.png';
import wordmark from '../../../public/brand/cpeople-wordmark.png';
import { chooseLocale } from '../../actions';
import { BellIcon, CloseIcon, Icon, MenuIcon, PinIcon, SearchIcon } from './icons';

export interface NavItem {
  readonly key: string;
  readonly label: string;
  readonly aria: string;
  readonly icon: IconName;
  readonly badge?: number;
  readonly current?: boolean;
}

export interface NavGroup {
  readonly key: string;
  readonly title?: string;
  readonly items: readonly NavItem[];
}

export interface ShellLabels {
  readonly home: string;
  readonly mainNav: string;
  readonly openMenu: string;
  readonly closeMenu: string;
  readonly pin: string;
  readonly unpin: string;
  readonly search: string;
  readonly searchPlaceholder: string;
  readonly language: string;
  readonly otherLanguage: string;
  readonly notifications: string;
  readonly account: string;
  readonly signOut: string;
}

/** How wide the menu is, in pixels, collapsed and open. */
const RAIL = 76;
const OPEN = 260;

/** Long enough that passing the pointer over the menu does not open it. */
const OPEN_DELAY = 120;
const CLOSE_DELAY = 220;

const PIN_KEY = 'cpeople.menu.pinned';

/**
 * Whether the menu is pinned open, kept in the browser rather than on the server:
 * it is a preference about this screen, not about this person's account.
 *
 * Storage can be unavailable — a private window, a browser set to block site data —
 * and then the menu simply starts collapsed and forgets again next time.
 */
const pinListeners = new Set<() => void>();

function readPin(): boolean {
  try {
    return window.localStorage.getItem(PIN_KEY) === 'true';
  } catch {
    return false;
  }
}

function writePin(pinned: boolean): void {
  try {
    window.localStorage.setItem(PIN_KEY, String(pinned));
  } catch {
    /* the menu still works, it just forgets */
  }
  for (const listener of pinListeners) listener();
}

function subscribeToPin(listener: () => void): () => void {
  pinListeners.add(listener);
  return () => pinListeners.delete(listener);
}

/**
 * The application shell: the menu, the top bar, and the page inside them
 * (docs/design/home-dashboard.dc.html).
 *
 * The menu shows icons only until it is asked for — by pointer, by keyboard focus,
 * or by being pinned — and then it names everything. Only the pinned state moves
 * the page: hovering floats the menu over the content instead, so reading does not
 * shift under the pointer. On a phone it is a drawer over the page.
 */
export function AppShell({
  nav,
  labels,
  user,
  tenant,
  locale,
  title,
  subtitle,
  children,
}: {
  nav: readonly NavGroup[];
  labels: ShellLabels;
  user: { name: string; initials: string; role: string };
  tenant: { name: string; note: string; initials: string };
  locale: Locale;
  title: string;
  subtitle: string;
  children: ReactNode;
}): JSX.Element {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // A pinned menu is a preference, so it survives the next page and the next day.
  // The server cannot know it, so it renders the menu collapsed and this reads the
  // answer as soon as the browser has one.
  const pinned = useSyncExternalStore(subscribeToPin, readPin, () => false);

  useEffect(() => () => clearTimeout(timer.current), []);

  const expanded = hovered || focused || pinned || drawerOpen;

  function togglePin(): void {
    writePin(!pinned);
    setHovered(false);
  }

  function enter(): void {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHovered(true), OPEN_DELAY);
  }

  function leave(): void {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHovered(false), CLOSE_DELAY);
  }

  function blur(event: FocusEvent<HTMLElement>): void {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
  }

  return (
    <div
      className="flex min-h-dvh flex-wrap items-stretch bg-page"
      style={
        {
          '--rail-slot': `${pinned ? OPEN : RAIL}px`,
          '--rail-width': `${expanded ? OPEN : RAIL}px`,
        } as CSSProperties
      }
    >
      {/* Phones: a bar with the menu button, because there is no room for a rail. */}
      <div className="hidden w-full items-center justify-between gap-3 border-b border-card-border bg-white px-4 py-3 max-[720px]:flex">
        <button
          type="button"
          aria-label={labels.openMenu}
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          className="quiet-button size-11"
        >
          <MenuIcon />
        </button>
        <a href="/home" aria-label={labels.home} className="flex items-center gap-2.5">
          <Image src={icon} alt="" width={34} height={34} />
          <Image
            src={wordmark}
            alt=""
            height={30}
            style={{ height: '30px', width: 'auto' }}
          />
        </a>
        <span className="w-11" aria-hidden="true" />
      </div>

      {drawerOpen && (
        <button
          type="button"
          aria-label={labels.closeMenu}
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-[35] hidden border-0 bg-navy/40 max-[720px]:block"
        />
      )}

      <div
        className="relative z-20 w-[var(--rail-slot)] shrink-0 grow-0 basis-[var(--rail-slot)] transition-[flex-basis,width] duration-200 ease-out motion-reduce:transition-none max-[720px]:fixed max-[720px]:inset-y-0 max-[720px]:start-0 max-[720px]:z-40 max-[720px]:w-0 max-[720px]:basis-0" 
      >
        <nav
          aria-label={labels.mainNav}
          onMouseEnter={enter}
          onMouseLeave={leave}
          onFocus={() => setFocused(true)}
          onBlur={blur}
          style={{ boxShadow: expanded && !pinned ? '0 16px 48px rgba(15,25,55,0.16)' : 'none' }}
          className={`absolute inset-y-0 start-0 flex w-[var(--rail-width)] flex-col gap-6 overflow-y-auto overflow-x-hidden border-e border-card-border bg-white px-4 py-6 transition-[width,box-shadow] duration-200 ease-out motion-reduce:transition-none max-[720px]:fixed max-[720px]:w-[280px] ${
            drawerOpen ? 'max-[720px]:flex' : 'max-[720px]:hidden'
          }`}
        >
          <div className="flex min-h-11 items-center gap-3">
            <a href="/home" aria-label={labels.home} className="flex min-w-0 flex-1 items-center gap-3">
              <Image src={icon} alt="" width={44} height={44} className="shrink-0" />
              {expanded && (
                <Image src={wordmark} alt="" height={32} style={{ height: '32px', width: 'auto' }} />
              )}
            </a>
            {expanded && (
              <>
                <button
                  type="button"
                  aria-pressed={pinned}
                  aria-label={pinned ? labels.unpin : labels.pin}
                  title={pinned ? labels.unpin : labels.pin}
                  onClick={togglePin}
                  className={`quiet-button size-10 max-[720px]:hidden ${
                    pinned ? 'bg-tint text-blue' : 'text-body'
                  }`}
                >
                  <PinIcon />
                </button>
                <button
                  type="button"
                  aria-label={labels.closeMenu}
                  onClick={() => setDrawerOpen(false)}
                  className="quiet-button hidden size-10 max-[720px]:flex"
                >
                  <CloseIcon />
                </button>
              </>
            )}
          </div>

          <div className="flex flex-col gap-[18px]">
            {nav.map((group) => (
              <div key={group.key} className="flex flex-col gap-0.5">
                {group.title !== undefined &&
                  (expanded ? (
                    <div className="whitespace-nowrap px-3 pb-1.5 text-xs font-semibold text-muted">
                      {group.title}
                    </div>
                  ) : (
                    <div aria-hidden="true" className="mx-2 mb-2 h-px bg-line" />
                  ))}

                {group.items.map((item) => (
                  <a
                    key={item.key}
                    href="#"
                    aria-label={item.aria}
                    aria-current={item.current ? 'page' : undefined}
                    className={`relative flex min-h-11 items-center gap-3.5 whitespace-nowrap rounded-[10px] px-3 py-2.5 text-sm transition-colors duration-150 ease-out hover:bg-hover motion-reduce:transition-none ${
                      item.current ? 'bg-tint font-semibold text-navy' : 'text-body'
                    }`}
                  >
                    <Icon name={item.icon} />
                    {expanded && <span className="flex-1">{item.label}</span>}
                    {item.badge !== undefined &&
                      (expanded ? (
                        <span className="num rounded-full bg-blue px-2 py-0.5 text-xs font-semibold text-white">
                          {item.badge}
                        </span>
                      ) : (
                        <span
                          aria-hidden="true"
                          className="absolute top-[5px] start-[26px] size-3 rounded-full border-2 border-white bg-blue"
                        />
                      ))}
                  </a>
                ))}
              </div>
            ))}
          </div>

          {expanded ? (
            <div className="flex items-center gap-3 whitespace-nowrap rounded-[14px] border border-card-border p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-navy text-[13px] font-semibold text-white">
                {tenant.initials}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-navy">{tenant.name}</span>
                <span className="text-xs text-body">{tenant.note}</span>
              </span>
            </div>
          ) : (
            <span
              title={`${tenant.name}, ${tenant.note}`}
              className="ms-1 grid size-9 place-items-center rounded-[10px] bg-navy text-[13px] font-semibold text-white"
            >
              {tenant.initials}
            </span>
          )}
        </nav>
      </div>

      <main className="flex min-w-0 shrink grow-[999] basis-[560px] flex-col gap-6 px-[clamp(16px,3vw,40px)] pb-12 pt-6">
        <header className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="flex min-w-0 shrink grow basis-[280px] flex-col gap-1">
            <h1 className="text-[26px] font-normal tracking-[-0.01em] text-navy">{title}</h1>
            <p className="text-sm text-body">{subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="flex h-11 w-[380px] max-w-full items-center gap-2.5 rounded-xl border border-card-border bg-white px-3.5 text-body">
              <SearchIcon />
              <span className="sr-only">{labels.search}</span>
              <input
                type="search"
                placeholder={labels.searchPlaceholder}
                className="min-w-0 flex-1 bg-transparent text-sm text-navy outline-none"
              />
            </label>

            <form action={chooseLocale}>
              <input type="hidden" name="returnTo" value="/home" />
              <button
                type="submit"
                name="locale"
                value={locale === 'en' ? 'fr' : 'en'}
                aria-label={labels.language}
                className="quiet-button h-11 min-w-11 px-3 text-[13px] font-semibold text-navy"
              >
                {locale.toUpperCase()}
              </button>
            </form>

            <button
              type="button"
              aria-label={labels.notifications}
              className="quiet-button relative size-11 text-navy"
            >
              <BellIcon />
              <span
                aria-hidden="true"
                className="absolute top-[9px] end-2.5 size-2 rounded-full border-2 border-white bg-cyan"
              />
            </button>

            <AccountMenu user={user} account={labels.account} signOut={labels.signOut} />
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}

/** The signed-in person, and the way out (M02). */
function AccountMenu({
  user,
  account,
  signOut,
}: {
  user: { name: string; initials: string; role: string };
  account: string;
  signOut: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button
        type="button"
        aria-label={account}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((was) => !was)}
        className="quiet-button h-11 gap-2.5 ps-1.5 pe-3.5 text-navy"
      >
        <span className="grid size-8 place-items-center rounded-[9px] bg-tint text-xs font-semibold">
          {user.initials}
        </span>
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[13px] font-semibold">{user.name}</span>
          <span className="text-xs text-body">{user.role}</span>
        </span>
      </button>

      {open && (
        <form
          action="/api/auth/sign-out"
          method="post"
          className="absolute end-0 top-[52px] z-30 min-w-[200px] rounded-xl border border-card-border bg-white p-1.5 shadow-[0_12px_32px_rgba(15,25,55,0.14)]"
        >
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2.5 text-start text-sm font-semibold text-navy transition-colors duration-200 ease-out hover:bg-hover motion-reduce:transition-none"
          >
            {signOut}
          </button>
        </form>
      )}
    </div>
  );
}
