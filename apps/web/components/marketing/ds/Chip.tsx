"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

/**
 * Homa Chip, selectable pill. Ported from
 * docs/homa-design/components/forms/Chip.jsx (source of truth); keep in sync
 * until packages/design exists (M1-17). Transition properties are named
 * explicitly (the kit's `all` is an escalation trigger in the
 * review-animations skill).
 */
export function Chip({
  children,
  selected = false,
  onClick,
  iconLeft = null,
  style = {},
}: {
  children?: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  iconLeft?: ReactNode;
  style?: CSSProperties;
}) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  return (
    <span
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? selected : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--font-sans)",
        fontSize: "0.875rem",
        fontWeight: 600,
        padding: "7px 14px",
        borderRadius: "var(--radius-pill)",
        cursor: onClick ? "pointer" : "default",
        background: selected ? "var(--brand)" : hover && onClick ? "var(--stone-100)" : "var(--surface-card)",
        color: selected ? "var(--on-brand)" : "var(--text-body)",
        border: `1.5px solid ${selected ? "var(--brand)" : "var(--border-default)"}`,
        outline: "none",
        boxShadow: focus ? "var(--shadow-focus)" : "none",
        transition:
          "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
        ...style,
      }}
    >
      {iconLeft}
      {children}
    </span>
  );
}
