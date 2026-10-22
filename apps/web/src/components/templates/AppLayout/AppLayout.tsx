'use client';

import { APP_NAME } from '@offerleap/shared';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';

import { Button, Icon } from '../../atoms';
import { LocaleSwitcher, ThemeToggle } from '../../molecules';
import { Drawer } from '../../organisms';

/** Translated texts of the phone menu. */
export interface AppLayoutMenuLabels {
  /** The ☰ button, e.g. "Open menu". */
  open: string;
  /** The drawer's close button, e.g. "Close menu". */
  close: string;
  /** Accessible name of the drawer, e.g. "Menu". */
  title: string;
  /** Row labels next to the switches, e.g. "Language", "Appearance". */
  language: string;
  theme: string;
}

export interface AppLayoutProps {
  children: ReactNode;
  /** Wraps the brand so it can link home (the template stays router-agnostic). */
  brand?: (content: ReactNode) => ReactNode;
  /** Main navigation links (`<li>` items, rendered inside a labelled `<nav>`). */
  nav?: ReactNode;
  navLabel?: string;
  /** Controls on the right of the desktop header, after language and theme (e.g. account and sign-out). */
  actions?: ReactNode;
  /** Bottom of the phone menu (e.g. the account card and sign-out). */
  menuFooter?: ReactNode;
  /** Texts of the phone menu; without them there is no phone menu. */
  menuLabels?: AppLayoutMenuLabels;
  width?: 'lg' | 'xl';
}

const WIDTH = { lg: 'max-w-4xl', xl: 'max-w-6xl' } as const;

/**
 * Switching the language loads the page again in that language, which would close the phone menu. A short-lived
 * note in sessionStorage tells the new page to reopen it where the user was.
 */
const MENU_REOPEN_KEY = 'offerleap:menu-reopen';
const MENU_REOPEN_TTL_MS = 5_000;

function rememberMenuOpen() {
  try {
    sessionStorage.setItem(MENU_REOPEN_KEY, String(Date.now()));
  } catch {
    // Storage blocked: the menu just closes, as before.
  }
}

function hasMenuReopen(): boolean {
  try {
    return Date.now() - Number(sessionStorage.getItem(MENU_REOPEN_KEY)) < MENU_REOPEN_TTL_MS;
  } catch {
    return false;
  }
}

function clearMenuReopen() {
  try {
    sessionStorage.removeItem(MENU_REOPEN_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * True once the app has hydrated. A language switch is a client-side navigation that remounts this layout: by
 * then storage can be read while rendering, so the menu is open from the very first frame (no flicker). The
 * first page load must render like the server (closed) and reopen in an effect.
 */
let hydrated = false;

/**
 * @description Shell for signed-in pages, with the content column below the header.
 * - From `xl` (1280px) up: one header row with brand, navigation, language/theme switches and the account
 *   actions — that row needs about 1100px, so narrower screens (tablets too, not just phones) get the menu.
 * - Below that: the brand and, opposite it, a ☰ button; everything else lives in a drawer that slides in from the
 *   right, the side of the button (navigation as a vertical list, language, theme, then `menuFooter`).
 * Presentational only — links, texts and data come from the caller.
 * @param props - {@link AppLayoutProps}
 */
export function AppLayout({
  children,
  brand = (content) => content,
  nav,
  navLabel,
  actions,
  menuFooter,
  menuLabels,
  width = 'xl',
}: AppLayoutProps) {
  // Arriving from a language switch made in the open menu: open it again, without the slide-in.
  const [reopenOnArrival] = useState(() => Boolean(menuLabels) && hydrated && hasMenuReopen());
  const [menuOpen, setMenuOpen] = useState(reopenOnArrival);
  /** Reopened after a language switch: no slide-in, it was already open. */
  const [menuRestored, setMenuRestored] = useState(reopenOnArrival);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const firstLoad = !hydrated;
    hydrated = true;
    if (reopenOnArrival) return clearMenuReopen();
    // First page load: storage couldn't be read while hydrating, so reopen here (one frame later).
    if (!firstLoad || !menuLabels || !hasMenuReopen()) return;
    clearMenuReopen();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuRestored(true);
    setMenuOpen(true);
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeMenu = () => {
    setMenuOpen(false);
    setMenuRestored(false);
  };
  const logo = (
    <span className="flex items-center gap-2 font-bold">
      <Icon name="sparkles" className="text-primary-text" />
      {APP_NAME}
    </span>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
        <div
          className={cn('mx-auto flex w-full items-center gap-2 px-4 py-3 sm:px-6 xl:gap-6', WIDTH[width])}
        >
          {brand(logo)}
          {nav && (
            <nav aria-label={navLabel} className="hidden flex-1 xl:block">
              <ul className="flex items-center gap-1">{nav}</ul>
            </nav>
          )}
          <div className={cn('ml-auto items-center gap-2', menuLabels ? 'hidden xl:flex' : 'flex')}>
            <LocaleSwitcher />
            <ThemeToggle />
            {actions}
          </div>
          {menuLabels && (
            <Button
              ref={menuButtonRef}
              variant="ghost"
              size="icon"
              aria-label={menuLabels.open}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="-mr-2 ml-auto xl:hidden"
            >
              <Icon name="menu" />
            </Button>
          )}
        </div>
      </header>

      {menuLabels && (
        <Drawer
          open={menuOpen}
          onClose={closeMenu}
          instant={menuRestored}
          // Also when it was reopened after a language switch (not opened by the button).
          onAfterClose={() => menuButtonRef.current?.focus()}
          // Back on the language switch the user just used (keyboard users keep their place).
          initialFocus={menuRestored ? '[data-drawer-keep-open] a[hreflang]' : undefined}
          label={menuLabels.title}
          closeLabel={menuLabels.close}
          header={brand(logo)}
          footer={menuFooter}
          side="right"
        >
          {nav && (
            <nav aria-label={navLabel}>
              {/* Same links as the desktop bar, stacked and full width with larger touch targets. */}
              <ul className="flex flex-col gap-1 [&_a]:flex [&_a]:h-11 [&_a]:w-full [&_a]:text-base">
                {nav}
              </ul>
            </nav>
          )}
          <div
            data-drawer-keep-open
            // A language link reloads the page in that language; the menu reopens there.
            onClickCapture={(event) => {
              if ((event.target as HTMLElement).closest('a[hreflang]')) rememberMenuOpen();
            }}
            className="flex flex-col gap-3 border-t border-border px-3 pt-5"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-fg-muted">{menuLabels.language}</span>
              <LocaleSwitcher />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-fg-muted">{menuLabels.theme}</span>
              <ThemeToggle />
            </div>
          </div>
        </Drawer>
      )}

      <main id="main" className={cn('mx-auto w-full flex-1 px-4 py-8 sm:px-6', WIDTH[width])}>
        {children}
      </main>
    </div>
  );
}

/**
 * @description Class names for a navigation link; pass `active` for the current section (also set
 * `aria-current="page"` on the link).
 * @param active - Whether the link points to the current section.
 */
export function navLinkClasses(active: boolean): string {
  return cn(
    'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors',
    'outline-none focus-visible:ring-3 focus-visible:ring-ring/40',
    active ? 'bg-primary-soft text-primary-soft-fg' : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
  );
}
