"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import type { SemanticIconName } from "@homa/design/contract";

import { Logo } from "../brand/Logo";
import { Icon } from "./Icon";
import { QuietAction } from "./QuietAction";

/**
 * Public shell destinations. Keeping these in the Quiet primitive makes the
 * nav contract reviewable without coupling the visual shell to a page route.
 */
export const QUIET_NAV_LINKS = [
  ["How it works", "/#how"],
  ["Features", "/#features"],
  ["Our story", "/#stories"],
] as const;

export type QuietNavMenuItem = {
  href: string;
  label: string;
  icon?: SemanticIconName;
  group?: "primary" | "work";
  dividerBefore?: boolean;
};

export type QuietNavProps = {
  signedIn?: boolean;
  primaryActionLabel: string;
  primaryActionHref?: string;
  onPrimaryAction?: () => void;
  signedInItems?: readonly QuietNavMenuItem[];
};

const DESKTOP_QUERY = "(min-width: 881px)";
const SCROLLED_AT_PX = 8;
const MENU_EXIT_MS = 220;
const SECTION_SPY_ROOT_MARGIN = "-40% 0px -50% 0px";

type MenuState = "closed" | "open" | "closing";

/**
 * Quiet authority's shared public and auth-aware web navigation.
 *
 * The component intentionally owns behavior, not page content. Marketing
 * routes provide the anchor targets; signed-in visitors get the same app
 * destinations used by the dashboard shell. Outside SignupPopupProvider the
 * primary action remains a normal /onboarding link.
 */
export function QuietNav({
  signedIn = false,
  primaryActionLabel,
  primaryActionHref = "/onboarding",
  onPrimaryAction,
  signedInItems = [],
}: QuietNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [activeHref, setActiveHref] = useState<string | null>(null);
  const [menuTickHref, setMenuTickHref] = useState<string | null>(null);
  const [menuState, setMenuState] = useState<MenuState>("closed");
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const previousMenuState = useRef<MenuState>("closed");

  const menuOpen = menuState === "open";
  const menuVisible = menuState !== "closed";
  const closeMenu = () => setMenuState((state) => (state === "open" ? "closing" : state));

  useEffect(() => {
    let scheduled = false;
    const check = () => {
      scheduled = false;
      setScrolled(window.scrollY > SCROLLED_AT_PX);
    };
    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const targets = QUIET_NAV_LINKS.flatMap(([, href]) => {
      const id = href.split("#")[1];
      const element = id ? document.getElementById(id) : null;
      return element ? [[href, element] as const] : [];
    });
    if (targets.length === 0) return;

    const crossing = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const target = targets.find(([, element]) => element === entry.target);
          if (!target) continue;
          if (entry.isIntersecting) crossing.add(target[0]);
          else crossing.delete(target[0]);
        }
        let current: string | null = null;
        for (const [href] of targets) if (crossing.has(href)) current = href;
        setActiveHref(current);
        setMenuTickHref((previous) => current ?? previous ?? QUIET_NAV_LINKS[0][1]);
      },
      { rootMargin: SECTION_SPY_ROOT_MARGIN },
    );
    for (const [, element] of targets) observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
        return;
      }
      if (event.key !== "Tab") return;
      const menu = document.getElementById("quiet-nav-menu");
      const toggle = toggleRef.current;
      if (!menu || !toggle) return;
      const focusables = [
        toggle,
        ...menu.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !focusables.includes(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuVisible) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousOverflow;
    };
  }, [menuVisible]);

  useEffect(() => {
    if (!menuOpen) return;
    const nav = navRef.current;
    if (!nav?.parentElement) return;
    const siblings = Array.from(nav.parentElement.children).filter(
      (element) => element !== nav && !element.hasAttribute("inert"),
    );
    for (const sibling of siblings) sibling.setAttribute("inert", "");
    return () => {
      for (const sibling of siblings) sibling.removeAttribute("inert");
    };
  }, [menuOpen]);

  useEffect(() => {
    if (menuState !== "closing") return;
    const timer = window.setTimeout(() => setMenuState("closed"), MENU_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [menuState]);

  useEffect(() => {
    const previous = previousMenuState.current;
    previousMenuState.current = menuState;
    if (menuState === "closed" && previous === "closing") {
      toggleRef.current?.focus({ preventScroll: true });
    }
  }, [menuState]);

  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuState("closed");
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  const closing = menuState === "closing" ? "true" : undefined;
  const navAction = onPrimaryAction ? (
    <QuietAction kind="primary" onClick={onPrimaryAction}>
      {primaryActionLabel}
    </QuietAction>
  ) : (
    <QuietAction kind="primary" href={primaryActionHref}>
      {primaryActionLabel}
    </QuietAction>
  );

  return (
    <nav
      ref={navRef}
      className="quiet-nav"
      data-scrolled={scrolled || menuVisible ? "true" : "false"}
      aria-label="Primary"
    >
      <div className="quiet-nav__row">
        <Link href="/" aria-label="Homa home" className="quiet-nav__home">
          <Logo size={30} />
        </Link>

        <div className="quiet-nav__links" aria-label="Explore Homa">
          {QUIET_NAV_LINKS.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className="quiet-nav__link"
              aria-current={activeHref === href ? "true" : undefined}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="quiet-nav__auth">
          {signedIn ? (
            <QuietAction kind="primary" href="/app">
              Open Homa
            </QuietAction>
          ) : (
            <>
              <Link href="/signin" className="quiet-nav__signin">
                Sign in
              </Link>
              <span className="quiet-nav__desktop-action">{navAction}</span>
            </>
          )}
          <button
            ref={toggleRef}
            type="button"
            className="quiet-nav__toggle"
            aria-expanded={menuOpen}
            aria-controls="quiet-nav-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuState((state) => (state === "open" ? "closing" : "open"))}
          >
            <Icon name={menuOpen ? "close" : "menu"} size={24} />
          </button>
        </div>
      </div>

      {menuVisible ? (
        <>
          <button
            type="button"
            className="quiet-nav__backdrop"
            data-closing={closing}
            aria-label="Close menu"
            onClick={closeMenu}
          />
          <div
            id="quiet-nav-menu"
            className="quiet-nav__menu"
            data-closing={closing}
            aria-label="Mobile navigation"
          >
            {signedIn ? (
              <>
                {signedInItems.map(({ href, label, icon, group, dividerBefore }, index) => (
                  <Fragment key={href}>
                    {dividerBefore || (group === "work" && signedInItems[index - 1]?.group !== "work") ? (
                      <div className="quiet-nav__divider" aria-hidden="true" />
                    ) : null}
                    {group === "work" && signedInItems[index - 1]?.group !== "work" ? (
                      <p className="quiet-nav__menu-label">Your work</p>
                    ) : null}
                    <Link href={href} className="quiet-nav__menu-link" onClick={closeMenu}>
                      {icon ? <Icon name={icon} size={20} /> : null}
                      {label}
                    </Link>
                  </Fragment>
                ))}
              </>
            ) : (
              <>
                {QUIET_NAV_LINKS.map(([label, href]) => (
                  <Link
                    key={label}
                    href={href}
                    className="quiet-nav__menu-link"
                    aria-current={menuTickHref === href ? "true" : undefined}
                    onClick={closeMenu}
                  >
                    {label}
                  </Link>
                ))}
                <div className="quiet-nav__divider" aria-hidden="true" />
                <Link href="/signin" className="quiet-nav__menu-link quiet-nav__menu-link--strong" onClick={closeMenu}>
                  Sign in
                </Link>
                <span className="quiet-nav__mobile-action">
                  {onPrimaryAction ? (
                    <QuietAction
                      kind="primary"
                      className="quiet-nav__mobile-cta"
                      onClick={() => {
                        closeMenu();
                        onPrimaryAction();
                      }}
                    >
                      {primaryActionLabel}
                    </QuietAction>
                  ) : (
                    <QuietAction kind="primary" href={primaryActionHref} className="quiet-nav__mobile-cta" onClick={closeMenu}>
                      {primaryActionLabel}
                    </QuietAction>
                  )}
                </span>
              </>
            )}
          </div>
        </>
      ) : null}
    </nav>
  );
}
