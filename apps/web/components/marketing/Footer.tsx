import Link from "next/link";

import { Logo } from "../brand/Logo";

/**
 * Navy site footer: brand column with a serif tagline + Product / Company /
 * Support link columns + copyright rule. Evolved from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx with a quiet ruled-paper
 * texture (white at 4%, the notebook Homa keeps). Everything sits on one
 * 45px ruling: link rows are exactly 45px (12+21+12), the tagline leading is
 * 45px so its baselines rest on the rules, and the copyright border lands on
 * a rule. The yellow-to-navy wave seam is rendered by page.tsx above this
 * component; the footer adds no second closing device.
 */

const COLUMNS: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, string]>]> = [
  ["Product", [["Your child's progress report", "/onboarding"], ["How the report works", "/onboarding/method"], ["Features", "/#features"]]],
  ["Company", [["Our story", "/#stories"], ["Blog", "/blog"], ["Joining Homa", "/onboarding"]]],
  ["Support", [["Privacy", "/privacy"], ["Terms", "/terms"], ["Contact", "mailto:hello@mail.thankshoma.com"]]],
];

/* The one link long enough to wrap on phones; it gets a two-rule-row
   treatment (90px) so the ruling stays in tune below it. */
const TALL_LINK = "Your child's progress report";

/* Ruling geometry, all in px from the footer's top edge:
   rules repeat every 45px with the first visible rule at y=108, which is the
   gap between each column heading (76 to 96) and its first link. The solid
   navy layer above 90px keeps any rule from crossing the wordmark. Row
   heights are built to that pitch: heading block 32px, link row 45px
   (padding 12 + line 21 + 12), tagline leading 45px, email row framed
   243 to 288, copyright border on the rule at 333. The mobile row gap of
   58px keeps stacked nav rows on the same grid (32 + 58 is one whole rule
   plus one heading block). The focus ring is gold, not clay: clay
   disappears against navy. */
const FOOTER_CSS = `
.lp-footer {
  background:
    linear-gradient(to bottom, var(--pop-navy) 0 90px, transparent 90px),
    repeating-linear-gradient(to bottom, transparent 0, transparent 44px, rgba(255, 255, 255, 0.04) 44px, rgba(255, 255, 255, 0.04) 45px) 0 64px,
    var(--pop-navy);
}
.lp-footer-grid {
  max-width: 1120px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) repeat(3, minmax(0, 200px));
  justify-content: space-between;
  gap: 44px 32px;
}
.lp-footer-head {
  color: var(--on-brand);
  font-weight: 700;
  font-size: 0.75rem;
  line-height: 20px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  margin-bottom: 12px;
}
.lp-footer-links {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.lp-footer-link {
  display: inline-block;
  padding: 12px 0;
  color: var(--stone-400);
  text-decoration: none;
  font-size: 0.9rem;
  line-height: 21px;
  transition: color var(--dur-fast) var(--ease-out);
}
.lp-footer-link:hover { color: var(--stone-100); }
.lp-footer-link:focus-visible {
  outline: 2px solid var(--gold-400);
  outline-offset: 3px;
  border-radius: var(--radius-xs);
  color: var(--stone-100);
}
.lp-footer-email { margin-top: 33px; }
@media (max-width: 880px) {
  .lp-footer-brand { grid-column: 1 / -1; }
  .lp-footer-grid { gap: 58px 24px; }
  .lp-footer-link { font-size: 0.875rem; text-wrap: balance; }
  /* Two full rule rows: the rule passes cleanly between the wrapped lines. */
  .lp-footer-link--tall { padding: 24px 0; max-width: 9em; }
  /* Support spans both columns as a horizontal utility row, so the 2-up
     collapse never leaves a vacant grid cell. */
  .lp-footer nav:nth-of-type(3) { grid-column: 1 / -1; }
  .lp-footer nav:nth-of-type(3) .lp-footer-links {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 0 28px;
  }
}
`;

export function Footer() {
  return (
    <footer className="lp-pad lp-footer" style={{ color: "var(--stone-300)", padding: "76px 40px 36px" }}>
      <style>{FOOTER_CSS}</style>
      <div className="lp-4col lp-footer-grid">
        <div className="lp-footer-brand">
          {/* display flex (not the default inline-flex) pins the lockup to
              exactly 28px tall, keeping the ruling math true below it. */}
          <Logo size={28} tone="dark" style={{ display: "flex" }} />
          <p
            style={{
              margin: "16px 0 0",
              maxWidth: 300,
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: "1.15rem",
              lineHeight: "45px",
              color: "var(--stone-300)",
              textWrap: "pretty",
            }}
          >
            The calm assistant for homeschooling families.
          </p>
          <a href="mailto:hello@mail.thankshoma.com" className="lp-footer-link lp-footer-email">
            hello@mail.thankshoma.com
          </a>
        </div>
        {COLUMNS.map(([heading, links]) => (
          <nav key={heading} aria-label={heading}>
            <div className="lp-footer-head">{heading}</div>
            {/* Anchors stretch to ~45px rows so the whole row is tappable. */}
            <div className="lp-footer-links">
              {links.map(([label, href]) => {
                const linkClass = label === TALL_LINK ? "lp-footer-link lp-footer-link--tall" : "lp-footer-link";
                return href.startsWith("/") ? (
                  <Link key={label} href={href} className={linkClass}>
                    {label}
                  </Link>
                ) : (
                  <a key={label} href={href} className={linkClass}>
                    {label}
                  </a>
                );
              })}
            </div>
          </nav>
        ))}
      </div>
      <div
        style={{
          maxWidth: 1120,
          margin: "45px auto 0",
          paddingTop: 22,
          borderTop: "1px solid rgba(255, 255, 255, 0.14)",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "6px 24px",
          fontSize: "0.85rem",
          color: "var(--stone-400)",
        }}
      >
        <span>&copy; 2026 Homa.</span>
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: "0.95rem",
            color: "var(--stone-300)",
          }}
        >
          Made for families who teach.
        </span>
      </div>
    </footer>
  );
}
