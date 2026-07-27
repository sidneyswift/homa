"use client";

import { useState } from "react";
import { Doodle } from "./Doodle";
import { Eyebrow } from "./dividers";
import { FAQ_ITEMS } from "./faq-items";

/**
 * FAQ, evolved from docs/homa-design/ui_kits/landing/LandingPage.jsx into a
 * ruled reference sheet: one warm card holding every answer over the design
 * system's paper-rule texture, with two more sheets peeking out beneath like
 * pages in the binder. Items live in faq-items.ts, shared with the FAQPage
 * JSON-LD on the landing page.
 *
 * Collapse-by-default accordion (founder request, 2026-07-26): each answer
 * hides until its question opens. This is the one WAI-ARIA resilient
 * disclosure pattern (h3 > button[aria-expanded][aria-controls], plus a
 * role="region" panel), not native <details>/<summary>: probing the live
 * accessibility tree (both headless and a real Chrome tab) showed a bare
 * <summary>, with or without a nested heading, exposes only as "generic",
 * never "button", in every browser tested here, and forcing role="button"
 * onto a <summary> that also carries heading content leaves the button
 * with no accessible name at all (the heading child's text stops counting
 * toward the button's name once the child has its own role). The
 * h3-wraps-button shape sidesteps both failures: the button's own text is
 * its name, the h3 gives it a real heading level, and aria-expanded is
 * ours to set correctly, verified. `openIndex` keeps one item open at a
 * time (parent's choice per the brief); native <details> gave that for
 * free via a shared `name`, so this is the deliberate trade for correct
 * semantics, not an oversight.
 *
 * Everything inside the card registers to the 32px paper-rule grid
 * (--bg-paper repeats every 32px): both type sizes run at a 32px line
 * height, every vertical space is a multiple of 32, and the sheet's
 * backgroundSize/backgroundPosition pin the rule phase so each text
 * baseline sits a couple of pixels above its rule, like handwriting on
 * lined paper. Change any vertical number here only in steps of 32. Each
 * item's own 32px bottom padding is the only inter-item gap (open or
 * closed), so the rhythm holds automatically as answers expand and
 * collapse.
 *
 * Layout lives in the scoped .lp-faq-* classes below (not inline) because
 * the accordion needs the [data-open] attribute selector and a
 * grid-template-rows transition, neither of which the shared .lp-2col grid
 * fallback or plain inline styles can express.
 */

const FAQ_CSS = `
/* Single-column stacked list, not CSS columns: masonry reflows every item
   below a mid-column expand across the column break, which read as a
   jump the moment one answer's height changed. A single column lets each
   item grow in place with nothing beside it to reflow. */
.lp-faq-sheet { padding: 32px 48px 0; }
.lp-faq-margin { position: absolute; top: 52px; right: 0; display: flex; align-items: flex-end; gap: 16px; }
/* Rests the glyph's base on the same y as the Answers span's hairline
   (probe-measured: the svg box bottom sat 4.45px under the hairline at 20px). */
.lp-faq-doodle { display: inline-flex; margin-bottom: 24px; }
.lp-faq-under1 { inset: 22px -14px -16px 16px; }
.lp-faq-under2 { inset: 30px -20px -22px 22px; }

.lp-faq-item { position: relative; }
/* Collapsed, an item is just its one-line question plus this 32px gap: the
   gap's single ruled line (from the sheet's repeating --bg-paper) falls
   only ~5px above the seam with the next item, close enough to read as a
   stray half line butting into the next question rather than a blank
   notebook row. Cover only that seam sliver, not the whole 32px: the rest
   of the gap keeps showing the paper rule, so a closed sheet still reads
   as ruled paper and not a flat white list. The last item keeps its full
   rule too: a ruled row before the card's bottom edge reads as blank
   notebook paper, not a mistake, and the sheet's own bottom padding stays
   0 so that row isn't doubled. */
.lp-faq-item:not(:last-child)::after { content: ""; position: absolute; left: -48px; right: -48px; bottom: 0; height: 4px; background: var(--surface-card); }

/* padding-block 6 plus the matching negative margin-block grows the
   button's own hit box to 44px (32px text line plus 12px) without
   changing what the item contributes to the 32px rule grid: padding and
   margin cancel out, so every sibling still lands on the same rule it did
   before. Otherwise a one-line question (03-05) had only a 32px tap
   target, an accident of copy length rather than a sized target. */
.lp-faq-toggle { display: flex; align-items: flex-start; width: 100%; gap: 12px; margin: -6px 0; padding: 6px 0; background: none; border: none; font: inherit; color: inherit; text-align: left; cursor: pointer; border-radius: var(--radius-sm); }
.lp-faq-toggle:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--brand), var(--shadow-focus); }
.lp-faq-q-text { transition: color var(--dur-fast) var(--ease-out); }
.lp-faq-toggle:hover .lp-faq-q-text, .lp-faq-toggle:focus-visible .lp-faq-q-text { color: var(--pop-cobalt-deep); }

.lp-faq-chevron { transition: transform var(--dur-base) var(--ease-out), color var(--dur-fast) var(--ease-out); }
.lp-faq-item[data-open="true"] .lp-faq-chevron { transform: rotate(180deg); }
.lp-faq-toggle:hover .lp-faq-chevron, .lp-faq-toggle:focus-visible .lp-faq-chevron { color: var(--pop-cobalt-deep); }

/* grid-template-rows 0fr/1fr animates a height none of the fixed values
   (--32px multiples included) could, since answers vary in line count.
   visibility stays out of the transition until the collapse finishes so
   a screen reader landing mid-close doesn't briefly meet zero-height
   text; guarded below for prefers-reduced-motion. */
.lp-faq-answer-wrap { display: grid; grid-template-rows: 0fr; visibility: hidden; transition: grid-template-rows var(--dur-slow) var(--ease-out), visibility 0s linear var(--dur-slow); }
.lp-faq-item[data-open="true"] > .lp-faq-answer-wrap { grid-template-rows: 1fr; visibility: visible; transition: grid-template-rows var(--dur-slow) var(--ease-out), visibility 0s linear; }
.lp-faq-answer-inner { overflow: hidden; min-height: 0; }

@media (prefers-reduced-motion: reduce) {
  .lp-faq-chevron, .lp-faq-q-text, .lp-faq-answer-wrap, .lp-faq-item[data-open="true"] > .lp-faq-answer-wrap { transition: none; }
}

@media (max-width: 880px) {
  .lp-faq-sheet { padding: 32px 22px 0; }
  .lp-faq-margin { top: 2px; right: 0; }
  .lp-faq-margin-note { display: none; }
  .lp-faq-doodle { margin-bottom: 0; }
  .lp-faq-item:not(:last-child)::after { left: -22px; right: -22px; }
  .lp-faq-under1 { inset: 18px -9px -11px 12px; }
  .lp-faq-under2 { inset: 26px -14px -16px 18px; }
}
`;

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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
            <div data-reveal-kids="">
              {FAQ_ITEMS.map(([q, a], i) => {
                const isOpen = openIndex === i;
                const buttonId = `faq-question-${i}`;
                const panelId = `faq-answer-${i}`;
                return (
                  <div key={q} className="lp-faq-item" data-open={isOpen ? "true" : undefined} style={{ padding: "0 0 32px" }}>
                    <h3 style={{ margin: 0 }}>
                      <button
                        type="button"
                        id={buttonId}
                        className="lp-faq-toggle"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => setOpenIndex(isOpen ? null : i)}
                      >
                        <span
                          className="lp-faq-q-text"
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 12,
                            flex: "1 1 auto",
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
                              /* Smaller than the 32px line so baseline alignment
                                 never grows the flex line past the rule grid. */
                              lineHeight: "16px",
                              color: "var(--pop-cobalt)",
                            }}
                          >
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {q}
                        </span>
                        <span
                          aria-hidden="true"
                          className="lp-faq-chevron"
                          style={{ display: "inline-flex", alignItems: "center", height: 32, flexShrink: 0, color: "var(--pop-cobalt)" }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M4 9 L12 16 L20 9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </button>
                    </h3>
                    <div id={panelId} role="region" aria-labelledby={buttonId} className="lp-faq-answer-wrap">
                      <div className="lp-faq-answer-inner">
                        <p style={{ margin: "0 0 0 38px", color: "var(--stone-700)", lineHeight: "32px", fontSize: "0.95rem", textWrap: "pretty" }}>
                          {a}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
