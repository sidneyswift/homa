"use client";

import Link from "next/link";
import { Menu, Settings, X } from "lucide-react";
import { useEffect, useRef, useState, type TransitionEvent } from "react";

import { Logo } from "../brand/Logo";
import { APP_NAV_ITEMS } from "../dashboard/sidebar-nav";
import { Button } from "./ds/Button";
import { HERO_COPY } from "./landing-content";
import { useSignedIn } from "./use-signed-in";
import { useSignupPopup } from "./SignupPopupProvider";

/**
 * Sticky marketing nav, evolved from the former landing composition. Links
 * anchor to their
 * page sections; "Sign in" points at /signin; the primary CTA carries the
 * same free-report promise as the hero (HERO_COPY.primaryAction, so the
 * nav never sells a different action than the page) and opens the landing
 * page's signup popup where a SignupPopupProvider wraps this, or falls
 * back to navigating straight to /onboarding everywhere else Nav renders
 * (onboarding, blog), where there's no popup to open.
 *
 * Surface: transparent at rest (founder call 2026-07-06, it reads as part
 * of whatever's underneath), but once the page scrolls the kit's original
 * frosted cream fill fades back in (globals.css .lp-nav::before), because
 * a sticky transparent bar lets content scroll through the links (founder
 * bug report 2026-07-08). The bar itself stays full-bleed while an inner
 * .lp-nav-row is capped at the page's 1200px content rail, so the logo
 * lands on the hero text edge at wide viewports instead of hugging the
 * viewport corner; the section links sit on true viewport center past
 * 1000px (absolute centering, where the wide auth cluster can no longer
 * collide with them, measured ~55px of clearance at 1000 with the widest
 * signed-out cluster) and float in the free space below that, so wide
 * viewports, including iPad landscape at 1024, read as one balanced
 * logo / links / auth rhythm that lines up with the symmetric hero
 * underneath.
 * Base layout styles live in globals.css as .lp-nav; link, rail, scrim,
 * and exit styling live in NAV_CSS below (this component's own
 * stylesheet) because globals.css is owned elsewhere.
 *
 * An IntersectionObserver over the three anchor targets marks the section
 * currently under the viewport's midline with aria-current, so the nav
 * reflects where the reader is; on routes without those sections (blog,
 * onboarding) no target resolves and the observer never attaches. The
 * phone menu never shows three identical resting ticks: when no section
 * crosses the spy band it marks the last section the reader crossed,
 * defaulting to the first link before any scroll (an unscrolled reader
 * is at "How it works"), so the grown tick always reads as a position
 * indicator. The desktop links keep the pure spy value; underlining a
 * link the reader never scrolled to would claim too much there.
 *
 * Phones (<=880px, the kit's breakpoint): everything except the logo and
 * a hamburger toggle hides (.lp-nav-links), founder call 2026-07-08:
 * "there should only be logo and hamburger", and the bar drops to 64px
 * (NAV_CSS overrides --lp-nav-height at :root so the hero gradient tuck
 * and anchor scroll margins, which consume the variable, stay in sync).
 * The toggle opens a cream card menu over a warm scrim that starts below
 * the bar's bottom hairline (the frosted bar stays a crisp sheet above
 * it), carrying the section links, "Sign in" (so signing in is never
 * desktop-only, same founder report), and the full-width free-report CTA
 * as the menu's closing offer; rows stagger in a few ms apart, transform
 * and opacity only. While the menu is open the page behind it cannot
 * scroll (html overflow lock). The menu closes on any link tap, Escape, a
 * tap on the scrim, or the viewport growing past the breakpoint; close
 * plays a short fade (data-closing) before React unmounts it, with a
 * timeout fallback in case transitionend never fires, and hands focus
 * back to the toggle so keyboard users are never stranded on <body>.
 * While open, Tab is contained to the toggle plus the menu's focusables,
 * and the nav's page siblings go inert, so keyboard, switch, and
 * screen-reader users never walk the dimmed page behind it.
 *
 * Auth-aware (founder report 2026-07-09: a signed-in parent was still
 * offered sign-up): useSignedIn resolves the Supabase session after
 * mount, and while it's true the auth links swap for one "Open Homa"
 * button on desktop, and the phone menu swaps the marketing links for
 * the app's tabs (APP_NAV_ITEMS, the same list the desktop sidebar
 * renders) plus Settings, so the menu reads as the signed-in app's nav,
 * not a pitch.
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
/** Outlives the 120ms exit transition; unmounts if transitionend is lost. */
const MENU_EXIT_FALLBACK_MS = 260;
/** A section is "current" while it crosses this band of the viewport
    (just above the midline, so the active link flips as a section's
    content, not its tail, is what the reader sees). */
const SECTION_SPY_ROOT_MARGIN = "-40% 0px -50% 0px";

/* Nav-owned styles. Everything here is scoped to .lp-nav-* class names so
   it composes with (never fights) the base .lp-nav rules in globals.css;
   a doubled selector is used where this sheet must win a specificity tie.
   All color and motion values are design-system tokens; the scrim ink
   rgba(51,42,33) is the shadow ink the token file already uses. */
const NAV_CSS = `
/* The page's 1200px section boxes are border-box WITH their 40px side
   padding, so the text rail they draw is 1120px wide. The bar's own 40px
   padding sits outside this row; capping the row at 1120px lands the logo
   and CTA exactly on that rail at every viewport past the breakpoint. */
.lp-nav-row {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
}
.lp-nav-home {
  display: inline-flex;
  align-items: center;
  padding: 8px 10px;
  margin: -8px -10px;
  border-radius: var(--radius-sm);
}
.lp-nav-home:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--brand), var(--shadow-focus);
}
/* Below 1000px, auto margins float the links in the free space so they
   collapse gracefully near the 881px breakpoint instead of riding over
   the logo. Past 1000px the auth cluster is much wider than the logo, so
   free-space centering sits visibly left of true center while the hero
   below is symmetric; with collision impossible there (measured ~55px
   between the links and the widest signed-out auth cluster at 1000),
   the links are absolutely centered on the row instead, which keeps
   iPad landscape at 1024 on the same centered rhythm as desktop. */
.lp-nav-primary {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  margin-right: auto;
}
@media (min-width: 1000px) {
  .lp-nav-row {
    position: relative;
  }
  .lp-nav-primary {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
  }
  /* At the band's narrow end the centered links sit close to "Sign in"
     while acres of air sit after the logo, so the two clusters started
     reading as one row of links; a wider auth gap plus a left pad keeps
     the seam legible without moving the links off true center. Doubled
     selector wins the tie with the base .lp-nav-auth gap below. */
  .lp-nav-auth.lp-nav-auth {
    padding-left: 24px;
    gap: 16px;
  }
}
.lp-nav-auth {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
.lp-nav-link {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: var(--radius-pill);
  color: var(--text-muted);
  text-decoration: none;
  font-weight: var(--weight-medium);
  font-size: var(--text-sm);
  line-height: 1.2;
  white-space: nowrap;
  transition: color var(--dur-fast) var(--ease-out);
}
.lp-nav-link::after {
  content: "";
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 3px;
  height: 2px;
  border-radius: 2px;
  background: var(--brand);
  opacity: 0;
  transform: scaleX(0.5);
  transform-origin: left center;
  transition: opacity var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
}
.lp-nav-link:hover {
  color: var(--text-strong);
}
.lp-nav-link:hover::after {
  opacity: 1;
  transform: scaleX(1);
}
.lp-nav-link:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--brand), var(--shadow-focus);
  color: var(--text-strong);
}
.lp-nav-link[aria-current] {
  color: var(--text-strong);
}
.lp-nav-link[aria-current]::after {
  opacity: 1;
  transform: scaleX(1);
}
.lp-nav-link-ink {
  color: var(--text-body);
  font-weight: var(--weight-semibold);
}
.lp-nav-toggle:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--brand), var(--shadow-focus);
}
/* A whisper of depth once the frosted surface is in: the bar reads as a
   sheet of paper lifted off the page, not a line taped across it. The
   fill also steps up from the base 85% cream: at 85%, saturated bands
   scrolling underneath (the cobalt ticker) ghosted through the blur as
   muddy smears, and at 92% high-luminance cards (the hero chat card)
   still passed under the links as a visible light patch, splitting the
   bar into two tones. 95% keeps one uniform sheet while the blur still
   whispers that the page is underneath. The doubled selector wins the
   tie with the base .lp-nav::before background in globals.css. */
.lp-nav.lp-nav[data-scrolled="true"]::before {
  background: color-mix(in srgb, var(--surface-raised) 95%, transparent);
  box-shadow: var(--shadow-sm);
}
@media (max-width: 880px) {
  :root {
    --lp-nav-height: 64px;
  }
  .lp-nav.lp-nav {
    padding: 10px 20px;
  }
  /* Phones scroll display-size H2s directly under the shallow 64px bar,
     where even the 95% fill lets dark headings read through the blur as
     sliced text; 98% stops that while keeping a whisper of frost. */
  .lp-nav.lp-nav[data-scrolled="true"]::before {
    background: color-mix(in srgb, var(--surface-raised) 98%, transparent);
  }
  /* The scrim starts at the bar's bottom hairline, so the frosted bar
     stays one crisp sheet above it instead of a half-dimmed band. */
  .lp-nav-menu-backdrop {
    top: var(--lp-nav-height);
    background: rgba(51, 42, 33, 0.45);
    opacity: 1;
    transition: opacity var(--dur-base) var(--ease-out);
    @starting-style {
      opacity: 0;
    }
  }
  .lp-nav-menu-backdrop[data-closing="true"] {
    opacity: 0;
    pointer-events: none;
    transition-duration: var(--dur-fast);
  }
  /* The card is the page's paper, not a bare white sheet: cream fill,
     hairline border, and rows that answer touch with the same coral
     underline the desktop links use. */
  .lp-nav-menu.lp-nav-menu {
    padding: 10px;
    background: var(--surface-raised);
    border: 1px solid var(--border-subtle);
  }
  .lp-nav-menu[data-closing="true"] {
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
    pointer-events: none;
    transition-duration: var(--dur-fast);
  }
  /* Rows drift in 72ms apart (transform/opacity only), a step wide enough
     to register as a cascade while the whole menu still settles inside
     ~400ms; --stagger is read by each row's own transition list below so
     hover and press feedback never inherit the entrance delay. */
  .lp-nav-menu > * {
    --stagger: 0ms;
    opacity: 1;
    transform: none;
    transition: opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out);
    transition-delay: var(--stagger);
    @starting-style {
      opacity: 0;
      transform: translateY(4px);
    }
  }
  .lp-nav-menu > :nth-child(2) { --stagger: calc(var(--dur-fast) * 0.6); }
  .lp-nav-menu > :nth-child(3) { --stagger: calc(var(--dur-fast) * 1.2); }
  .lp-nav-menu > :nth-child(4) { --stagger: calc(var(--dur-fast) * 1.8); }
  .lp-nav-menu > :nth-child(5) { --stagger: calc(var(--dur-fast) * 2.4); }
  .lp-nav-menu > :nth-child(6) { --stagger: calc(var(--dur-fast) * 3.0); }
  .lp-nav-menu > :nth-child(7) { --stagger: calc(var(--dur-fast) * 3.6); }
  .lp-nav-menu[data-closing="true"] > * {
    transition-delay: 0ms;
  }
  .lp-nav-menu-link.lp-nav-menu-link {
    position: relative;
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 10px 14px;
    transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out);
    transition-delay: 0ms, 0ms, var(--stagger), var(--stagger);
  }
  /* Phones have no hover and a press lasts ~120ms, so the coral accent
     rests visible at 0.3 (the brand mark is never desktop-only in a
     mobile-only menu) and deepens to full on press and aria-current. */
  .lp-nav-menu-link::after {
    content: "";
    position: absolute;
    left: 14px;
    bottom: 8px;
    width: 22px;
    height: 2px;
    border-radius: 2px;
    background: var(--brand);
    opacity: 0.3;
    transform: scaleX(1);
    transform-origin: left center;
    transition: opacity var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), width var(--dur-fast) var(--ease-out);
  }
  .lp-nav-menu-link.lp-nav-menu-link:hover,
  .lp-nav-menu-link.lp-nav-menu-link:active {
    background: var(--brand-soft);
    color: var(--text-strong);
  }
  .lp-nav-menu-link:hover::after,
  .lp-nav-menu-link:active::after {
    opacity: 1;
    transform: scaleX(1);
  }
  .lp-nav-menu-link:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--brand), var(--shadow-focus);
  }
  .lp-nav-menu-link[aria-current] {
    color: var(--text-strong);
  }
  /* The current section reads by shape as well as tone: the tick grows to
     36px, so it never depends on the 0.3-vs-1.0 opacity step alone (an
     opacity-only cue is near-invisible to low-vision readers). */
  .lp-nav-menu-link[aria-current]::after {
    opacity: 1;
    transform: scaleX(1);
    width: 36px;
  }
  /* "Sign in" can never be the current section, so it carries no resting
     tick; sharing the section-spy mark muddied what the grown tick means. */
  .lp-nav-menu-link-strong::after {
    content: none;
  }
  /* The rule between links and auth is the brand's hand-drawn squiggle,
     inked in the same coral as the link ticks so the menu speaks one ink
     voice (the shared --squiggle-ink token strokes gray, and a data URI
     cannot read CSS variables, so the same 40x8 wave is restated here
     with the --brand value from globals.css, clay-500 #E7602F). 0.35
     sits the wave at the resting ticks' visual weight. */
  .lp-nav-menu-divider.lp-nav-menu-divider {
    height: 8px;
    margin: 8px 14px 6px;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='8' viewBox='0 0 40 8'%3E%3Cpath d='M0 4 Q5 0 10 4 T20 4 T30 4 T40 4' fill='none' stroke='%23E7602F' stroke-width='1.6'/%3E%3C/svg%3E") repeat-x left center / 40px 8px;
    opacity: 0.35;
  }
}
@media (prefers-reduced-motion: reduce) {
  .lp-nav-link::after,
  .lp-nav-menu-link::after {
    transform: none;
    transition: opacity var(--dur-fast) ease;
  }
  .lp-nav-menu-backdrop {
    transition: opacity var(--dur-base) ease;
  }
  .lp-nav-menu[data-closing="true"] {
    transform: none;
    transition: opacity var(--dur-fast) ease;
  }
  .lp-nav-menu > *,
  .lp-nav-menu-link.lp-nav-menu-link {
    transition: none;
    transform: none;
    @starting-style {
      opacity: 1;
      transform: none;
    }
  }
}
`;

type MenuState = "closed" | "open" | "closing";

export function Nav() {
  const openPopup = useSignupPopup();
  const signedIn = useSignedIn();
  const [scrolled, setScrolled] = useState(false);
  const [activeHref, setActiveHref] = useState<string | null>(null);
  // The phone menu's copy of the spy value, kept sticky so its tick is
  // never uninformative: seeded with the first link once the section
  // targets resolve (page top, nothing crossing the band yet) and held
  // at the last crossed section when the reader scrolls past all three
  // (FAQ, footer). Stays null on routes without the landing sections.
  const [menuTickHref, setMenuTickHref] = useState<string | null>(null);
  const [menuState, setMenuState] = useState<MenuState>("closed");
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const prevMenuStateRef = useRef<MenuState>("closed");
  const menuOpen = menuState === "open";
  const menuVisible = menuState !== "closed";
  const closeMenu = () => setMenuState((state) => (state === "open" ? "closing" : state));

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
    // Section spy: whichever anchor target crosses the viewport band is
    // the current section. On routes without the landing sections no
    // target resolves and no observer attaches.
    const targets = LINKS.flatMap(([, href]) => {
      const id = href.split("#")[1];
      const el = id ? document.getElementById(id) : null;
      return el ? [[href, el] as const] : [];
    });
    if (targets.length === 0) return;
    const crossing = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const match = targets.find(([, el]) => el === entry.target);
          if (!match) continue;
          if (entry.isIntersecting) crossing.add(match[0]);
          else crossing.delete(match[0]);
        }
        // The band is thin, so at most one section usually crosses it;
        // when two do (a short section), the later one wins.
        let current: string | null = null;
        for (const [href] of targets) if (crossing.has(href)) current = href;
        setActiveHref(current);
        // Sticky tick: the observer's initial pass fires with nothing
        // crossing at page top, which seeds the first link; afterwards
        // the tick holds the last crossed section.
        setMenuTickHref((prev) => current ?? prev ?? LINKS[0][1]);
      },
      { rootMargin: SECTION_SPY_ROOT_MARGIN }
    );
    for (const [, el] of targets) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
        return;
      }
      // Focus stays inside the overlay: the page behind it is scroll-locked
      // and scrim-dimmed, so tabbing into it would move through invisible
      // links. The cycle is toggle, then the menu's own focusables, wrapped
      // at both ends.
      if (event.key !== "Tab") return;
      const menu = document.getElementById("lp-nav-menu");
      const toggle = toggleRef.current;
      if (!menu || !toggle) return;
      const focusables: HTMLElement[] = [
        toggle,
        ...menu.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ),
      ];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !focusables.includes(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    // The scrim dims the page; locking html keeps it from also scrolling
    // underneath, which read as a broken overlay.
    if (!menuVisible) return;
    const root = document.documentElement;
    const prior = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prior;
    };
  }, [menuVisible]);

  useEffect(() => {
    // The scrim hides the page visually and the Tab trap contains the
    // keyboard, but screen-reader virtual cursors and VoiceOver swipes
    // ignore both, so the dimmed content also leaves the accessibility
    // tree: every sibling of the nav (the page sections) goes inert while
    // the menu is open. The nav itself never does, so the toggle and menu
    // stay reachable. Keyed to open, not visible: the menu's CTA opens
    // the signup popup (a sibling) during the exit fade, and the popup
    // must not mount inert. Pre-existing inert siblings are left alone so
    // cleanup never un-inerts something another overlay owns.
    if (!menuOpen) return;
    const nav = navRef.current;
    if (!nav?.parentElement) return;
    const dimmed = Array.from(nav.parentElement.children).filter(
      (el) => el !== nav && !el.hasAttribute("inert")
    );
    for (const el of dimmed) el.setAttribute("inert", "");
    return () => {
      for (const el of dimmed) el.removeAttribute("inert");
    };
  }, [menuOpen]);

  useEffect(() => {
    if (menuState !== "closing") return;
    const timer = window.setTimeout(() => setMenuState("closed"), MENU_EXIT_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [menuState]);

  useEffect(() => {
    // Escape or a scrim tap would otherwise strand keyboard focus on
    // <body>; hand it back to the toggle once the exit fade finishes.
    const prev = prevMenuStateRef.current;
    prevMenuStateRef.current = menuState;
    if (menuState === "closed" && prev === "closing") {
      toggleRef.current?.focus({ preventScroll: true });
    }
  }, [menuState]);

  useEffect(() => {
    // Rotating to landscape past the breakpoint would strand an open menu.
    const desktop = window.matchMedia(DESKTOP_QUERY);
    function onChange(event: MediaQueryListEvent) {
      if (event.matches) setMenuState("closed");
    }
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  function onMenuTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (menuState !== "closing") return;
    if (event.target !== event.currentTarget) return;
    if (event.propertyName !== "opacity") return;
    setMenuState("closed");
  }

  const closing = menuState === "closing" ? "true" : undefined;
  const ctaLabel = HERO_COPY.primaryAction;

  return (
    <nav ref={navRef} className="lp-nav lp-pad" data-scrolled={scrolled || menuVisible ? "true" : "false"}>
      <style>{NAV_CSS}</style>
      <div className="lp-nav-row">
        <Link href="/" aria-label="Homa" className="lp-nav-home">
          <Logo size={28} />
        </Link>
        <div className="lp-nav-links lp-nav-primary">
          {LINKS.map(([label, href]) => (
            <Link
              key={label}
              href={href}
              className="lp-nav-link"
              aria-current={activeHref === href ? "true" : undefined}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="lp-nav-auth">
          {signedIn ? (
            // Signed in: one door back into the app, no auth pitch.
            <span className="lp-nav-links" style={{ display: "inline-flex" }}>
              <Button variant="primary" href="/app">
                Open Homa
              </Button>
            </span>
          ) : (
            <>
              <Link href="/signin" className="lp-nav-links lp-nav-link lp-nav-link-ink">
                Sign in
              </Link>
              {/* Button has no className prop, so a hide-on-phones wrapper
                  carries .lp-nav-links for it. */}
              <span className="lp-nav-links" style={{ display: "inline-flex" }}>
                {openPopup ? (
                  <Button variant="primary" onClick={openPopup}>
                    {ctaLabel}
                  </Button>
                ) : (
                  <Button variant="primary" href="/onboarding">
                    {ctaLabel}
                  </Button>
                )}
              </span>
            </>
          )}
          <button
            ref={toggleRef}
            type="button"
            className="lp-nav-toggle"
            aria-expanded={menuOpen ? "true" : "false"}
            aria-controls="lp-nav-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuState((state) => (state === "open" ? "closing" : "open"))}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {menuVisible ? (
        <>
          {/* Scrim: any tap outside the menu closes it. */}
          <div
            className="lp-nav-menu-backdrop"
            data-closing={closing}
            onClick={closeMenu}
            aria-hidden="true"
          />
          <div
            id="lp-nav-menu"
            className="lp-nav-menu"
            data-closing={closing}
            onTransitionEnd={onMenuTransitionEnd}
          >
            {signedIn ? (
              <>
                {APP_NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="lp-nav-menu-link lp-nav-menu-link-app"
                    onClick={closeMenu}
                  >
                    <Icon size={18} aria-hidden="true" />
                    {label}
                  </Link>
                ))}
                <div className="lp-nav-menu-divider" aria-hidden="true" />
                <Link
                  href="/app/settings"
                  className="lp-nav-menu-link lp-nav-menu-link-app"
                  onClick={closeMenu}
                >
                  <Settings size={18} aria-hidden="true" />
                  Settings
                </Link>
              </>
            ) : (
              <>
                {LINKS.map(([label, href]) => (
                  <Link
                    key={label}
                    href={href}
                    className="lp-nav-menu-link"
                    aria-current={menuTickHref === href ? "true" : undefined}
                    onClick={closeMenu}
                  >
                    {label}
                  </Link>
                ))}
                <div className="lp-nav-menu-divider" aria-hidden="true" />
                <Link
                  href="/signin"
                  className="lp-nav-menu-link lp-nav-menu-link-strong"
                  onClick={closeMenu}
                >
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
                      {ctaLabel}
                    </Button>
                  ) : (
                    <Button variant="primary" fullWidth href="/onboarding" onClick={closeMenu}>
                      {ctaLabel}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      ) : null}
    </nav>
  );
}
