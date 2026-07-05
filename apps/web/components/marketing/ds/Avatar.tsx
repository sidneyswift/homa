import type { CSSProperties } from "react";

/**
 * Homa Avatar, circular initials, warm auto-color from name. Ported from
 * docs/homa-design/components/data-display/Avatar.jsx (source of truth);
 * keep in sync until packages/design exists (M1-17).
 */

const PALETTE = ["var(--clay-400)", "var(--sage-500)", "var(--gold-500)", "var(--sky-500)", "var(--clay-500)"];

export function Avatar({
  name = "",
  size = 40,
  tone,
  style = {},
}: {
  name?: string;
  size?: number;
  tone?: string;
  style?: CSSProperties;
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const bg = tone || PALETTE[name.length % PALETTE.length];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: bg,
        color: "#fff",
        overflow: "hidden",
        fontFamily: "var(--font-sans)",
        fontWeight: 700,
        fontSize: size * 0.4,
        border: "2px solid var(--surface-card)",
        boxShadow: "var(--shadow-xs)",
        ...style,
      }}
    >
      {initials}
    </span>
  );
}
