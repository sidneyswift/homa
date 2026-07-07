"use client";

import { useMemo } from "react";

/**
 * The whole-curriculum web for the peek-under-the-hood panel, ported
 * verbatim from docs/homa-design/ui_kits/landing/LandingPage.jsx: ~140
 * linked skill dots, foundational to advanced, deterministic layout
 * (seeded), with labeled clusters. Sage = secure, clay ring = Homa works
 * next. Static once rendered, no motion.
 */

type WebNode = { x: number; y: number; t: number; state?: "secure" | "coming" | "next" };

const LABELS: ReadonlyArray<readonly [string, number, number]> = [
  ["Handwriting", 0.045, 0.8],
  ["Phonics", 0.09, 0.48],
  ["Counting", 0.1, 0.18],
  ["Add & subtract", 0.23, 0.4],
  ["Language reasoning", 0.25, 0.7],
  ["Spelling", 0.31, 0.9],
  ["Place value", 0.38, 0.26],
  ["Reading", 0.45, 0.52],
  ["Measurement", 0.39, 0.74],
  ["Fractions", 0.52, 0.34],
  ["Writing", 0.56, 0.68],
  ["Times tables", 0.6, 0.16],
  ["Geometry", 0.68, 0.56],
  ["Ratio", 0.76, 0.28],
  ["Probability", 0.78, 0.74],
  ["Algebra", 0.88, 0.48],
];

const CORNER_STYLE = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1.5, fill: "var(--text-subtle)" } as const;

export function SkillWeb() {
  const web = useMemo(() => {
    let seed = 7;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const W = 1000,
      H = 340,
      N = 140;
    const nodes: WebNode[] = [];
    for (let i = 0; i < N; i++) {
      const t = (i + rand() * 0.9) / N;
      nodes.push({ x: 30 + (W - 60) * t, y: 30 + (H - 60) * rand(), t });
    }
    nodes.forEach((n) => {
      n.state = n.t < 0.42 ? (rand() < 0.88 ? "secure" : "coming") : n.t < 0.58 ? (rand() < 0.4 ? "secure" : "coming") : "coming";
    });
    let ring = 0;
    nodes.forEach((n) => {
      if (ring < 9 && n.state === "coming" && n.t > 0.42 && n.t < 0.64 && rand() < 0.5) {
        n.state = "next";
        ring++;
      }
    });
    const edges: Array<[number, number]> = [];
    nodes.forEach((n, i) => {
      const cands: Array<[number, number]> = [];
      for (let j = 0; j < N; j++) {
        const m = nodes[j];
        if (m.x <= n.x) continue;
        cands.push([(m.x - n.x) * (m.x - n.x) + (m.y - n.y) * 1.6 * ((m.y - n.y) * 1.6), j]);
      }
      cands.sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < Math.min(2, cands.length); k++) edges.push([i, cands[k][1]]);
    });
    return { nodes, edges };
  }, []);

  return (
    <svg viewBox="0 0 1000 340" style={{ width: "100%", display: "block" }} aria-hidden="true">
      {web.edges.map(([a, b], i) => {
        const n = web.nodes[a],
          m = web.nodes[b];
        return <line key={i} x1={n.x} y1={n.y} x2={m.x} y2={m.y} stroke="rgba(51,42,33,0.09)" strokeWidth="1" />;
      })}
      {web.nodes.map((n, i) =>
        n.state === "secure" ? (
          <circle key={i} cx={n.x} cy={n.y} r="3.6" fill="var(--sage-600)" />
        ) : n.state === "next" ? (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r="6" fill="#fff" stroke="var(--clay-500)" strokeWidth="2.6" />
            <circle cx={n.x} cy={n.y} r="1.8" fill="var(--clay-500)" />
          </g>
        ) : (
          <circle key={i} cx={n.x} cy={n.y} r="3.2" fill="#fff" stroke="var(--stone-300)" strokeWidth="1.2" />
        ),
      )}
      {LABELS.map(([l, tx, ty]) => (
        <text
          key={l}
          x={tx * 1000}
          y={ty * 340}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 12.5,
            fontWeight: 600,
            fill: "var(--stone-600)",
            paintOrder: "stroke",
            stroke: "var(--bg-page)",
            strokeWidth: 4,
            strokeLinejoin: "round",
          }}
        >
          {l}
        </text>
      ))}
      <text x="30" y="14" style={CORNER_STYLE}>
        FOUNDATIONAL
      </text>
      <text x="970" y="14" textAnchor="end" style={CORNER_STYLE}>
        MORE ADVANCED &#8594;
      </text>
    </svg>
  );
}
