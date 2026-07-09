import { ageInMonths, isInScoredRange } from "@homa/core";

import type { ChildRecord } from "../../lib/family";
import type { DashboardReport } from "../../lib/dashboard";
import { Logo } from "../brand/Logo";
import { movedUpCount } from "./movement";

/**
 * "A note from Homa", the dashboard's reassurance beat. Composed from
 * each kid's real report positions using the report's own vocabulary
 * (ahead / on track / growing right now, packages/core sentences.ts).
 * Voice laws: one sentence per kid, never a comparison between siblings,
 * reassure before inform, no gendered pronouns, no deficit words.
 */

function kidSentence(child: ChildRecord, report: DashboardReport | null): string {
  const months = ageInMonths(child.birth_month);
  if (!report) {
    if (months < 24) return `${child.name}'s checklist opens at age 2.`;
    if (isInScoredRange(months)) {
      return `${child.name}'s checklist is ready whenever you are, about five minutes.`;
    }
    return `${child.name} is past the checklist's range, and chat still knows the whole family.`;
  }
  const scored = report.scores.domains.filter(
    (score) => !score.exposureBased && score.position !== "not_mapped",
  );
  const ahead = scored.filter((score) => score.position === "ahead").length;
  const onTrack = scored.filter((score) => score.position === "on_track").length;
  const growing = scored.filter((score) => score.position === "growing").length;
  if (ahead > 0) {
    return `${child.name} is ahead for their age in ${ahead} ${ahead === 1 ? "subject" : "subjects"}.`;
  }
  if (onTrack > 0) {
    return `${child.name} is right where most kids their age are.`;
  }
  if (growing > 0) {
    return `${child.name} has a clear next step in ${growing} ${growing === 1 ? "subject" : "subjects"}, named in the report.`;
  }
  return `${child.name}'s picture is just getting started, and it fills in as you answer.`;
}

export function FamilyNote({
  kids,
  reports,
}: {
  kids: ChildRecord[];
  reports: Map<string, DashboardReport>;
}) {
  const sentences = kids.map((child) => kidSentence(child, reports.get(child.id) ?? null));

  const moved = kids.reduce((sum, child) => {
    const report = reports.get(child.id);
    return sum + (report ? movedUpCount(report.scores, report.history[0]?.scores) : 0);
  }, 0);

  const anyGrowing = [...reports.values()].some((report) =>
    report.scores.domains.some((score) => score.position === "growing" && !score.exposureBased),
  );
  const closing =
    moved > 0
      ? `Since last check-in, ${moved} ${moved === 1 ? "subject" : "subjects"} moved up. Your work is showing up in the numbers.`
      : reports.size > 0 && !anyGrowing
        ? "Nothing to worry about this week."
        : null;

  return (
    <section
      aria-label="A note from Homa"
      className="mt-4 flex gap-4 rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-5"
    >
      <div className="flex-shrink-0 pt-0.5">
        <Logo variant="mark" size={34} />
      </div>
      <div>
        <p className="font-mono text-[0.65rem] uppercase tracking-widest text-sage">
          A note from Homa
        </p>
        <p className="mt-1 text-body">
          {sentences.join(" ")}
          {closing ? ` ${closing}` : ""}
        </p>
      </div>
    </section>
  );
}
