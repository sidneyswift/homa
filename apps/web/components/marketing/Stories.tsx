import { Squiggle } from "./ds/Squiggle";
import { Doodle } from "./Doodle";
import { Eyebrow } from "./dividers";
import { FOUNDER_STORY_COPY } from "./landing-content";

/**
 * Honest founder story. No family testimonial or founder photo renders until
 * a consented source exists; the public co-founder signature carries trust.
 */
export function Stories() {
  return (
    <section id="stories" style={{ background: "var(--band-blush)", padding: "96px 40px 104px", position: "relative", overflow: "hidden" }}>
      <Doodle name="heart" size={30} color="var(--clay-600)" rotate={-10} style={{ position: "absolute", top: 42, left: "6%" }} />
      <Doodle name="sparkle" size={26} color="#fff" rotate={18} style={{ position: "absolute", bottom: 52, right: "5%" }} />
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div data-reveal="" style={{ textAlign: "center", marginBottom: 36 }}>
          <Eyebrow color="var(--clay-700)">{FOUNDER_STORY_COPY.eyebrow}</Eyebrow>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 5vw, 2.6rem)",
              fontWeight: 700,
              color: "var(--text-strong)",
              margin: "8px 0 10px",
            }}
          >
            {FOUNDER_STORY_COPY.headline}
          </h2>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Squiggle segments={4} line={false} color="var(--clay-700)" style={{ width: "auto" }} />
          </div>
        </div>
        <div
          data-reveal=""
          className="rv-d1"
          style={{
            background: "var(--surface-card)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-sm)",
            padding: "30px 32px",
          }}
        >
          <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", lineHeight: 1.55, color: "var(--text-strong)", margin: 0 }}>
            {FOUNDER_STORY_COPY.body}
          </p>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.6, margin: "16px 0 0", fontSize: "0.98rem" }}>
            {FOUNDER_STORY_COPY.closing}
          </p>
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border-subtle)" }}>
            <p
              style={{
                margin: 0,
                color: "var(--sage-700)",
                fontFamily: "var(--font-hand)",
                fontSize: "1.45rem",
                fontWeight: 600,
              }}
            >
              {FOUNDER_STORY_COPY.signature}
            </p>
            <p style={{ margin: "2px 0 0", color: "var(--text-subtle)", fontSize: "0.8rem" }}>Co-founders of Homa</p>
          </div>
        </div>
      </div>
    </section>
  );
}
