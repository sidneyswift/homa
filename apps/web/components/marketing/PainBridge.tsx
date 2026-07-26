import { Clock3, FileCheck2, Files, HelpCircle, type LucideIcon } from "lucide-react";

import { Doodle } from "./Doodle";
import { Eyebrow } from "./dividers";
import { PAIN_CLOSING, PAIN_ITEMS, type PainId } from "./landing-content";

const PAIN_ICONS: Record<PainId, LucideIcon> = {
  planning: Clock3,
  proof: HelpCircle,
  scattered: Files,
  paperwork: FileCheck2,
};

/**
 * Chip pairings from the landing kit's feature recipe: a light family
 * tint under the family's deepest ink. Planning uses clay-100 because
 * clay-50 sits at the same value as the card's warm paper and the chip
 * vanished. Gold icons and text always use gold-ink (DS law). Blob radii
 * rotate per item so no two chips share a silhouette.
 */
const PAIN_ACCENTS: Record<PainId, { tint: string; ink: string; blob: string }> = {
  planning: { tint: "var(--clay-100)", ink: "var(--clay-700)", blob: "var(--blob-1)" },
  proof: { tint: "var(--sage-50)", ink: "var(--sage-700)", blob: "var(--blob-2)" },
  scattered: { tint: "var(--sky-100)", ink: "var(--sky-600)", blob: "var(--blob-3)" },
  paperwork: { tint: "var(--gold-100)", ink: "var(--gold-ink)", blob: "var(--blob-4)" },
};

/** Sub-degree tilts, large enough to register in a screenshot, so the
    index cards read hand-placed rather than templated. Above 880px,
    globals.css also rotates each article (nth-child rotate) and the two
    stack; these values stay small so the combined desktop tilt remains
    sub-degree while the 541-880px band, where the globals rotations do
    not apply, keeps a visible hand-laid tilt. */
const PAIN_TILTS: Record<PainId, string> = {
  planning: "-0.3deg",
  proof: "0.25deg",
  scattered: "-0.2deg",
  paperwork: "0.3deg",
};

/** Names the work a parent is already carrying before Homa answers it. */
export function PainBridge() {
  return (
    <section
      className="lp-pad lp-section"
      style={{ position: "relative", padding: "76px 40px 64px", maxWidth: 1200, margin: "0 auto" }}
    >
      {/* Text-wrap, the rule grid, and doodle placement live here because
          they need media queries that inline styles cannot express. Scoped
          by the lp-painb- prefix.

          The rule grid: the shared --bg-paper repeats every 32px while the
          card type sits on a 24px rhythm, so the shared texture grazes
          cap-heights and drifts. Each card draws its own 24px grid instead,
          and the title (24px lines, zero bottom margin) plus the body
          (24px lines) stay on that grid, so every text line sits on a rule
          like writing on an index card. Titles carry no min-height: the
          stagger offsets already break cross-card body alignment on
          purpose, and reserving a second title row left a blank ruled line
          under one-line titles. The rule stripe is 2px of --paper-rule
          (the token alone is too faint to survive DPR1 rendering) and
          background-position centers that 2px stripe ~2px under the first
          title baseline; the 540px block re-tunes it for the shallower
          padding.

          881-1000px: four columns squeeze to ~180-200px and bodies rag
          word-by-word, so the grid drops to 2x2 there; the article
          margin-top reset zeroes the >880px stagger offsets from
          globals.css, which would misalign the 2x2 rows.

          The doodle's right offset is clamped so the cloud never drifts
          closer than 32px to the viewport edge in the 881-1024px band,
          where the 720px header stops re-centering it. */}
      <style>{`
        .lp-painb-h2 { text-wrap: balance; }
        .lp-painb-body { text-wrap: pretty; }
        .lp-painb-close { text-wrap: balance; }
        .lp-painb-card {
          padding: 26px 22px 24px;
          background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 22px, var(--paper-rule) 22px, var(--paper-rule) 24px);
          background-position: 0 19px;
        }
        .lp-painb-title { text-wrap: balance; }
        .lp-painb-rule { width: 44px; }
        .lp-painb-doodle { position: absolute; top: -6px; right: max(-56px, calc(50% - 50vw + 32px)); line-height: 0; }
        @media (min-width: 881px) and (max-width: 1000px) {
          .lp-pain-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .lp-pain-grid > article { margin-top: 0 !important; }
        }
        @media (max-width: 880px) {
          .lp-painb-doodle { display: none; }
        }
        @media (max-width: 540px) {
          .lp-painb-card { padding: 20px 18px 18px; background-position: 0 13px; }
          .lp-painb-rule { display: none; }
        }
      `}</style>

      <div
        data-reveal=""
        style={{ position: "relative", maxWidth: 720, margin: "0 auto", textAlign: "center" }}
      >
        <span className="lp-painb-doodle" aria-hidden="true">
          <Doodle name="cloud" size={44} color="var(--sky-300)" rotate={-8} />
        </span>
        <Eyebrow>The work around teaching</Eyebrow>
        {/* No squiggle underline: the wavy mark is reserved for the page's
            three anchor moments (hero CTA, Stories heading, CTA band), and
            this heading sits one scroll after the hero's cobalt CTA
            squiggle; two wavy marks in adjacent views read as a tic. The
            cloud and kicker carry the lockup. */}
        <h2 className="lp-h2" style={{ margin: "10px 0 0", color: "var(--text-strong)" }}>
          Planning and records take time.
        </h2>
      </div>

      <div
        data-reveal-kids=""
        className="lp-pain-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          /* Content-height cards: stretch would pad every card to the
             tallest one's height with blank ruled rows; ragged bottom
             edges read as index cards laid down by hand. */
          alignItems: "start",
          gap: 26,
          /* 56, not 46: absorbs part of the retired heading squiggle's
             26px slot so the H2-to-cards interval stays close to what the
             section was tuned at. */
          marginTop: 56,
        }}
      >
        {PAIN_ITEMS.map(({ id, title, body }) => {
          const Icon = PAIN_ICONS[id];
          const { tint, ink, blob } = PAIN_ACCENTS[id];
          return (
            <article key={id} style={{ minWidth: 0, display: "flex" }}>
              <div
                className="lp-painb-card"
                style={{
                  flex: 1,
                  backgroundColor: "var(--bg-page-warm)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--shadow-xs)",
                  transform: `rotate(${PAIN_TILTS[id]})`,
                  /* Rotation pivots above center so the tilt reads at the
                     top edge, where the cards abut across the gap. */
                  transformOrigin: "50% 40%",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    width: 52,
                    height: 52,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: blob,
                    background: tint,
                    /* Sticker ring: lifts the chip off the card's paper rules. */
                    border: "2px solid var(--surface-card)",
                  }}
                >
                  <Icon size={23} color={ink} aria-hidden="true" />
                </span>
                <h3
                  className="lp-painb-title"
                  style={{
                    margin: "16px 0 0",
                    color: "var(--text-strong)",
                    fontFamily: "var(--font-display)",
                    fontSize: "1.08rem",
                    fontWeight: 650,
                    lineHeight: "24px",
                  }}
                >
                  {title}
                </h3>
                <p
                  className="lp-painb-body"
                  style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.94rem", lineHeight: "24px" }}
                >
                  {body}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <div
        data-reveal=""
        className="rv-d1"
        style={{
          margin: "64px auto 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <span className="lp-painb-rule" aria-hidden="true" style={{ flexShrink: 0, borderTop: "1.5px solid var(--clay-300)" }} />
        <p
          className="lp-painb-close"
          style={{
            margin: 0,
            color: "var(--text-strong)",
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: "clamp(1.4rem, 2.6vw, 1.8rem)",
            lineHeight: 1.35,
            textAlign: "center",
          }}
        >
          {PAIN_CLOSING}
        </p>
        <span className="lp-painb-rule" aria-hidden="true" style={{ flexShrink: 0, borderTop: "1.5px solid var(--clay-300)" }} />
      </div>
    </section>
  );
}
