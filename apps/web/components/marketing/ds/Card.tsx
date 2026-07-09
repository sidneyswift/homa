"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

import { useCanHover, usePrefersReducedMotion } from "./use-interaction-media";

/**
 * Homa Card, soft warm surface container. Ported from
 * docs/homa-design/components/layout/Card.jsx (source of truth); keep in
 * sync until packages/design exists (M1-17). The interactive hover-lift only
 * fires on hover-capable devices (never triggers on a touch tap), and its
 * translate is dropped under reduced motion while the shadow depth cue stays.
 */

const PADS = { none: 0, sm: "var(--space-4)", md: "var(--space-6)", lg: "var(--space-8)" } as const;

export function Card({
  padding = "md",
  interactive = false,
  elevated = false,
  children,
  onClick,
  style = {},
}: {
  padding?: keyof typeof PADS;
  interactive?: boolean;
  elevated?: boolean;
  children?: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  const [hover, setHover] = useState(false);
  const canHover = useCanHover();
  const reduceMotion = usePrefersReducedMotion();
  const lifted = interactive && hover && canHover;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-xl)",
        padding: PADS[padding],
        boxShadow: elevated ? "var(--shadow-md)" : "var(--shadow-sm)",
        transition: "box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)",
        cursor: interactive ? "pointer" : "default",
        ...(lifted
          ? { boxShadow: "var(--shadow-lg)", ...(reduceMotion ? {} : { transform: "translateY(-2px)" }) }
          : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
