"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Logo } from "../brand/Logo";
import { Button } from "./ds/Button";
import { useSignupPopup } from "./SignupPopupProvider";

/**
 * Sticky marketing nav, ported from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx. Links anchor to their
 * page sections; "Sign in" points at /signin; "Sign up" opens the landing
 * page's signup popup where a SignupPopupProvider wraps this (the
 * landing page itself), or falls back to navigating straight to
 * /onboarding everywhere else Nav renders (onboarding, blog), where
 * there's no popup to open.
 *
 * Surface: transparent at rest (founder call 2026-07-06, it reads as part
 * of whatever's underneath), but once the page scrolls the kit's original
 * frosted cream fill fades back in (globals.css .lp-nav::before), because
 * a sticky transparent bar lets content scroll through the links (founder
 * bug report 2026-07-08). Layout styles live in globals.css as .lp-nav so
 * that scrolled state and the phone breakpoint can restyle the bar without
 * fighting inline styles.
 *
 * Phones (<=880px, the kit's breakpoint): everything except the logo and
 * a hamburger toggle hides (.lp-nav-links), founder call 2026-07-08:
 * "there should only be logo and hamburger". The toggle opens a card menu
 * carrying the section links, "Sign in" (so signing in is never
 * desktop-only, same founder report), and a full-width "Sign up" as the
 * menu's closing CTA. The menu closes on any link tap, Escape, a tap on
 * the transparent backdrop, or the viewport growing past the breakpoint.
 */

const LINKS: ReadonlyArray<readonly [string, string]> = [
  ["How it works", "/#how"],
  ["Features", "/#features"],
  ["Our story", "/#stories"],
];

/** Matches the kit's 880px phone breakpoint in globals.css. */
const DESKTOP_QUERY = "(min-width: 881px)";
/** Past this scroll depth the frosted surface fades in. */
const SCROLLED_AT_PX = 8;

export function Nav() {
  const openPopup = useSignupPopup();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    let scheduled = false;
    function check() {
      scheduled = false;
      setScrolled(window.scrollY > SCROLLED_AT_PX);
    }
    function onScroll() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(check);
    }
    // Anchor links (/#features) can land mid-page, so read once on mount.
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    // Rotating to landscape past the breakpoint would strand an open menu.
    const desktop = window.matchMedia(DESKTOP_QUERY);
    function onChange(event: MediaQueryListEvent) {
      if (event.matches) setMenuOpen(false);
    }
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  return (
    <nav className="lp-nav lp-pad" data-scrolled={scrolled || menuOpen ? "true" : "false"}>
      <Link href="/" aria-label="Homa" style={{ display: "inline-flex" }}>
        <Logo size={28} />
      </Link>
      <div className="lp-nav-links" style={{ display: "flex", gap: 28, marginLeft: 20 }}>
        {LINKS.map(([label, href]) => (
          <Link
            key={label}
            href={href}
            style={{
              color: "var(--text-muted)",
              textDecoration: "none",
              fontWeight: 500,
              fontSize: "0.95rem",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </Link>
        ))}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
        <Link
          href="/signin"
          className="lp-nav-links"
          style={{
            color: "var(--text-body)",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.95rem",
            whiteSpace: "nowrap",
          }}
        >
          Sign in
        </Link>
        {/* Button has no className prop, so a hide-on-phones wrapper
            carries .lp-nav-links for it. */}
        <span className="lp-nav-links" style={{ display: "inline-flex" }}>
          {openPopup ? (
            <Button variant="primary" onClick={openPopup}>
              Sign up
            </Button>
          ) : (
            <Button variant="primary" href="/onboarding">
              Sign up
            </Button>
          )}
        </span>
        <button
          type="button"
          className="lp-nav-toggle"
          aria-expanded={menuOpen ? "true" : "false"}
          aria-controls="lp-nav-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {menuOpen ? (
        <>
          {/* Tap-catch layer: any tap outside the menu closes it. */}
          <div className="lp-nav-menu-backdrop" onClick={closeMenu} aria-hidden="true" />
          <div id="lp-nav-menu" className="lp-nav-menu">
            {LINKS.map(([label, href]) => (
              <Link key={label} href={href} className="lp-nav-menu-link" onClick={closeMenu}>
                {label}
              </Link>
            ))}
            <div className="lp-nav-menu-divider" aria-hidden="true" />
            <Link href="/signin" className="lp-nav-menu-link lp-nav-menu-link-strong" onClick={closeMenu}>
              Sign in
            </Link>
            <div className="lp-nav-menu-cta">
              {openPopup ? (
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => {
                    closeMenu();
                    openPopup();
                  }}
                >
                  Sign up
                </Button>
              ) : (
                <Button variant="primary" fullWidth href="/onboarding" onClick={closeMenu}>
                  Sign up
                </Button>
              )}
            </div>
          </div>
        </>
      ) : null}
    </nav>
  );
}
