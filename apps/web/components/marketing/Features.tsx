import type { CSSProperties } from "react";

import { CapabilityProof } from "./CapabilityProof";
import { Card } from "./ds/Card";
import { Doodle } from "./Doodle";
import { Eyebrow } from "./dividers";
import { CAPABILITY_ITEMS } from "./landing-content";

/**
 * Four concrete product capabilities, each paired with fixture-safe UI proof.
 * The progress report has its own larger section immediately after this grid.
 *
 * Each Card sits inside a bare wrapper div on purpose: the stylesheet reveal
 * rule targets the grid's direct children, and Card's own inline transition
 * (box-shadow, transform, the hover tier) would override it, collapsing the
 * 320ms staggered rise into a simultaneous 200ms opacity pop. The wrapper
 * owns only the reveal transition; its stagger rides --rv-delay so no other
 * property can ever inherit a 210ms lag.
 */

const REVEAL_STAGGER_MS = 70;

/**
 * Pinwheel spans (5/7 over 7/5) instead of a uniform 2x2: the practice and
 * binder proofs carry artwork thumbnails that want width, while the plan
 * checklist and the hours bars are list-shaped and read well narrow. The
 * media query mirrors globals.css, which collapses .lp-capability-grid to
 * one column at 880px and below, so the spans only ever exist where the
 * twelve tracks do.
 */
const SPAN_CLASS = ["lp-cap-n", "lp-cap-w", "lp-cap-w", "lp-cap-n"] as const;

const FEATURES_CSS = `
@media (min-width: 881px) {
  .lp-capability-grid { grid-template-columns: repeat(12, minmax(0, 1fr)); }
  .lp-capability-grid > .lp-cap-n { grid-column: span 5; }
  .lp-capability-grid > .lp-cap-w { grid-column: span 7; }
}
`;

export function Features() {
  return (
    <section
      id="features"
      className="lp-pad lp-section"
      style={{ padding: "76px 40px 72px", maxWidth: 1200, margin: "0 auto", position: "relative" }}
    >
      <style>{FEATURES_CSS}</style>
      {/* One bold mark inhabits the pause between the pull-quote above and
          this heading: a lone 26px speck read as a stray, so the sparkle
          grew to carry the corner alone. Its old cobalt star companion is
          gone on purpose; the sparkle-plus-star pair repeated at other band
          corners and read copy-pasted at page scale. */}
      <Doodle name="sparkle" size={38} color="var(--pop-blush)" rotate={-15} style={{ position: "absolute", top: 20, right: "5%" }} />
      <Doodle name="loop" size={34} color="var(--pop-cobalt)" rotate={-8} style={{ position: "absolute", bottom: 34, left: "3%" }} />
      <div data-reveal="" style={{ marginBottom: 56 }}>
        <Eyebrow>What Homa does</Eyebrow>
        <h2 className="lp-h2" style={{ maxWidth: 620, color: "var(--text-strong)", margin: "10px 0 0" }}>
          Plans, pages, and records in <span style={{ color: "var(--brand)" }}>one place.</span>
        </h2>
        {/* No squiggle underline here on purpose: the wavy mark is reserved
            for the page's three anchor moments (hero CTA, Stories heading,
            CTA band); repeated under every section heading it read as
            template fill. The coral "one place." and the kicker carry the
            heading's identity. */}
      </div>
      <div
        data-reveal-kids=""
        className="lp-capability-grid"
        style={{ display: "grid", gap: 22 }}
      >
        {CAPABILITY_ITEMS.map(({ id, title, body }, index) => (
          <div
            key={id}
            className={SPAN_CLASS[index % SPAN_CLASS.length]}
            style={
              {
                "--rv-delay": `${index * REVEAL_STAGGER_MS}ms`,
                transitionDelay: "var(--rv-delay, 0ms)",
              } as CSSProperties
            }
          >
            <Card padding="lg" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <h3
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.45rem",
                  fontWeight: 650,
                  color: "var(--text-strong)",
                  margin: "0 0 7px",
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  color: "var(--text-muted)",
                  lineHeight: 1.55,
                  margin: "0 0 22px",
                  fontSize: "0.98rem",
                  textWrap: "pretty",
                }}
              >
                {body}
              </p>
              {/* Bottom-aligned so the four proofs share a baseline no matter
                  how long each card's body runs. */}
              <div style={{ marginTop: "auto" }}>
                <CapabilityProof capabilityId={id} />
              </div>
            </Card>
          </div>
        ))}
      </div>
    </section>
  );
}
