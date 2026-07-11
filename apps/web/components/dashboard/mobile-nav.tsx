"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { Logo } from "../brand/Logo";
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
 * growing past the desktop breakpoint; React unmounts it instantly on
 * close. Entrance per the emil-design-eng rules: transform only,
 * ease-out, from the edge the trigger sits on.
 */

/** Tailwind's lg, where the shell swaps the phone bar for the sidebar. */
const DESKTOP_QUERY = "(min-width: 1024px)";

export function MobileNav(props: SidebarProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    // Rotating to landscape past the breakpoint would strand an open
    // drawer over the desktop sidebar.
    const desktop = window.matchMedia(DESKTOP_QUERY);
    function onChange(event: MediaQueryListEvent) {
      if (event.matches) setOpen(false);
    }
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

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

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border-subtle bg-page/95 px-3 backdrop-blur lg:hidden print:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="app-drawer"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="rounded-md p-2 text-body transition-colors duration-(--dur-fast) ease-out hover:bg-page active:bg-[var(--stone-100)]"
        >
          <Menu size={22} />
        </button>

        <Link href="/app" aria-label="Home" className="inline-flex rounded-md">
          <Logo size={24} />
        </Link>

        {/* The context switcher (kid avatar, top right, founder lean
            2026-07-10) for multi-kid families; single-kid families keep
            the spacer that balances the hamburger so the wordmark sits
            centered either way. */}
        {props.kids.length > 1 ? (
          <ContextSwitcher kids={props.kids} selected={props.viewContext} />
        ) : (
          <span className="w-[38px]" aria-hidden="true" />
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
            className="fixed inset-0 z-40 bg-[rgba(51,42,33,0.42)] transition-opacity duration-(--dur-base) ease-out starting:opacity-0 motion-reduce:transition-none"
          />
          <div
            id="app-drawer"
            // Delegated close: the drawer is the sidebar, so every link
            // inside (tabs, account menu's Settings) should land on its
            // page with the drawer gone; the viewing rows are buttons,
            // so they opt in via data-drawer-close.
            onClick={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest("a") || target.closest("[data-drawer-close]")) close();
            }}
            className="fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] translate-x-0 flex-col overflow-y-auto rounded-r-[var(--radius-xl)] border-r border-border-subtle bg-card p-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-xl)] transition-[translate] duration-(--dur-base) ease-out starting:-translate-x-full motion-reduce:transition-none"
          >
            <div className="flex items-center justify-between px-2.5 pb-5 pt-1">
              <Link href="/app" aria-label="Home" className="inline-flex rounded-md">
                <Logo size={26} />
              </Link>
              <button
                type="button"
                aria-label="Close menu"
                onClick={close}
                className="rounded-md p-1.5 text-subtle transition-colors duration-(--dur-fast) ease-out hover:bg-page hover:text-body"
              >
                <X size={20} />
              </button>
            </div>

            <SidebarContent {...props} />
          </div>
        </>
      ) : null}
    </>
  );
}
