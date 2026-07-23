import type { GrowthSeries } from "../../lib/admin/overview-data";
import { EmptyNote } from "./ui";

/**
 * The founder's growth lines: cumulative real signups (demand, husks
 * included) and cumulative setup-done families, per day, full product
 * history (founder rulings 2026-07-23: "a graph, not a number", then
 * "count all real"). The vertical gap between the two lines is the
 * onboarding leak, so this stays two fixed lines, never a filter.
 * Hand-rolled server-rendered SVG like ui.tsx's Spark; no hover. The
 * numbers that matter are printed at the line ends.
 */

const WIDTH = 720;
const HEIGHT = 240;
const INSET_LEFT = 40;
const INSET_RIGHT = 108;
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

export function GrowthChart({ series }: { series: GrowthSeries }) {
  const { signups, setupDone } = series;
  if (signups.length < 2) {
    return <EmptyNote>The growth line starts once two days of signups exist.</EmptyNote>;
  }

  const plotLeft = INSET_LEFT;
  const plotRight = WIDTH - INSET_RIGHT;
  const plotTop = INSET_TOP;
  const plotBottom = HEIGHT - INSET_BOTTOM;

  const max = Math.max(...signups.map((p) => p.total), 1);
  const step = max <= 40 ? 10 : 20;
  const domainTop = Math.max(step, Math.ceil(max / step) * step);

  const x = (index: number, length: number) =>
    plotLeft + (index / (Math.max(length, signups.length) - 1)) * (plotRight - plotLeft);
  const y = (value: number) =>
    plotBottom - (value / domainTop) * (plotBottom - plotTop);

  const gridValues: number[] = [];
  for (let v = 0; v <= domainTop; v += step) gridValues.push(v);

  const toLine = (points: { total: number }[]) =>
    points
      .map((p, i) => `${x(i, points.length).toFixed(1)},${y(p.total).toFixed(1)}`)
      .join(" ");

  const weekTicks = signups
    .map((p, i) => ({ day: p.day, i }))
    .filter(({ day }) => isSunday(day));
  const launchIndex = signups.findIndex((p) => p.day === LAUNCH_DAY);

  const lastSignup = signups[signups.length - 1];
  const lastSetup = setupDone.length > 0 ? setupDone[setupDone.length - 1] : null;

  // End-of-line labels double as the legend. When the two endpoints sit
  // close together, the setup label is pushed down so they never overlap.
  const signupLabelY = y(lastSignup.total);
  let setupLabelY = lastSetup ? y(lastSetup.total) : null;
  if (setupLabelY !== null && setupLabelY - signupLabelY < 34) {
    setupLabelY = signupLabelY + 34;
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Families over time: ${lastSignup.total} signed up${
        lastSetup ? `, ${lastSetup.total} finished setup` : ""
      }`}
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
          x={x(i, signups.length)}
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
            x1={x(launchIndex, signups.length)}
            x2={x(launchIndex, signups.length)}
            y1={plotTop}
            y2={plotBottom}
            stroke="var(--stone-300)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <text
            x={x(launchIndex, signups.length) + 5}
            y={plotTop + 8}
            className="font-mono"
            fontSize="10"
            fill="var(--stone-500)"
          >
            launch
          </text>
        </g>
      ) : null}
      {setupDone.length > 1 ? (
        <polyline
          points={toLine(setupDone)}
          fill="none"
          stroke="var(--sage-500)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      <polyline
        points={toLine(signups)}
        fill="none"
        stroke="var(--clay-500)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={x(signups.length - 1, signups.length)}
        cy={y(lastSignup.total)}
        r="4"
        fill="var(--clay-500)"
      />
      <text
        x={plotRight + 14}
        y={signupLabelY + 4}
        fontSize="20"
        fontWeight="600"
        fill="var(--text-strong)"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {lastSignup.total}
      </text>
      <text
        x={plotRight + 14}
        y={signupLabelY + 18}
        className="font-mono"
        fontSize="10"
        fill="var(--stone-500)"
      >
        signed up
      </text>
      {lastSetup && setupLabelY !== null ? (
        <g>
          <circle
            cx={x(setupDone.length - 1, setupDone.length)}
            cy={y(lastSetup.total)}
            r="3.5"
            fill="var(--sage-500)"
          />
          <text
            x={plotRight + 14}
            y={setupLabelY + 4}
            fontSize="16"
            fontWeight="600"
            fill="var(--sage-600)"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {lastSetup.total}
          </text>
          <text
            x={plotRight + 14}
            y={setupLabelY + 17}
            className="font-mono"
            fontSize="10"
            fill="var(--stone-500)"
          >
            set up
          </text>
        </g>
      ) : null}
    </svg>
  );
}
