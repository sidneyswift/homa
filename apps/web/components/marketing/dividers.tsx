import type { ReactNode } from "react";

/**
 * Section-seam dividers + the Eyebrow section label, ported verbatim from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx (source of truth); keep
 * in sync until packages/design exists (M1-17). Purely decorative, static
 * SVG, no motion.
 */

export function Wave({ color = "var(--band-sky)", flip = false }: { color?: string; flip?: boolean }) {
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
    </svg>
  );
}

/**
 * Squiggle ribbon divider: a fat wavy band with a repeating phrase riding
 * the curve. The ribbon IS the seam: `top` and `bottom` section colors meet
 * along its centerline, hidden under the band, so no other transition ever
 * shows behind it.
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
  const d = paths[phase % 2];
  const phrase = `${Array(9).fill(text).join("  \u00b7  ")}  \u00b7  `;
  return (
    <div aria-hidden="true" style={{ position: "relative", height: 150, margin: "-1px 0", pointerEvents: "none" }}>
      <svg
        viewBox="0 0 1440 176"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
      >
        <path d={`${d} L 1500 -40 L -60 -40 Z`} fill={top} />
        <path d={`${d} L 1500 216 L -60 216 Z`} fill={bottom} />
        <path id={rid} d={d} fill="none" stroke={color} strokeWidth="54" strokeLinecap="round" />
        <text
          dominantBaseline="middle"
          style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 18, letterSpacing: "0.2em", fill: ink }}
        >
          <textPath href={`#${rid}`}>{phrase}</textPath>
        </text>
      </svg>
    </div>
  );
}

/** Uppercase tracked section label above headings. */
export function Eyebrow({ color = "var(--brand)", children }: { color?: string; children: ReactNode }) {
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
