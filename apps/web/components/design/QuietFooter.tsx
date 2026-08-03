import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "../brand/Logo";

export const QUIET_FOOTER_COLUMNS = [
  [
    "Product",
    [
      ["Your child's progress report", "/onboarding"],
      ["How the report works", "/onboarding/method"],
      ["Features", "/#features"],
    ],
  ],
  [
    "Company",
    [
      ["Our story", "/#stories"],
      ["Blog", "/blog"],
      ["Joining Homa", "/onboarding"],
    ],
  ],
  [
    "Support",
    [
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Contact", "mailto:hello@thankshoma.com"],
    ],
  ],
] as const;

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return href.startsWith("/") ? (
    <Link href={href}>{children}</Link>
  ) : (
    <a href={href}>{children}</a>
  );
}
/** Shared Quiet authority footer for marketing, onboarding, and editorial routes. */
export function QuietFooter() {
  return (
    <footer className="quiet-footer">
      <div className="quiet-footer__inner">
        <div className="quiet-footer__brand">
          <Logo size={30} tone="dark" />
          <p>Your homeschool helper, keeping the work and the record together.</p>
          <a href="mailto:hello@thankshoma.com" className="quiet-footer__email">
            hello@thankshoma.com
          </a>
        </div>
        {QUIET_FOOTER_COLUMNS.map(([heading, links]) => (
          <nav key={heading} aria-label={heading}>
            <div className="quiet-footer__head">{heading}</div>
            <div className="quiet-footer__links">
              {links.map(([label, href]) => (
                <FooterLink href={href} key={label}>
                  {label}
                </FooterLink>
              ))}
            </div>
          </nav>
        ))}
      </div>
      <div className="quiet-footer__legal">
        <span>© 2026 Homa.</span>
        <span>Made for families who teach.</span>
      </div>
    </footer>
  );
}
