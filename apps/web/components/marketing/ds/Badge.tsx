import type { CSSProperties, ReactNode } from "react";

/**
 * Homa Badge, small status/label pill. This is a legacy projection migrating
 * to the semantic primitives in @homa/design.
 */

type BadgeTone = "neutral" | "brand" | "sage" | "gold" | "success" | "warning" | "danger" | "info";
type BadgeVariant = "soft" | "solid";

const TONES: Record<BadgeTone, Record<BadgeVariant, [string, string]>> = {
  neutral: { soft: ["var(--stone-100)", "var(--stone-700)"], solid: ["var(--stone-700)", "#fff"] },
  brand: { soft: ["var(--clay-50)", "var(--clay-700)"], solid: ["var(--brand)", "#fff"] },
  sage: { soft: ["var(--sage-50)", "var(--sage-700)"], solid: ["var(--sage-600)", "#fff"] },
  gold: { soft: ["var(--gold-100)", "var(--gold-ink)"], solid: ["var(--gold-500)", "var(--gold-ink-strong)"] },
  success: { soft: ["var(--success-soft)", "var(--sage-700)"], solid: ["var(--success)", "#fff"] },
  warning: { soft: ["var(--warning-soft)", "var(--gold-ink)"], solid: ["var(--warning)", "var(--gold-ink-strong)"] },
  danger: { soft: ["var(--danger-soft)", "var(--rose-600)"], solid: ["var(--danger)", "#fff"] },
  info: { soft: ["var(--info-soft)", "var(--sky-600)"], solid: ["var(--info)", "#fff"] },
};

export function Badge({
  tone = "neutral",
  variant = "soft",
  children,
  iconLeft = null,
  style = {},
}: {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  children?: ReactNode;
  iconLeft?: ReactNode;
  style?: CSSProperties;
}) {
  const [bg, fg] = TONES[tone][variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        background: bg,
        color: fg,
        fontFamily: "var(--font-sans)",
        fontSize: "0.75rem",
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: "var(--radius-pill)",
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {iconLeft}
      {children}
    </span>
  );
}
