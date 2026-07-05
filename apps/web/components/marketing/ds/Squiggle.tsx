import type { CSSProperties } from "react";

/**
 * Homa Squiggle, the playful heading divider: a short hand-drawn wave that
 * settles into a thin rule. Ported from
 * docs/homa-design/components/playful/Squiggle.jsx (source of truth); keep
 * in sync until packages/design exists (M1-17).
 */
export function Squiggle({
  color = "var(--text-strong)",
  segments = 5,
  line = true,
  style = {},
}: {
  color?: string;
  segments?: number;
  line?: boolean;
  style?: CSSProperties;
}) {
  const w = segments * 20;
  let d = "M0 4";
  for (let i = 0; i < segments * 2; i++) {
    d += ` Q${i * 10 + 5} ${i % 2 ? 8 : 0} ${i * 10 + 10} 4`;
  }
  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%", ...style }}>
      <svg
        width={w}
        height={10}
        viewBox={`0 0 ${w} 8`}
        fill="none"
        style={{ flexShrink: 0, display: "block", overflow: "visible" }}
        aria-hidden="true"
      >
        <path d={d} stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {line && <span style={{ flex: 1, borderTop: `1.2px solid ${color}`, opacity: 0.9 }} />}
    </div>
  );
}
