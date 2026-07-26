import Image from "next/image";

import { Squiggle } from "./ds/Squiggle";
import { Doodle } from "./Doodle";
import { Eyebrow } from "./dividers";
import { FOUNDER_STORY_COPY } from "./landing-content";

/**
 * Honest founder story. The co-founder photo is founder-supplied
 * (2026-07-18), so the consent bar for rendering it is met. The blush band
 * is upholstered with tone-on-tone dots (faded near both wave seams so the
 * solid-blush dividers meet a solid edge), and the photo is staged as a
 * taped-down snapshot breaking the card's top edge, echoing the hero
 * phone's hand-placed language. It keeps a rounded slot, not a blob mask:
 * the tight two-face crop can't afford edge cropping. Caveat stays
 * reserved for Homa's own margin notes, so the founders sign in the serif
 * voice instead.
 */

const DOT = "radial-gradient(circle, rgba(255, 255, 255, 0.28) 8px, transparent 9px)";
const BLUSH_CLEAR = "color-mix(in srgb, var(--band-blush) 0%, transparent)";

export function Stories() {
  return (
    <section
      id="stories"
      className="lp-pad lp-section"
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "96px 40px 116px",
        backgroundColor: "var(--band-blush)",
        backgroundImage: `linear-gradient(to bottom, var(--band-blush) 0, var(--band-blush) 240px, ${BLUSH_CLEAR} 340px, ${BLUSH_CLEAR} calc(100% - 150px), var(--band-blush) 100%), ${DOT}, ${DOT}`,
        backgroundSize: "auto, 108px 108px, 108px 108px",
        backgroundPosition: "0 0, 0 0, 54px 54px",
      }}
    >
      <style>{`
        #stories h2 { text-wrap: balance; }
        .lp-stories-photo { align-self: start; margin-top: -88px; }
        .lp-stories-corner { display: contents; }
        /* Below 1080px the card's corner reaches these marks (white on white, or floating on the card), so they bow out early. */
        @media (max-width: 1080px) {
          .lp-stories-corner { display: none; }
        }
        @media (max-width: 880px) {
          .lp-stories-photo { margin: -46px auto 0; }
        }
        /* Phones only: fills the dotted strip below the stacked card, where the corner duo above is hidden. */
        .lp-stories-below { display: contents; }
        @media (min-width: 881px) {
          .lp-stories-below { display: none; }
        }
      `}</style>
      {/* Loose doodle clusters, unevenly sized and rotated so they read as hand-scattered, not pinned at mirrored corners. */}
      <Doodle name="heart" size={30} color="var(--clay-600)" rotate={-12} style={{ position: "absolute", top: 46, left: "5.5%" }} />
      <Doodle name="sparkle" size={15} color="#fff" rotate={20} style={{ position: "absolute", top: 92, left: "8.4%" }} />
      {/* The bottom duo hides on phones: the stacked card grows tall enough there that these corner marks would land on white. */}
      <span className="lp-stories-corner">
        <Doodle name="sparkle" size={26} color="#fff" rotate={8} style={{ position: "absolute", bottom: 118, right: "7.2%" }} />
        <Doodle name="heart" size={15} color="var(--clay-600)" rotate={16} style={{ position: "absolute", bottom: 168, right: "9.6%" }} />
      </span>
      <span className="lp-stories-below">
        <Doodle name="sparkle" size={18} color="#fff" rotate={-10} style={{ position: "absolute", bottom: 64, left: "12%" }} />
      </span>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div data-reveal="" style={{ textAlign: "center", marginBottom: 58 }}>
          <Eyebrow color="var(--text-strong)">{FOUNDER_STORY_COPY.eyebrow}</Eyebrow>
          <h2 className="lp-h2" style={{ color: "var(--text-strong)", margin: "10px 0 12px" }}>
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
            boxShadow: "var(--shadow-md)",
            padding: "34px 38px 24px",
          }}
        >
          <div
            className="lp-story-grid"
            style={{ display: "grid", gridTemplateColumns: "1fr 236px", gap: 36, alignItems: "center" }}
          >
            <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.28rem", lineHeight: 1.6, color: "var(--text-strong)", margin: 0 }}>
              {FOUNDER_STORY_COPY.body}
            </p>
            <div className="lp-story-photo lp-stories-photo">
              <div style={{ position: "relative", transform: "rotate(2.5deg)" }}>
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
                    border: "6px solid var(--surface-card)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-lg)",
                  }}
                />
                {/* Tape reaches well past the print border onto the photo itself; the hairline edge keeps it legible over the photo's bright sky. */}
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    top: -12,
                    left: "42%",
                    width: 92,
                    height: 34,
                    transform: "translateX(-50%) rotate(-5deg)",
                    background:
                      "linear-gradient(rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.5) 22%, rgba(255, 255, 255, 0.5) 78%, rgba(255, 255, 255, 0.9))",
                    // Stone hairline, not white: over the photo's near-white sky a white edge vanishes.
                    border: "1px solid color-mix(in srgb, var(--stone-300) 60%, transparent)",
                    boxShadow: "0 3px 6px rgba(51, 42, 33, 0.22)",
                    borderRadius: 2,
                  }}
                />
              </div>
              {/* The caption sits under the snapshot, not on the signature row: it fills the tall column and keeps the label with the faces it names. */}
              <p
                style={{
                  margin: "10px 0 0",
                  textAlign: "center",
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.8rem",
                  letterSpacing: "0.02em",
                  color: "var(--text-muted)",
                }}
              >
                Co-founders of Homa
              </p>
              {/* A small hand-drawn anchor under the caption: keeps the tall right column from ending in bare white. */}
              <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
                <Squiggle segments={3} line={false} color="var(--clay-300)" style={{ width: "auto" }} />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            {/* A short standalone flourish: the wave-into-hairline hybrid read as a rendering glitch, so the rule is gone on purpose. */}
            <div style={{ display: "flex" }}>
              <Squiggle segments={4} line={false} color="var(--stone-400)" style={{ width: "auto" }} />
            </div>
            <p
              style={{
                margin: "14px 0 0",
                color: "var(--sage-700)",
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontSize: "1.15rem",
                fontWeight: 500,
              }}
            >
              {FOUNDER_STORY_COPY.signature}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
