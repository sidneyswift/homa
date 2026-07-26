import Link from "next/link";

import { Logo } from "../brand/Logo";

/**
 * Navy site footer: brand column with a serif tagline + Product / Company /
 * Support link columns + copyright rule. Evolved from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx with a quiet ruled-paper
 * texture (white at 4%, the notebook Homa keeps). Everything sits on one
 * 45px ruling: link rows are exactly 45px (24+21+0) so every baseline rides
 * its rule the way the tagline's 45px leading does, and the copyright border
 * lands on a rule. The yellow-to-navy wave seam is rendered by page.tsx above
 * this component; the footer adds no second closing device.
 */

const COLUMNS: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, string]>]> = [
  ["Product", [["Your child's progress report", "/onboarding"], ["How the report works", "/onboarding/method"], ["Features", "/#features"]]],
  ["Company", [["Our story", "/#stories"], ["Blog", "/blog"], ["Joining Homa", "/onboarding"]]],
  ["Support", [["Privacy", "/privacy"], ["Terms", "/terms"], ["Contact", "mailto:hello@thankshoma.com"]]],
];

/* The one link long enough to wrap on true phones; at 480px and below it
   gets a two-rule-row treatment (90px) so the ruling stays in tune below
   it. From 481px up the column is wide enough for one line. */
const TALL_LINK = "Your child's progress report";

/* Ruling geometry, all in px from the footer's top edge:
   rules repeat every 45px with the first visible rule at y=108, which is the
   gap between each column heading (76 to 96) and its first link. The solid
   navy layer above 90px keeps any rule from crossing the wordmark. Row
   heights are built to that pitch: heading block 32px, link row 45px
   (padding 24 + line 21 + 0), tagline one line of 45px leading on desktop,
   email row framed 198 to 243, copyright border on the rule at 288. Every
   stacked band stays in tune because gap 13 + heading 32 is one rule row,
   and the brand block (28 logo + 16 + 33 margins) plus its 45px rows always
   ends on a rule. Baselines write ON the rules, measured, not assumed: the
   tagline's serif baseline sits 4px above its rule, and 24px top padding
   puts the 15.5px link ascent at 5.5px above its rule, the closest a 21px
   line box inside a 45px row can get. The tall link's phone treatment
   switches to 45px line boxes (12px top padding, 33px below) so both of its
   lines write on their own rule at the same 5.5px offset. The focus ring
   is gold, not clay: clay disappears against navy. */
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
/* Zero strut: the email + flourish line box must end exactly at the email's
   45px row, or the inherited body line-height adds a stray px under it and
   knocks the legal border off its rule. Every child sets its own leading. */
.lp-footer-brand { line-height: 0; }
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
  padding: 24px 0 0;
  color: var(--on-brand);
  text-decoration: none;
  font-size: 0.9rem;
  line-height: 21px;
  transition: text-decoration-color var(--dur-fast) var(--ease-out);
}
/* Resting and hover are both on-brand white now, so hover reads via
   underline instead of color (the focus ring already covers focus). */
.lp-footer-link:hover { text-decoration: underline; text-underline-offset: 3px; }
.lp-footer-link:focus-visible {
  outline: 2px solid var(--gold-400);
  outline-offset: 3px;
  border-radius: var(--radius-xs);
  color: var(--on-brand);
}
.lp-footer-email { margin-top: 33px; }
/* A pen tail after the email, the one hand-made mark in the brand column's
   quiet right side. It shares the email's 45px line box (bottom-aligned, so
   the curve rides the same rule the email baseline sits on) and stays at 10%
   white: louder than the 4% rules, quieter than the 14% legal border. */
.lp-footer-flourish {
  /* The global reset blockifies svg; inline-block returns it to the
     email's line box. */
  display: inline-block;
  vertical-align: bottom;
  margin-left: 14px;
  pointer-events: none;
}
.lp-footer-legal { margin: 45px auto 0; }
@media (max-width: 1120px) {
  /* The brand column collapses before it can crush: under ~1115px the
     1.4fr brand track (viewport - 80 padding - 600 link tracks - 96 gaps)
     falls below the one-line email + flourish measure (184 + 14 + 140 =
     338px), which would wrap the pen tail onto an orphan row and strand a
     dead band beside it. So from 1120px down the brand spans the full first
     row and the three navs share an even row below it. Row gap 13 keeps the
     ruling in tune (13 + heading 32 is one rule row). Below 880px the shared
     .lp-4col rule takes the template to two columns; the brand span carries
     through. */
  .lp-footer-brand { grid-column: 1 / -1; }
  .lp-footer-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 13px 24px;
  }
}
@media (max-width: 880px) {
  .lp-footer-link { font-size: 0.875rem; text-wrap: balance; }
  /* Support spans both columns as one full-width ruled utility row, so the
     2-up collapse never leaves a vacant grid cell or a half-empty band. It
     reads left-anchored like every other list; the two-ended space-between
     treatment stays unique to the legal band. */
  .lp-footer nav:nth-of-type(3) { grid-column: 1 / -1; }
  .lp-footer nav:nth-of-type(3) .lp-footer-links {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: 0 64px;
  }
}
@media (max-width: 480px) {
  /* Two full rule rows on phones only, each line riding its own rule: with
     45px line boxes, baselines land at 12 + 27.5 = 39.5 and 84.5 (half
     leading (45 - 21) / 2 plus the 15.5px ascent), 5.5px above BOTH rules,
     the same dialect as every neighbor, and no rule slices between the two
     lines of one link. 12 + 90 - 12 = 90 keeps the ruling in pitch at two
     rule rows exactly, so the next link starts on the very next rule
     instead of leaving a blank ruled row the sibling column fills. */
  .lp-footer-link--tall { padding: 12px 0 0; margin-bottom: -12px; line-height: 45px; max-width: 9em; }
  .lp-footer-flourish { display: none; }
}
`;

export function Footer() {
  return (
    <footer className="lp-pad lp-footer" style={{ color: "var(--on-brand)", padding: "76px 40px 36px" }}>
      <style>{FOOTER_CSS}</style>
      <div className="lp-4col lp-footer-grid">
        <div className="lp-footer-brand">
          {/* display flex (not the default inline-flex) pins the lockup to
              exactly 28px tall, keeping the ruling math true below it. */}
          <Logo size={28} tone="dark" style={{ display: "flex" }} />
          <p
            style={{
              margin: "16px 0 0",
              maxWidth: 420,
              fontWeight: 400,
              fontSize: "1.15rem",
              lineHeight: "45px",
              color: "var(--on-brand)",
              textWrap: "pretty",
            }}
          >
            Your homeschool helper.
          </p>
          <a href="mailto:hello@thankshoma.com" className="lp-footer-link lp-footer-email">
            hello@thankshoma.com
          </a>
          <svg
            className="lp-footer-flourish"
            width="140"
            height="45"
            viewBox="0 0 140 45"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 39 C 20 32.5, 38 43.5, 60 38.5 C 78 34.5, 96 43, 116 38 C 124 36.2, 132 36.5, 138 38.5"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
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
        className="lp-footer-legal"
        style={{
          maxWidth: 1120,
          paddingTop: 22,
          borderTop: "1px solid rgba(255, 255, 255, 0.14)",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "6px 24px",
          fontSize: "0.85rem",
          color: "var(--on-brand)",
        }}
      >
        <span>&copy; 2026 Homa.</span>
        <span
          style={{
            fontSize: "0.95rem",
            color: "var(--on-brand)",
          }}
        >
          Made for families who teach.
        </span>
      </div>
    </footer>
  );
}
