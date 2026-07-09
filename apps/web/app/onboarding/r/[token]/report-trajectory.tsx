import { getMapDomain } from "@homa/core";

import type { GrowthEra } from "./growth-story";

/**
 * The trajectory chart: months ahead by subject across check-ins, the
 * web port of the founder dashboard's hero chart (homa-macmini
 * generate_dashboard.py). Server-rendered SVG like ReportChart, no
 * client JS.
 *
 * Display conventions, all founder-ruled (2026-07-08):
 * - Every subject starts on the at-age line one week before the first
 *   check-in, so the first week reads as a burst of measured progress.
 *   Growing subjects included: founder rule "downward on the line chart
 *   is ok", so their week-one segment honestly dips to the growing slot
 *   (and any later drop between check-ins draws as it happened).
 * - The axis always extends four weeks past today (open future, with
 *   the armed re-check marked when one exists), and the y-axis fits the
 *   child (snapped to 6-month bands) so the lines own the frame.
 * - Lines that moved are featured; flat lines recede. Each line is
 *   direct-labeled at its endpoint in the future space (no legend, no
 *   color matching across thirteen hues).
 * - What still never renders: negative axis numbers, "behind" wording,
 *   red or warning treatment on a drop, family target lines; +24
 *   remains the display cap, never a goal.
 */

const WIDTH = 640;
const PLOT_HEIGHT = 300;
/** left fits "growing" at the 12px axis font without clipping. */
const MARGIN = { top: 30, right: 16, bottom: 34, left: 66 } as const;
const HEIGHT = MARGIN.top + PLOT_HEIGHT + MARGIN.bottom;
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const Y_MIN = -6;
/** Growing subjects plot here: below the at-age line, never a number. */
const GROWING_MONTHS = -3;
const DATE_TICK_COUNT = 6;
/** The at-age origin sits one week before the first check-in. */
const START_LEAD_MS = 7 * 24 * 60 * 60 * 1000;
/** Four weeks of open future, always, so the chart has room to grow. */
const FUTURE_WINDOW_MS = 28 * 24 * 60 * 60 * 1000;
/**
 * Whole-month scores stack subjects onto identical values; each series
 * rides its own hairline lane, centered on the true value, so
 * overlapping lines stay countable without biasing the picture.
 */
const LANE_STEP_PX = 2;
const LANE_COUNT = 5;
/** End-label metrics: line height and the mono glyph width at 11px
 * (bumped from 9px, UX read 2026-07-08: the inline mini rendered the
 * labels as an unreadable squint on a phone). */
const LABEL_H = 13;
const LABEL_CHAR_W = 6.9;

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
  gross_motor: "var(--gold-400)",
  fine_motor: "var(--gold-ink)",
  social_emotional: "var(--clay-300)",
  self_care: "var(--sage-300)",
  executive_function: "var(--stone-700)",
  computer_science: "var(--stone-500)",
};
const FALLBACK_COLOR = "var(--stone-500)";

interface SeriesPoint {
  t: number;
  months: number;
  /** True for the synthetic at-age starting anchor (drawn lineless-ly:
   * the fan of lines leaving it is the marker). */
  origin?: boolean;
}

interface TrajectorySeries {
  domainId: string;
  name: string;
  color: string;
  points: SeriesPoint[];
  /** A line with a story (it moved, or it is clearly ahead) renders at
   * full volume; flat lines recede so the movers stay readable. */
  featured: boolean;
}

/** One line per mapped, age-normed subject, strongest first. Each series
 * opens with the at-age origin anchor; eras where a subject wasn't
 * mapped yet simply contribute no point. */
function buildSeries(eras: GrowthEra[], tStart: number): TrajectorySeries[] {
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
      if (points.length > 0) {
        points.unshift({ t: tStart, months: 0, origin: true });
      }
      const moved = points.some((point) => point.months !== points[0].months);
      const lastMonths = points.length > 0 ? points[points.length - 1].months : 0;
      return {
        domainId,
        name: getMapDomain(domainId)?.displayName ?? domainId,
        color: DOMAIN_COLORS[domainId] ?? FALLBACK_COLOR,
        points,
        featured: moved || lastMonths >= 6,
      };
    })
    .filter((series) => series.points.length > 1);
}

function dayLabel(t: number): string {
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface EndLabel {
  domainId: string;
  color: string;
  text: string;
  /** Where the line actually ends (leader lines start here). */
  lineX: number;
  lineY: number;
  /** Where the label settles after collision dodging. */
  y: number;
}

/** Spreads end labels vertically so none overlap: a forward pass pushes
 * collisions down, a backward pass lifts any overflow off the plot's
 * bottom edge. */
function dodgeLabels(labels: EndLabel[]): EndLabel[] {
  const sorted = [...labels].sort((a, b) => a.y - b.y);
  const top = MARGIN.top + 6;
  const bottom = MARGIN.top + PLOT_HEIGHT - 2;
  let prev = top - LABEL_H;
  for (const label of sorted) {
    label.y = Math.max(label.y, prev + LABEL_H);
    prev = label.y;
  }
  let next = bottom + LABEL_H;
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    sorted[index].y = Math.min(sorted[index].y, next - LABEL_H);
    next = sorted[index].y;
  }
  return sorted;
}

export function ReportTrajectory({
  childName,
  eras,
  nextRecheckAt = null,
}: {
  childName: string;
  /** Oldest first, the live report last (report-view's eras). */
  eras: GrowthEra[];
  /** ISO date of the soonest armed plan re-check, marked in the future
   * window when present. */
  nextRecheckAt?: string | null;
}) {
  if (eras.length === 0) return null;

  const eraTimes = [...eras.map((era) => new Date(era.generated_at).getTime())].sort(
    (a, b) => a - b,
  );
  const tStart = eraTimes[0] - START_LEAD_MS;
  const now = new Date().getTime();
  const tMax = Math.max(eraTimes[eraTimes.length - 1], now) + FUTURE_WINDOW_MS;

  const series = buildSeries(eras, tStart);
  if (series.length === 0) return null;

  // The y-axis fits the child: highest reading plus headroom, snapped to
  // the 6-month band grid, never below +12 (room to grow) and never
  // above the +24 display cap.
  const maxMonths = Math.max(0, ...series.flatMap((entry) => entry.points.map((p) => p.months)));
  const yMax = Math.min(24, Math.max(12, Math.ceil((maxMonths + 2) / 6) * 6));
  const yGrid = [0, 6, 12, 18, 24].filter((months) => months <= yMax);

  const x = (t: number): number => MARGIN.left + ((t - tStart) / (tMax - tStart)) * PLOT_WIDTH;
  const y = (months: number): number =>
    MARGIN.top + ((yMax - months) / (yMax - Y_MIN)) * PLOT_HEIGHT;
  /** The series' lane-shifted y, so identical values stay countable. */
  const laneY = (months: number, seriesIndex: number): number =>
    y(months) + ((seriesIndex % LANE_COUNT) - Math.floor(LANE_COUNT / 2)) * LANE_STEP_PX;

  const dateTicks = Array.from(
    { length: DATE_TICK_COUNT },
    (_, index) => tStart + (index * (tMax - tStart)) / (DATE_TICK_COUNT - 1),
  );
  const hasGrowingPoint = series.some((entry) =>
    entry.points.some((point) => point.months === GROWING_MONTHS),
  );
  const todayX = Math.min(Math.max(x(now), MARGIN.left + 20), WIDTH - MARGIN.right - 20);
  const recheckT = nextRecheckAt ? new Date(nextRecheckAt).getTime() : null;
  const showRecheck = recheckT !== null && recheckT > now && recheckT <= tMax;

  // Direct labels at each line's end, in the open future space: colored
  // anchor dot, muted mono text (some series colors are too light to
  // carry 9px type), truncated to the room actually available.
  const labelX = Math.max(...series.map((entry) => x(entry.points[entry.points.length - 1].t))) + 12;
  const labelBudget = Math.max(4, Math.floor((WIDTH - MARGIN.right - labelX - 8) / LABEL_CHAR_W));
  const labels = dodgeLabels(
    series.map((entry, seriesIndex) => {
      const last = entry.points[entry.points.length - 1];
      const value = last.months > 0 ? ` +${last.months}` : "";
      const room = labelBudget - value.length;
      const name =
        entry.name.length > room ? `${entry.name.slice(0, Math.max(1, room - 1))}\u2026` : entry.name;
      return {
        domainId: entry.domainId,
        color: entry.color,
        text: `${name}${value}`,
        lineX: x(last.t),
        lineY: laneY(last.months, seriesIndex),
        y: laneY(last.months, seriesIndex),
      };
    }),
  );

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`${childName}'s months ahead by subject across ${eras.length} check-ins, from the at-age start`}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {/* Calendar gridlines, so the x-axis reads as a timeline. */}
      {dateTicks.map((t, index) => (
        <g key={t}>
          <line
            x1={x(t)}
            x2={x(t)}
            y1={MARGIN.top}
            y2={MARGIN.top + PLOT_HEIGHT}
            stroke="var(--stone-100)"
            strokeWidth={1}
          />
          <text
            x={x(t)}
            y={MARGIN.top + PLOT_HEIGHT + 18}
            textAnchor="middle"
            style={{ font: "500 12px var(--font-mono)", fill: "var(--text-subtle)" }}
          >
            {index === 0 ? "start" : dayLabel(t)}
          </text>
        </g>
      ))}

      {yGrid.map((months) => (
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
            style={{ font: "500 12px var(--font-mono)", fill: "var(--text-subtle)" }}
          >
            {months === 0 ? "at age" : `+${months}${months === yMax ? " mo" : ""}`}
          </text>
        </g>
      ))}
      {hasGrowingPoint ? (
        <text
          x={MARGIN.left - 8}
          y={y(GROWING_MONTHS) + 3}
          textAnchor="end"
          style={{ font: "500 12px var(--font-mono)", fill: "var(--sky-600)" }}
        >
          growing
        </text>
      ) : null}

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
        textAnchor="middle"
        style={{ font: "700 10px var(--font-mono)", fill: "var(--text-subtle)" }}
      >
        today
      </text>

      {/* The armed re-check, so the open future has a named next event. */}
      {showRecheck ? (
        <>
          <line
            x1={x(recheckT)}
            x2={x(recheckT)}
            y1={MARGIN.top}
            y2={MARGIN.top + PLOT_HEIGHT}
            stroke="var(--sage-300)"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <text
            x={Math.min(x(recheckT), WIDTH - MARGIN.right - 24)}
            y={MARGIN.top - 8}
            textAnchor="middle"
            style={{ font: "700 10px var(--font-mono)", fill: "var(--sage-700)" }}
          >
            re-check
          </text>
        </>
      ) : null}

      {/* Muted lines first, featured lines on top of them. */}
      {[...series]
        .map((entry, seriesIndex) => ({ entry, seriesIndex }))
        .sort((a, b) => Number(a.entry.featured) - Number(b.entry.featured))
        .map(({ entry, seriesIndex }) => (
          <g key={entry.domainId} opacity={entry.featured ? 0.95 : 0.45}>
            <polyline
              points={entry.points
                .map(
                  (point) =>
                    `${x(point.t).toFixed(1)},${laneY(point.months, seriesIndex).toFixed(1)}`,
                )
                .join(" ")}
              fill="none"
              stroke={entry.color}
              strokeWidth={entry.featured ? 2.5 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {entry.points.map((point, index) =>
              point.origin ? null : (
                <circle
                  key={`${entry.domainId}-${point.t}`}
                  cx={x(point.t)}
                  cy={laneY(point.months, seriesIndex)}
                  r={
                    index === entry.points.length - 1
                      ? entry.featured
                        ? 4.5
                        : 3.5
                      : entry.featured
                        ? 3.5
                        : 2.5
                  }
                  fill={index === entry.points.length - 1 ? entry.color : "#fff"}
                  stroke={index === entry.points.length - 1 ? "#fff" : entry.color}
                  strokeWidth={index === entry.points.length - 1 ? 1.5 : 2}
                />
              ),
            )}
          </g>
        ))}

      {/* Direct labels in the future space: the legend, where the eye
          already is. Hairline leaders reconnect dodged labels. */}
      {labels.map((label) => (
        <g key={label.domainId}>
          {Math.abs(label.y - label.lineY) > 5 ? (
            <line
              x1={label.lineX + 5}
              y1={label.lineY}
              x2={labelX - 3}
              y2={label.y}
              stroke="var(--stone-200)"
              strokeWidth={1}
            />
          ) : null}
          <circle cx={labelX} cy={label.y} r={2.5} fill={label.color} />
          <text
            x={labelX + 6}
            y={label.y + 3}
            style={{ font: "500 11px var(--font-mono)", fill: "var(--text-muted)" }}
          >
            {label.text}
          </text>
        </g>
      ))}
    </svg>
  );
}
