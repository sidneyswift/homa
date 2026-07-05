"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";

/**
 * Homa Button, primary interactive element. Ported from
 * docs/homa-design/components/actions/Button.jsx (source of truth); keep in
 * sync until packages/design exists (M1-17). Adds `href` (renders a Next
 * Link with identical styling) so kit CTAs can navigate.
 * Motion per the emil-design-eng skill: exact transition properties, brand
 * ease-out, press scale from --press-scale.
 */

type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const SIZES: Record<ButtonSize, CSSProperties & { gap: string }> = {
  sm: { padding: "8px 14px", fontSize: "0.875rem", gap: "6px", minHeight: 36 },
  md: { padding: "11px 20px", fontSize: "1rem", gap: "8px", minHeight: 44 },
  lg: { padding: "15px 28px", fontSize: "1.0625rem", gap: "10px", minHeight: 52 },
};

const VARIANTS: Record<ButtonVariant, CSSProperties> = {
  primary: { background: "var(--brand)", color: "var(--on-brand)", border: "1px solid transparent" },
  secondary: { background: "transparent", color: "var(--sage-700)", border: "1.5px solid var(--sage-300)" },
  soft: { background: "var(--brand-soft)", color: "var(--clay-700)", border: "1px solid transparent" },
  ghost: { background: "transparent", color: "var(--text-body)", border: "1px solid transparent" },
  danger: { background: "var(--danger)", color: "#fff", border: "1px solid transparent" },
};

const HOVER_BG: Record<ButtonVariant, string> = {
  primary: "var(--brand-hover)",
  secondary: "var(--sage-50)",
  soft: "var(--brand-soft-2)",
  ghost: "var(--stone-100)",
  danger: "var(--rose-600)",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  iconLeft = null,
  iconRight = null,
  type = "button",
  href,
  onClick,
  children,
  style = {},
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  disabled?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  type?: "button" | "submit" | "reset";
  href?: string;
  onClick?: () => void;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const [focus, setFocus] = useState(false);

  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: SIZES[size].gap,
    fontFamily: "var(--font-sans)",
    fontWeight: 700,
    fontSize: SIZES[size].fontSize,
    lineHeight: 1,
    padding: SIZES[size].padding,
    minHeight: SIZES[size].minHeight,
    width: fullWidth ? "100%" : "auto",
    borderRadius: "var(--radius-pill)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    textDecoration: "none",
    transition:
      "background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
    whiteSpace: "nowrap",
    ...VARIANTS[variant],
    ...style,
  };

  const dynamic: CSSProperties = disabled
    ? {}
    : {
        background: hover ? HOVER_BG[variant] : (base.background as string),
        transform: active ? "scale(var(--press-scale))" : "none",
        outline: "none",
        boxShadow: focus ? "var(--shadow-focus)" : "none",
      };

  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setActive(false);
    },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
    onTouchStart: () => setActive(true),
    onTouchEnd: () => setActive(false),
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
  };

  if (href) {
    return (
      <Link href={href} onClick={onClick} style={{ ...base, ...dynamic }} {...handlers}>
        {iconLeft}
        {children}
        {iconRight}
      </Link>
    );
  }

  return (
    <button type={type} disabled={disabled} onClick={onClick} style={{ ...base, ...dynamic }} {...handlers}>
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
