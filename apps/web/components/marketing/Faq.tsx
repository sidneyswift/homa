import { Doodle } from "./Doodle";
import { Eyebrow } from "./dividers";
import { FAQ_ITEMS } from "./faq-items";

/**
 * FAQ, evolved from docs/homa-design/ui_kits/landing/LandingPage.jsx into a
 * ruled reference sheet: one warm card holding every answer over the design
 * system's paper-rule texture, with two more sheets peeking out beneath like
 * pages in the binder. Items live in faq-items.ts, shared with the FAQPage
 * JSON-LD on the landing page. Questions are h3s so the document outline
 * keeps every question.
 *
 * Everything inside the card registers to the 32px paper-rule grid
 * (--bg-paper repeats every 32px): both type sizes run at a 32px line
 * height, every vertical space is a multiple of 32, and the sheet's
 * backgroundSize/backgroundPosition pin the rule phase so each text
 * baseline sits a couple of pixels above its rule, like handwriting on
 * lined paper. Change any vertical number here only in steps of 32.
 *
 * Layout lives in the scoped .lp-faq-* classes below (not inline) because
 * answers flow in CSS columns, which the shared .lp-2col grid fallback
 * cannot collapse; the media query here owns the phone layout instead.
 */

const FAQ_CSS = `
.lp-faq-cols { columns: 2; column-gap: 56px; }
.lp-faq-sheet { padding: 32px 48px; }
.lp-faq-margin { position: absolute; top: 52px; right: 0; display: flex; align-items: flex-end; gap: 16px; }
/* Rests the glyph's base on the same y as the Answers span's hairline
   (probe-measured: the svg box bottom sat 4.45px under the hairline at 20px). */
.lp-faq-doodle { display: inline-flex; margin-bottom: 24px; }
.lp-faq-signoff { right: 48px; }
.lp-faq-under1 { inset: 22px -14px -16px 16px; }
.lp-faq-under2 { inset: 30px -20px -22px 22px; }
/* In the 881-1024 band the two columns end rules apart and the blank
   field bottom-right becomes the section's largest void. Column width
   is the only lever that keeps the 32px rule registration intact, and
   the band needs it pulled in opposite directions: through 959 slimmer
   columns wrap the right column longer, from 960 wider columns let the
   left column shed lines. Probe-swept at 20 widths (faq-band-probe /
   faq-config-probe in the round's scratchpad): every tier holds the
   column-bottom delta at 3 blank rules or fewer at each probed width
   except an irreducible 911-914 sliver at 4 (no gap/pad pairing gets
   under it there). If FAQ copy changes, re-run the sweep before
   trusting these pairings. Horizontal values only; every vertical
   number stays a multiple of 32. */
@media (min-width: 881px) and (max-width: 914px) {
  .lp-faq-cols { column-gap: 64px; }
  .lp-faq-sheet { padding: 32px 56px; }
  .lp-faq-signoff { right: 56px; }
}
@media (min-width: 915px) and (max-width: 959px) {
  .lp-faq-cols { column-gap: 80px; }
  .lp-faq-sheet { padding: 32px 72px; }
  .lp-faq-signoff { right: 72px; }
}
@media (min-width: 960px) and (max-width: 1024px) {
  .lp-faq-cols { column-gap: 40px; }
  .lp-faq-sheet { padding: 32px 40px; }
  .lp-faq-signoff { right: 40px; }
}
@media (max-width: 880px) {
  .lp-faq-cols { columns: 1; }
  .lp-faq-sheet { padding: 32px 22px; }
  .lp-faq-margin { top: 2px; right: 0; }
  .lp-faq-margin-note { display: none; }
  .lp-faq-doodle { margin-bottom: 0; }
  .lp-faq-signoff { right: 22px; }
  /* Single column leaves one fully blank ruled row between items, which
     reads as a layout gap rather than paper; paint the card color over
     each inter-item padding band so rules only run behind written lines.
     The last item keeps its rules: the signoff claims those on purpose. */
  .lp-faq-item { position: relative; }
  .lp-faq-item:not(:last-child)::after { content: ""; position: absolute; left: -22px; right: -22px; bottom: 0; height: 32px; background: var(--surface-card); }
  .lp-faq-under1 { inset: 18px -9px -11px 12px; }
  .lp-faq-under2 { inset: 26px -14px -16px 18px; }
}
`;

export function Faq() {
  return (
    // scrollMarginTop keeps nav and deep links to #faq from tucking the
    // heading under the sticky bar: 80px rendered bar height + 24.
    // Bottom padding 88, not 120 (one 32px rule-grid step down): the sheet
    // sat a full cream void above the navy ribbon, the third slack gap in
    // the page's lower half (2026-07-26 composition pass).
    <section id="faq" className="lp-pad lp-section" style={{ padding: "64px 40px 88px", maxWidth: 1200, margin: "0 auto", scrollMarginTop: 104 }}>
      <style>{FAQ_CSS}</style>
      <div style={{ maxWidth: 1000, margin: "0 auto", position: "relative" }}>
        <div className="lp-faq-margin" aria-hidden="true">
          <span className="lp-faq-doodle">
            <Doodle name="sparkle" size={24} color="var(--pop-cobalt)" rotate={-6} />
          </span>
          <div className="lp-faq-margin-note" style={{ textAlign: "right" }}>
            <span
              style={{
                display: "block",
                padding: "0 2px 6px",
                borderBottom: "1px solid var(--border-subtle)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.72rem",
                fontWeight: 500,
                letterSpacing: "0.06em",
                color: "var(--pop-cobalt)",
              }}
            >
              Answers 01 to {String(FAQ_ITEMS.length).padStart(2, "0")}
            </span>
            <span
              style={{
                display: "block",
                marginTop: 6,
                padding: "0 2px",
                fontFamily: "var(--font-mono)",
                fontSize: "0.72rem",
                fontWeight: 500,
                letterSpacing: "0.06em",
                color: "var(--stone-600)",
              }}
            >
              One sheet, kept short
            </span>
          </div>
        </div>
        <div data-reveal="" style={{ marginBottom: 44, maxWidth: 620 }}>
          <Eyebrow color="var(--pop-cobalt)">Good to know</Eyebrow>
          <h2 className="lp-h2" style={{ color: "var(--text-strong)", margin: "10px 0 12px" }}>
            Questions, answered
          </h2>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: "1.2rem",
              color: "var(--stone-700)",
              margin: 0,
            }}
          >
            Short answers, before you begin.
          </p>
        </div>
        <div data-reveal="" className="rv-d1" style={{ position: "relative" }}>
          {/* Two sheets underneath, deepest first, so the card reads as the
              top page of a small stack rather than a thick border. */}
          <div
            aria-hidden="true"
            className="lp-faq-under2"
            style={{
              position: "absolute",
              background: "var(--surface-raised)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-2xl)",
              transform: "rotate(0.5deg)",
            }}
          />
          <div
            aria-hidden="true"
            className="lp-faq-under1"
            style={{
              position: "absolute",
              background: "var(--surface-raised)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-2xl)",
              boxShadow: "var(--shadow-xs)",
              transform: "rotate(-0.7deg)",
            }}
          />
          <div
            className="lp-faq-sheet"
            style={{
              position: "relative",
              background: "var(--surface-card)",
              backgroundImage: "var(--bg-paper)",
              /* --bg-paper is a repeating gradient with no intrinsic size, so
                 backgroundPosition only gets traction once the tile is pinned
                 to one 32px period; the -5px phase lands each rule 2-4px
                 under the text baselines (probe-measured: h3 2.45, p 3.45). */
              backgroundSize: "100% 32px",
              backgroundPosition: "0 -5px",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-2xl)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div data-reveal-kids="" className="lp-faq-cols">
              {FAQ_ITEMS.map(([q, a], i) => (
                <article key={q} className="lp-faq-item" style={{ breakInside: "avoid", padding: "0 0 32px" }}>
                  <h3
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 12,
                      margin: 0,
                      fontFamily: "var(--font-display)",
                      fontSize: "1.08rem",
                      fontWeight: 650,
                      lineHeight: "32px",
                      color: "var(--text-strong)",
                      textWrap: "balance",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 26,
                        flexShrink: 0,
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.72rem",
                        fontWeight: 500,
                        letterSpacing: "0.06em",
                        /* Smaller than the h3's 32px so baseline alignment
                           never grows the flex line past the rule grid. */
                        lineHeight: "16px",
                        color: "var(--pop-cobalt)",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {q}
                  </h3>
                  <p style={{ margin: "0 0 0 38px", color: "var(--stone-700)", lineHeight: "32px", fontSize: "0.95rem", textWrap: "pretty" }}>
                    {a}
                  </p>
                </article>
              ))}
            </div>
            {/* Claims the trailing blank rules after the shorter column as a
                deliberate close, registered to the same 32px rule grid. */}
            <div
              aria-hidden="true"
              className="lp-faq-signoff"
              style={{
                position: "absolute",
                /* right offset lives in FAQ_CSS: 48px at base, 40px in the
                   881-1024 band, 22px stacked, tracking the sheet padding. */
                /* 32 minus a 3px baseline-phase correction: the mono line's
                   baseline in a 32px box sits 6px above the rule, body text
                   sits 2-4px above (probe: h3 2.45, p 3.45). 29 lands this
                   baseline 3px above the sheet's last written-on rule. */
                bottom: 29,
                fontFamily: "var(--font-mono)",
                fontSize: "0.72rem",
                fontWeight: 500,
                letterSpacing: "0.06em",
                lineHeight: "32px",
                color: "var(--stone-600)",
              }}
            >
              End of the sheet
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
