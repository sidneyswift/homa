import type { CSSProperties } from "react";

import { CapabilityProof } from "./CapabilityProof";
import { Card } from "./ds/Card";
import { Squiggle } from "./ds/Squiggle";
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

export function Features() {
  return (
    <section
      id="features"
      className="lp-pad lp-section"
      style={{ padding: "76px 40px 72px", maxWidth: 1200, margin: "0 auto", position: "relative" }}
    >
      {/* The sparkle sits up in the inter-section band so the pause between
          the pull-quote above and this heading reads inhabited, not empty. */}
      <Doodle name="sparkle" size={26} color="var(--pop-blush)" rotate={12} style={{ position: "absolute", top: 20, right: "5%" }} />
      <Doodle name="loop" size={34} color="var(--pop-cobalt)" rotate={-8} style={{ position: "absolute", bottom: 34, left: "3%" }} />
      <div data-reveal="" style={{ marginBottom: 56 }}>
        <Eyebrow>What Homa does</Eyebrow>
        <h2 className="lp-h2" style={{ maxWidth: 620, color: "var(--text-strong)", margin: "10px 0 0" }}>
          Plans, pages, and records in <span style={{ color: "var(--brand)" }}>one place.</span>
        </h2>
        {/* Wave only, no trailing rule: the sibling sections underline their
            headings with a short coral squiggle, and a wave that settles
            into a 1000px hairline read as a broken border. Left-set because
            this header is left-set; segments stay modest so the wave never
            flatlines mid-run. */}
        <Squiggle segments={6} line={false} color="var(--brand)" style={{ width: "auto", marginTop: 16 }} />
      </div>
      <div
        data-reveal-kids=""
        className="lp-capability-grid"
        style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 22 }}
      >
        {CAPABILITY_ITEMS.map(({ id, title, body }, index) => (
          <div
            key={id}
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
