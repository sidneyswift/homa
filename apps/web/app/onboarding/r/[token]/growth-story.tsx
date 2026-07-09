import { getMapDomain, type MapScores, type ReportNarrative } from "@homa/core";

/**
 * The growth story: the report's archive, finally read. Every rescore
 * archives its numbers AND the letter that shipped with them; this
 * section walks the whole arc as chapters (oldest first), quoting each
 * era's note as period voice, with per-chapter movement computed
 * pairwise and positive-only (the anti-guilt law: drops never render as
 * arrows; holding steady is a normal chapter, not a missing one).
 * Rising subjects additionally get their own dated curve, the pediatric
 * growth-chart grammar: the child against her own past, never against
 * another child.
 */

export interface GrowthEra {
  generated_at: string;
  scores: MapScores;
  narrative?: ReportNarrative | null;
}

const POSITION_RANK: Record<string, number> = {
  not_mapped: 0,
  growing: 1,
  on_track: 2,
  ahead: 3,
};

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function movementBetween(prev: MapScores, next: MapScores): string[] {
  const lines: string[] = [];
  for (const current of next.domains) {
    if (current.exposureBased) continue;
    const previous = prev.domains.find((entry) => entry.domainId === current.domainId);
    if (!previous) continue;
    const name = getMapDomain(current.domainId)?.displayName ?? current.domainId;
    if (
      current.monthsAhead !== null &&
      previous.monthsAhead !== null &&
      current.monthsAhead > previous.monthsAhead
    ) {
      lines.push(`${name} +${current.monthsAhead - previous.monthsAhead} mo`);
    } else if ((POSITION_RANK[current.position] ?? 0) > (POSITION_RANK[previous.position] ?? 0)) {
      lines.push(`${name} moved up`);
    }
  }
  return lines;
}

interface Sparkline {
  subjectName: string;
  points: Array<{ date: string; monthsAhead: number }>;
}

/** Rising curves only: a subject qualifies when it has 2+ dated
 * months-ahead readings and never dips (dips stay in the quiet re-check
 * lane by law; the curve lane is for watching numbers climb). */
function risingSparklines(eras: GrowthEra[]): Sparkline[] {
  const bySubject = new Map<string, Array<{ date: string; monthsAhead: number }>>();
  for (const era of eras) {
    for (const score of era.scores.domains) {
      if (score.exposureBased || score.monthsAhead === null) continue;
      const list = bySubject.get(score.domainId) ?? [];
      list.push({ date: era.generated_at, monthsAhead: score.monthsAhead });
      bySubject.set(score.domainId, list);
    }
  }
  const lines: Sparkline[] = [];
  for (const [domainId, points] of bySubject) {
    if (points.length < 2) continue;
    const rising = points.every(
      (point, index) => index === 0 || point.monthsAhead >= points[index - 1].monthsAhead,
    );
    const grew = points[points.length - 1].monthsAhead > points[0].monthsAhead;
    if (!rising || !grew) continue;
    lines.push({
      subjectName: getMapDomain(domainId)?.displayName ?? domainId,
      points,
    });
  }
  return lines
    .sort(
      (a, b) =>
        b.points[b.points.length - 1].monthsAhead -
        b.points[0].monthsAhead -
        (a.points[a.points.length - 1].monthsAhead - a.points[0].monthsAhead),
    )
    .slice(0, 3);
}

function SparklineSvg({ line }: { line: Sparkline }) {
  const values = line.points.map((point) => point.monthsAhead);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 132;
  const height = 40;
  const x = (index: number) =>
    line.points.length === 1 ? width / 2 : 8 + (index * (width - 16)) / (line.points.length - 1);
  const y = (value: number) =>
    max === min ? height / 2 : height - 8 - ((value - min) * (height - 16)) / (max - min);
  const path = line.points.map((point, index) => `${x(index)},${y(point.monthsAhead)}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`${line.subjectName}: ${values[0]} to ${values[values.length - 1]} months ahead across ${line.points.length} check-ins`}
    >
      <polyline
        points={path}
        fill="none"
        stroke="var(--sage-500, #3D9A50)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {line.points.map((point, index) => (
        <circle
          key={point.date + String(index)}
          cx={x(index)}
          cy={y(point.monthsAhead)}
          r={index === line.points.length - 1 ? 3.5 : 2.5}
          fill={index === line.points.length - 1 ? "var(--clay-600, #E7602F)" : "var(--sage-500, #3D9A50)"}
        />
      ))}
    </svg>
  );
}

export function GrowthStory({
  childName,
  eras,
}: {
  childName: string;
  /** Oldest first, the live report last. */
  eras: GrowthEra[];
}) {
  if (eras.length < 2) return null;
  const sparklines = risingSparklines(eras);

  return (
    <>
      <h2 className="mt-9 font-display text-xl font-semibold text-strong">
        {childName}&apos;s story so far
      </h2>
      <p className="mt-1 text-sm text-muted">
        Every re-check adds a chapter.
      </p>

      <ol className="mt-4 flex flex-col gap-2.5">
        {eras.map((era, index) => {
          const movement = index > 0 ? movementBetween(eras[index - 1].scores, era.scores) : [];
          const excerpt = era.narrative?.note ?? null;
          const isLatest = index === eras.length - 1;
          return (
            <li
              key={era.generated_at}
              className="rounded-md border border-border-subtle bg-card p-4"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-xs font-bold text-strong">
                  {dateLabel(era.generated_at)}
                </span>
                <span className="font-mono text-[0.65rem] text-subtle">
                  {era.scores.mappedCount} of {era.scores.totalDomains} subjects mapped {"\u00b7"}{" "}
                  {era.scores.observationCount} answers
                </span>
                {isLatest ? (
                  <span
                    className="rounded-pill px-2 py-0.5 font-mono text-[0.6rem] font-bold"
                    style={{ background: "var(--gold-100)", color: "var(--gold-ink)" }}
                  >
                    today
                  </span>
                ) : null}
              </div>
              {movement.length > 0 ? (
                <p className="mt-1 text-xs font-semibold" style={{ color: "var(--sage-700)" }}>
                  {"\u2191"} {movement.join(" \u00b7 ")}
                </p>
              ) : index > 0 ? (
                <p className="mt-1 text-xs text-muted">
                  Holding steady, which is a normal chapter too.
                </p>
              ) : null}
              {/* Past chapters quote their era's note as period voice; the
                  live chapter's note is already on screen two sections up,
                  and quoting it again reads as the page repeating itself
                  (ICP read-along, 2026-07-08). */}
              {excerpt && !isLatest ? (
                <p className="mt-2 font-serif text-sm italic leading-relaxed text-body">
                  &ldquo;{excerpt.length > 220 ? `${excerpt.slice(0, 220).trimEnd()}\u2026` : excerpt}&rdquo;
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {sparklines.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {sparklines.map((line) => (
            <div key={line.subjectName} className="rounded-md border border-border-subtle bg-card p-3">
              <p className="text-xs font-semibold text-strong">{line.subjectName}</p>
              <SparklineSvg line={line} />
              <p className="font-mono text-[0.6rem] text-subtle">
                +{line.points[0].monthsAhead} mo {"\u2192"} +
                {line.points[line.points.length - 1].monthsAhead} mo, their own curve
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
