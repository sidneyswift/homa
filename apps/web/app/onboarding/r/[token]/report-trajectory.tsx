import { getMapDomain } from "@homa/core";

import type { GrowthEra } from "./growth-story";

/**
 * The trajectory chart: months ahead by subject across check-ins, the
 * web port of the founder dashboard's hero chart (homa-macmini
 * generate_dashboard.py). Server-rendered SVG like ReportChart, no
 * client JS. Product adaptations, per the anti-guilt display law:
 * growing subjects plot on a quiet slot just below the at-age line,
 * worded, never numbered, and the family-philosophy "target" reference
 * lines do not port; the +24 gridline is the display cap, not a goal.
 * Renders nothing until a second check-in exists (one date is a dot,
 * not a trajectory).
 */

const WIDTH = 640;
const PLOT_HEIGHT = 220;
const MARGIN = { top: 22, right: 16, bottom: 28, left: 52 } as const;
const HEIGHT = MARGIN.top + PLOT_HEIGHT + MARGIN.bottom;
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const Y_MIN = -6;
const Y_MAX = 26;
/** Growing subjects plot here: below the at-age line, never a number. */
const GROWING_MONTHS = -3;
const Y_GRID = [0, 6, 12, 18, 24] as const;
const MAX_DATE_TICKS = 5;

/** One distinguishable design-system color per subject (tokens only). */
const DOMAIN_COLORS: Record<string, string> = {
  math: "var(--pop-cobalt)",
  literacy: "var(--sky-600)",
  phonics: "var(--pop-navy)",
  writing: "var(--clay-700)",
  language: "var(--sky-500)",
  science: "var(--sage-500)",
  social_studies: "var(--sage-700)",
  art: "var(--clay-500)",
  music: "var(--pop-blush)",
  gross_motor: "var(--gold-500)",
  fine_motor: "var(--gold-ink)",
  social_emotional: "var(--clay-300)",
  self_care: "var(--sage-300)",
  executive_function: "var(--pop-cobalt-deep)",
  computer_science: "var(--stone-500)",
};
const FALLBACK_COLOR = "var(--stone-500)";

interface SeriesPoint {
  t: number;
  months: number;
}

interface TrajectorySeries {
  domainId: string;
  name: string;
  color: string;
  points: SeriesPoint[];
}

/** One line per mapped, age-normed subject, strongest first (so the
 * legend ranks the way the strengths list does). Eras where a subject
 * wasn't mapped yet simply contribute no point: the line starts when
 * the data does. */
function buildSeries(eras: GrowthEra[]): TrajectorySeries[] {
  const latest = eras[eras.length - 1];
  return latest.scores.strengthOrder
    .map((domainId) => {
      const points: SeriesPoint[] = [];
      for (const era of eras) {
        const score = era.scores.domains.find((entry) => entry.domainId === domainId);
        if (!score || score.exposureBased || score.position === "not_mapped") continue;
        points.push({
          t: new Date(era.generated_at).getTime(),
          months: score.monthsAhead ?? GROWING_MONTHS,
        });
      }
      points.sort((a, b) => a.t - b.t);
      return {
        domainId,
        name: getMapDomain(domainId)?.displayName ?? domainId,
        color: DOMAIN_COLORS[domainId] ?? FALLBACK_COLOR,
        points,
      };
    })
    .filter((series) => series.points.length > 0);
}

function dayLabel(t: number): string {
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** At most MAX_DATE_TICKS date labels, spread evenly, one per distinct day. */
function pickDateTicks(eraTimes: number[]): number[] {
  const seen = new Set<string>();
  const distinctDays = eraTimes.filter((t) => {
    const label = dayLabel(t);
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
  if (distinctDays.length <= MAX_DATE_TICKS) return distinctDays;
  return Array.from(
    { length: MAX_DATE_TICKS },
    (_, index) => distinctDays[Math.round((index * (distinctDays.length - 1)) / (MAX_DATE_TICKS - 1))],
  );
}

export function ReportTrajectory({
  childName,
  eras,
}: {
  childName: string;
  /** Oldest first, the live report last (report-view's eras). */
  eras: GrowthEra[];
}) {
  if (eras.length < 2) return null;
  const series = buildSeries(eras);
  if (series.length === 0) return null;

  const eraTimes = [...eras.map((era) => new Date(era.generated_at).getTime())].sort(
    (a, b) => a - b,
  );
  const t0 = eraTimes[0];
  const now = new Date().getTime();
  const tEnd = Math.max(eraTimes[eraTimes.length - 1], now);
  // A little forward space so the newest dots and the today line breathe.
  const tMax = tEnd + Math.max((tEnd - t0) * 0.06, 1);

  const x = (t: number): number => MARGIN.left + ((t - t0) / (tMax - t0)) * PLOT_WIDTH;
  const y = (months: number): number =>
    MARGIN.top + ((Y_MAX - months) / (Y_MAX - Y_MIN)) * PLOT_HEIGHT;

  const dateTicks = pickDateTicks(eraTimes);
  const hasGrowingPoint = series.some((entry) =>
    entry.points.some((point) => point.months === GROWING_MONTHS),
  );
  const todayX = Math.min(x(now), WIDTH - MARGIN.right - 4);

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${childName}'s months ahead by subject across ${eras.length} check-ins`}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        {Y_GRID.map((months) => (
          <g key={months}>
            <line
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={y(months)}
              y2={y(months)}
              stroke={months === 0 ? "var(--stone-300)" : "var(--stone-100)"}
              strokeWidth={months === 0 ? 2 : 1}
            />
            <text
              x={MARGIN.left - 8}
              y={y(months) + 3}
              textAnchor="end"
              style={{ font: "500 10px var(--font-mono)", fill: "var(--text-subtle)" }}
            >
              {months === 0 ? "at age" : `+${months}${months === 24 ? " mo" : ""}`}
            </text>
          </g>
        ))}
        {hasGrowingPoint ? (
          <text
            x={MARGIN.left - 8}
            y={y(GROWING_MONTHS) + 3}
            textAnchor="end"
            style={{ font: "500 10px var(--font-mono)", fill: "var(--sky-600)" }}
          >
            growing
          </text>
        ) : null}

        {dateTicks.map((t) => (
          <text
            key={t}
            x={x(t)}
            y={MARGIN.top + PLOT_HEIGHT + 18}
            textAnchor="middle"
            style={{ font: "500 10px var(--font-mono)", fill: "var(--text-subtle)" }}
          >
            {dayLabel(t)}
          </text>
        ))}

        {/* Today, so the eye separates the recorded past from open future. */}
        <line
          x1={todayX}
          x2={todayX}
          y1={MARGIN.top}
          y2={MARGIN.top + PLOT_HEIGHT}
          stroke="var(--stone-300)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        <text
          x={todayX}
          y={MARGIN.top - 8}
          textAnchor="end"
          style={{ font: "700 9px var(--font-mono)", fill: "var(--text-subtle)" }}
        >
          today
        </text>

        {series.map((entry) => (
          <g key={entry.domainId}>
            {entry.points.length >= 2 ? (
              <polyline
                points={entry.points
                  .map((point) => `${x(point.t).toFixed(1)},${y(point.months).toFixed(1)}`)
                  .join(" ")}
                fill="none"
                stroke={entry.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
            ) : null}
            {entry.points.map((point, index) => (
              <circle
                key={`${entry.domainId}-${point.t}`}
                cx={x(point.t)}
                cy={y(point.months)}
                r={index === entry.points.length - 1 ? 4 : 3}
                fill={entry.color}
                stroke="#fff"
                strokeWidth={1.5}
              />
            ))}
          </g>
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {series.map((entry) => (
          <span key={entry.domainId} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ background: entry.color }}
            />
            <span className="font-mono text-[0.65rem] text-muted">{entry.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
