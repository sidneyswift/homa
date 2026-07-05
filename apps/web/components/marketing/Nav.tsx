import Link from "next/link";

import { Logo } from "../brand/Logo";
import { Button } from "./ds/Button";

/**
 * Sticky marketing nav, ported verbatim from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx. Links anchor to their
 * page sections; "Sign in" points at /signin; "Start free" routes to the
 * waitlist (the live conversion path until invites open).
 */

const LINKS: ReadonlyArray<readonly [string, string]> = [
  ["How it works", "/#how"],
  ["Features", "/#features"],
  ["Try it", "/#try"],
  ["Our story", "/#stories"],
];

export function Nav() {
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
        background: "rgba(251,247,240,0.85)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--border-subtle)",
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
        <Button variant="primary" href="/map">
          Your child&rsquo;s map
        </Button>
      </div>
    </nav>
  );
}
