import Link from "next/link";

import {
  ageInMonths,
  ageLabel,
  getMapDomain,
  isInScoredRange,
  MONTH_PLAN_DOMAIN,
  type DomainScore,
} from "@homa/core";

import type { ChildCurriculumRow } from "../../lib/curriculum";
import type { ChildRecord } from "../../lib/family";
import type { DashboardPlan, DashboardReport } from "../../lib/dashboard";
import { avatarTone } from "./sidebar";
import { gaugeLabel, SubjectGauge, subjectTone } from "./subject-gauge";

/**
 * One kid's card on the dashboard: the template's per-child frame with
 * the report's real vocabulary inside it. Subject rows use the shared
 * position gauge (subject-gauge.tsx); the header links to the kid's own
 * page, the deeper per-kid view.
 */

export interface KidPill {
  label: string;
  bg: string;
  ink: string;
}

/** The kid's overall standing chip, reassurance-first (also used by the
 * per-kid page header). */
export function kidPill(report: DashboardReport | null, months: number): KidPill | null {
  if (!report) {
    if (months < 24) return { label: "Opens at age 2", bg: "var(--stone-100)", ink: "var(--stone-600)" };
    if (isInScoredRange(months)) {
      return { label: "Checklist ready", bg: "var(--stone-100)", ink: "var(--stone-600)" };
    }
    return null;
  }
  const scored = report.scores.domains.filter(
    (score) => !score.exposureBased && score.position !== "not_mapped",
  );
  if (scored.length === 0) {
    return { label: "Just getting started", bg: "var(--stone-100)", ink: "var(--stone-600)" };
  }
  const ahead = scored.filter((score) => score.position === "ahead").length;
  const growing = scored.filter((score) => score.position === "growing").length;
  // Strengths first: the sky pill only when growing genuinely dominates
  // the picture; a kid ahead in two subjects with one growing is, in this
  // house's vocabulary, on track.
  if (growing > scored.length - growing) {
    return { label: "Growing right now", bg: "var(--info-soft)", ink: "var(--sky-600)" };
  }
  if (ahead >= Math.ceil(scored.length / 2)) {
    return { label: "Ahead \u2726", bg: "var(--gold-100)", ink: "var(--gold-ink)" };
  }
  return { label: "On track", bg: "var(--sage-50)", ink: "var(--sage-700)" };
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function KidCard({
  child,
  index,
  report,
  plans,
  curriculum,
  curriculumPending,
}: {
  child: ChildRecord;
  index: number;
  report: DashboardReport | null;
  plans: DashboardPlan[];
  curriculum: ChildCurriculumRow | null;
  curriculumPending: boolean;
}) {
  const months = ageInMonths(child.birth_month);
  const [avatarBg, avatarInk] = avatarTone(index);
  const pill = kidPill(report, months);

  const byId = new Map(report?.scores.domains.map((score) => [score.domainId, score]) ?? []);
  const topSubjects = (report?.scores.strengthOrder ?? [])
    .map((domainId) => byId.get(domainId))
    .filter((score): score is DomainScore => Boolean(score && !score.exposureBased))
    .slice(0, 3);

  // The footer line: a growing subject's named next step beats a trophy.
  const growingWithStep = report?.scores.domains.find(
    (score) => score.position === "growing" && !score.exposureBased && score.frontierStatement,
  );
  const strongest = topSubjects.find((score) => score.strongestObservedStatement);
  const footerLine = growingWithStep?.frontierStatement
    ? { label: "Next up", text: lowerFirst(growingWithStep.frontierStatement) }
    : strongest?.strongestObservedStatement
      ? { label: "You've seen it", text: lowerFirst(strongest.strongestObservedStatement) }
      : null;

  const monthPlan = plans.find((plan) => plan.domainId === MONTH_PLAN_DOMAIN) ?? plans[0] ?? null;

  return (
    <article
      id={`kid-${child.id}`}
      className="flex scroll-mt-20 flex-col rounded-lg border border-border-subtle bg-card p-5 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <Link href={`/app/kids/${child.id}`} className="flex min-w-0 flex-1 items-center gap-3 group">
          <span
            className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full font-bold"
            style={{ background: avatarBg, color: avatarInk }}
          >
            {child.name.charAt(0)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-bold text-strong group-hover:text-brand">
              {child.name}
            </span>
            <span className="block text-xs text-subtle">{ageLabel(months)}</span>
          </span>
        </Link>
        {pill ? (
          <span
            className="whitespace-nowrap rounded-pill px-2.5 py-1 text-[0.72rem] font-bold"
            style={{ background: pill.bg, color: pill.ink }}
          >
            {pill.label}
          </span>
        ) : null}
      </div>

      {topSubjects.length > 0 ? (
        <div className="mt-4 flex flex-col gap-3">
          {topSubjects.map((score) => (
            <div key={score.domainId}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[0.78rem]">
                <span className="font-semibold text-body">
                  {getMapDomain(score.domainId)?.displayName ?? score.domainId}
                </span>
                <span className="font-mono text-xs" style={{ color: subjectTone(score.position).ink }}>
                  {gaugeLabel(score)}
                </span>
              </div>
              <SubjectGauge score={score} />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">
          {months < 24
            ? `Homa's checklist opens at age 2. Until then, ${child.name}'s spot is saved.`
            : isInScoredRange(months)
              ? `About five minutes of questions builds ${child.name}'s first progress report.`
              : `${child.name} is past the checklist's range. Chat still knows the whole family.`}
        </p>
      )}

      {footerLine ? (
        <p className="mt-3.5 border-t border-border-subtle pt-3 text-[0.78rem] text-muted">
          {footerLine.label}:{" "}
          <span className="font-semibold text-body">{footerLine.text}</span>
        </p>
      ) : null}

      {child.profile.interests?.length ? (
        <p className="mt-2 text-xs text-subtle">Into: {child.profile.interests.join(", ")}</p>
      ) : null}

      {/* "Call Homa" curriculum (founder decision 2026-07-07): shows once
          a call has happened; the pending line while it is being built. */}
      {curriculum ? (
        <div className="mt-3 rounded-md border border-sage/30 bg-[var(--accent-sage-soft)] p-3">
          <p className="text-sm font-semibold text-strong">{curriculum.curriculum.title}</p>
          <p className="mt-1 text-xs text-body">{curriculum.curriculum.overview}</p>
        </div>
      ) : curriculumPending ? (
        <p className="mt-3 text-xs text-muted">
          Homa is building {child.name}&apos;s curriculum from your call.
        </p>
      ) : null}

      {/* mt-auto pins the actions to the card's bottom edge so a row of
          kid cards keeps one baseline even when content depths differ. */}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {report?.token ? (
          <Link
            href={`/onboarding/r/${report.token}`}
            className="inline-flex min-h-10 items-center rounded-pill border border-border bg-card px-4 py-2 text-xs font-semibold text-strong transition-colors hover:border-brand"
          >
            Open {child.name}&apos;s report
          </Link>
        ) : isInScoredRange(months) ? (
          <Link
            href="/onboarding"
            className="inline-flex min-h-10 items-center rounded-pill bg-brand px-4 py-2 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-hover"
          >
            Start {child.name}&apos;s checklist
          </Link>
        ) : null}
        {report?.token && monthPlan ? (
          <Link
            href={`/onboarding/r/${report.token}/plan/${monthPlan.domainId}`}
            className="inline-flex min-h-10 items-center rounded-pill border border-border bg-card px-4 py-2 text-xs font-semibold text-strong transition-colors hover:border-brand"
          >
            Open the month
          </Link>
        ) : null}
      </div>
    </article>
  );
}
