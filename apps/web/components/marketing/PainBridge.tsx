import { Clock3, FileCheck2, Files, HelpCircle, type LucideIcon } from "lucide-react";

import { Eyebrow } from "./dividers";
import { PAIN_CLOSING, PAIN_ITEMS, type PainId } from "./landing-content";

const PAIN_ICONS: Record<PainId, LucideIcon> = {
  planning: Clock3,
  proof: HelpCircle,
  scattered: Files,
  paperwork: FileCheck2,
};

/** Names the work a parent is already carrying before Homa answers it. */
export function PainBridge() {
  return (
    <section className="lp-pad" style={{ padding: "76px 40px 92px", maxWidth: 1200, margin: "0 auto" }}>
      <div data-reveal="" style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <Eyebrow>The work around teaching</Eyebrow>
        <h2
          style={{
            margin: "10px 0 0",
            color: "var(--text-strong)",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 5vw, 2.7rem)",
            fontWeight: 700,
          }}
        >
          Planning and records take time.
        </h2>
      </div>

      <div
        data-reveal-kids=""
        className="lp-pain-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 28,
          marginTop: 48,
        }}
      >
        {PAIN_ITEMS.map(({ id, title, body }) => {
          const Icon = PAIN_ICONS[id];
          return (
            <article key={id} style={{ minWidth: 0 }}>
              <span
                style={{
                  display: "inline-flex",
                  width: 42,
                  height: 42,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  background: "var(--surface-card)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <Icon size={20} color="var(--clay-600)" aria-hidden="true" />
              </span>
              <h3
                style={{
                  margin: "16px 0 5px",
                  color: "var(--text-strong)",
                  fontFamily: "var(--font-display)",
                  fontSize: "1.08rem",
                  fontWeight: 650,
                }}
              >
                {title}
              </h3>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.94rem", lineHeight: 1.55 }}>
                {body}
              </p>
            </article>
          );
        })}
      </div>

      <p
        data-reveal=""
        className="rv-d1"
        style={{
          margin: "52px auto 0",
          color: "var(--text-strong)",
          fontFamily: "var(--font-display)",
          fontSize: "clamp(1.25rem, 3vw, 1.55rem)",
          fontWeight: 650,
          textAlign: "center",
        }}
      >
        {PAIN_CLOSING}
      </p>
    </section>
  );
}
