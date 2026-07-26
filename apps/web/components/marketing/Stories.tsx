import Image from "next/image";
import type { CSSProperties } from "react";

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

// Shared washi recipe for both strips. Warm tint under a flat diagonal
// sheen, every stop capped at 0.65 alpha: a symmetric near-opaque ramp read
// as glass and striped over the border/sky seams on mobile. The stone
// hairline (not white) keeps the edge legible over the photo's bright sky,
// so the shadow can stay a hint; a heavier one showed through the
// translucent fill and greyed the strip. drop-shadow, not box-shadow:
// clip-path would clip a box shadow away entirely; this one hugs the torn
// silhouette. Torn ends stay in a 4-7% amplitude envelope but off any even
// rhythm, so at close zoom they read as a tear, not a machined zigzag.
const TAPE_BASE: CSSProperties = {
  position: "absolute",
  backgroundColor: "color-mix(in srgb, var(--stone-200) 18%, transparent)",
  backgroundImage:
    "linear-gradient(105deg, rgba(255, 255, 255, 0.62), rgba(255, 255, 255, 0.38) 45%, rgba(255, 255, 255, 0.55))",
  border: "1px solid color-mix(in srgb, var(--stone-300) 60%, transparent)",
  filter: "drop-shadow(0 2px 5px rgba(51, 42, 33, 0.16))",
  clipPath:
    "polygon(5% 0, 96% 6%, 100% 22%, 95% 33%, 100% 55%, 96% 66%, 100% 86%, 94% 100%, 4% 97%, 0 78%, 6% 61%, 0 44%, 3% 27%, 0 12%)",
};

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
        .lp-stories-photo { align-self: start; margin-top: -96px; }
        .lp-story-grid { gap: 32px; }
        .lp-stories-anchor { display: flex; justify-content: center; margin-top: 14px; }
        .lp-stories-corner { display: contents; }
        .lp-stories-corner-sparkle { position: absolute; bottom: 118px; right: 7.2%; }
        .lp-stories-corner-heart { position: absolute; bottom: 168px; right: 9.6%; }
        /* 881-1080px: the blush margin beside the 780px card narrows to ~50px, so the duo tucks low into the bottom-right strip instead of vanishing (a 26px sparkle at right 2.5% stays on blush and clears the card edge; the heart at bottom 88 sits below the card's bottom at ~116). */
        @media (max-width: 1080px) and (min-width: 881px) {
          .lp-stories-corner-sparkle { bottom: 36px; right: 2.5%; }
          .lp-stories-corner-heart { bottom: 88px; right: 5.5%; }
        }
        @media (max-width: 880px) {
          .lp-stories-corner { display: none; }
          .lp-stories-photo { margin: -46px auto 0; }
          .lp-story-grid { gap: 22px; }
          .lp-stories-anchor { margin-top: 12px; }
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
        {/* Positions live on wrapper spans, not inline on the Doodles, so the 881-1080px media query can pull the duo inward. */}
        <span className="lp-stories-corner-sparkle">
          <Doodle name="sparkle" size={26} color="#fff" rotate={8} style={{ display: "block" }} />
        </span>
        <span className="lp-stories-corner-heart">
          <Doodle name="heart" size={15} color="var(--clay-600)" rotate={16} style={{ display: "block" }} />
        </span>
      </span>
      <span className="lp-stories-below">
        <Doodle name="sparkle" size={18} color="#fff" rotate={-10} style={{ position: "absolute", bottom: 44, left: "12%" }} />
        {/* The strip below the card is only 72px tall here (lp-section collapses padding-bottom to 72 at <=880px), so the heart sits low; bottom 98 would land on the card. */}
        <Doodle name="heart" size={12} color="var(--clay-600)" rotate={14} style={{ position: "absolute", bottom: 30, right: "16%" }} />
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
          {/* gap lives in the style block (32px, 22px stacked) so the mobile override can win; inline gap would beat any stylesheet rule. */}
          <div
            className="lp-story-grid"
            style={{ display: "grid", gridTemplateColumns: "1fr 272px", alignItems: "center" }}
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
                  sizes="(max-width: 880px) 70vw, 272px"
                  style={{
                    display: "block",
                    width: "100%",
                    height: "auto",
                    border: "6px solid var(--surface-card)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-lg)",
                  }}
                />
                {/* Two anchor points sell the taped-down read: one lone centered strip could not plausibly hold a rotated, overhanging print. The long strip crosses the top edge off-center; the short one pins the top-right corner at an opposing angle so neither stripe runs parallel to the border seam. */}
                <span
                  aria-hidden="true"
                  style={{
                    ...TAPE_BASE,
                    top: -10,
                    left: "42%",
                    width: 92,
                    height: 26,
                    transform: "translateX(-50%) rotate(-8deg)",
                  }}
                />
                <span
                  aria-hidden="true"
                  style={{
                    ...TAPE_BASE,
                    top: -8,
                    right: "6%",
                    width: 64,
                    height: 22,
                    transform: "rotate(7deg)",
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
              {/* A small hand-drawn anchor under the caption: keeps the tall right column from ending in bare white. A heart, not a squiggle, so the headline keeps the section's only squiggle. Its margin lives in .lp-stories-anchor so the stacked layout can pull it closer to the caption. */}
              <div className="lp-stories-anchor">
                <Doodle name="heart" size={15} color="var(--clay-400)" rotate={-8} />
              </div>
            </div>
          </div>
          {/* The signature row closes the card corner to corner: the green sign-off on the left, one quiet sparkle at the right end under the photo column, so the bottom-right quadrant is a resting point instead of bare white. The signature's old squiggle is gone on purpose; the section keeps exactly one (the headline's), so the mark stays an anchor rather than a tic. */}
          <div style={{ marginTop: 18, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
            <div>
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
            <Doodle name="sparkle" size={20} color="var(--clay-400)" rotate={15} style={{ marginBottom: 4 }} />
          </div>
        </div>
      </div>
    </section>
  );
}
