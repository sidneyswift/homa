"use client";

import Link from "next/link";

import { Logo } from "../brand/Logo";
import { Button } from "./ds/Button";
import { useSignupPopup } from "./SignupPopupProvider";

/**
 * Sticky marketing nav, ported verbatim from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx. Links anchor to their
 * page sections; "Sign in" points at /signin; "Sign up" opens the landing
 * page's signup popup where a SignupPopupProvider wraps this (the
 * landing page itself), or falls back to navigating straight to
 * /onboarding everywhere else Nav renders (onboarding, blog), where
 * there's no popup to open.
 *
 * Transparent globally (founder call 2026-07-06): no fill, no blur, no
 * border, so it reads as part of whatever's underneath rather than a bar
 * sitting on top. Every page this renders on (landing, blog, onboarding)
 * currently has a light background directly under the nav, so contrast
 * holds; a future section with a dark or busy background starting at the
 * very top of a page would need its own check.
 */

const LINKS: ReadonlyArray<readonly [string, string]> = [
  ["How it works", "/#how"],
  ["Features", "/#features"],
  ["Our story", "/#stories"],
];

export function Nav() {
  const openPopup = useSignupPopup();
  return (
    <nav
      className="lp-pad"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 32,
        padding: "18px 40px",
        background: "transparent",
      }}
    >
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
        {openPopup ? (
          <Button variant="primary" onClick={openPopup}>
            Sign up
          </Button>
        ) : (
          <Button variant="primary" href="/onboarding">
            Sign up
          </Button>
        )}
      </div>
    </nav>
  );
}
