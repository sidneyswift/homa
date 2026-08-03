import type { CSSProperties } from "react";

import { Logo } from "../brand/Logo";

export type QuietIdentityProps = {
  size?: number;
  variant?: "full" | "mark";
  tone?: "light" | "dark";
  treatment?: "solid" | "line";
  className?: string;
  style?: CSSProperties;
};

/**
 * Identity adapter for web surfaces. It delegates every visible mark and
 * wordmark detail to the canonical Logo component and never accepts custom
 * geometry, colors, or hand-built text. Use the `mark` variant only where a
 * compact identity slot has an accessible name elsewhere.
 */
export function QuietIdentity({ className = "", ...props }: QuietIdentityProps) {
  return (
    <span className={`quiet-identity ${className}`.trim()} data-identity="homa">
      <Logo {...props} />
    </span>
  );
}
