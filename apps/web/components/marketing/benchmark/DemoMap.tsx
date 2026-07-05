/**
 * The live benchmark map, ported verbatim from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx: two skill constellations
 * (Reading, Math) as a node-link graph. Nodes drift off the baseline, edges
 * curve. Node/edge state changes transition fill/stroke at --dur-base
 * --ease-out (color-only motion, GPU-friendly, interruptible).
 */

const RX = (i: number) => 100 + i * 106;
const RY = [66, 48, 76, 54, 82, 62];
const MY = [184, 166, 192, 170, 196, 176];

type NodeState = "solid" | "start" | "coming";

const nodeState = (i: number, start: number | null): NodeState =>
  start == null ? "coming" : i < start ? "solid" : i === start ? "start" : "coming";

const LABEL_HALO = {
  paintOrder: "stroke",
  stroke: "var(--surface-card)",
  strokeWidth: 4,
  strokeLinejoin: "round",
} as const;

function trackEls(nodes: readonly string[], ys: number[], start: number | null, keyp: string) {
  const els = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const active = start != null && i < start;
    const bend = i % 2 ? -18 : 18;
    els.push(
      <path
        key={`${keyp}e${i}`}
        d={`M ${RX(i)} ${ys[i]} Q ${(RX(i) + RX(i + 1)) / 2} ${(ys[i] + ys[i + 1]) / 2 + bend} ${RX(i + 1)} ${ys[i + 1]}`}
        fill="none"
        stroke={active ? "var(--sage-300)" : "var(--stone-200)"}
        strokeWidth="1.6"
        style={{ transition: "stroke var(--dur-base) var(--ease-out)" }}
      />,
    );
  }
  nodes.forEach((n, i) => {
    const s = nodeState(i, start);
    els.push(
      <g key={`${keyp}n${i}`}>
        <circle
          cx={RX(i)}
          cy={ys[i]}
          r={s === "start" ? 9 : 6.5}
          fill={s === "solid" ? "var(--sage-500)" : s === "start" ? "var(--clay-50)" : "#fff"}
          stroke={s === "solid" ? "var(--sage-500)" : s === "start" ? "var(--clay-500)" : "var(--stone-300)"}
          strokeWidth={s === "start" ? 3 : 1.6}
          style={{ transition: "fill var(--dur-base) var(--ease-out), stroke var(--dur-base) var(--ease-out)" }}
        />
        <text
          x={RX(i)}
          y={ys[i] + (s === "start" ? 27 : 24)}
          textAnchor="middle"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 11.5,
            fontWeight: s === "coming" ? 500 : 700,
            fill: s === "start" ? "var(--clay-700)" : s === "solid" ? "var(--sage-700)" : "var(--text-subtle)",
            transition: "fill var(--dur-base) var(--ease-out)",
            ...LABEL_HALO,
          }}
        >
          {n}
        </text>
      </g>,
    );
  });
  return els;
}

const CORNER_STYLE = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, fill: "var(--text-subtle)" } as const;

export function DemoMap({
  readingNodes,
  mathNodes,
  readingStart,
  mathStart,
  mathOn = true,
}: {
  readingNodes: readonly string[];
  mathNodes: readonly string[];
  readingStart: number | null;
  mathStart: number | null;
  mathOn?: boolean;
}) {
  return (
    <svg viewBox="0 0 700 236" style={{ width: "100%", display: "block" }} aria-hidden="true">
      <text x="100" y="16" style={CORNER_STYLE}>
        EARLIER
      </text>
      <text x="660" y="16" textAnchor="end" style={CORNER_STYLE}>
        LATER
      </text>
      {trackEls(readingNodes, RY, readingStart, "r")}
      <text x="16" y="70" style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 700, fill: "var(--text-body)" }}>
        Reading
      </text>
      <g style={{ opacity: mathOn ? 1 : 0.22, transition: "opacity 320ms var(--ease-out)" }}>
        {trackEls(mathNodes, MY, mathStart, "m")}
        <text x="16" y="188" style={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 700, fill: "var(--text-body)" }}>
          Math
        </text>
      </g>
    </svg>
  );
}
