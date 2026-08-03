import type { CSSProperties } from "react";
import { logoGeometry } from "@homa/design/contract";

/**
 * Homa logo, "the little home": a watchful coral house with bright eyes,
 * beside the Fredoka wordmark (each letter nudged off the baseline). The
 * master geometry is owned by @homa/design and projected through this adapter.
 */

// Exported for non-React render targets (the printable worksheet footer
// inlines the mark as a raw SVG string). Same art, one source of truth.
export const HOUSE_PATH = logoGeometry.housePath;

/**
 * The eyes, in the same 48x48 viewBox, exported for the same reason the
 * house path is: ThinkingMark animates this face and must animate THE
 * mark, not a lookalike of it (brand-casing-homa, 2026-07-28). Each pupil
 * sits slightly down and right of its own white, which is the resting gaze
 * that gives the still logo its character; every animated glance moves
 * relative to that offset rather than replacing it.
 */
export const EYES = logoGeometry.eyes;

/** The pupil ink, and the line-treatment eye radius, shared for the same reason. */
export const PUPIL_FILL = logoGeometry.pupilFill;
export const LINE_EYE_R = 2.7;

/** Where the house meets the ground, so a squash scales from its base
 *  like clay pressed down rather than from its middle like a balloon. */
export const HOUSE_BASE = { x: 24, y: 44 } as const;

// [letter, baseline offset, rotation] for the approved Homa lockup.
const WORDMARK_LETTERS: ReadonlyArray<readonly [string, string, number]> = [
  ["H", "-0.06em", -3],
  ["o", "0.05em", 0],
  ["m", "-0.04em", 2],
  ["a", "0.06em", -2],
];

export function Logo({
  size = 32,
  variant = "full",
  tone = "light",
  treatment = "solid",
  style = {},
}: {
  size?: number;
  variant?: "full" | "mark";
  tone?: "light" | "dark";
  treatment?: "solid" | "line";
  style?: CSSProperties;
}) {
  const body = tone === "dark" ? "var(--homa-visual-coral)" : "var(--homa-visual-coral)";
  const word = tone === "dark" ? "var(--homa-paper)" : "var(--homa-ink)";
  const svgStyle: CSSProperties = { display: "block", flexShrink: 0 };

  const mark =
    treatment === "line" ? (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={svgStyle}>
        <path d={HOUSE_PATH} fill="none" stroke={body} strokeWidth="3.2" strokeLinejoin="round" />
        {EYES.map((eye) => (
          <circle key={eye.cx} cx={eye.cx} cy={eye.cy} r={LINE_EYE_R} fill={body} />
        ))}
      </svg>
    ) : (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" style={svgStyle}>
        <path d={HOUSE_PATH} fill={body} />
        {EYES.map((eye) => (
          <circle key={eye.cx} cx={eye.cx} cy={eye.cy} r={eye.r} fill="var(--homa-paper)" />
        ))}
        {EYES.map((eye) => (
          <circle key={eye.cx} cx={eye.pupilCx} cy={eye.pupilCy} r={eye.pupilR} fill={PUPIL_FILL} />
        ))}
      </svg>
    );

  if (variant === "mark") {
    return (
      <span role="img" aria-label="Homa" style={{ display: "inline-flex", ...style }}>
        {mark}
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label="Homa"
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.3, ...style }}
    >
      {mark}
      <span
        aria-hidden="true"
        style={{
          fontFamily: "var(--font-wordmark)",
          fontWeight: 600,
          fontSize: size * 0.98,
          lineHeight: 1,
          color: word,
          display: "inline-flex",
          marginTop: size * -0.04,
        }}
      >
        {WORDMARK_LETTERS.map(([letter, offsetY, rotateDeg]) => (
          <span
            key={letter}
            style={{ display: "inline-block", transform: `translateY(${offsetY}) rotate(${rotateDeg}deg)` }}
          >
            {letter}
          </span>
        ))}
      </span>
    </span>
  );
}
