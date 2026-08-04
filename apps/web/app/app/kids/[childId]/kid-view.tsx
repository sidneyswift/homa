import Link from "next/link";

import { ageInMonths, ageLabel, homaNote, isInScoredRange, noteGreeting } from "@homa/core";

import type { ChildCurriculumRow } from "../../../../lib/curriculum";
import { kidProgressAction } from "../../../../lib/child-progress/kid-action";
import type { ChildRecord } from "../../../../lib/family";
import type { DashboardPlan, DashboardReport, RecentWin } from "../../../../lib/dashboard";
import { KidAvatar } from "../../../../components/dashboard/kid-avatar";
import { kidPill } from "../../../../components/dashboard/kid-pill";
import { Logo } from "../../../../components/brand/Logo";
import { MonthCard } from "../../../../components/dashboard/month-card";
import { movedUpCount } from "../../../../components/dashboard/movement";
import { StatTiles } from "../../../../components/dashboard/stat-tiles";
import { WinsCard } from "../../../../components/dashboard/wins-card";
import { AskHomaAboutChild } from "../../../../components/progress/ask-homa-about-child";
import { QuietAction } from "../../../../components/design/QuietAction";
import { QuietFrame } from "../../../../components/design/QuietFrame";
import { QuietStatus } from "../../../../components/design/QuietStatus";
import { SubjectList } from "./subject-list";

/**
 * One kid's corner of the dashboard (pure render; page.tsx owns auth +
 * data): header with the standing pill, the sibling switcher, per-kid
 * tiles, core's reviewed homaNote, every subject with the report's own
 * sentences, running months, dated wins, and the curriculum.
 */

export function KidView({
  kids,
  kidIndex,
  parentFirstName,
  report,
  reports,
  plans,
  wins,
  curriculum,
  curriculumPending,
}: {
  kids: ChildRecord[];
  /** Position of this kid within the family list (drives avatar tone). */
  kidIndex: number;
  parentFirstName: string;
  report: DashboardReport | null;
  /** All the family's reports, for the month card's token links. */
  reports: Map<string, DashboardReport>;
  /** This kid's plans only. */
  plans: DashboardPlan[];
  wins: RecentWin[];
  curriculum: ChildCurriculumRow | null;
  curriculumPending: boolean;
}) {
  const child = kids[kidIndex];
  const months = ageInMonths(child.birth_month);
  const pill = kidPill(report, months);
  const moved = report ? movedUpCount(report.scores, report.history[0]?.scores) : 0;
  const childNames = new Map([[child.id, child.name]]);
  const progressAction = kidProgressAction(
    child.id,
    report?.token,
  );

  return (
    <>
      <header className="flex flex-wrap items-center gap-4">
        <KidAvatar name={child.name} index={kidIndex} avatarUrl={child.avatar_url} size={52} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[1.8rem] font-semibold leading-tight tracking-[-0.015em] text-[color:var(--homa-ink)]">
            {child.name}&apos;s progress
          </h1>
          <p className="mt-0.5 text-sm text-[color:var(--homa-muted-ink)]">
            {ageLabel(months)}
            {child.profile.interests?.length
              ? ` \u00b7 into ${child.profile.interests.join(", ")}`
              : ""}
          </p>
        </div>
        {pill ? (
          <span
            className="whitespace-nowrap rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-canvas)] px-3 py-1.5 text-[0.78rem] font-bold text-[color:var(--homa-brand-text)]"
            style={{ background: pill.bg, color: pill.ink }}
          >
            {pill.label}
          </span>
        ) : null}
      </header>

      {/* Sibling switcher: the rest of the crew, one tap away. */}
      {kids.length > 1 ? (
        <nav aria-label="Switch kid" className="mt-4 flex flex-wrap gap-2">
          {kids.map((entry, index) => {
            const current = entry.id === child.id;
            return (
              <Link
                key={entry.id}
                href={`/app/kids/${entry.id}`}
                aria-current={current ? "page" : undefined}
                className={
                  current
                    ? "quiet-filter quiet-filter--active inline-flex items-center gap-2"
                    : "quiet-filter inline-flex items-center gap-2"
                }
              >
                <KidAvatar name={entry.name} index={index} avatarUrl={entry.avatar_url} size={20} />
                {entry.name}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {report ? <StatTiles reports={[report]} plans={plans} kidCount={1} /> : null}

      {/* The per-kid note: core's reviewed homaNote, the same words the
          report opens with, plus the movement celebration when earned. */}
      {report ? (
        <QuietStatus tone="constructive" className="mt-4 flex gap-4 p-5">
          <div className="flex-shrink-0 pt-0.5">
            <Logo variant="mark" size={34} />
          </div>
          <div>
            <p
              className="font-sans text-[0.68rem] font-bold uppercase tracking-[0.14em]"
            >
              A note from Homa
            </p>
            <p className="mt-1 font-serif italic text-[color:var(--homa-ink)]">{noteGreeting(parentFirstName)}</p>
            <p className="mt-1 text-[color:var(--homa-muted-ink)]">
              {homaNote(report.scores, child.name)}
              {moved > 0
                ? ` Since last check-in, ${moved} ${moved === 1 ? "subject" : "subjects"} moved up.`
                : ""}
            </p>
          </div>
        </QuietStatus>
      ) : (
        <QuietFrame tone="paper" className="mt-4 p-6">
          <p className="font-display text-lg font-semibold text-[color:var(--homa-ink)]">
            {months < 24
              ? `${child.name}'s checklist opens at age 2.`
              : isInScoredRange(months)
                ? `${child.name}'s picture starts with the checklist.`
                : `${child.name} is past the checklist's range.`}
          </p>
            <p className="mt-1 text-sm text-[color:var(--homa-muted-ink)]">
            {months < 24
              ? "Until then, this page keeps their spot warm."
              : isInScoredRange(months)
                ? "About five minutes of questions builds the first progress report, and this page fills in."
                : "Chat still knows the whole family, and this page holds whatever you add."}
          </p>
          {isInScoredRange(months) ? (
            <QuietAction href="/onboarding" size="default" className="mt-4">
              Start {child.name}&apos;s checklist
            </QuietAction>
          ) : null}
        </QuietFrame>
      )}

      {report ? <SubjectList report={report} childName={child.name} ageMonths={months} /> : null}

      {(plans.length > 0 || wins.length > 0) && report ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <MonthCard plans={plans} reports={reports} childNames={childNames} />
          <WinsCard wins={wins} childNames={childNames} />
        </div>
      ) : null}

      {curriculum ? (
        <QuietFrame tone="mineral" className="mt-4 p-5">
          <p
            className="font-sans text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[color:var(--homa-brand-text)]"
          >
            {child.name}&apos;s curriculum {"\u00b7"} {curriculum.curriculum.durationLabel}
          </p>
          <p className="mt-1.5 font-display text-lg font-semibold text-[color:var(--homa-ink)]">
            {curriculum.curriculum.title}
          </p>
            <p className="mt-1 text-sm text-[color:var(--homa-muted-ink)]">{curriculum.curriculum.overview}</p>
          {curriculum.curriculum.subjects.length > 0 ? (
              <p className="mt-2 text-xs text-[color:var(--homa-muted-ink)]">
              Covers {curriculum.curriculum.subjects.map((subject) => subject.subjectName).join(", ")}.
            </p>
          ) : null}
        </QuietFrame>
      ) : curriculumPending ? (
        <p className="mt-4 text-sm text-[color:var(--homa-muted-ink)]">
          Homa is building {child.name}&apos;s curriculum from your call.
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        {progressAction ? (
          <QuietAction href={progressAction.href}>
            {progressAction.label}
          </QuietAction>
        ) : null}
        <AskHomaAboutChild
          childId={child.id}
          childName={child.name}
        />
      </div>
    </>
  );
}
