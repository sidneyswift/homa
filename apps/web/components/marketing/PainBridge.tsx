import { Clock3, FileCheck2, Files, HelpCircle, type LucideIcon } from "lucide-react";

import { Doodle } from "./Doodle";
import { Eyebrow } from "./dividers";
import { Squiggle } from "./ds/Squiggle";
import { PAIN_CLOSING, PAIN_ITEMS, type PainId } from "./landing-content";

const PAIN_ICONS: Record<PainId, LucideIcon> = {
  planning: Clock3,
  proof: HelpCircle,
  scattered: Files,
  paperwork: FileCheck2,
};

/**
 * Chip pairings from the landing kit's feature recipe: a 50-level family
 * tint under the family's deepest ink. Gold icons and text always use
 * gold-ink (DS law). Blob radii rotate per item so no two chips share a
 * silhouette.
 */
const PAIN_ACCENTS: Record<PainId, { tint: string; ink: string; blob: string }> = {
  planning: { tint: "var(--clay-50)", ink: "var(--clay-700)", blob: "var(--blob-1)" },
  proof: { tint: "var(--sage-50)", ink: "var(--sage-700)", blob: "var(--blob-2)" },
  scattered: { tint: "var(--sky-100)", ink: "var(--sky-600)", blob: "var(--blob-3)" },
  paperwork: { tint: "var(--gold-100)", ink: "var(--gold-ink)", blob: "var(--blob-4)" },
};

/** Sub-half-degree tilts so the index cards read hand-placed, never sloppy. */
const PAIN_TILTS: Record<PainId, string> = {
  planning: "-0.45deg",
  proof: "0.35deg",
  scattered: "-0.3deg",
  paperwork: "0.4deg",
};

/** Names the work a parent is already carrying before Homa answers it. */
export function PainBridge() {
  return (
    <section
      className="lp-pad lp-section"
      style={{ position: "relative", padding: "76px 40px 64px", maxWidth: 1200, margin: "0 auto" }}
    >
      {/* Text-wrap, min-height, and doodle placement live here because they
          need media queries that inline styles cannot express. Scoped by the
          lp-painb- prefix. */}
      <style>{`
        .lp-painb-h2 { text-wrap: balance; }
        .lp-painb-body { text-wrap: pretty; }
        .lp-painb-card { padding: 26px 22px 24px; }
        .lp-painb-title { min-height: 2.6em; }
        .lp-painb-rule { width: 44px; }
        .lp-painb-doodle { position: absolute; top: 58px; right: 6.5%; line-height: 0; }
        @media (max-width: 880px) {
          .lp-painb-doodle { top: 26px; right: 2px; }
          .lp-painb-doodle svg { width: 22px; height: 22px; }
        }
        @media (max-width: 540px) {
          .lp-painb-card { padding: 20px 18px 18px; }
          .lp-painb-title { min-height: 0; }
          .lp-painb-rule { width: 22px; }
        }
      `}</style>

      <span className="lp-painb-doodle" aria-hidden="true">
        <Doodle name="cloud" size={44} color="var(--sky-300)" rotate={-8} />
      </span>

      <div data-reveal="" style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
        <Eyebrow>The work around teaching</Eyebrow>
        <h2 className="lp-h2" style={{ margin: "10px 0 0", color: "var(--text-strong)" }}>
          Planning and records take time.
        </h2>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
          <Squiggle segments={5} line={false} color="var(--brand)" style={{ width: "auto" }} />
        </div>
      </div>

      <div
        data-reveal-kids=""
        className="lp-pain-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 26,
          marginTop: 46,
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
                  backgroundImage: "var(--bg-paper)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--shadow-xs)",
                  transform: `rotate(${PAIN_TILTS[id]})`,
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
                    margin: "16px 0 6px",
                    color: "var(--text-strong)",
                    fontFamily: "var(--font-display)",
                    fontSize: "1.08rem",
                    fontWeight: 650,
                    lineHeight: 1.25,
                  }}
                >
                  {title}
                </h3>
                <p
                  className="lp-painb-body"
                  style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.94rem", lineHeight: 1.55 }}
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
          gap: 18,
        }}
      >
        <span className="lp-painb-rule" aria-hidden="true" style={{ flexShrink: 0, borderTop: "1.5px solid var(--clay-300)" }} />
        <p
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
