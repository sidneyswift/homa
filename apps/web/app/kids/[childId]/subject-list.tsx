import { ageLabel, domainLine, getMapDomain, type DomainScore } from "@homa/core";

import type { DashboardReport } from "../../../lib/dashboard";
import { movementFor } from "../../../components/dashboard/movement";
import { gaugeLabel, SubjectGauge, subjectTone } from "../../../components/dashboard/subject-gauge";

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
  const byId = new Map(report.scores.domains.map((score) => [score.domainId, score]));
  const ordered = report.scores.strengthOrder
    .map((domainId) => byId.get(domainId))
    .filter((score): score is DomainScore => Boolean(score));
  const notMapped = report.scores.domains.filter((score) => score.position === "not_mapped");
  const prior = report.history[0];

  return (
    <section aria-label="Subjects" className="mt-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-strong">Subject by subject</h2>
        <p className="text-xs text-subtle">
          strongest first {"\u00b7"} typical for {ageLabel(ageMonths)} marked on each bar
        </p>
      </div>
      <div className="mt-3 flex flex-col">
        {ordered.map((score, index) => {
          const domain = getMapDomain(score.domainId);
          const line = domainLine(score, childName);
          const tone = subjectTone(score.position);
          const movement = movementFor(score, prior);
          return (
            <div
              key={score.domainId}
              className={`py-3.5 ${index < ordered.length - 1 ? "border-b border-[var(--stone-100)]" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-strong">
                  {domain?.displayName ?? score.domainId}
                </span>
                <span
                  className="rounded-pill px-2.5 py-0.5 text-[0.68rem] font-bold"
                  style={{ background: tone.chipBg, color: tone.ink }}
                >
                  {line.badge}
                </span>
                {movement ? (
                  <span
                    className="rounded-pill px-2 py-0.5 font-mono text-[0.62rem] font-bold"
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
              <p className="mt-1.5 text-sm text-muted">{line.sentence}</p>
            </div>
          );
        })}
      </div>
      {notMapped.length > 0 ? (
        <p className="mt-3 border-t border-[var(--stone-100)] pt-3 text-xs text-subtle">
          {notMapped.length} {notMapped.length === 1 ? "subject isn't" : "subjects aren't"} mapped
          yet. A few more answers on the report fill {notMapped.length === 1 ? "it" : "them"} in.
        </p>
      ) : null}
    </section>
  );
}
