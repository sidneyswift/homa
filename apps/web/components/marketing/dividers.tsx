/**
 * Soft wave section-seam divider. Ported from
 * docs/homa-design/templates/landing-page/LandingPage.dc.html (source of
 * truth); keep in sync until packages/design exists (M1-17). Purely
 * decorative.
 */

export function Wave({
  color = "var(--band-sky)",
  flip = false,
}: {
  color?: string;
  flip?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 1440 48"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{
        display: "block",
        width: "100%",
        height: 44,
        margin: "-1px 0",
        transform: flip ? "scaleY(-1)" : "none",
      }}
    >
      <path
        fill={color}
        d="M0 0 H1440 V12 C1220 46 980 4 720 24 C460 44 220 8 0 32 Z"
      />
    </svg>
  );
}

/** A hand-drawn squiggle trailing into a straight rule, under a heading. */
export function SquiggleRule({ color = "var(--text-strong)" }: { color?: string }) {
  return (
    <div className="flex items-center" aria-hidden="true">
      <svg width="100" height="10" viewBox="0 0 100 8" fill="none" style={{ flexShrink: 0, overflow: "visible" }}>
        <path
          d="M0 4 Q5 0 10 4 Q15 8 20 4 Q25 0 30 4 Q35 8 40 4 Q45 0 50 4 Q55 8 60 4 Q65 0 70 4 Q75 8 80 4 Q85 0 90 4 Q95 8 100 4"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <span className="flex-1" style={{ borderTop: `1.2px solid ${color}`, opacity: 0.9 }} />
    </div>
  );
}
