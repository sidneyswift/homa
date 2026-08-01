import type { FamiliesByDayPoint, GrowthSeries } from "../../lib/admin/overview-data";
import { EmptyNote } from "./ui";

/**
 * The founder's growth lines: cumulative onboarding starts (demand, husks
 * included), accounts created (the population the headline and roster
 * count), families that added a child, and verified trial starts, per day,
 * across full product history. The vertical gaps
 * between the lines are the funnel leaks, so this stays fixed lines,
 * never a filter. Hand-rolled server-rendered SVG like ui.tsx's Spark;
 * no hover. The numbers that matter are printed at the line ends and
 * double as the legend.
 */

const WIDTH = 720;
const HEIGHT = 240;
const INSET_LEFT = 40;
const INSET_RIGHT = 124;
const INSET_TOP = 16;
const INSET_BOTTOM = 28;

/** Endpoint labels never sit closer than this vertically. */
const LABEL_GAP = 34;

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

interface Line {
  points: FamiliesByDayPoint[];
  label: string;
  stroke: string;
  labelFill: string;
}

export function GrowthChart({ series }: { series: GrowthSeries }) {
  const { startedOnboarding } = series;
  if (startedOnboarding.length < 2) {
    return <EmptyNote>The growth line starts after two days of email collection.</EmptyNote>;
  }

  // Top of the funnel first: later lines draw on top, and endpoint
  // labels stack in this order when they crowd.
  const lines: Line[] = [
    {
      points: startedOnboarding,
      label: "email collected",
      stroke: "var(--clay-500)",
      labelFill: "var(--text-strong)",
    },
    {
      points: series.accounts,
      label: "created account",
      stroke: "var(--sky-600)",
      labelFill: "var(--sky-600)",
    },
    {
      points: series.setupDone,
      label: "added a child",
      stroke: "var(--sage-500)",
      labelFill: "var(--sage-600)",
    },
    {
      points: series.trialStarted,
      label: "trial started",
      stroke: "var(--gold-500)",
      labelFill: "var(--gold-ink)",
    },
  ].filter((line) => line.points.length > 1);

  const plotLeft = INSET_LEFT;
  const plotRight = WIDTH - INSET_RIGHT;
  const plotTop = INSET_TOP;
  const plotBottom = HEIGHT - INSET_BOTTOM;

  const max = Math.max(...startedOnboarding.map((p) => p.total), 1);
  const step = max <= 40 ? 10 : 20;
  const domainTop = Math.max(step, Math.ceil(max / step) * step);

  const x = (index: number, length: number) =>
    plotLeft + (index / (Math.max(length, startedOnboarding.length) - 1)) * (plotRight - plotLeft);
  const y = (value: number) =>
    plotBottom - (value / domainTop) * (plotBottom - plotTop);

  const gridValues: number[] = [];
  for (let v = 0; v <= domainTop; v += step) gridValues.push(v);

  const toPolyline = (points: FamiliesByDayPoint[]) =>
    points
      .map((p, i) => `${x(i, points.length).toFixed(1)},${y(p.total).toFixed(1)}`)
      .join(" ");

  const weekTicks = startedOnboarding
    .map((p, i) => ({ day: p.day, i }))
    .filter(({ day }) => isSunday(day));
  const launchIndex = startedOnboarding.findIndex((p) => p.day === LAUNCH_DAY);

  // Endpoint labels, nudged apart top-down so they never overlap.
  let previousLabelY = -Infinity;
  const labeled = lines.map((line, index) => {
    const last = line.points[line.points.length - 1];
    let labelY = y(last.total);
    if (labelY - previousLabelY < LABEL_GAP) labelY = previousLabelY + LABEL_GAP;
    previousLabelY = labelY;
    return { ...line, last, labelY, primary: index === 0 };
  });

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Families over time: ${labeled
        .map((line) => `${line.last.total} ${line.label}`)
        .join(", ")}`}
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
          x={x(i, startedOnboarding.length)}
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
            x1={x(launchIndex, startedOnboarding.length)}
            x2={x(launchIndex, startedOnboarding.length)}
            y1={plotTop}
            y2={plotBottom}
            stroke="var(--stone-300)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <text
            x={x(launchIndex, startedOnboarding.length) + 5}
            y={plotTop + 8}
            className="font-mono"
            fontSize="10"
            fill="var(--stone-500)"
          >
            launch
          </text>
        </g>
      ) : null}
      {[...labeled].reverse().map((line) => (
        <polyline
          key={`line-${line.label}`}
          points={toPolyline(line.points)}
          fill="none"
          stroke={line.stroke}
          strokeWidth={line.primary ? "2.5" : "2"}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {labeled.map((line) => (
        <g key={`end-${line.label}`}>
          <circle
            cx={x(line.points.length - 1, line.points.length)}
            cy={y(line.last.total)}
            r={line.primary ? 4 : 3.5}
            fill={line.stroke}
          />
          <text
            x={plotRight + 14}
            y={line.labelY + 4}
            fontSize={line.primary ? 20 : 16}
            fontWeight="600"
            fill={line.labelFill}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {line.last.total}
          </text>
          <text
            x={plotRight + 14}
            y={line.labelY + (line.primary ? 18 : 17)}
            className="font-mono"
            fontSize="10"
            fill="var(--stone-500)"
          >
            {line.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
