import { CapabilityProof } from "./CapabilityProof";
import { Card } from "./ds/Card";
import { Squiggle } from "./ds/Squiggle";
import { Doodle } from "./Doodle";
import { Eyebrow } from "./dividers";
import { CAPABILITY_ITEMS } from "./landing-content";

/**
 * Four concrete product capabilities, each paired with fixture-safe UI proof.
 * The progress report has its own larger section immediately after this grid.
 */

export function Features() {
  return (
    <section
      id="features"
      className="lp-pad"
      style={{ padding: "124px 40px 104px", maxWidth: 1200, margin: "0 auto", position: "relative" }}
    >
      <Doodle name="sparkle" size={26} color="var(--pop-blush)" rotate={12} style={{ position: "absolute", top: 84, right: "5%" }} />
      <div data-reveal="" style={{ marginBottom: 64, maxWidth: 620 }}>
        <Eyebrow>What Homa does</Eyebrow>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 5vw, 2.6rem)",
            fontWeight: 700,
            color: "var(--text-strong)",
            margin: "10px 0 14px",
          }}
        >
          Plans, pages, and records in one place.
        </h2>
        <Squiggle />
      </div>
      <div data-reveal-kids="" className="lp-capability-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 22 }}>
        {CAPABILITY_ITEMS.map(({ id, title, body }) => (
          <Card key={id} padding="lg">
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
            <p style={{ minHeight: "3.1em", color: "var(--text-muted)", lineHeight: 1.55, margin: "0 0 20px", fontSize: "0.98rem" }}>
              {body}
            </p>
            <CapabilityProof capabilityId={id} />
          </Card>
        ))}
      </div>
    </section>
  );
}
