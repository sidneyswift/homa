"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { usePrefersReducedMotion } from "./ds/use-interaction-media";

/**
 * Section-seam dividers + the Eyebrow section label, ported verbatim from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx (source of truth); keep
 * in sync until packages/design exists (M1-17). Wave and Eyebrow are
 * static SVG, no motion. Ribbon's text scrolls like a ticker along its
 * curve (SMIL `<animate>` on `startOffset`, the only cross-browser way to
 * move a textPath, per MDN); JS-armed and skipped entirely under
 * prefers-reduced-motion, so static SVG is always the safe default.
 */

export function Wave({
  color = "var(--band-sky)",
  flip = false,
  stroke = false,
}: {
  color?: string;
  flip?: boolean;
  stroke?: boolean;
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
      <path fill={color} d="M0 0 H1440 V12 C1220 46 980 4 720 24 C460 44 220 8 0 32 Z" />
      {/* Optional 1px crest edge for boundaries where the two grounds are
          near-identical creams (bg-page against bg-page-warm): without it
          the wave is invisible and the seam reads as a dead join. The
          non-scaling stroke keeps the hairline 1px despite the stretched
          viewBox. */}
      {stroke ? (
        <path
          d="M1440 12 C1220 46 980 4 720 24 C460 44 220 8 0 32"
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}

const RIBBON_TEXT_STYLE = {
  fontFamily: "var(--font-sans)",
  fontWeight: 700,
  fontSize: 18,
  letterSpacing: "0.2em",
} as const;

/** Pixels of ticker travel per second; same for every ribbon so a longer phrase just runs longer, not faster. */
const RIBBON_SCROLL_SPEED = 34;

/**
 * User-units of straight-line extension added to each end of a ribbon's
 * curve, for text only (see `textPaths` below). A `<textPath>` can't draw
 * anything at an arc-length below 0 or past the path's total length, so
 * animating `startOffset` on the plain ~1570-unit-long curve pushed
 * characters past one end or the other mid-loop and they vanished
 * (reported as "missing words"). 3000 comfortably covers the largest
 * observed per-ribbon loop distance (~450 units) with room to spare for
 * longer future copy.
 */
const PATH_OVERSCAN = 3000;

/**
 * Squiggle ribbon divider: a fat wavy band with a repeating phrase riding
 * the curve. The ribbon IS the seam: `top` and `bottom` section colors meet
 * along its centerline, hidden under the band, so no other transition ever
 * shows behind it. The phrase scrolls like a ticker; alternating `phase`
 * (already used to alternate the curve shape) also alternates scroll
 * direction, so consecutive ribbons on a page visibly move opposite ways.
 */
export function Ribbon({
  text,
  color = "var(--pop-cobalt)",
  ink = "#FFFFFF",
  phase = 0,
  top = "var(--bg-page)",
  bottom = "var(--bg-page)",
}: {
  text: string;
  color?: string;
  ink?: string;
  phase?: number;
  top?: string;
  bottom?: string;
}) {
  const rid = `ribbon-${text.replace(/[^a-z]/gi, "").toLowerCase().slice(0, 16)}${phase}`;
  const paths = [
    "M-60 96 C 240 30, 480 152, 750 88 C 1020 26, 1240 142, 1500 62",
    "M-60 72 C 220 146, 470 28, 760 92 C 1050 154, 1260 40, 1500 104",
  ];
  // Same two curves, each extended by PATH_OVERSCAN of straight line at
  // both ends (identical shape in between, so the visible colored band
  // below, which still uses `paths`, is unchanged pixel-for-pixel). Text
  // rides this longer version so the ticker always has valid arc-length
  // to draw on.
  const textPaths = [
    `M${-60 - PATH_OVERSCAN} 96 L-60 96 C 240 30, 480 152, 750 88 C 1020 26, 1240 142, 1500 62 L${1500 + PATH_OVERSCAN} 62`,
    `M${-60 - PATH_OVERSCAN} 72 L-60 72 C 220 146, 470 28, 760 92 C 1050 154, 1260 40, 1500 104 L${1500 + PATH_OVERSCAN} 104`,
  ];
  const d = paths[phase % 2];
  const textD = textPaths[phase % 2];
  const reverse = phase % 2 !== 0;
  // One repeating "text · " unit, glued together 9x. Looping the ticker by
  // exactly one unit's measured width (see below) makes the reset invisible:
  // the pixels revealed after the jump are identical to the ones before it.
  const unit = `${text}  \u00b7  `;
  const phrase = unit.repeat(9);

  const unitRef = useRef<SVGTextElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [loop, setLoop] = useState<{ distance: number; duration: number } | null>(null);
  // The SMIL ticker only renders while the ribbon is near the viewport and
  // motion is welcome: an indefinite animation on an off-screen ribbon still
  // burns main-thread time, and the one-time mount read of the media query
  // ignored a user toggling reduced motion mid-visit. The loop advances by
  // exactly one repeating unit, so unmount/remount restarts invisibly.
  const [onScreen, setOnScreen] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const unitWidth = unitRef.current?.getComputedTextLength();
    if (!unitWidth) return;
    setLoop({ distance: unitWidth, duration: unitWidth / RIBBON_SCROLL_SPEED });
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: "120px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const animate = loop !== null && onScreen && !reducedMotion;

  return (
    <div ref={rootRef} aria-hidden="true" style={{ position: "relative", height: 150, margin: "-1px 0", pointerEvents: "none" }}>
      <svg
        viewBox="0 0 1440 176"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      >
        <path d={`${d} L 1500 -40 L -60 -40 Z`} fill={top} />
        <path d={`${d} L 1500 216 L -60 216 Z`} fill={bottom} />
        <path d={d} fill="none" stroke={color} strokeWidth="54" strokeLinecap="round" />
        {/* Invisible, extends past the colored band above on both ends: the textPath target, per the PATH_OVERSCAN note. */}
        <path id={rid} d={textD} fill="none" />
        {/* Off-canvas, invisible: exists only so getComputedTextLength() can measure one unit's rendered width. */}
        <text ref={unitRef} x={-9999} y={-9999} opacity={0} style={RIBBON_TEXT_STYLE}>
          {unit}
        </text>
        <text dominantBaseline="middle" style={{ ...RIBBON_TEXT_STYLE, fill: ink }}>
          <textPath href={`#${rid}`} startOffset={PATH_OVERSCAN}>
            {phrase}
            {animate && loop ? (
              <animate
                attributeName="startOffset"
                values={reverse ? `${PATH_OVERSCAN}; ${PATH_OVERSCAN + loop.distance}` : `${PATH_OVERSCAN}; ${PATH_OVERSCAN - loop.distance}`}
                dur={`${loop.duration}s`}
                repeatCount="indefinite"
              />
            ) : null}
          </textPath>
        </text>
      </svg>
    </div>
  );
}

/** Uppercase tracked section label above headings. Defaults to clay-600,
    not coral: at 0.8rem this is normal-size text, and coral sits near 3.2:1
    on cream, under the AA 4.5:1 floor. Coral stays for icons and large
    display accents where 3:1 suffices. */
export function Eyebrow({ color = "var(--clay-600)", children }: { color?: string; children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: "0.8rem",
        fontWeight: 700,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </div>
  );
}
