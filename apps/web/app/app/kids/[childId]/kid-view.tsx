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
import { SubjectList } from "./subject-list";

/**
 * One kid's corner of the dashboard (pure render; page.tsx owns auth +
 * data): header with the standing pill, the sibling switcher, per-kid
 * tiles, core's reviewed homaNote, every subject with the report's own
 * sentences, running months, dated wins, and the curriculum.
 */

export interface KidLessonListEntry {
  id: string;
  status: string;
  startedAt: string;
}

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
  lessonListen,
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
  /** Lesson listen entry point (§7 Q5); null while the flag is off. */
  lessonListen: {
    recordHref: string;
    lessons: KidLessonListEntry[];
  } | null;
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
        <section
          aria-label="A note from HOMA"
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
              A note from HOMA
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
          HOMA is building {child.name}&apos;s curriculum from your call.
        </p>
      ) : null}

      {/* Lesson listen (plan 2026-07-13-lesson-listen.md §4.6): the
          recording door lives on the page that owns this kid, and the
          latest reviews sit right under it. */}
      {lessonListen ? (
        <section
          aria-label="Lessons"
          className="mt-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-lg font-semibold text-strong">
                Lessons
              </p>
              <p className="mt-0.5 text-sm text-muted">
                Teach like always. Homa listens, then writes a review: how
                it went and ideas for next time.
              </p>
            </div>
            <Link
              href={lessonListen.recordHref}
              className="inline-flex min-h-10 items-center rounded-pill bg-brand px-5 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover"
            >
              Record a lesson
            </Link>
          </div>
          {lessonListen.lessons.length > 0 ? (
            <ul className="mt-4 space-y-1.5">
              {lessonListen.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <Link
                    href={`/app/lessons/${lesson.id}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-bg-page px-3 py-2 text-sm transition-colors hover:border-brand"
                  >
                    <span className="text-body">
                      Lesson from{" "}
                      {new Date(lesson.startedAt).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                    <span className="text-xs font-medium text-muted">
                      {lesson.status === "ready"
                        ? "Review ready"
                        : lesson.status === "failed"
                          ? "Homa couldn't finish"
                          : "Review on the way"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        {progressAction ? (
          <Link
            href={progressAction.href}
            className="inline-flex min-h-11 items-center rounded-pill bg-[var(--brand-active)] px-5 py-2.5 text-sm font-semibold text-on-brand transition-colors hover:bg-[var(--clay-600)]"
          >
            {progressAction.label}
          </Link>
        ) : null}
        <AskHomaAboutChild
          childId={child.id}
          childName={child.name}
        />
      </div>
    </>
  );
}
