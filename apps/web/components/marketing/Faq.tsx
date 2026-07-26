import { Doodle } from "./Doodle";
import { Squiggle } from "./ds/Squiggle";
import { Eyebrow } from "./dividers";
import { FAQ_ITEMS } from "./faq-items";

/**
 * FAQ, evolved from docs/homa-design/ui_kits/landing/LandingPage.jsx into a
 * ruled reference sheet: one warm card holding every answer, hairline rules
 * per row, the design system's paper-rule texture behind, and a second
 * sheet peeking out beneath like a page in the binder. Items live in
 * faq-items.ts, shared with the FAQPage JSON-LD on the landing page.
 * Questions are h3s so the document outline keeps every question.
 *
 * Layout lives in the scoped .lp-faq-* classes below (not inline) because
 * answers flow in CSS columns, which the shared .lp-2col grid fallback
 * cannot collapse; the media query here owns the phone layout instead.
 */

const FAQ_CSS = `
.lp-faq-cols { columns: 2; column-gap: 56px; }
.lp-faq-sheet { padding: 30px 48px; }
.lp-faq-doodle { position: absolute; top: 38px; right: 6px; }
@media (max-width: 880px) {
  .lp-faq-cols { columns: 1; }
  .lp-faq-sheet { padding: 8px 22px 14px; }
  .lp-faq-doodle { top: -16px; right: 6px; }
}
`;

export function Faq() {
  return (
    <section id="faq" className="lp-pad lp-section" style={{ padding: "64px 40px 120px", maxWidth: 1200, margin: "0 auto" }}>
      <style>{FAQ_CSS}</style>
      <div style={{ maxWidth: 1000, margin: "0 auto", position: "relative" }}>
        <span className="lp-faq-doodle" aria-hidden="true">
          <Doodle name="cloud" size={38} color="var(--pop-cobalt)" rotate={-6} />
        </span>
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
              margin: "0 0 16px",
            }}
          >
            Short answers, before you begin.
          </p>
          <Squiggle color="var(--pop-cobalt)" line={false} />
        </div>
        <div data-reveal="" className="rv-d1" style={{ position: "relative" }}>
          {/* The sheet underneath: same paper, nudged and tilted, so the
              card reads as the top page of a small stack. */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "18px -9px -11px 12px",
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
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-2xl)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div data-reveal-kids="" className="lp-faq-cols">
              {FAQ_ITEMS.map(([q, a], i) => (
                <article key={q} style={{ breakInside: "avoid", borderTop: "1px solid var(--border-subtle)", padding: "20px 0 26px" }}>
                  <h3
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 12,
                      margin: 0,
                      fontFamily: "var(--font-display)",
                      fontSize: "1.08rem",
                      fontWeight: 650,
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
                        color: "var(--pop-cobalt)",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {q}
                  </h3>
                  <p style={{ margin: "8px 0 0 38px", color: "var(--text-muted)", lineHeight: 1.6, fontSize: "0.95rem", textWrap: "pretty" }}>
                    {a}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
