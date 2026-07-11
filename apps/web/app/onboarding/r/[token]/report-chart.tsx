import { getMapSubject, type SubjectScore } from "@homa/core";

/**
 * The whole-picture chart: one dot per subject on a months-ahead axis,
 * server-rendered SVG (no client JS). Anti-guilt display law applies:
 * growing subjects sit in sky just left of the at-age line with the word
 * "growing", never a negative number, never red. When prior scores exist,
 * subjects that moved UP show a faded ring at the old spot with a
 * connector, the before/after made visible; drops draw nothing.
 *
 * Two layouts (founder ask 2026-07-08: the chart must be readable on a
 * phone without pinching):
 * - "stacked" (default, the report page): a ~400-unit viewBox with each
 *   subject's name on its own line above its dot track, so type renders
 *   at near-native size on a phone.
 * - "wide" (the print one-pager): the original dense left-label layout,
 *   which fits a letter page.
 */

const AXIS_MIN = -6;
const AXIS_MAX = 26;

const COLORS = {
  gold: "var(--gold-400)",
  sage: "var(--sage-300)",
  sky: "var(--sky-500)",
} as const;

const POSITION_RANK: Record<SubjectScore["position"], number> = {
  not_mapped: 0,
  growing: 1,
  on_track: 2,
  ahead: 3,
};

function dotMonths(score: SubjectScore): number {
  return score.position === "growing" ? -3 : Math.min(score.monthsAhead ?? 0, 24);
}

/** The prior dot's months, only when the subject genuinely moved up. */
function priorMonths(score: SubjectScore, prior: SubjectScore[] | null): number | null {
  if (!prior) return null;
  const previous = prior.find((entry) => entry.subjectId === score.subjectId);
  if (!previous || previous.position === "not_mapped") return null;
  const monthsImproved =
    score.monthsAhead !== null &&
    previous.monthsAhead !== null &&
    score.monthsAhead > previous.monthsAhead;
  const positionImproved = POSITION_RANK[score.position] > POSITION_RANK[previous.position];
  if (!monthsImproved && !positionImproved) return null;
  return dotMonths(previous);
}

function rowColor(score: SubjectScore): string {
  if (score.position === "growing") return COLORS.sky;
  return (score.monthsAhead ?? 0) >= 6 ? COLORS.gold : COLORS.sage;
}

function rowLabel(score: SubjectScore): string {
  if (score.position === "growing") return "growing";
  const months = score.monthsAhead ?? 0;
  return months > 0 ? `+${months} mo` : "at age";
}

/** Phone-first layout: subject name above its own track, full-width plot. */
function StackedChart({ rows, prior }: { rows: SubjectScore[]; prior: SubjectScore[] | null }) {
  const WIDTH = 400;
  const PAD_L = 10;
  const PAD_R = 10;
  const HEADER = 26;
  const ROW_H = 48;
  const height = HEADER + rows.length * ROW_H + 6;

  const x = (months: number): number =>
    PAD_L + ((months - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * (WIDTH - PAD_L - PAD_R);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      role="img"
      aria-label="Months ahead of age, one dot per subject"
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      {[0, 6, 12, 18, 24].map((months) => (
        <g key={months}>
          <line
            x1={x(months)}
            x2={x(months)}
            y1={HEADER - 6}
            y2={height - 6}
            stroke={months === 0 ? "var(--stone-300)" : "var(--stone-100)"}
            strokeWidth={months === 0 ? 2 : 1}
          />
          <text
            x={x(months)}
            y={12}
            textAnchor="middle"
            style={{ font: "500 11px var(--font-mono)", fill: "var(--text-subtle)" }}
          >
            {months === 0 ? "at age" : `+${months}${months === 24 ? " mo" : ""}`}
          </text>
        </g>
      ))}

      {rows.map((score, index) => {
        const top = HEADER + index * ROW_H;
        const labelY = top + 14;
        const cy = top + 33;
        const domain = getMapSubject(score.subjectId);
        const dotX = x(dotMonths(score));
        const color = rowColor(score);
        const label = rowLabel(score);
        const priorM = priorMonths(score, prior);
        const priorX = priorM === null ? null : x(priorM);
        // The value label flips to the left side when the dot is near the
        // right edge, so "+24 mo" never runs off the canvas.
        const flip = dotX > WIDTH - 64;
        return (
          <g key={score.subjectId}>
            <text
              x={PAD_L}
              y={labelY}
              style={{
                font: "600 13px var(--font-sans)",
                fill: "var(--text-body)",
                paintOrder: "stroke",
                stroke: "var(--surface-card, #fff)",
                strokeWidth: 4,
                strokeLinejoin: "round",
              }}
            >
              {domain?.displayName ?? score.subjectId}
            </text>
            {priorX !== null ? (
              <>
                <line
                  x1={priorX}
                  x2={dotX}
                  y1={cy}
                  y2={cy}
                  stroke="var(--stone-300)"
                  strokeWidth={2}
                  strokeDasharray="1.5 3"
                />
                <circle cx={priorX} cy={cy} r={5.5} fill="none" stroke="var(--stone-300)" strokeWidth={2} />
              </>
            ) : null}
            <circle
              cx={dotX}
              cy={cy}
              r={8}
              fill={color}
              stroke="#fff"
              strokeWidth={2.5}
              style={{ filter: "drop-shadow(0 0 1px rgba(78,70,62,.35))" }}
            />
            <text
              x={flip ? dotX - 15 : dotX + 15}
              y={cy + 4}
              textAnchor={flip ? "end" : "start"}
              style={{
                font: "500 11px var(--font-mono)",
                fill: "var(--text-muted)",
                paintOrder: "stroke",
                stroke: "var(--surface-card, #fff)",
                strokeWidth: 4,
                strokeLinejoin: "round",
              }}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** The original dense layout: labels in a left column (print one-pager). */
function WideChart({ rows, prior }: { rows: SubjectScore[]; prior: SubjectScore[] | null }) {
  const ROW_H = 34;
  const LABEL_W = 150;
  const VALUE_W = 64;
  const WIDTH = 640;
  const height = rows.length * ROW_H + 40;

  const x = (months: number): number =>
    LABEL_W + ((months - AXIS_MIN) / (AXIS_MAX - AXIS_MIN)) * (WIDTH - LABEL_W - VALUE_W);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      role="img"
      aria-label="Months ahead of age, one dot per subject"
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
        const domain = getMapSubject(score.subjectId);
        const dotX = x(dotMonths(score));
        const priorM = priorMonths(score, prior);
        const priorX = priorM === null ? null : x(priorM);
        return (
          <g key={score.subjectId}>
            <text
              x={LABEL_W - 10}
              y={cy + 4}
              textAnchor="end"
              style={{ font: "600 12px var(--font-sans)", fill: "var(--text-body)" }}
            >
              {domain?.displayName ?? score.subjectId}
            </text>
            {priorX !== null ? (
              <>
                <line
                  x1={priorX}
                  x2={dotX}
                  y1={cy}
                  y2={cy}
                  stroke="var(--stone-300)"
                  strokeWidth={2}
                  strokeDasharray="1.5 3"
                />
                <circle cx={priorX} cy={cy} r={5} fill="none" stroke="var(--stone-300)" strokeWidth={2} />
              </>
            ) : null}
            <circle
              cx={dotX}
              cy={cy}
              r={7}
              fill={rowColor(score)}
              stroke="#fff"
              strokeWidth={2.5}
              style={{ filter: "drop-shadow(0 0 1px rgba(78,70,62,.35))" }}
            />
            <text
              x={dotX + 14}
              y={cy + 4}
              style={{ font: "500 10px var(--font-mono)", fill: "var(--text-subtle)" }}
            >
              {rowLabel(score)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function ReportChart({
  scores,
  prior = null,
  variant = "stacked",
}: {
  scores: SubjectScore[];
  prior?: SubjectScore[] | null;
  /** "stacked" is the phone-first report layout; "wide" the print one. */
  variant?: "stacked" | "wide";
}) {
  const rows = scores.filter((score) => score.position !== "not_mapped" && !score.exposureBased);
  if (variant === "wide") return <WideChart rows={rows} prior={prior} />;
  return <StackedChart rows={rows} prior={prior} />;
}
