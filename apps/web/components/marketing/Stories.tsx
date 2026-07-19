import Image from "next/image";

import { Squiggle } from "./ds/Squiggle";
import { Doodle } from "./Doodle";
import { Eyebrow } from "./dividers";
import { FOUNDER_STORY_COPY } from "./landing-content";

/**
 * Honest founder story. The co-founder photo is founder-supplied
 * (2026-07-18), so the consent bar for rendering it is met. It sits in a
 * rounded slot (not a blob mask: the tight two-face crop can't afford edge
 * cropping) beside the quote, with the signature spanning below both.
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
          <div
            className="lp-story-grid"
            style={{ display: "grid", gridTemplateColumns: "1fr 236px", gap: 32, alignItems: "center" }}
          >
            <div>
              <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", lineHeight: 1.55, color: "var(--text-strong)", margin: 0 }}>
                {FOUNDER_STORY_COPY.body}
              </p>
              <p style={{ color: "var(--text-muted)", lineHeight: 1.6, margin: "16px 0 0", fontSize: "0.98rem" }}>
                {FOUNDER_STORY_COPY.closing}
              </p>
            </div>
            {/* Tilted like a snapshot laid on the kitchen table, echoing the
                hero phone's hand-placed language. */}
            <div className="lp-story-photo" style={{ transform: "rotate(2deg)" }}>
              <Image
                src="/images/founders.jpg"
                alt="Alessa and Carolyng, Homa's co-founders, smiling together outside in the sun"
                width={920}
                height={868}
                sizes="(max-width: 880px) 70vw, 236px"
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--shadow-md)",
                }}
              />
            </div>
          </div>
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
