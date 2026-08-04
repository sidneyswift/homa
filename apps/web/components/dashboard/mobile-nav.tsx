"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Logo } from "../brand/Logo";
import { Icon } from "../design/Icon";
import { ContextSwitcher } from "./context-switcher";
import { SidebarContent, type SidebarProps } from "./sidebar";

/**
 * The signed-in phone nav (founder call 2026-07-09: one mobile nav on
 * every signed-in page, and it is a hamburger on the top left that opens
 * the sidebar). The bar carries the hamburger, the wordmark, and (for
 * multi-kid families) the context switcher avatar on the right (founder
 * lean 2026-07-10: switch kids from the top right without the drawer);
 * the old gear / Ask Homa / Sign out cluster retired because the drawer
 * is the whole sidebar, tabs, kids, and the account menu included, so
 * every one of those doors now lives one tap in. Renders in
 * the /app shell, so every signed-in surface gets it for free. The bar's
 * h-14 is load-bearing: chat's phone height is 100dvh minus exactly this
 * bar.
 *
 * Drawer behavior matches the house menus (marketing Nav, AccountMenu):
 * closes on Escape, a backdrop tap, any link tap inside, or the viewport
 * growing past the desktop breakpoint. The drawer keeps an explicit closing
 * state long enough to play its exit transition, then returns focus to the
 * trigger. Entrance and exit use transform only, ease-out, from the edge the
 * trigger sits on.
 */

/** The Quiet shell breakpoint where the phone bar swaps for the sidebar. */
const DESKTOP_QUERY = "(min-width: 1024px)";
const DRAWER_EXIT_MS = 200;
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileNav(props: SidebarProps) {
  const [drawerState, setDrawerState] = useState<"closed" | "open" | "closing">("closed");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const hadOpenDrawerRef = useRef(false);
  const open = drawerState !== "closed";

  const finishClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setDrawerState("closed");
  }, []);

  const openDrawer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setDrawerState("open");
  }, []);

  const close = useCallback(() => {
    setDrawerState((current) => {
      if (current !== "open") return current;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        window.setTimeout(finishClose, 0);
      } else {
        closeTimerRef.current = window.setTimeout(finishClose, DRAWER_EXIT_MS);
      }
      return "closing";
    });
  }, [finishClose]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  useEffect(() => {
    if (!open) {
      if (hadOpenDrawerRef.current) {
        hadOpenDrawerRef.current = false;
        triggerRef.current?.focus({ preventScroll: true });
      }
      return;
    }

    hadOpenDrawerRef.current = true;
    const drawer = drawerRef.current;
    if (!drawer) return;
    const activeDrawer = drawer;

    const focusables = () =>
      Array.from(activeDrawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    window.requestAnimationFrame(() => {
      (closeButtonRef.current ?? focusables()[0] ?? activeDrawer).focus({ preventScroll: true });
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        activeDrawer.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !activeDrawer.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerState, open]);

  useEffect(() => {
    // Rotating to landscape past the breakpoint would strand an open
    // drawer over the desktop sidebar.
    const desktop = window.matchMedia(DESKTOP_QUERY);
    function onChange(event: MediaQueryListEvent) {
      if (event.matches) close();
    }
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, [close]);

  useEffect(() => {
    // A full-height drawer over a scrolled page: the page underneath
    // stays put while the drawer is up.
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => () => finishClose(), [finishClose]);

  return (
    <>
      <header className="quiet-shell__mobile-bar">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="app-drawer"
          aria-label="Open menu"
          onClick={openDrawer}
          ref={triggerRef}
          className="quiet-shell__icon-action"
        >
          <Icon name="menu" size={24} />
        </button>

        <Link href="/app" aria-label="Home" className="quiet-shell__logo">
          <Logo size={24} />
        </Link>

        {/* The context switcher (kid avatar, top right, founder lean
            2026-07-10) for multi-kid families; single-kid families keep
            the spacer that balances the hamburger so the wordmark sits
            centered either way. */}
        {props.kids.length > 1 ? (
          <ContextSwitcher kids={props.kids} selected={props.viewContext} />
        ) : (
          <span className="h-11 w-11" aria-hidden="true" />
        )}
      </header>

      {/* The drawer lives OUTSIDE the bar: the bar's backdrop-blur makes
          it the containing block for fixed descendants, which would pin
          and clip the drawer to the bar's 56px box. */}
      {open ? (
        <>
          {/* Tap-catch scrim: any tap outside the drawer closes it. */}
          <div
            onClick={close}
            aria-hidden="true"
            data-closing={drawerState === "closing" ? "true" : undefined}
            className="quiet-shell__scrim"
          />
          <div
            id="app-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Homa menu"
            tabIndex={-1}
            // Delegated close: the drawer is the sidebar, so every link
            // inside (tabs, account menu's Settings) should land on its
            // page with the drawer gone; the viewing rows are buttons,
            // so they opt in via data-drawer-close.
            onClick={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest("a") || target.closest("[data-drawer-close]")) close();
            }}
            onTransitionEnd={(event) => {
              if (
                drawerState === "closing" &&
                event.target === event.currentTarget &&
                event.propertyName === "transform"
              ) {
                finishClose();
              }
            }}
            data-closing={drawerState === "closing" ? "true" : undefined}
            className="quiet-shell__drawer"
          >
            <div className="quiet-shell__drawer-header">
              <Link href="/app" aria-label="Home" className="quiet-shell__logo">
                <Logo size={26} />
              </Link>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close menu"
                onClick={close}
                className="quiet-shell__icon-action"
              >
                <Icon name="close" size={24} />
              </button>
            </div>

            <SidebarContent {...props} withViewingRows />
          </div>
        </>
      ) : null}
    </>
  );
}
