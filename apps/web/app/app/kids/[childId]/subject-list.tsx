import { ageLabel, subjectLine, getMapSubject, type SubjectScore } from "@homa/core";

import type { DashboardReport } from "../../../../lib/dashboard";
import { movementFor } from "../../../../components/dashboard/movement";
import { gaugeLabel, SubjectGauge, subjectTone } from "../../../../components/dashboard/subject-gauge";
import { QuietFrame } from "../../../../components/design/QuietFrame";

/**
 * Every subject on one kid's page, strengths first (the report's own
 * strengthOrder), each with the reviewed sentence from core's
 * sentences.ts, the shared position gauge, and the dated movement chip
 * when a subject genuinely moved. Exposure subjects (second language,
 * coding) badge without a gauge: they track family exposure, not age
 * norms. Unmapped subjects fold into one quiet line instead of a wall
 * of gray rows.
 */

export function SubjectList({
  report,
  childName,
  ageMonths,
}: {
  report: DashboardReport;
  childName: string;
  ageMonths: number;
}) {
  const byId = new Map(report.scores.subjects.map((score) => [score.subjectId, score]));
  const ordered = report.scores.strengthOrder
    .map((subjectId) => byId.get(subjectId))
    .filter((score): score is SubjectScore => Boolean(score));
  const notMapped = report.scores.subjects.filter((score) => score.position === "not_mapped");
  const prior = report.history[0];

  return (
    <QuietFrame as="section" aria-label="Subjects" className="mt-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-[color:var(--homa-ink)]">Subject by subject</h2>
        <p className="text-xs text-[color:var(--homa-muted-ink)]">
          strongest first {"\u00b7"} typical for {ageLabel(ageMonths)} marked on each bar
        </p>
      </div>
      <div className="mt-3 flex flex-col">
        {ordered.map((score, index) => {
          const domain = getMapSubject(score.subjectId);
          const line = subjectLine(score, childName);
          const tone = subjectTone(score.position);
          const movement = movementFor(score, prior);
          return (
            <div
              key={score.subjectId}
                className={`py-3.5 ${index < ordered.length - 1 ? "border-b border-[var(--homa-control-boundary)]" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-[color:var(--homa-ink)]">
                  {domain?.displayName ?? score.subjectId}
                </span>
                <span
                  className="rounded-[var(--homa-radius-control)] px-2.5 py-0.5 text-[0.68rem] font-bold"
                  style={{ background: tone.chipBg, color: tone.ink }}
                >
                  {line.badge}
                </span>
                {movement ? (
                  <span
                    className="rounded-[var(--homa-radius-control)] px-2 py-0.5 font-mono text-[0.62rem] font-bold"
                    style={
                      movement.tone === "gold"
                        ? { background: "var(--gold-100)", color: "var(--gold-ink)" }
                        : { background: "var(--accent-sage-soft)", color: "var(--sage-700)" }
                    }
                  >
                    {"\u2191"} {movement.label}
                  </span>
                ) : null}
                {!score.exposureBased ? (
                    <span className="ml-auto font-mono text-xs" style={{ color: tone.ink }}>
                    {gaugeLabel(score)}
                  </span>
                ) : null}
              </div>
              {!score.exposureBased ? (
                <div className="mt-2">
                  <SubjectGauge score={score} />
                </div>
              ) : null}
        <p className="mt-1.5 text-sm text-[color:var(--homa-muted-ink)]">{line.sentence}</p>
            </div>
          );
        })}
      </div>
      {notMapped.length > 0 ? (
        <p className="mt-3 border-t border-[var(--homa-control-boundary)] pt-3 text-xs text-[color:var(--homa-muted-ink)]">
          {notMapped.length} {notMapped.length === 1 ? "subject isn't" : "subjects aren't"} mapped
          yet. A few more answers on the report fill {notMapped.length === 1 ? "it" : "them"} in.
        </p>
      ) : null}
    </QuietFrame>
  );
}
