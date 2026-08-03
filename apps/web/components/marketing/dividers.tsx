"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { usePrefersReducedMotion } from "./ds/use-interaction-media";

/**
 * Section-seam dividers + the Eyebrow section label, evolved from the former
 * landing composition. The contract in @homa/design is authoritative. Wave
 * and Eyebrow are
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
          near-identical creams (var(--bg-page) against var(--bg-page-warm)):
          without it the wave is invisible and the seam reads as a dead join. The
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

/* Bottom-tear counterpart to the deckle that ends HowThread
   (thread/HowThread.tsx DECKLE_D): the blush story band enters as a torn
   sheet, so it must exit as one too; a smooth wave on the same band read
   as two different papers. Derived from the source edge (vertically
   mirrored, horizontally reversed, anchors jittered) so the two tears
   share one vocabulary, mostly shallow undulation with a handful of deep
   bites, without being a recognizable copy: a real sheet's two torn
   edges never match. `color` fills from the top of the strip down to the
   tear; whatever ground sits behind the strip shows through below it. */
const TORN_D =
  "M0 43.3 Q -8 48.0 3 40.6 Q 30 49.3 50 44.1 Q 65 47.8 75 44.4 Q 87 49.8 97 44.6 Q 124 47.3 148 33.5 L 170 48.5 L 202 39.7 Q 224 50.2 249 41.8 Q 267 50.4 285 43.7 Q 301 47.8 311 45.0 Q 326 50.3 338 39.5 Q 365 50.4 387 38.9 L 401 50.1 L 422 43.4 Q 439 49.0 453 41.0 Q 482 50.5 506 40.7 L 521 50.7 L 551 40.4 Q 574 50.0 596 42.1 Q 615 48.1 627 41.1 Q 646 48.2 665 43.2 Q 679 50.4 699 42.4 Q 715 51.7 736 33.8 L 746 50.2 L 773 43.0 Q 795 52.1 818 45.0 Q 841 50.3 866 42.3 L 866 50.7 L 887 37.9 Q 905 48.3 923 37.6 Q 944 49.4 966 42.7 Q 979 50.6 995 40.2 L 1002 50.5 L 1031 39.6 Q 1052 48.2 1077 40.3 Q 1099 48.4 1125 42.8 L 1144 50.6 L 1172 38.0 Q 1197 49.1 1220 45.8 Q 1243 47.9 1261 34.2 L 1279 51.1 L 1321 35.7 L 1328 50.1 L 1358 38.9 L 1368 49.8 L 1393 42.4 L 1402 49.0 L 1418 42.7 L 1427 47.2 L 1440 40.2 L 1440 0 L 0 0 Z";

export function Deckle({ color = "var(--band-blush)" }: { color?: string }) {
  return (
    <svg
      viewBox="0 0 1440 62"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: "block", width: "100%", height: 62, margin: "-1px 0" }}
    >
      <defs>
        <filter id="lp-deckle-shadow" x="-2%" y="-30%" width="104%" height="160%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      {/* Cast shadow under the tear only: the torn sheet lies ON the page
          below, so its bottom edge shadows downward; the sheet's own body
          covers the rest of the offset copy. The viewBox is 6 units taller
          than the tear needs so the blur is never clipped at the bottom. */}
      <path
        d={TORN_D}
        transform="translate(0 5)"
        fill="color-mix(in oklab, var(--text-body) 12%, transparent)"
        filter="url(#lp-deckle-shadow)"
      />
      <path fill={color} d={TORN_D} />
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
