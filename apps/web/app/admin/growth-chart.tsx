import type { FamiliesByDayPoint } from "../../lib/admin/overview-data";
import { EmptyNote } from "./ui";

/**
 * The founder's growth line: cumulative real families per day, full
 * product history (founder ask 2026-07-23: "a graph, not a number").
 * Hand-rolled server-rendered SVG like ui.tsx's Spark; no chart library,
 * no hover. The two numbers that matter, zero and now, are printed on
 * the chart itself.
 */

const WIDTH = 720;
const HEIGHT = 240;
const INSET_LEFT = 40;
const INSET_RIGHT = 88;
const INSET_TOP = 16;
const INSET_BOTTOM = 28;

/** The July 13, 2026 conference: the launch elbow in the curve gets a
 * label so it never needs a legend. */
const LAUNCH_DAY = "2026-07-13";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(day: string): string {
  const [, month, date] = day.split("-");
  return `${MONTHS[Number(month) - 1]} ${Number(date)}`;
}

function isSunday(day: string): boolean {
  return new Date(`${day}T00:00:00Z`).getUTCDay() === 0;
}

export function GrowthChart({ points }: { points: FamiliesByDayPoint[] }) {
  if (points.length < 2) {
    return <EmptyNote>The growth line starts once two days of signups exist.</EmptyNote>;
  }

  const plotLeft = INSET_LEFT;
  const plotRight = WIDTH - INSET_RIGHT;
  const plotTop = INSET_TOP;
  const plotBottom = HEIGHT - INSET_BOTTOM;

  const max = Math.max(...points.map((p) => p.total), 1);
  const step = max <= 40 ? 10 : 20;
  const domainTop = Math.max(step, Math.ceil(max / step) * step);

  const x = (index: number) =>
    plotLeft + (index / (points.length - 1)) * (plotRight - plotLeft);
  const y = (value: number) =>
    plotBottom - (value / domainTop) * (plotBottom - plotTop);

  const gridValues: number[] = [];
  for (let v = 0; v <= domainTop; v += step) gridValues.push(v);

  const line = points
    .map((p, i) => `${x(i).toFixed(1)},${y(p.total).toFixed(1)}`)
    .join(" ");

  const weekTicks = points
    .map((p, i) => ({ day: p.day, i }))
    .filter(({ day }) => isSunday(day));
  const launchIndex = points.findIndex((p) => p.day === LAUNCH_DAY);
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Families over time, ${last.total} today`}
    >
      {gridValues.map((v) => (
        <g key={v}>
          <line
            x1={plotLeft}
            x2={plotRight}
            y1={y(v)}
            y2={y(v)}
            stroke="var(--stone-200)"
            strokeWidth="1"
          />
          <text
            x={plotLeft - 8}
            y={y(v) + 3}
            textAnchor="end"
            className="font-mono"
            fontSize="10"
            fill="var(--stone-500)"
          >
            {v}
          </text>
        </g>
      ))}
      <line
        x1={plotLeft}
        x2={plotRight}
        y1={plotBottom}
        y2={plotBottom}
        stroke="var(--stone-300)"
        strokeWidth="1"
      />
      {weekTicks.map(({ day, i }) => (
        <text
          key={day}
          x={x(i)}
          y={plotBottom + 18}
          textAnchor="middle"
          className="font-mono"
          fontSize="10"
          fill="var(--stone-500)"
        >
          {shortDate(day)}
        </text>
      ))}
      {launchIndex >= 0 ? (
        <g>
          <line
            x1={x(launchIndex)}
            x2={x(launchIndex)}
            y1={plotTop}
            y2={plotBottom}
            stroke="var(--stone-300)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <text
            x={x(launchIndex) + 5}
            y={plotTop + 8}
            className="font-mono"
            fontSize="10"
            fill="var(--stone-500)"
          >
            launch
          </text>
        </g>
      ) : null}
      <polyline
        points={line}
        fill="none"
        stroke="var(--clay-500)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x(points.length - 1)} cy={y(last.total)} r="4" fill="var(--clay-500)" />
      <text
        x={plotRight + 14}
        y={y(last.total) + 4}
        fontSize="20"
        fontWeight="600"
        fill="var(--text-strong)"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {last.total}
      </text>
      <text
        x={plotRight + 14}
        y={y(last.total) + 18}
        className="font-mono"
        fontSize="10"
        fill="var(--stone-500)"
      >
        families
      </text>
    </svg>
  );
}
