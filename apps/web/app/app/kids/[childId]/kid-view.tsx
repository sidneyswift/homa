import Link from "next/link";

import { ageInMonths, ageLabel, homaNote, isInScoredRange, noteGreeting } from "@homa/core";

import type { ChildCurriculumRow } from "../../../../lib/curriculum";
import type { ChildRecord } from "../../../../lib/family";
import type { DashboardPlan, DashboardReport, RecentWin } from "../../../../lib/dashboard";
import { avatarTone } from "../../../../components/dashboard/sidebar";
import { kidPill } from "../../../../components/dashboard/kid-pill";
import { Logo } from "../../../../components/brand/Logo";
import { MonthCard } from "../../../../components/dashboard/month-card";
import { movedUpCount } from "../../../../components/dashboard/movement";
import { StatTiles } from "../../../../components/dashboard/stat-tiles";
import { WinsCard } from "../../../../components/dashboard/wins-card";
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
  const [avatarBg, avatarInk] = avatarTone(kidIndex);
  const pill = kidPill(report, months);
  const moved = report ? movedUpCount(report.scores, report.history[0]?.scores) : 0;
  const childNames = new Map([[child.id, child.name]]);

  return (
    <>
      <header className="flex flex-wrap items-center gap-4">
        <span
          className="inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full text-xl font-bold"
          style={{ background: avatarBg, color: avatarInk }}
        >
          {child.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[1.8rem] font-semibold leading-tight tracking-[-0.015em] text-strong">
            {child.name}&apos;s progress
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {ageLabel(months)}
            {child.profile.interests?.length
              ? ` \u00b7 into ${child.profile.interests.join(", ")}`
              : ""}
          </p>
        </div>
        {pill ? (
          <span
            className="whitespace-nowrap rounded-pill px-3 py-1.5 text-[0.78rem] font-bold"
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
            const [bg, ink] = avatarTone(index);
            const current = entry.id === child.id;
            return (
              <Link
                key={entry.id}
                href={`/app/kids/${entry.id}`}
                aria-current={current ? "page" : undefined}
                className={
                  current
                    ? "inline-flex items-center gap-2 rounded-pill bg-brand-soft px-3.5 py-1.5 text-sm font-bold text-[var(--clay-700)]"
                    : "inline-flex items-center gap-2 rounded-pill border border-border-subtle bg-card px-3.5 py-1.5 text-sm font-medium text-muted transition-colors hover:border-brand hover:text-body"
                }
              >
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[0.65rem] font-bold"
                  style={{ background: bg, color: ink }}
                >
                  {entry.name.charAt(0)}
                </span>
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
        <section
          aria-label="A note from Homa"
          className="mt-4 flex gap-4 rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-5"
        >
          <div className="flex-shrink-0 pt-0.5">
            <Logo variant="mark" size={34} />
          </div>
          <div>
            <p
              className="font-mono text-[0.65rem] uppercase tracking-widest"
              style={{ color: "var(--sage-700)" }}
            >
              A note from Homa
            </p>
            <p className="mt-1 font-serif italic text-strong">{noteGreeting(parentFirstName)}</p>
            <p className="mt-1 text-body">
              {homaNote(report.scores, child.name)}
              {moved > 0
                ? ` Since last check-in, ${moved} ${moved === 1 ? "subject" : "subjects"} moved up.`
                : ""}
            </p>
          </div>
        </section>
      ) : (
        <section className="mt-4 rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
          <p className="font-display text-lg font-semibold text-strong">
            {months < 24
              ? `${child.name}'s checklist opens at age 2.`
              : isInScoredRange(months)
                ? `${child.name}'s picture starts with the checklist.`
                : `${child.name} is past the checklist's range.`}
          </p>
          <p className="mt-1 text-sm text-muted">
            {months < 24
              ? "Until then, this page keeps their spot warm."
              : isInScoredRange(months)
                ? "About five minutes of questions builds the first progress report, and this page fills in."
                : "Chat still knows the whole family, and this page holds whatever you add."}
          </p>
          {isInScoredRange(months) ? (
            <Link
              href="/onboarding"
              className="mt-4 inline-flex min-h-10 items-center rounded-pill bg-brand px-5 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover"
            >
              Start {child.name}&apos;s checklist
            </Link>
          ) : null}
        </section>
      )}

      {report ? <SubjectList report={report} childName={child.name} ageMonths={months} /> : null}

      {(plans.length > 0 || wins.length > 0) && report ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <MonthCard plans={plans} reports={reports} childNames={childNames} />
          <WinsCard wins={wins} childNames={childNames} />
        </div>
      ) : null}

      {curriculum ? (
        <section className="mt-4 rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-5">
          <p
            className="font-mono text-[0.65rem] uppercase tracking-widest"
            style={{ color: "var(--sage-700)" }}
          >
            {child.name}&apos;s curriculum {"\u00b7"} {curriculum.curriculum.durationLabel}
          </p>
          <p className="mt-1.5 font-display text-lg font-semibold text-strong">
            {curriculum.curriculum.title}
          </p>
          <p className="mt-1 text-sm text-body">{curriculum.curriculum.overview}</p>
          {curriculum.curriculum.subjects.length > 0 ? (
            <p className="mt-2 text-xs text-muted">
              Covers {curriculum.curriculum.subjects.map((subject) => subject.subjectName).join(", ")}.
            </p>
          ) : null}
        </section>
      ) : curriculumPending ? (
        <p className="mt-4 text-sm text-muted">
          Homa is building {child.name}&apos;s curriculum from your call.
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        {report?.token ? (
          <Link
            href={`/app/${child.id}/report`}
            className="inline-flex min-h-11 items-center rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover"
          >
            Open the full report
          </Link>
        ) : null}
        <Link
          href="/app"
          className="inline-flex min-h-11 items-center rounded-pill border border-border bg-card px-5 py-2.5 text-sm font-semibold text-strong transition-colors hover:border-brand"
        >
          Ask Homa about {child.name}
        </Link>
      </div>
    </>
  );
}
