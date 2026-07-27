import type { CSSProperties } from "react";
import Link from "next/link";

import {
  ageInMonths,
  ageLabel,
  subjectLine,
  getMapSubject,
  homaNote,
  MAP_SOURCES,
  MONTH_PLAN_SUBJECT,
  cdcChecklistUrl,
  noteGreeting,
  notePlanSentence,
  reportStaleness,
  US_STATES,
  type SubjectScore,
  type MapAnswer,
  type MapScores,
  type ReportNarrative,
} from "@homa/core";

import type { StateRequirementsSummary } from "../../../../lib/map/state-requirements";
import type { TrajectoryEra } from "../../../../lib/map/trajectory-eras";
import type { ReportLock, WallCheckout } from "../../../../lib/billing/wall-types";
import type { SubjectLessonSummary } from "../../../../lib/subject-lessons/types";
import { Logo } from "../../../../components/brand/Logo";
import { DoorLink } from "../../../../components/billing/door-link";
import { ReportLockOffer } from "../../../../components/billing/report-lock-offer";
import { reportLockRowLine } from "../../../../components/billing/wall-copy";
import { CallHomaPs } from "./call-homa-ps";
import { MonthButton } from "./month-button";
import { ReceiptsList, type ReceiptRow } from "./receipts-list";
import { ReportActions } from "./report-actions";
import { reportButtonClass } from "./report-button";
import { ReportNav } from "./report-nav";
import { ReportSnapshot } from "./report-snapshot";
import { StalenessBanner } from "./staleness-banner";
import { StateCard } from "./state-card";
import { SubjectLessonButton } from "./subject-lesson-button";

/**
 * The progress report renderer, shared by the live tokenized page, the
 * public sample, and the in-app home surface (/app/[childId]/report,
 * founder ask 2026-07-10: the report IS the dashboard). Built around
 * progressive disclosure (founder pass
 * 2026-07-08: "if you've said it once, you don't need to say it again",
 * round 2 on 2026-07-09): the note from Homa reads as an actual letter
 * (greeting, the note sentence, the month plan, a call-me line, a
 * sign-off), the snapshot is one chart with one sentence and flows
 * straight into the whole picture and then subject by subject with
 * nothing between, subject cards are bare until opened, and the state
 * and methodology cards start closed. Movement chips show dated,
 * POSITIVE change only (anti-guilt law: a drop renders as nothing, never
 * a down-arrow). No red, no "behind".
 *
 * With a narrativeView (D8 overturn), the model-written note and subject
 * lines render in place of the template sentences, per piece: a
 * gate-rejected piece falls back to its template line. Every number,
 * badge, chart point, and citation stays computed, either way.
 */

export interface ReportNarrativeView {
  narrative: ReportNarrative;
  rejectedPieces: string[];
}

export interface ReportViewData {
  token: string;
  scores: MapScores;
  bankVersion: string;
  generatedAt: string;
  childName: string;
  birthMonth: string;
  parentFirstName: string | null;
  usState: string | null;
  familyId: string;
  childId: string;
  answers: { itemId: string; answer: MapAnswer }[];
  history: { scores: MapScores; generated_at: string; narrative?: ReportNarrative | null }[];
  /** The trajectory chart's scorings, oldest first, live last,
   * re-normalized to one measuring stick where the evidence ledger
   * allows (lib/map/trajectory-eras). */
  eras: TrajectoryEra[];
  otherKids: { id: string; name: string; inRange: boolean; hasReport: boolean }[];
  /** Built months and their synced check-off counts (empty on sample). */
  plans: { subjectId: string; done: number; total: number; retestAt: string }[];
  /** The family's linked texting/calling number, if any (null on the
   * sample page, which carries no real family). */
  familyPhone: string | null;
}

const POSITION_RANK: Record<SubjectScore["position"], number> = {
  not_mapped: 0,
  growing: 1,
  on_track: 2,
  ahead: 3,
};

function badgeStyleForPosition(position: SubjectScore["position"]): CSSProperties {
  switch (position) {
    case "ahead":
      return { background: "var(--gold-100)", color: "var(--gold-ink)" };
    case "on_track":
      return { background: "var(--accent-sage-soft)", color: "var(--sage-700)" };
    case "growing":
      return { background: "var(--info-soft)", color: "var(--sky-600)" };
    case "not_mapped":
      return { background: "var(--surface-sunken)", color: "var(--text-muted)" };
    default: {
      const exhaustive: never = position;
      throw new Error(`Unhandled map position: ${exhaustive}`);
    }
  }
}

interface Movement {
  /** "+4 mo since Jun 6" (gold) or "moved up since Jun 6" (sage). */
  label: string;
  tone: "gold" | "sage";
}

function movementFor(
  current: SubjectScore,
  prior: { scores: MapScores; generated_at: string } | undefined,
): Movement | null {
  if (!prior || current.exposureBased) return null;
  const previous = prior.scores.subjects.find((entry) => entry.subjectId === current.subjectId);
  if (!previous) return null;
  const since = new Date(prior.generated_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  if (
    current.monthsAhead !== null &&
    previous.monthsAhead !== null &&
    current.monthsAhead > previous.monthsAhead
  ) {
    return { label: `+${current.monthsAhead - previous.monthsAhead} mo since ${since}`, tone: "gold" };
  }
  if (POSITION_RANK[current.position] > POSITION_RANK[previous.position]) {
    return { label: `moved up since ${since}`, tone: "sage" };
  }
  return null;
}

export function ReportView({
  data,
  sample = false,
  mirror = false,
  context = "standalone",
  narrativeView = null,
  stateRequirements = null,
  wall = null,
  subjectLessonsEnabled = false,
  subjectLessons = [],
  reportLock = null,
  viewerActions = { call: true, month: true, lesson: false },
}: {
  data: ReportViewData;
  sample?: boolean;
  /** The founder's read-only mirror (/admin/families/.../report/...):
   * real data, zero reach into the family. No corrections, no plan or
   * call buttons, no flow CTAs, and, critically, no ReportActions
   * beacon, so a founder look never stamps her viewed receipt. */
  mirror?: boolean;
  /** "standalone" is the tokenized/emailed page with its own chrome;
   * "app" renders inside the /app frame, which already owns the nav,
   * the background, and the way back, so none of those repeat here. */
  context?: "standalone" | "app";
  /** The model-written pieces, when generated and gate-approved. */
  narrativeView?: ReportNarrativeView | null;
  /** The family's state compliance summary (render-time join, never
   * stored on the report; null renders the old one-line reassurance). */
  stateRequirements?: StateRequirementsSummary | null;
  /** The wall (plans/2026-07-11-the-wall.md): checkout URLs when this
   * family is walled, null when every door is open (the default, and
   * always the case while HOMA_WALL_ENABLED is off). */
  wall?: WallCheckout | null;
  /** The exact dark flag. False preserves the legacy subject-plan door. */
  subjectLessonsEnabled?: boolean;
  /** Current target-matching rows visible to this viewer. */
  subjectLessons?: SubjectLessonSummary[];
  /** The report lock (plans/2026-07-18-report-lock.md): when present,
   * only its freeSubjects render as full rows; every other mapped
   * subject renders held (name and answer count, no scores, no blur)
   * behind one membership offer card. null means the whole report
   * renders open, the default and always the case while
   * HOMA_REPORT_LOCK_ENABLED is off. Never passed by the sample or the
   * founder mirror. */
  reportLock?: ReportLock | null;
  /** Call, month, and owner-only lesson build permissions. Which of the
   * letter's actions THIS viewer's session can actually complete
   * (founder ruling 2026-07-14, report-page dead ends, option b): the
   * call needs a signed-in family member, the month BUILD needs a
   * resume cookie or membership, lesson build needs account ownership.
   * Suppressed buttons beat dead ones: a text-born family has neither
   * and used to get a circular device hint. Defaults keep the
   * signed-in /app route unchanged; an already-built month renders as
   * a plain tokenized link for every viewer regardless. */
  viewerActions?: { call: boolean; month: boolean; lesson: boolean };
}) {
  const report = data;
  const inApp = context === "app";
  const rejectedPieces = new Set(narrativeView?.rejectedPieces ?? []);
  /** The generated text for a piece, or null when the template must render. */
  const generatedPiece = (key: string, text: string | undefined): string | null =>
    narrativeView && text && !rejectedPieces.has(key) ? text : null;
  const noteText = generatedPiece("note", narrativeView?.narrative.note);
  const months = ageInMonths(report.birthMonth);
  const editable = !sample && !mirror;
  const staleness = reportStaleness(report.birthMonth, report.generatedAt);
  const scores = report.scores.subjects;
  const byId = new Map(scores.map((score) => [score.subjectId, score]));
  const ordered: SubjectScore[] = [
    ...report.scores.strengthOrder.map((id) => byId.get(id)).filter((s): s is SubjectScore => Boolean(s)),
    ...scores.filter((score) => score.position === "not_mapped"),
  ];
  const prior = report.history[0];
  const movements = new Map<string, Movement>();
  for (const score of scores) {
    const movement = movementFor(score, prior);
    if (movement) movements.set(score.subjectId, movement);
  }
  const subjectLessonBySubject = new Map(
    subjectLessons.map((lesson) => [lesson.subjectId, lesson]),
  );

  const answersByDomain = new Map<string, ReceiptRow[]>();
  for (const entry of report.answers) {
    const found = getMapSubject(entry.itemId.split(".")[0]);
    const subjectId = found?.id ?? entry.itemId.split(".")[0];
    const item = found?.items.find((candidate) => candidate.id === entry.itemId);
    if (!item) continue;
    const list = answersByDomain.get(subjectId) ?? [];
    list.push({
      itemId: item.id,
      statement: item.statement,
      typicalMonths: item.typicalMonths,
      answer: entry.answer,
    });
    answersByDomain.set(subjectId, list);
  }

  // The one-tap unified month, now living INSIDE the note from Homa
  // (founder ask 2026-07-08): one sentence explaining what she built,
  // one button. Before the month exists, the button's tap is the
  // explicit consent that builds it and arms the 28-day retest email.
  const monthBuilt = report.plans.some((plan) => plan.subjectId === MONTH_PLAN_SUBJECT);
  const ELECTIVES = new Set(["art", "music", "spanish", "computer_science"]);
  const monthBuildable = scores.some(
    (score) =>
      !score.exposureBased &&
      !ELECTIVES.has(score.subjectId) &&
      (score.position === "growing" || score.position === "on_track"),
  );
  // A built month is a plain tokenized link (viewable by anyone with
  // the report link, no session); only the BUILD tap needs a session,
  // so an unbuildable-for-this-viewer month offer is suppressed.
  const monthOffered =
    editable && (monthBuilt || (monthBuildable && viewerActions.month));
  /** Names the month the plan starts (the letter's plan sentence, not
   * the report's generation date: a re-opened report should still read
   * as "this month's plan"). */
  const monthName = new Date().toLocaleDateString("en-US", { month: "long" });

  // The trajectory's eras arrive precomputed (oldest first, live last,
  // re-normalized where the evidence ledger allows), so this renderer
  // never mixes measuring sticks itself.
  const eras = report.eras;

  const sourceKeys = new Set<string>();
  for (const score of scores) {
    if (score.position === "not_mapped") continue;
    const domain = getMapSubject(score.subjectId);
    domain?.items.forEach((item) => item.sources.forEach((key) => sourceKeys.add(key)));
  }
  const generatedDate = new Date(report.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const stateName = report.usState
    ? US_STATES.find((state) => state.code === report.usState)?.name
    : null;
  const nextKid = report.otherKids.find((kid) => kid.inRange && !kid.hasReport);
  const readyKids = report.otherKids.filter((kid) => kid.hasReport);

  // ---- The report's pieces, built once and arranged twice ----
  // The token page flows them as one long letter card; the in-app page
  // lays the same pieces out as dashboard cards (founder ask 2026-07-10:
  // on desktop the report reads as a dashboard, not one long scroll).
  // Spacing between pieces belongs to the layout, so each piece only
  // carries its letter-flow margin when NOT in the app grid.

  const stalenessBanner =
    editable && staleness.stale ? (
      <StalenessBanner
        childId={report.childId}
        childName={report.childName}
        staleness={staleness}
      />
    ) : null;

  const heroInner = (
    <>
      <div className="flex items-center gap-3">
        <Logo size={24} />
        <span className="font-mono text-xs uppercase tracking-widest text-strong/70">
          made for {report.childName} {"\u00b7"} {generatedDate}
        </span>
      </div>
      <h1 className="mt-5 font-display text-4xl font-bold leading-none tracking-tight text-strong sm:text-5xl">
        {report.childName}&apos;s <span style={{ color: "var(--clay-600)" }}>progress report</span>
      </h1>
      {/* No subtitle (round 2, founder ask 2026-07-09): the heading
          flowing straight into age, subjects, and benchmarks below
          is enough. */}
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-strong/70">
        <span>
          age <b className="text-strong">{ageLabel(months)}</b>
        </span>
        <span>
          subjects mapped <b className="text-strong">{report.scores.mappedCount} of {report.scores.totalSubjects}</b>
        </span>
        <span>
          your answers <b className="text-strong">{report.scores.observationCount}</b>
        </span>
        <span>
          <b className="text-strong">national</b> benchmarks
        </span>
      </div>
    </>
  );

  // Note from Homa: a personal letter, not a block of text (round 2,
  // founder ask 2026-07-09). Greeting, the note sentence, the
  // month-plan sentence, the call-me line, and the sign-off, all in
  // this one card, with the month button after the sign-off (it's the
  // letter's P.S. action, not a mid-paragraph interruption).
  const noteCard = (
    // In the app grid the note spans both columns (it rides above the
    // full-width snapshot, founder ask 2026-07-11); standalone is
    // untouched, the letter has no grid.
    <div
      className={`flex gap-4 rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-5 ${inApp ? "lg:col-span-2" : ""}`.trim()}
    >
      <div className="flex-shrink-0 pt-0.5">
        <Logo variant="mark" size={34} />
      </div>
      <div className="min-w-0 flex-1">
        {/* sage-700, not the sage-500 default: at this tiny size on the
            sage-50 card, sage-500 sits near 3.2:1, under the 4.5:1 AA
            bar (report-preview.tsx picked sage-700 for the same eyebrow). */}
        <p
          className="font-mono text-[0.65rem] uppercase tracking-widest"
          style={{ color: "var(--sage-700)" }}
        >
          A note from Homa
        </p>
        <p className="mt-2 font-serif text-lg italic text-strong">
          {noteGreeting(report.parentFirstName)}
        </p>
        <p className="mt-2 text-body">
          {noteText ?? homaNote(report.scores, report.childName)}
        </p>
        {monthOffered ? (
          <p className="mt-2 text-body">{notePlanSentence(report.childName, monthName)}</p>
        ) : null}
        {editable && viewerActions.call ? (
          <div className="mt-2">
            <CallHomaPs childId={report.childId} childName={report.childName} wall={wall} />
          </div>
        ) : null}
        {/* text-lg matches the greeting: the letter's two serif
            bookends read as one voice at one size. */}
        <p className="mt-3 font-serif text-lg italic text-strong">
          Thanks,
          <br />
          Homa
        </p>
        {monthOffered ? (
          <MonthButton
            childId={report.childId}
            childName={report.childName}
            planUrl={
              monthBuilt
                ? `/onboarding/r/${report.token}/plan/${MONTH_PLAN_SUBJECT}`
                : null
            }
            wall={wall}
          />
        ) : null}
      </div>
    </div>
  );

  // The snapshot: the interactive chart with its data-written caption.
  // Full width in the app grid (founder ask 2026-07-11: half a column
  // squeezed the trajectory chart into a squint).
  const snapshotCard = (
    <ReportSnapshot
      childName={report.childName}
      birthMonth={report.birthMonth}
      generatedDate={generatedDate}
      eras={eras}
      className={inApp ? "lg:col-span-2" : "mt-4"}
    />
  );

  const subjectsHeading = (
    <>
      <h2 className={`font-display text-xl font-semibold text-strong ${inApp ? "" : "mt-9"}`.trim()}>
        Subject by subject
      </h2>
      <p className="mt-1 text-sm text-muted">
        Open any subject to see what I asked, what you answered, and the benchmarks used.
      </p>
    </>
  );

  // The report lock's partition (plans/2026-07-18-report-lock.md).
  // Only mapped subjects ever lock: a not-mapped row has no scored
  // content to hold back, so it stays visible below the held rows.
  // An empty lockedScores (four or fewer mapped subjects) renders the
  // report fully open with no offer: walling nothing is theater.
  const lockFreeSet = reportLock ? new Set(reportLock.freeSubjects) : null;
  const lockedScores = lockFreeSet
    ? ordered.filter(
        (score) => score.position !== "not_mapped" && !lockFreeSet.has(score.subjectId),
      )
    : [];
  const lockActive = reportLock !== null && lockedScores.length > 0;
  const lockedIds = new Set(lockedScores.map((score) => score.subjectId));
  const openMapped = ordered.filter(
    (score) => score.position !== "not_mapped" && !lockedIds.has(score.subjectId),
  );
  const openNotMapped = ordered.filter((score) => score.position === "not_mapped");

  // A held subject's whole row: the name and her own answer count.
  // No badge, no months, no blurred numbers: nothing shown, nothing
  // teased (the anti-guilt law holds even for locked content, so the
  // row never implies the hidden subjects are the weak ones).
  const renderHeldRow = (score: SubjectScore) => {
    const domain = getMapSubject(score.subjectId);
    return (
      <div
        key={score.subjectId}
        className="rounded-md border border-dashed border-border-subtle px-4 py-3.5"
      >
        <p className="font-semibold text-muted">{domain?.displayName}</p>
        <p className="mt-0.5 text-sm text-subtle">
          {reportLockRowLine(domain?.displayName ?? score.subjectId, score.observations)}
        </p>
      </div>
    );
  };

  // Subject by subject: bare rows until opened (progressive
  // disclosure). Open = what the subject is, the questions and
  // answers, why it's interesting, the benchmarks, and the two
  // places to take it.
  const renderSubjectRow = (score: SubjectScore) => {
        const domain = getMapSubject(score.subjectId);
        const line = subjectLine(score, report.childName);
        const subjectText = generatedPiece(
          `subject.${score.subjectId}`,
          narrativeView?.narrative.subjects[score.subjectId],
        );
        const drawerText = generatedPiece(
          `drawer.${score.subjectId}`,
          narrativeView?.narrative.drawers[score.subjectId],
        );
        // "Why this is interesting": the model-written subject line
        // continued by its drawer piece; the reviewed template
        // sentence when the model's words aren't available.
        const whyInteresting = [subjectText ?? line.sentence, drawerText]
          .filter(Boolean)
          .join(" ");
        const subjectAnswers = answersByDomain.get(score.subjectId) ?? [];
        const movement = movements.get(score.subjectId);
        const badgeStyle = badgeStyleForPosition(score.position);
        const subjectLesson = subjectLessonBySubject.get(score.subjectId);
        const lessonLabel = subjectLesson
          ? "Open the lesson"
          : "Build the next lesson";
        const lessonUrl = subjectLesson
          ? `/onboarding/r/${report.token}/lesson/${score.subjectId}`
          : null;
        const subjectActionHeight = subjectLessonsEnabled
          ? "min-h-11"
          : "min-h-10";
        const subjectActionVariant = subjectLessonsEnabled
          ? "primary-strong"
          : score.position === "growing"
            ? "primary"
            : "secondary";
        const domainSources = Array.from(
          new Set(domain?.items.flatMap((item) => [...item.sources]) ?? []),
        );
        return (
          <details key={score.subjectId} id={`subject-${score.subjectId}`} className="group rounded-md border border-border-subtle">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
              <span
                className="flex-shrink-0 whitespace-nowrap rounded-pill px-3 py-1 text-xs font-bold"
                style={badgeStyle}
              >
                {line.badge}
              </span>
              <span className="min-w-0 flex-1 font-semibold text-strong">
                {domain?.displayName}
              </span>
              <span className="flex-shrink-0 text-right">
                {/* Speaks only when it adds information beyond the
                    badge ("+9 mo"); "at age" next to "On track" was
                    the same fact in two vocabularies. */}
                {line.numberLabel ? (
                  <span className="block font-mono text-sm text-strong">{line.numberLabel}</span>
                ) : null}
                {movement ? (
                  <span
                    className="mt-0.5 inline-block rounded-pill px-2 py-0.5 font-mono text-[0.65rem] font-bold"
                    style={
                      movement.tone === "gold"
                        ? { background: "var(--gold-100)", color: "var(--gold-ink)" }
                        : { background: "var(--accent-sage-soft)", color: "var(--sage-700)" }
                    }
                  >
                    {"\u2191"} {movement.label}
                  </span>
                ) : null}
              </span>
              <span
                aria-hidden="true"
                className="flex-shrink-0 text-subtle transition-transform duration-(--dur-fast) ease-out group-open:rotate-180"
              >
                {"\u25BE"}
              </span>
            </summary>
            <div className="border-t border-border-subtle px-5 pb-5 pt-4">
              {/* 1. What this subject is, in plain words. */}
              <p className="text-sm text-body">{domain?.whatItIs}</p>

              {/* 2. The questions, and what she answered. */}
              {subjectAnswers.length > 0 ? (
                <>
                  <p className="mt-5 font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
                    Questions I asked {"\u00b7"} your answers
                  </p>
                  <ReceiptsList
                    childId={report.childId}
                    rows={subjectAnswers}
                    editable={editable}
                  />
                </>
              ) : (
                <p className="mt-4 text-sm text-muted">
                  No answers here yet. A few would fill this subject in.
                </p>
              )}

              {/* 3. Why this is interesting: the one interpreted
                  paragraph, connecting the subject and her answers. */}
              {score.position !== "not_mapped" ? (
                <>
                  <p className="mt-5 font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
                    Why this is interesting
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm text-body">{whyInteresting}</p>
                </>
              ) : null}

              {/* 4. The benchmarks, as plain links. */}
              <p className="mt-5 font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
                Benchmarks
              </p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {domainSources.map((key) => {
                  const source = MAP_SOURCES[key];
                  if (!source) return null;
                  // The CDC link lands on the checklist page for
                  // THIS child's age (read-through: "show me the
                  // exact page"), not the index.
                  const href = key === "cdc" ? cdcChecklistUrl(months) : source.url;
                  return (
                    <li key={key} className="text-xs">
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted underline underline-offset-2 transition-colors duration-(--dur-fast) ease-out hover:text-brand"
                      >
                        {source.label}
                      </a>
                    </li>
                  );
                })}
              </ul>

              {/* 5. The two places to take it. The mirror shows both
                  inert, faithful to her screen (founder ask 2026-07-14
                  afternoon): they walk the FAMILY's flow, so only her
                  own session gets live buttons. */}
              {!score.exposureBased && score.position !== "not_mapped" ? (
                <div className="mt-6 flex flex-wrap items-center gap-2 print:hidden">
                  {mirror ? (
                    <>
                      <span
                        aria-disabled="true"
                        className={reportButtonClass(
                          subjectActionVariant,
                          `inline-flex ${subjectActionHeight} cursor-default items-center px-4 py-2 text-xs font-semibold opacity-60`,
                        )}
                      >
                        {subjectLessonsEnabled
                          ? lessonLabel
                          : "Build the 4-week plan"}
                      </span>
                      <span
                        aria-disabled="true"
                        className={reportButtonClass(
                          "secondary",
                          "inline-flex min-h-10 cursor-default items-center px-4 py-2 text-xs font-semibold opacity-60",
                        )}
                      >
                        Answer a few deeper questions
                      </span>
                      <span className="text-xs text-subtle">hers to tap</span>
                    </>
                  ) : sample ? (
                    <Link
                      href="/onboarding"
                      className={reportButtonClass(
                        subjectLessonsEnabled
                          ? "primary-strong"
                          : "primary",
                        `inline-flex ${subjectActionHeight} items-center px-4 py-2 text-xs font-semibold ${
                          subjectLessonsEnabled
                            ? "focus-visible:shadow-[var(--shadow-focus)] focus-visible:outline-none"
                            : ""
                        }`.trim(),
                      )}
                    >
                      {subjectLessonsEnabled
                        ? "Get your own report to build lessons"
                        : "Get your own report to unlock plans"}
                    </Link>
                  ) : (
                    <>
                      {subjectLessonsEnabled ? (
                        subjectLesson || viewerActions.lesson ? (
                          <SubjectLessonButton
                            childId={report.childId}
                            subjectId={score.subjectId}
                            lessonUrl={lessonUrl}
                            wall={wall}
                            emphasis="primary"
                          />
                        ) : null
                      ) : (
                        <DoorLink
                          href={`/onboarding/r/${report.token}/plan/${score.subjectId}`}
                          door="plan"
                          childId={report.childId}
                          className={reportButtonClass(
                            score.position === "growing" ? "primary" : "secondary",
                            "inline-flex min-h-10 items-center px-4 py-2 text-xs font-semibold",
                          )}
                        >
                          Build the 4-week plan
                        </DoorLink>
                      )}
                      {/* Says the action honestly: this one leaves the
                          report and asks more questions. */}
                      <Link
                        href={`/onboarding?dd=${report.childId}.${score.subjectId}`}
                        className={reportButtonClass(
                          "secondary",
                          "inline-flex min-h-10 items-center px-4 py-2 text-xs font-semibold",
                        )}
                      >
                        Answer a few deeper questions
                      </Link>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </details>
        );
  };

  const subjectRows = (
    <div className="mt-4 flex flex-col gap-2.5">
      {lockActive && reportLock ? (
        <>
          {openMapped.map(renderSubjectRow)}
          <ReportLockOffer
            childId={report.childId}
            childName={report.childName}
            mappedCount={report.scores.mappedCount}
            openCount={openMapped.length}
            lockedCount={lockedScores.length}
            checkout={reportLock.checkout}
            signinNext={
              inApp ? `/app/${report.childId}/report` : `/onboarding/r/${report.token}`
            }
          />
          {lockedScores.map(renderHeldRow)}
          {openNotMapped.map(renderSubjectRow)}
        </>
      ) : (
        ordered.map(renderSubjectRow)
      )}
    </div>
  );

  // The state card: reference data joined at render, closed by
  // default, so it can never go stale inside anyone's report.
  const stateCard = stateRequirements ? (
    <StateCard
      summary={stateRequirements}
      childName={report.childName}
      className={inApp ? "" : "mt-9"}
    />
  ) : null;

  // Methodology: closed by default, one plain paragraph, the
  // sources one more tap down (founder ask 2026-07-08).
  const methodologyCard = (
    <details className={`group rounded-lg bg-[var(--surface-sunken)] ${inApp ? "" : "mt-9"}`.trim()}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden">
        <h3 className="font-display text-base font-semibold text-strong">
          How this report is made
        </h3>
        <span
          aria-hidden="true"
          className="flex-shrink-0 text-subtle transition-transform duration-(--dur-fast) ease-out group-open:rotate-180"
        >
          {"\u25BE"}
        </span>
      </summary>
      <div className="px-5 pb-5 text-sm">
        <p className="text-muted">
          {/* Explicit join: Turbopack's SWC JSX transform strips the
              leading space of a multi-line text node right after an
              expression, which rendered "Mayadoes". */}
          Your answers describe what {report.childName}
          {" "}does day to day. Each one is checked against published national benchmarks
          for their age, the same sources schools and pediatricians use. Where you said
          &ldquo;not sure&rdquo;, the report says so instead of guessing. This is not a
          test and not medical advice, and the picture sharpens as you answer more.
        </p>
        {stateName && !stateRequirements ? (
          <p className="mt-2 text-muted">
            Homeschooling is legal in all 50 states, including {stateName}. When your
            invite to Homa opens, Homa tracks {stateName}&apos;s requirements for you.
          </p>
        ) : null}
        <details className="group/sources mt-3">
          <summary className="cursor-pointer list-none text-xs font-semibold text-strong [&::-webkit-details-marker]:hidden">
            Sources{" "}
            <span
              aria-hidden="true"
              className="inline-block transition-transform duration-(--dur-fast) ease-out group-open/sources:rotate-180"
            >
              {"\u25BE"}
            </span>
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {Array.from(sourceKeys).map((key) => {
              const source = MAP_SOURCES[key];
              if (!source) return null;
              return (
                <li key={key} className="text-xs">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted underline underline-offset-2 transition-colors duration-(--dur-fast) ease-out hover:text-brand"
                  >
                    {source.label}
                  </a>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 font-mono text-[0.6rem] text-subtle">
            checklist version {report.bankVersion}
          </p>
        </details>
      </div>
    </details>
  );

  // Sibling reports built in the same sitting. On the token URL,
  // deliberately no direct report links: this page is shareable, and
  // embedding a sibling's token would let anyone holding one kid's
  // link open the other kid's report. In-app is session-scoped, so
  // each sibling's own report page links directly.
  const siblingsCard =
    !sample && !mirror && readyKids.length > 0 ? (
      <div className={`rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-5 print:hidden ${inApp ? "" : "mt-9"}`.trim()}>
        <p className="font-display text-lg font-semibold text-strong">
          {readyKids.length === 1
            ? `${readyKids[0].name}'s report is ready too.`
            : "The other reports are ready too."}
        </p>
        {inApp ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {readyKids.map((kid) => (
              <Link
                key={kid.id}
                href={`/app/${kid.id}/report`}
                className={reportButtonClass(
                  "primary",
                  "inline-flex min-h-11 items-center px-5 py-2.5 text-sm font-semibold",
                )}
              >
                Open {kid.name}&apos;s report
              </Link>
            ))}
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-body">
              {readyKids.length === 1 ? "It's" : "They're"} in your inbox, and one tap from
              your family page.
            </p>
            <Link
              href="/onboarding"
              className={reportButtonClass(
                "primary",
                "mt-3 inline-flex min-h-11 items-center px-5 py-2.5 text-sm font-semibold",
              )}
            >
              {readyKids.length === 1 ? `Open ${readyKids[0].name}'s report` : "Open the reports"}
            </Link>
          </>
        )}
      </div>
    ) : null;

  // Next kid handoff.
  const nextKidCard =
    !sample && !mirror && nextKid ? (
      <div className={`rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-5 print:hidden ${inApp ? "" : "mt-9"}`.trim()}>
        <p className="font-display text-lg font-semibold text-strong">
          {nextKid.name} is next.
        </p>
        <p className="mt-1 text-sm text-body">
          Same questionnaire, tuned to {nextKid.name}&apos;s age. About five minutes.
        </p>
        <Link
          href={`/onboarding?start=${nextKid.id}`}
          className={reportButtonClass(
            "primary",
            "mt-3 inline-flex min-h-11 items-center px-5 py-2.5 text-sm font-semibold",
          )}
        >
          Map {nextKid.name} next
        </Link>
      </div>
    ) : null;

  const footerContent = (
    <>
      <span>Made with Homa for {report.childName}</span>
      {/* ReportActions carries the report-viewed beacon; the mirror
          must never fire it (a founder look is not her look). */}
      {!sample && !mirror ? (
        <ReportActions
          childName={report.childName}
          token={report.token}
        />
      ) : sample ? (
        <Link href="/onboarding" className="text-brand underline-offset-2 hover:underline">
          Get your own
        </Link>
      ) : null}
    </>
  );

  // ---- In-app: the same pieces as a dashboard (founder ask
  // 2026-07-10: cards across the screen on desktop, not one long
  // letter). Single column on phones, two columns from lg; the note,
  // snapshot, and subjects lead as full-width rows (founder ask
  // 2026-07-11), the support cards pair up below. Width and padding
  // mirror PageColumn so the report sits like every other app page.
  if (inApp) {
    return (
      <div className="px-5 py-7 pb-16 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-[1040px]">
          {stalenessBanner}

          {/* Hero: the report's header band as its own card. */}
          <div
            style={{ background: "var(--band-sky)" }}
            className="overflow-hidden rounded-[28px] border border-border px-7 pb-7 pt-8 shadow-sm sm:px-10"
          >
            {heroInner}
          </div>

          <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
            {noteCard}
            {snapshotCard}

            <section className="rounded-lg border border-border-subtle bg-card p-5 shadow-sm lg:col-span-2">
              {subjectsHeading}
              {subjectRows}
            </section>

            {stateCard}
            {methodologyCard}
            {siblingsCard}
            {nextKidCard}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle bg-card px-5 py-4 text-sm text-subtle lg:col-span-2">
              {footerContent}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Standalone: the token page's one long letter card, exactly as
  // it prints and shares.
  return (
    <div className="min-h-screen bg-page pb-16">
      {/* The way out (founder ask 2026-07-08: the report page had no
          path to the app or settings). The sample keeps its own CTAs;
          the mirror sits inside the admin frame, which owns the way
          back. */}
      {!sample && !mirror ? <ReportNav /> : null}

      <main className="mx-auto w-full max-w-2xl px-4 pt-6">
        {sample ? (
          <p className="mb-4 rounded-md px-4 py-3 text-sm font-semibold" style={{ background: "var(--gold-100)", color: "var(--gold-ink)" }}>
            Sample report. Maya is a demonstration child; every number below is example data.{" "}
            <Link href="/onboarding" className="underline">Get your own child&apos;s report</Link>, free, in
            about five minutes.
          </p>
        ) : null}

        {/* The self-renewing report: staleness is derived at render (birth
            date + generation time + the bank), never stored, so the
            permanent URL always knows how much the child has grown. */}
        {stalenessBanner}

        <div className="overflow-hidden rounded-[28px] border border-border bg-card shadow-lg print:border-0 print:shadow-none">
          {/* Header band */}
          <div style={{ background: "var(--band-sky)" }} className="px-7 pb-7 pt-8 sm:px-10">
            {heroInner}
          </div>

          <div className="px-7 py-7 sm:px-10">
            {noteCard}
            {snapshotCard}

            {/* The snapshot flows straight into subject by subject: the
                whole-picture dot chart retired 2026-07-10 (founder ask;
                the snapshot's trajectory chart and the subject rows
                already carry the same picture). */}
            {subjectsHeading}
            {subjectRows}

            {/* After subject by subject, straight into the state card and
                methodology (round 2, founder ask 2026-07-09: every subject
                card's own next step carries the "what now" job). */}
            {stateCard}
            {methodologyCard}
            {siblingsCard}
            {nextKidCard}

            {/* CTA band: the token page's door into the app; the in-app
                dashboard renders none (the frame is already home), and
                the mirror renders none (both doors are hers). */}
            {!mirror ? (
              <div className="mt-9 rounded-lg p-6 print:hidden" style={{ background: "var(--surface-inverse)" }}>
                <h3 className="font-display text-2xl font-bold" style={{ color: "#fff" }}>
                  This report is where {report.childName} starts, not where {report.childName} stays.
                </h3>
                <p className="mt-2 max-w-lg" style={{ color: "var(--stone-300)" }}>
                  Homa builds a plan for whatever is growing, makes materials for exactly those
                  skills, and re-draws this report as {report.childName} grows, so you watch the
                  numbers move.
                </p>
                {sample ? (
                  <>
                    <Link
                      href="/onboarding"
                      className={reportButtonClass(
                        "primary",
                        "mt-4 inline-flex items-center px-5 py-2.5 text-sm font-bold",
                      )}
                    >
                      Start your free trial
                    </Link>
                    <p className="mt-3 text-xs" style={{ color: "var(--stone-400)" }}>
                      Five minutes of questions, benchmarked against national standards. 30 free
                      days, then $19 a month.
                    </p>
                  </>
                ) : (
                  // This report lives in the app now (founder ask
                  // 2026-07-10): the token page's job ends at the door.
                  <Link
                    href={`/app/${report.childId}/report`}
                    className={reportButtonClass(
                      "primary",
                      "mt-4 inline-flex items-center px-5 py-2.5 text-sm font-bold",
                    )}
                  >
                    Open this report in Homa
                  </Link>
                )}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-7 py-4 text-sm text-subtle sm:px-10">
            {footerContent}
          </div>
        </div>

        {!mirror ? (
          <p className="mt-4 text-center text-sm text-subtle print:hidden">
            {sample ? (
              <Link href="/onboarding" className="text-brand underline-offset-2 hover:underline">
                back to your family
              </Link>
            ) : (
              <Link
                href={`/app/${report.childId}/report`}
                className="text-brand underline-offset-2 hover:underline"
              >
                open this report in Homa
              </Link>
            )}
          </p>
        ) : null}
      </main>
    </div>
  );
}
