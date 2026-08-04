"use client";

import { useState, type PointerEvent as ReactPointerEvent } from "react";

import {
  useSubjectDoor,
  type SubjectDoorRow,
} from "../../../../components/progress/subject-door-context";
import { QuietAction } from "../../../../components/design/QuietAction";
import { progressSubjectHeadline } from "../../../../lib/child-progress/view-copy";
import { ageAboutLabel } from "../../../../lib/map/trajectory-format";
import type {
  TrajectoryStory,
  TrajectoryStorySubject,
} from "../../../../lib/map/trajectory-story";

/**
 * The interactive trajectory chart (2026-07-13 pass, from the
 * plans/2026-07-13-trajectory-chart-directions.html lab): focus mode on
 * one shared canvas plus a ranked legend card.
 *
 * Display conventions in force:
 * - At rest, only this week's movers (plus the strongest subject) carry
 *   end labels and full color; every other line waits quietly. The
 *   legend card below is the full subject list and the tap target
 *   (founder ask 2026-07-13: a card instead of fourteen dodged
 *   line-end names).
 * - Hovering (mouse) or tapping a line or a legend row focuses that
 *   subject: its line lights up, the rest fade, and a meaning sentence
 *   translates the number into the actual skill and the age it is
 *   typical.
 * - Inside a SubjectDoor provider (the live Progress page), the legend
 *   card IS the subject-by-subject list (founder ask 2026-07-13): rows
 *   and lines open the subject's detail panel instead of pinning a
 *   meaning box, rows carry the open-conflict chip, and subjects the
 *   chart cannot plot (exposure subjects) still get a door row.
 * - Below-age frontiers plot their REAL negative months (founder ruling
 *   2026-07-13, replacing the fixed "growing" slot). No red, no
 *   "behind" wording, ever; a capped number displays as "15+", a floor,
 *   not the measurement.
 * - Every subject starts on the at-age line one week before the first
 *   check-in (founder-ruled origin, 2026-07-08), and the axis keeps
 *   four weeks of open future. The re-check marker was removed
 *   (founder ask 2026-07-13).
 * - Where adjacent points were measured under different rules
 *   (basisKey), the connecting stretch draws dotted (mixed-scales
 *   fix 2); the snapshot card explains the dots.
 */

const WIDTH = 640;
const PLOT_HEIGHT = 300;
/** left fits "at age" and "-12" at the 12px axis font. */
const MARGIN = { top: 30, right: 16, bottom: 34, left: 66 } as const;
const HEIGHT = MARGIN.top + PLOT_HEIGHT + MARGIN.bottom;
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const DATE_TICK_COUNT = 6;
/** The at-age origin sits one week before the first check-in. */
const START_LEAD_MS = 7 * 24 * 60 * 60 * 1000;
/** Four weeks of open future, always, so the chart has room to grow. */
const FUTURE_WINDOW_MS = 28 * 24 * 60 * 60 * 1000;
/** Whole-month scores stack subjects onto identical values; each series
 * rides its own hairline lane so overlapping lines stay countable. */
const LANE_STEP_PX = 2;
const LANE_COUNT = 5;
const LABEL_H = 13;
const LABEL_CHAR_W = 6.9;

/** One distinguishable design-system color per subject (tokens only). */
const SUBJECT_COLORS: Record<string, string> = {
  math: "var(--homa-midnight-action)",
  literacy: "var(--homa-info-ink)",
  phonics: "var(--homa-contained-band)",
  writing: "var(--homa-brand-text)",
  language: "var(--homa-constructive-ink)",
  science: "var(--homa-highlight-ink)",
  social_studies: "color-mix(in srgb, var(--homa-info-ink) 72%, var(--homa-ink))",
  art: "var(--homa-visual-coral)",
  music: "color-mix(in srgb, var(--homa-brand-text) 62%, var(--homa-ink))",
  gross_motor: "color-mix(in srgb, var(--homa-highlight-ink) 72%, var(--homa-ink))",
  fine_motor: "color-mix(in srgb, var(--homa-constructive-ink) 72%, var(--homa-ink))",
  social_emotional: "color-mix(in srgb, var(--homa-visual-coral) 72%, var(--homa-ink))",
  self_care: "color-mix(in srgb, var(--homa-info-ink) 52%, var(--homa-ink))",
  executive_function: "var(--homa-ink)",
  computer_science: "var(--homa-muted-ink)",
};
const FALLBACK_COLOR = "var(--homa-muted-ink)";

function colorFor(subjectId: string): string {
  return SUBJECT_COLORS[subjectId] ?? FALLBACK_COLOR;
}

function dayLabel(t: number): string {
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface PlottedPoint {
  t: number;
  months: number;
  basisKey: string;
  origin?: boolean;
}

interface EndLabel {
  subjectId: string;
  color: string;
  text: string;
  lineX: number;
  lineY: number;
  y: number;
}

/** Spreads end labels vertically so none overlap. */
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

/** The meaning box: the focused subject's number translated into the
 * skill behind it and the age that skill is typical. */
function MeaningBox({
  subject,
  childName,
  childAgeYears,
}: {
  subject: TrajectoryStorySubject;
  childName: string;
  childAgeYears: number;
}) {
  const belowAge = subject.latestMonths < 0;
  const statement = belowAge
    ? subject.strongestStatement ?? subject.frontierStatement
    : subject.strongestStatement;
  return (
    <div className="quiet-trajectory__meaning mt-2">
      <p className="quiet-trajectory__meaning-title">
        {subject.name} {subject.display} mo
        <span className="quiet-trajectory__meaning-meta">
          from {subject.observations}{" "}
          {subject.observations === 1 ? "answer" : "answers"}
        </span>
      </p>
      {statement ? (
        <p className="quiet-trajectory__meaning-copy mt-0.5">
          {belowAge ? "Working on: " : ""}
          {statement}
          {subject.strongestMonths !== null ? (
            <span className="quiet-trajectory__meaning-muted">
              {" \u00b7 "}typical around age {ageAboutLabel(subject.strongestMonths)}
              {" \u00b7 "}{childName} is {childAgeYears}
            </span>
          ) : null}
        </p>
      ) : null}
      {subject.beyondScale ? (
        <p className="quiet-trajectory__cap mt-1.5 inline-block">
          The checklist stops here, not {childName}
        </p>
      ) : null}
    </div>
  );
}

export function TrajectoryChart({
  story,
  childName,
  childAgeYears,
  now,
  doorRows = [],
}: {
  story: TrajectoryStory;
  childName: string;
  childAgeYears: number;
  /** The render instant (epoch ms), passed from the server so this
   * component stays pure and server and client draw the same axis. */
  now: number;
  /** The live view's subject rows (door mode only): conflict chips for
   * charted subjects, plus door rows for subjects the chart cannot
   * plot. Ignored outside a SubjectDoor provider. */
  doorRows?: SubjectDoorRow[];
}) {
  const door = useSubjectDoor();
  /** Pinned by tap/click; toggles off on a second tap. */
  const [pinned, setPinned] = useState<string | null>(null);
  /** Follows the mouse only (touch never hovers). */
  const [hovered, setHovered] = useState<string | null>(null);
  const focus = hovered ?? pinned;

  if (story.subjects.length === 0) return null;

  const doorRowById = new Map(doorRows.map((row) => [row.subjectId, row]));
  const chartedIds = new Set(story.subjects.map((subject) => subject.subjectId));
  /** Subjects with live evidence but no plottable line (exposure
   * subjects): in door mode they keep a row, so every subject still
   * has its door. */
  const unchartedRows = door
    ? doorRows.filter((row) => !chartedIds.has(row.subjectId))
    : [];

  const moverIds = new Set(story.movers.map((subject) => subject.subjectId));
  const strongestId = story.subjects[0]?.subjectId ?? null;

  const allTimes = story.subjects.flatMap((subject) =>
    subject.points.map((point) => point.t),
  );
  const tStart = Math.min(...allTimes) - START_LEAD_MS;
  const tMax = Math.max(...allTimes, now) + FUTURE_WINDOW_MS;

  const series = story.subjects.map((subject) => {
    const points: PlottedPoint[] = subject.points.map((point) => ({ ...point }));
    // The synthetic at-age anchor shares the first real point's basis,
    // so the week-one segment always draws solid.
    points.unshift({
      t: tStart,
      months: 0,
      basisKey: points[0].basisKey,
      origin: true,
    });
    return { subject, points };
  });

  // The y-axis fits the child, snapped to 6-month bands both ways:
  // headroom above the highest reading (never past the +24 cap), and
  // real negative room below the lowest (founder ruling 2026-07-13).
  const allMonths = series.flatMap(({ points }) => points.map((p) => p.months));
  const maxMonths = Math.max(0, ...allMonths);
  const minMonths = Math.min(0, ...allMonths);
  const yMax = Math.min(24, Math.max(12, Math.ceil((maxMonths + 2) / 6) * 6));
  const yMin = minMonths < 0 ? Math.max(-24, Math.floor((minMonths - 2) / 6) * 6) : -6;
  const yGrid: number[] = [];
  for (let months = yMin; months <= yMax; months += 6) yGrid.push(months);

  const x = (t: number): number => MARGIN.left + ((t - tStart) / (tMax - tStart)) * PLOT_WIDTH;
  const y = (months: number): number =>
    MARGIN.top + ((yMax - months) / (yMax - yMin)) * PLOT_HEIGHT;
  const laneY = (months: number, seriesIndex: number): number =>
    y(months) + ((seriesIndex % LANE_COUNT) - Math.floor(LANE_COUNT / 2)) * LANE_STEP_PX;

  const dateTicks = Array.from(
    { length: DATE_TICK_COUNT },
    (_, index) => tStart + (index * (tMax - tStart)) / (DATE_TICK_COUNT - 1),
  );
  const todayX = Math.min(Math.max(x(now), MARGIN.left + 20), WIDTH - MARGIN.right - 20);

  const featured = (subjectId: string): boolean =>
    focus ? subjectId === focus : moverIds.has(subjectId) || subjectId === strongestId;
  const lineOpacity = (subjectId: string): number => {
    if (focus) return subjectId === focus ? 0.95 : 0.12;
    return featured(subjectId) ? 0.95 : 0.3;
  };

  // End labels: at rest the movers plus the strongest line; in focus,
  // only the focused subject. The legend card carries everything else.
  const labeledIds = focus
    ? [focus]
    : story.subjects
        .filter((subject) => featured(subject.subjectId))
        .map((subject) => subject.subjectId);
  const labelX = Math.max(...series.map(({ points }) => x(points[points.length - 1].t))) + 12;
  const labelBudget = Math.max(4, Math.floor((WIDTH - MARGIN.right - labelX - 8) / LABEL_CHAR_W));
  const labels = dodgeLabels(
    series
      .map(({ subject, points }, seriesIndex) => ({ subject, points, seriesIndex }))
      .filter(({ subject }) => labeledIds.includes(subject.subjectId))
      .map(({ subject, points, seriesIndex }) => {
        const last = points[points.length - 1];
        const value = ` ${subject.display}`;
        const room = labelBudget - value.length;
        const name =
          subject.name.length > room
            ? `${subject.name.slice(0, Math.max(1, room - 1))}\u2026`
            : subject.name;
        return {
          subjectId: subject.subjectId,
          color: colorFor(subject.subjectId),
          text: `${name}${value}`,
          lineX: x(last.t),
          lineY: laneY(last.months, seriesIndex),
          y: laneY(last.months, seriesIndex),
        };
      }),
  );

  /** Door mode opens the subject's detail panel; otherwise a tap pins
   * the line and its meaning box. A charted subject the live view does
   * not know (no door row) keeps the pin even in door mode, so no tap
   * ever dead-ends. */
  const activate = (subjectId: string): void => {
    if (door && doorRowById.has(subjectId)) {
      door.openSubject(subjectId);
      return;
    }
    setPinned((current) => (current === subjectId ? null : subjectId));
  };
  const hoverIn = (subjectId: string) => (event: ReactPointerEvent): void => {
    if (event.pointerType === "mouse") setHovered(subjectId);
  };
  const hoverOut = (event: ReactPointerEvent): void => {
    if (event.pointerType === "mouse") setHovered(null);
  };

  // The meaning box opens on a pin (tap or click) only: hover changes
  // line emphasis without moving layout, so a mouse resting on a legend
  // row never fights the box appearing above it.
  const pinnedSubject = pinned
    ? story.subjects.find((subject) => subject.subjectId === pinned) ?? null
    : null;

  return (
    <div>
      <div className="quiet-trajectory__chart-frame">
        <svg
          className="quiet-trajectory__chart"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`${childName}'s months ahead by subject over time. Tap a subject below the chart to focus its line.`}
          style={{ width: "100%", height: "auto", display: "block" }}
          onPointerLeave={hoverOut}
          onClick={() => setPinned(null)}
        >
          {/* Calendar gridlines, so the x-axis reads as a timeline. */}
          {dateTicks.map((t, index) => (
            <g key={t}>
              <line
                x1={x(t)}
                x2={x(t)}
                y1={MARGIN.top}
                y2={MARGIN.top + PLOT_HEIGHT}
                stroke="var(--homa-soft-boundary)"
                strokeWidth={1}
              />
              <text
                className="quiet-trajectory__axis-label"
                x={x(t)}
                y={MARGIN.top + PLOT_HEIGHT + 18}
                textAnchor="middle"
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
                stroke={months === 0 ? "var(--homa-control-boundary)" : "var(--homa-soft-boundary)"}
                strokeWidth={months === 0 ? 2 : 1}
              />
              <text
                className="quiet-trajectory__axis-label"
                x={MARGIN.left - 8}
                y={y(months) + 3}
                textAnchor="end"
              >
                {months === 0
                  ? "at age"
                  : `${months > 0 ? "+" : ""}${months}${months === yMax ? " mo" : ""}`}
              </text>
            </g>
          ))}

          {/* Today, so the eye separates the recorded past from open future. */}
          <line
            x1={todayX}
            x2={todayX}
            y1={MARGIN.top}
            y2={MARGIN.top + PLOT_HEIGHT}
            stroke="var(--homa-control-boundary)"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
          <text
            className="quiet-trajectory__today-label"
            x={todayX}
            y={MARGIN.top - 8}
            textAnchor="middle"
          >
            today
          </text>

          {/* Muted lines first, featured on top. Segment by segment so a
              cross-basis stretch draws dotted while the rest stays solid. */}
          {series
            .map((entry, seriesIndex) => ({ ...entry, seriesIndex }))
            .sort(
              (a, b) =>
                Number(featured(a.subject.subjectId)) - Number(featured(b.subject.subjectId)),
            )
            .map(({ subject, points, seriesIndex }) => (
              <g
                key={subject.subjectId}
                opacity={lineOpacity(subject.subjectId)}
                className="cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();
                  activate(subject.subjectId);
                }}
                onPointerEnter={hoverIn(subject.subjectId)}
              >
                <title>{`${subject.name} ${subject.display} months`}</title>
                {points.slice(1).map((point, index) => {
                  const from = points[index];
                  const crossesScales = from.basisKey !== point.basisKey;
                  return (
                    <line
                      key={`${subject.subjectId}-seg-${point.t}`}
                      x1={x(from.t).toFixed(1)}
                      y1={laneY(from.months, seriesIndex).toFixed(1)}
                      x2={x(point.t).toFixed(1)}
                      y2={laneY(point.months, seriesIndex).toFixed(1)}
                      stroke={colorFor(subject.subjectId)}
                      strokeWidth={featured(subject.subjectId) ? 2.5 : 1.5}
                      strokeLinecap="round"
                      strokeDasharray={crossesScales ? "1 5" : undefined}
                    />
                  );
                })}
                {/* An invisible fat line keeps the tap target honest. */}
                <polyline
                  points={points
                    .map(
                      (point) =>
                        `${x(point.t).toFixed(1)},${laneY(point.months, seriesIndex).toFixed(1)}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                />
                {points.map((point, index) =>
                  point.origin ? null : (
                    <circle
                      key={`${subject.subjectId}-${point.t}`}
                      cx={x(point.t)}
                      cy={laneY(point.months, seriesIndex)}
                      r={
                        index === points.length - 1
                          ? featured(subject.subjectId)
                            ? 4.5
                            : 3.5
                          : featured(subject.subjectId)
                            ? 3.5
                            : 2.5
                      }
                      fill={index === points.length - 1 ? colorFor(subject.subjectId) : "#fff"}
                      stroke={index === points.length - 1 ? "#fff" : colorFor(subject.subjectId)}
                      strokeWidth={index === points.length - 1 ? 1.5 : 2}
                    />
                  ),
                )}
              </g>
            ))}

          {/* End labels for the story only; the legend card names the rest. */}
          {labels.map((label) => (
            <g key={label.subjectId}>
              {Math.abs(label.y - label.lineY) > 5 ? (
                <line
                  x1={label.lineX + 5}
                  y1={label.lineY}
                  x2={labelX - 3}
                  y2={label.y}
                  stroke="var(--homa-soft-boundary)"
                  strokeWidth={1}
                />
              ) : null}
              <circle cx={labelX} cy={label.y} r={2.5} fill={label.color} />
              <text
                className="quiet-trajectory__end-label"
                x={labelX + 6}
                y={label.y + 3}
              >
                {label.text}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {pinnedSubject ? (
        <MeaningBox
          subject={pinnedSubject}
          childName={childName}
          childAgeYears={childAgeYears}
        />
      ) : null}

      {/* The legend card: every subject, ranked strongest first, values
          visible at rest, movers badged. Rows are the focus controls; in
          door mode they are the subject-by-subject list and each row
          opens that subject's detail panel. */}
      {door ? (
        <p className="quiet-trajectory__hint mt-2.5">
          Every number here comes from your answers. Tap a subject to see them.
        </p>
      ) : null}
      <div className="quiet-trajectory__legend mt-2">
        {story.subjects.map((subject) => {
          const doorRow = doorRowById.get(subject.subjectId);
          const isPinned = pinned === subject.subjectId;
          const opensPanel = Boolean(door && doorRow);
          return (
            <QuietAction
              key={subject.subjectId}
              kind="quiet"
              type="button"
              aria-pressed={opensPanel ? undefined : isPinned}
              aria-haspopup={opensPanel ? "dialog" : undefined}
              aria-expanded={
                opensPanel
                  ? door?.openSubjectId === subject.subjectId
                  : undefined
              }
              onClick={() => activate(subject.subjectId)}
              onPointerEnter={hoverIn(subject.subjectId)}
              onPointerLeave={hoverOut}
              className={`quiet-trajectory__legend-row ${isPinned ? "quiet-trajectory__legend-row--selected" : ""}`.trim()}
            >
              <>
                <span
                  aria-hidden="true"
                  className="quiet-trajectory__swatch"
                  style={{ background: colorFor(subject.subjectId) }}
                />
                <span className="quiet-trajectory__subject-name">{subject.name}</span>
                {doorRow?.needsConfirm ? (
                  <span className="quiet-trajectory__badge quiet-trajectory__badge--attention">
                    {progressSubjectHeadline("conflict")}
                  </span>
                ) : null}
                {subject.mover ? (
                  <span className="quiet-trajectory__badge quiet-trajectory__badge--constructive">
                    +{subject.mover.to - subject.mover.from} this week
                  </span>
                ) : null}
                <span className="quiet-trajectory__value">{subject.display}</span>
                {opensPanel ? <span aria-hidden="true" className="quiet-trajectory__chevron">{"\u203A"}</span> : null}
              </>
            </QuietAction>
          );
        })}
        {unchartedRows.map((row) => (
          <QuietAction
            key={row.subjectId}
            kind="quiet"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={door?.openSubjectId === row.subjectId}
            onClick={() => door?.openSubject(row.subjectId)}
            className="quiet-trajectory__legend-row"
          >
            <>
              <span aria-hidden="true" className="quiet-trajectory__swatch quiet-trajectory__swatch--empty" />
              <span className="quiet-trajectory__subject-name">{row.displayName}</span>
              {row.needsConfirm ? (
                <span className="quiet-trajectory__badge quiet-trajectory__badge--attention">
                  {progressSubjectHeadline("conflict")}
                </span>
              ) : null}
              <span aria-hidden="true" className="quiet-trajectory__chevron">{"\u203A"}</span>
            </>
          </QuietAction>
        ))}
      </div>
    </div>
  );
}
