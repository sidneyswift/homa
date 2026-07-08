import { ageLabel, getMapDomain, type DomainScore, type MapScores } from "@homa/core";

import type { GrowthEra } from "./growth-story";
import { ReportTrajectory } from "./report-trajectory";

/**
 * The snapshot: the report's TLDR, ported from the founder dashboard's
 * daily Slack post (homa-macmini post_dashboard_slack.py) into product
 * law. Strengths lead with their numbers; the bottom of the ranking
 * renders in the growth lane ("Growing right now", sky, no numbers) or,
 * when nothing is growing, as "Closest to age" with honest at-age
 * labels, never "lowest standing", never a warning glyph. The next
 * re-check date shows only when a plan's four-week clock is armed, and
 * the trajectory chart appears once a second check-in exists. Pure
 * display over already-computed scores; nothing here writes.
 */

const TLDR_ROWS = 3;

function orderedRealScores(scores: MapScores): DomainScore[] {
  const byId = new Map(scores.domains.map((score) => [score.domainId, score]));
  return scores.strengthOrder
    .map((id) => byId.get(id))
    .filter((score): score is DomainScore => Boolean(score) && !score!.exposureBased);
}

export function ReportSnapshot({
  childName,
  generatedDate,
  ageMonths,
  scores,
  plans,
  eras,
}: {
  childName: string;
  /** Already formatted, e.g. "July 8, 2026" (matches the header band). */
  generatedDate: string;
  ageMonths: number;
  scores: MapScores;
  plans: { domainId: string; done: number; total: number; retestAt: string }[];
  /** Oldest first, the live report last (report-view's eras). */
  eras: GrowthEra[];
}) {
  const ordered = orderedRealScores(scores);
  const strengthRows = ordered.filter((score) => score.position === "ahead").slice(0, TLDR_ROWS);
  const growingRows = ordered.filter((score) => score.position === "growing").slice(0, TLDR_ROWS);

  // Only when nothing is growing: the subjects nearest the at-age line,
  // with their honest labels. Skips anything already shown as a strength
  // (a three-subject map should not list the same subject twice).
  const strengthIds = new Set(strengthRows.map((score) => score.domainId));
  const closestRows =
    growingRows.length > 0
      ? []
      : ordered
          .filter((score) => score.monthsAhead !== null && !strengthIds.has(score.domainId))
          .sort((a, b) => (a.monthsAhead ?? 0) - (b.monthsAhead ?? 0))
          .slice(0, TLDR_ROWS);

  const now = new Date().getTime();
  const nextRecheck = plans
    .map((plan) => new Date(plan.retestAt))
    .filter((date) => date.getTime() > now)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const name = (score: DomainScore): string =>
    getMapDomain(score.domainId)?.displayName ?? score.domainId;

  return (
    <div className="mt-4 rounded-lg bg-[var(--surface-sunken)] p-5">
      <p className="font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
        {childName}&apos;s snapshot {"\u00b7"} {generatedDate}
      </p>
      <p className="mt-1 font-mono text-xs text-muted">
        age {ageLabel(ageMonths)} {"\u00b7"} {scores.mappedCount} of {scores.totalDomains} subjects
        mapped
      </p>

      <div className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {strengthRows.length > 0 ? (
          <div>
            <p
              className="font-mono text-[0.65rem] uppercase tracking-widest"
              style={{ color: "var(--gold-ink)" }}
            >
              Strengths
            </p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {strengthRows.map((score) => (
                <li
                  key={score.domainId}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="font-semibold text-strong">{name(score)}</span>
                  <span className="font-mono text-xs" style={{ color: "var(--gold-ink)" }}>
                    +{score.monthsAhead} mo
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {growingRows.length > 0 ? (
          <div>
            <p
              className="font-mono text-[0.65rem] uppercase tracking-widest"
              style={{ color: "var(--sky-600)" }}
            >
              Growing right now
            </p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {growingRows.map((score) => (
                <li
                  key={score.domainId}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="font-semibold text-strong">{name(score)}</span>
                  <span className="font-mono text-xs" style={{ color: "var(--sky-600)" }}>
                    growing
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {closestRows.length > 0 ? (
          <div>
            <p
              className="font-mono text-[0.65rem] uppercase tracking-widest"
              style={{ color: "var(--sage-700)" }}
            >
              Closest to age
            </p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {closestRows.map((score) => (
                <li
                  key={score.domainId}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="font-semibold text-strong">{name(score)}</span>
                  <span className="font-mono text-xs" style={{ color: "var(--sage-700)" }}>
                    {score.monthsAhead && score.monthsAhead > 0
                      ? `+${score.monthsAhead} mo`
                      : "at age"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {nextRecheck ? (
        <p className="mt-3 font-mono text-xs text-muted">
          next re-check {"\u00b7"}{" "}
          {nextRecheck.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      ) : null}

      {eras.length >= 2 ? (
        <div className="mt-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
            By subject, over time
          </p>
          <p className="mt-1 text-xs text-muted">
            Each line is {childName} against their own past, never another child.
          </p>
          <div className="mt-2">
            <ReportTrajectory childName={childName} eras={eras} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
