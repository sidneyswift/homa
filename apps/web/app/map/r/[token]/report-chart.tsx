import { getMapDomain, type DomainScore } from "@homa/core";

/**
 * The whole-map chart: one dot per domain on a months-ahead axis,
 * server-rendered SVG (no client JS). Anti-guilt display law applies:
 * growing domains sit in sky just left of the at-age line with the word
 * "growing", never a negative number, never red.
 */

const AXIS_MIN = -6;
const AXIS_MAX = 26;
const ROW_H = 34;
const LABEL_W = 150;
const VALUE_W = 64;
const WIDTH = 640;

const COLORS = {
  gold: "var(--gold-400)",
  sage: "var(--sage-300)",
  sky: "var(--sky-500)",
} as const;

function x(months: number): number {
  const plot = WIDTH - LABEL_W - VALUE_W;
  return LABEL_W + ((months - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * plot;
}

export function ReportChart({ scores }: { scores: DomainScore[] }) {
  const rows = scores.filter((score) => score.position !== "not_mapped" && !score.exposureBased);
  const height = rows.length * ROW_H + 40;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      role="img"
      aria-label="Months ahead of age, one dot per domain"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {[0, 6, 12, 18, 24].map((months) => (
        <g key={months}>
          <line
            x1={x(months)}
            x2={x(months)}
            y1={22}
            y2={height - 14}
            stroke={months === 0 ? "var(--stone-300)" : "var(--stone-100)"}
            strokeWidth={months === 0 ? 2 : 1}
          />
          <text
            x={x(months)}
            y={14}
            textAnchor="middle"
            style={{ font: "500 10px var(--font-mono)", fill: "var(--text-subtle)" }}
          >
            {months === 0 ? "at age" : `+${months}${months === 24 ? " mo" : ""}`}
          </text>
        </g>
      ))}

      {rows.map((score, index) => {
        const cy = 34 + index * ROW_H + ROW_H / 2 - 8;
        const domain = getMapDomain(score.domainId);
        const growing = score.position === "growing";
        const months = score.monthsAhead ?? 0;
        const dotX = growing ? x(-3) : x(Math.min(months, 24));
        const color = growing ? COLORS.sky : months >= 6 ? COLORS.gold : COLORS.sage;
        const label = growing ? "growing" : months > 0 ? `+${months} mo` : "at age";
        return (
          <g key={score.domainId}>
            <text
              x={LABEL_W - 10}
              y={cy + 4}
              textAnchor="end"
              style={{ font: "600 12px var(--font-sans)", fill: "var(--text-body)" }}
            >
              {domain?.displayName ?? score.domainId}
            </text>
            <circle
              cx={dotX}
              cy={cy}
              r={7}
              fill={color}
              stroke="#fff"
              strokeWidth={2.5}
              style={{ filter: "drop-shadow(0 0 1px rgba(78,70,62,.35))" }}
            />
            <text
              x={growing ? dotX + 14 : x(Math.min(months, 24)) + 14}
              y={cy + 4}
              style={{ font: "500 10px var(--font-mono)", fill: "var(--text-subtle)" }}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
