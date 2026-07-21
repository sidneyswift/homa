import { Pressable, Text, View } from "react-native";
import Svg, { Circle, G, Line, Text as SvgText } from "react-native-svg";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, palette, radius, space } from "../../theme/tokens";
import { progressSubjectHeadline } from "./view-copy";
import type { TrajectoryStory } from "./trajectory-story";

/**
 * The trajectory chart, ported from
 * apps/web/app/onboarding/r/[token]/trajectory-chart.tsx in its live
 * Progress "door mode": the legend card below the canvas IS the
 * subject-by-subject list, and every row opens that subject's detail
 * sheet. Mouse hover, line tapping, and the pinned meaning box are web
 * affordances; on a phone every reading has a door, so the sheet is the
 * closer look (same reduction the web door mode itself makes).
 *
 * Display laws carried over unchanged: below-age frontiers plot their
 * REAL negative months with no red and no "behind" wording; a capped
 * number displays "15+", a floor, not the measurement; only this week's
 * net increases are badged (anti-guilt law lives in trajectory-story);
 * cross-basis stretches draw dotted.
 */

const WIDTH = 640;
const PLOT_HEIGHT = 300;
const MARGIN = { top: 30, right: 16, bottom: 34, left: 66 } as const;
const HEIGHT = MARGIN.top + PLOT_HEIGHT + MARGIN.bottom;
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const DATE_TICK_COUNT = 6;
/** The at-age origin sits one week before the first check-in
 * (founder-ruled origin, 2026-07-08). */
const START_LEAD_MS = 7 * 24 * 60 * 60 * 1000;
/** Four weeks of open future, always, so the chart has room to grow. */
const FUTURE_WINDOW_MS = 28 * 24 * 60 * 60 * 1000;
/** Whole-month scores stack subjects onto identical values; each series
 * rides its own hairline lane so overlapping lines stay countable. */
const LANE_STEP_PX = 2;
const LANE_COUNT = 5;
const LABEL_H = 13;
const LABEL_CHAR_W = 6.9;

/**
 * One distinguishable token per subject. The web map leans on pop-*
 * accents the mobile sheet does not carry yet, so each subject takes
 * its nearest hand-copied token (sage, gold, clay, sky, stone), never
 * an invented color.
 */
const SUBJECT_COLORS: Record<string, string> = {
  math: palette.sky500,
  literacy: palette.stone600,
  phonics: palette.stone700,
  writing: palette.clay700,
  language: palette.clay600,
  science: palette.sage500,
  social_studies: palette.sage600,
  art: palette.clay500,
  music: palette.clay400,
  gross_motor: palette.gold500,
  fine_motor: palette.goldInk,
  social_emotional: palette.clay300,
  self_care: palette.sage300,
  executive_function: palette.stone400,
  computer_science: palette.stone500,
};
const FALLBACK_COLOR = palette.stone500;

function colorFor(subjectId: string): string {
  return SUBJECT_COLORS[subjectId] ?? FALLBACK_COLOR;
}

function dayLabel(t: number): string {
  return new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** A subject row for the legend card (web SubjectDoorRow). */
export interface TrajectorySubjectRow {
  subjectId: string;
  displayName: string;
  needsConfirm: boolean;
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

/** Spreads end labels vertically so none overlap (web dodgeLabels). */
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

export function TrajectoryChart({
  story,
  childName,
  now,
  doorRows,
  onOpenSubject,
}: {
  story: TrajectoryStory;
  childName: string;
  /** The render instant (epoch ms) for the today line and open future. */
  now: number;
  /** Every live subject, charted or not, so each keeps its door. */
  doorRows: TrajectorySubjectRow[];
  onOpenSubject: (subjectId: string) => void;
}) {
  if (story.subjects.length === 0) return null;

  const doorRowById = new Map(doorRows.map((row) => [row.subjectId, row]));
  const chartedIds = new Set(
    story.subjects.map((subject) => subject.subjectId),
  );
  /** Exposure subjects have live evidence but no plottable line; they
   * keep a legend row so every subject still has its door. */
  const unchartedRows = doorRows.filter(
    (row) => !chartedIds.has(row.subjectId),
  );

  const moverIds = new Set(story.movers.map((subject) => subject.subjectId));
  const strongestId = story.subjects[0]?.subjectId ?? null;
  const featured = (subjectId: string): boolean =>
    moverIds.has(subjectId) || subjectId === strongestId;

  const allTimes = story.subjects.flatMap((subject) =>
    subject.points.map((point) => point.t),
  );
  const tStart = Math.min(...allTimes) - START_LEAD_MS;
  const tMax = Math.max(...allTimes, now) + FUTURE_WINDOW_MS;

  const series = story.subjects.map((subject) => {
    const points: PlottedPoint[] = subject.points.map((point) => ({
      ...point,
    }));
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
  // headroom above the highest reading and real negative room below the
  // lowest (founder ruling 2026-07-13).
  const allMonths = series.flatMap(({ points }) =>
    points.map((p) => p.months),
  );
  const maxMonths = Math.max(0, ...allMonths);
  const minMonths = Math.min(0, ...allMonths);
  const yMax = Math.min(24, Math.max(12, Math.ceil((maxMonths + 2) / 6) * 6));
  const yMin =
    minMonths < 0 ? Math.max(-24, Math.floor((minMonths - 2) / 6) * 6) : -6;
  const yGrid: number[] = [];
  for (let months = yMin; months <= yMax; months += 6) yGrid.push(months);

  const x = (t: number): number =>
    MARGIN.left + ((t - tStart) / (tMax - tStart)) * PLOT_WIDTH;
  const y = (months: number): number =>
    MARGIN.top + ((yMax - months) / (yMax - yMin)) * PLOT_HEIGHT;
  const laneY = (months: number, seriesIndex: number): number =>
    y(months) +
    ((seriesIndex % LANE_COUNT) - Math.floor(LANE_COUNT / 2)) * LANE_STEP_PX;

  const dateTicks = Array.from(
    { length: DATE_TICK_COUNT },
    (_, index) => tStart + (index * (tMax - tStart)) / (DATE_TICK_COUNT - 1),
  );
  const todayX = Math.min(
    Math.max(x(now), MARGIN.left + 20),
    WIDTH - MARGIN.right - 20,
  );

  // End labels for the story only (movers plus the strongest line); the
  // legend card names the rest.
  const labelX =
    Math.max(...series.map(({ points }) => x(points[points.length - 1].t))) +
    12;
  const labelBudget = Math.max(
    4,
    Math.floor((WIDTH - MARGIN.right - labelX - 8) / LABEL_CHAR_W),
  );
  const labels = dodgeLabels(
    series
      .map(({ subject, points }, seriesIndex) => ({
        subject,
        points,
        seriesIndex,
      }))
      .filter(({ subject }) => featured(subject.subjectId))
      .map(({ subject, points, seriesIndex }) => {
        const last = points[points.length - 1];
        const value = ` ${subject.display}`;
        const room = labelBudget - value.length;
        const name =
          subject.name.length > room
            ? `${subject.name.slice(0, Math.max(1, room - 1))}…`
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

  return (
    <View>
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          borderRadius: radius.sm,
          backgroundColor: colors.card,
          padding: space.sm,
        }}
      >
        {/* The aspect-ratio wrapper sizes the canvas; the Svg then fills
            it and the viewBox scales the 640-wide drawing down. */}
        <View
          style={{ width: "100%", aspectRatio: WIDTH / HEIGHT }}
          accessibilityLabel={`${childName}'s months ahead by subject over time. Tap a subject below the chart to see the answers its line comes from.`}
        >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        >
          {/* Calendar gridlines, so the x-axis reads as a timeline. */}
          {dateTicks.map((t, index) => (
            <G key={`tick-${t}`}>
              <Line
                x1={x(t)}
                x2={x(t)}
                y1={MARGIN.top}
                y2={MARGIN.top + PLOT_HEIGHT}
                stroke={palette.stone100}
                strokeWidth={1}
              />
              <SvgText
                x={x(t)}
                y={MARGIN.top + PLOT_HEIGHT + 18}
                textAnchor="middle"
                fontFamily={fontFamilies.bodyMedium}
                fontSize={12}
                fill={colors.textSubtle}
              >
                {index === 0 ? "start" : dayLabel(t)}
              </SvgText>
            </G>
          ))}

          {yGrid.map((months) => (
            <G key={`grid-${months}`}>
              <Line
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={y(months)}
                y2={y(months)}
                stroke={months === 0 ? palette.stone300 : palette.stone100}
                strokeWidth={months === 0 ? 2 : 1}
              />
              <SvgText
                x={MARGIN.left - 8}
                y={y(months) + 3}
                textAnchor="end"
                fontFamily={fontFamilies.bodyMedium}
                fontSize={12}
                fill={colors.textSubtle}
              >
                {months === 0
                  ? "at age"
                  : `${months > 0 ? "+" : ""}${months}${months === yMax ? " mo" : ""}`}
              </SvgText>
            </G>
          ))}

          {/* Today, separating the recorded past from open future. */}
          <Line
            x1={todayX}
            x2={todayX}
            y1={MARGIN.top}
            y2={MARGIN.top + PLOT_HEIGHT}
            stroke={palette.stone300}
            strokeWidth={1}
            strokeDasharray="2 3"
          />
          <SvgText
            x={todayX}
            y={MARGIN.top - 8}
            textAnchor="middle"
            fontFamily={fontFamilies.bodyBold}
            fontSize={10}
            fill={colors.textSubtle}
          >
            today
          </SvgText>

          {/* Muted lines first, featured on top. Segment by segment so a
              cross-basis stretch draws dotted while the rest stays solid. */}
          {series
            .map((entry, seriesIndex) => ({ ...entry, seriesIndex }))
            .sort(
              (a, b) =>
                Number(featured(a.subject.subjectId)) -
                Number(featured(b.subject.subjectId)),
            )
            .map(({ subject, points, seriesIndex }) => (
              <G
                key={subject.subjectId}
                opacity={featured(subject.subjectId) ? 0.95 : 0.3}
              >
                {points.slice(1).map((point, index) => {
                  const from = points[index];
                  const crossesScales = from.basisKey !== point.basisKey;
                  return (
                    <Line
                      key={`${subject.subjectId}-seg-${point.t}`}
                      x1={x(from.t)}
                      y1={laneY(from.months, seriesIndex)}
                      x2={x(point.t)}
                      y2={laneY(point.months, seriesIndex)}
                      stroke={colorFor(subject.subjectId)}
                      strokeWidth={featured(subject.subjectId) ? 2.5 : 1.5}
                      strokeLinecap="round"
                      strokeDasharray={crossesScales ? "1 5" : undefined}
                    />
                  );
                })}
                {points.map((point, index) =>
                  point.origin ? null : (
                    <Circle
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
                      fill={
                        index === points.length - 1
                          ? colorFor(subject.subjectId)
                          : colors.card
                      }
                      stroke={
                        index === points.length - 1
                          ? colors.card
                          : colorFor(subject.subjectId)
                      }
                      strokeWidth={index === points.length - 1 ? 1.5 : 2}
                    />
                  ),
                )}
              </G>
            ))}

          {labels.map((label) => (
            <G key={`label-${label.subjectId}`}>
              {Math.abs(label.y - label.lineY) > 5 ? (
                <Line
                  x1={label.lineX + 5}
                  y1={label.lineY}
                  x2={labelX - 3}
                  y2={label.y}
                  stroke={palette.stone200}
                  strokeWidth={1}
                />
              ) : null}
              <Circle cx={labelX} cy={label.y} r={2.5} fill={label.color} />
              <SvgText
                x={labelX + 6}
                y={label.y + 3}
                fontFamily={fontFamilies.bodyMedium}
                fontSize={11}
                fill={colors.textMuted}
              >
                {label.text}
              </SvgText>
            </G>
          ))}
        </Svg>
        </View>
      </View>

      <Text
        style={{
          marginTop: 10,
          fontFamily: fontFamilies.body,
          fontSize: fontSize.sm,
          color: colors.textMuted,
        }}
      >
        Every number here comes from your answers. Tap a subject to see them.
      </Text>

      {/* The legend card: every subject, ranked strongest first, values
          visible at rest, movers badged. Each row opens the subject's
          detail sheet (web door mode). */}
      <View
        style={{
          marginTop: space.sm,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          borderRadius: radius.sm,
          backgroundColor: colors.card,
          padding: 6,
        }}
      >
        {story.subjects.map((subject) => {
          const doorRow = doorRowById.get(subject.subjectId);
          return (
            <Pressable
              key={subject.subjectId}
              accessibilityRole="button"
              accessibilityLabel={`${subject.name}, ${subject.display} months. Opens the answers this number comes from.`}
              onPress={() => onOpenSubject(subject.subjectId)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: space.sm,
                minHeight: 40,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: radius.xs,
                backgroundColor: pressed ? colors.page : "transparent",
              })}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: colorFor(subject.subjectId),
                }}
              />
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontFamily: fontFamilies.bodySemibold,
                  fontSize: fontSize.sm,
                  color: colors.textStrong,
                }}
              >
                {subject.name}
              </Text>
              {doorRow?.needsConfirm ? (
                <View
                  style={{
                    borderRadius: radius.pill,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    backgroundColor: palette.gold100,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fontFamilies.bodyBold,
                      fontSize: 10,
                      color: palette.goldInk,
                    }}
                  >
                    {progressSubjectHeadline("conflict")}
                  </Text>
                </View>
              ) : null}
              {subject.mover ? (
                <View
                  style={{
                    borderRadius: radius.pill,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    backgroundColor: colors.sageSoft,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fontFamilies.bodyBold,
                      fontSize: 10,
                      color: palette.sage600,
                    }}
                  >
                    +{subject.mover.to - subject.mover.from} this week
                  </Text>
                </View>
              ) : null}
              <Text
                style={{
                  fontFamily: fontFamilies.bodyMedium,
                  fontSize: fontSize.xs,
                  color: colors.textMuted,
                }}
              >
                {subject.display}
              </Text>
              <Text
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.sm,
                  color: colors.textSubtle,
                }}
              >
                {"›"}
              </Text>
            </Pressable>
          );
        })}
        {unchartedRows.map((row) => (
          <Pressable
            key={row.subjectId}
            accessibilityRole="button"
            accessibilityLabel={`${row.displayName}. Opens what you have shared.`}
            onPress={() => onOpenSubject(row.subjectId)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: space.sm,
              minHeight: 40,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: radius.xs,
              backgroundColor: pressed ? colors.page : "transparent",
            })}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                borderWidth: 2,
                borderColor: palette.stone300,
              }}
            />
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontFamily: fontFamilies.bodySemibold,
                fontSize: fontSize.sm,
                color: colors.textStrong,
              }}
            >
              {row.displayName}
            </Text>
            {row.needsConfirm ? (
              <View
                style={{
                  borderRadius: radius.pill,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  backgroundColor: palette.gold100,
                }}
              >
                <Text
                  style={{
                    fontFamily: fontFamilies.bodyBold,
                    fontSize: 10,
                    color: palette.goldInk,
                  }}
                >
                  {progressSubjectHeadline("conflict")}
                </Text>
              </View>
            ) : null}
            <Text
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.sm,
                color: colors.textSubtle,
              }}
            >
              {"›"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
