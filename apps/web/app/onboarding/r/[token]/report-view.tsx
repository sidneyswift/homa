import Link from "next/link";

import {
  ageInMonths,
  ageLabel,
  domainLine,
  getMapDomain,
  homaNote,
  MAP_SOURCES,
  MONTH_PLAN_DOMAIN,
  cdcChecklistUrl,
  noteGreeting,
  notePlanSentence,
  reportStaleness,
  US_STATES,
  type DomainScore,
  type MapAnswer,
  type MapScores,
  type ReportNarrative,
} from "@homa/core";

import type { StateRequirementsSummary } from "../../../../lib/map/state-requirements";
import { Logo } from "../../../../components/brand/Logo";
import { CallHomaPs } from "./call-homa-ps";
import type { GrowthEra } from "./growth-story";
import { MonthButton } from "./month-button";
import { ReceiptsList, type ReceiptRow } from "./receipts-list";
import { ReportActions } from "./report-actions";
import { reportButtonClass } from "./report-button";
import { ReportChart } from "./report-chart";
import { ReportNav } from "./report-nav";
import { ReportSnapshot } from "./report-snapshot";
import { StalenessBanner } from "./staleness-banner";
import { StateCard } from "./state-card";

/**
 * The progress report renderer, shared by the live tokenized page and the
 * public sample. Built around progressive disclosure (founder pass
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
  otherKids: { id: string; name: string; inRange: boolean; hasReport: boolean }[];
  /** Built months and their synced check-off counts (empty on sample). */
  plans: { domainId: string; done: number; total: number; retestAt: string }[];
  /** The family's linked texting/calling number, if any (null on the
   * sample page, which carries no real family). */
  familyPhone: string | null;
}

const POSITION_RANK: Record<DomainScore["position"], number> = {
  not_mapped: 0,
  growing: 1,
  on_track: 2,
  ahead: 3,
};

interface Movement {
  /** "+4 mo since Jun 6" (gold) or "moved up since Jun 6" (sage). */
  label: string;
  tone: "gold" | "sage";
}

function movementFor(
  current: DomainScore,
  prior: { scores: MapScores; generated_at: string } | undefined,
): Movement | null {
  if (!prior || current.exposureBased) return null;
  const previous = prior.scores.domains.find((entry) => entry.domainId === current.domainId);
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
  narrativeView = null,
  stateRequirements = null,
}: {
  data: ReportViewData;
  sample?: boolean;
  /** The model-written pieces, when generated and gate-approved. */
  narrativeView?: ReportNarrativeView | null;
  /** The family's state compliance summary (render-time join, never
   * stored on the report; null renders the old one-line reassurance). */
  stateRequirements?: StateRequirementsSummary | null;
}) {
  const report = data;
  const rejectedPieces = new Set(narrativeView?.rejectedPieces ?? []);
  /** The generated text for a piece, or null when the template must render. */
  const generatedPiece = (key: string, text: string | undefined): string | null =>
    narrativeView && text && !rejectedPieces.has(key) ? text : null;
  const noteText = generatedPiece("note", narrativeView?.narrative.note);
  const months = ageInMonths(report.birthMonth);
  const editable = !sample;
  const staleness = reportStaleness(report.birthMonth, report.generatedAt);
  const scores = report.scores.domains;
  const byId = new Map(scores.map((score) => [score.domainId, score]));
  const ordered: DomainScore[] = [
    ...report.scores.strengthOrder.map((id) => byId.get(id)).filter((s): s is DomainScore => Boolean(s)),
    ...scores.filter((score) => score.position === "not_mapped"),
  ];
  const prior = report.history[0];
  const movements = new Map<string, Movement>();
  for (const score of scores) {
    const movement = movementFor(score, prior);
    if (movement) movements.set(score.domainId, movement);
  }
  const anyMovement = movements.size > 0;

  const answersByDomain = new Map<string, ReceiptRow[]>();
  for (const entry of report.answers) {
    const found = getMapDomain(entry.itemId.split(".")[0]);
    const domainId = found?.id ?? entry.itemId.split(".")[0];
    const item = found?.items.find((candidate) => candidate.id === entry.itemId);
    if (!item) continue;
    const list = answersByDomain.get(domainId) ?? [];
    list.push({
      itemId: item.id,
      statement: item.statement,
      typicalMonths: item.typicalMonths,
      answer: entry.answer,
    });
    answersByDomain.set(domainId, list);
  }

  // The one-tap unified month, now living INSIDE the note from Homa
  // (founder ask 2026-07-08): one sentence explaining what she built,
  // one button. Before the month exists, the button's tap is the
  // explicit consent that builds it and arms the 28-day retest email.
  const monthBuilt = report.plans.some((plan) => plan.domainId === MONTH_PLAN_DOMAIN);
  const ELECTIVES = new Set(["art", "music", "spanish", "computer_science"]);
  const monthBuildable = scores.some(
    (score) =>
      !score.exposureBased &&
      !ELECTIVES.has(score.domainId) &&
      (score.position === "growing" || score.position === "on_track"),
  );
  const monthOffered = editable && (monthBuilt || monthBuildable);
  /** Names the month the plan starts (the letter's plan sentence, not
   * the report's generation date: a re-opened report should still read
   * as "this month's plan"). */
  const monthName = new Date().toLocaleDateString("en-US", { month: "long" });

  // The growth story reads the whole archive, oldest chapter first, the
  // live report as the closing chapter.
  const eras: GrowthEra[] = [
    ...[...report.history]
      .reverse()
      .map((entry) => ({
        generated_at: entry.generated_at,
        scores: entry.scores,
        narrative: entry.narrative ?? null,
      })),
    {
      generated_at: report.generatedAt,
      scores: report.scores,
      narrative: narrativeView?.narrative ?? null,
    },
  ];

  const sourceKeys = new Set<string>();
  for (const score of scores) {
    if (score.position === "not_mapped") continue;
    const domain = getMapDomain(score.domainId);
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

  return (
    <div className="min-h-screen bg-page pb-16">
      {/* The way out (founder ask 2026-07-08: the report page had no
          path to the dashboard or settings). Sample keeps its own CTAs. */}
      {!sample ? <ReportNav /> : null}

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
        {editable && staleness.stale ? (
          <StalenessBanner
            childId={report.childId}
            childName={report.childName}
            staleness={staleness}
          />
        ) : null}

        <div className="overflow-hidden rounded-[28px] border border-border bg-card shadow-lg print:border-0 print:shadow-none">
          {/* Header band */}
          <div style={{ background: "var(--band-sky)" }} className="px-7 pb-7 pt-8 sm:px-10">
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
                subjects mapped <b className="text-strong">{report.scores.mappedCount} of {report.scores.totalDomains}</b>
              </span>
              <span>
                your answers <b className="text-strong">{report.scores.observationCount}</b>
              </span>
              <span>
                <b className="text-strong">national</b> benchmarks
              </span>
            </div>
          </div>

          <div className="px-7 py-7 sm:px-10">
            {/* Note from Homa: a personal letter, not a block of text
                (round 2, founder ask 2026-07-09). Greeting, the note
                sentence, the month she built from it, the call-me line,
                and a sign-off, all in this one card. */}
            <div className="flex gap-4 rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-5">
              <div className="flex-shrink-0 pt-0.5">
                <Logo variant="mark" size={34} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[0.65rem] uppercase tracking-widest text-sage">
                  A note from Homa
                </p>
                <p className="mt-2 font-serif text-lg italic text-strong">
                  {noteGreeting(report.parentFirstName)}
                </p>
                <p className="mt-2 text-body">
                  {noteText ?? homaNote(report.scores, report.childName)}
                </p>
                {monthOffered ? (
                  <>
                    <p className="mt-2 text-body">{notePlanSentence(report.childName, monthName)}</p>
                    <MonthButton
                      childId={report.childId}
                      childName={report.childName}
                      planUrl={
                        monthBuilt
                          ? `/onboarding/r/${report.token}/plan/${MONTH_PLAN_DOMAIN}`
                          : null
                      }
                    />
                  </>
                ) : null}
                {editable ? (
                  <div className="mt-2">
                    <CallHomaPs childId={report.childId} childName={report.childName} />
                  </div>
                ) : null}
                <p className="mt-3 font-serif italic text-strong">
                  Thanks,
                  <br />
                  Homa
                </p>
              </div>
            </div>

            {/* The snapshot: one chart, one sentence, tap to enlarge. */}
            <ReportSnapshot
              childName={report.childName}
              generatedDate={generatedDate}
              plans={report.plans}
              eras={eras}
            />

            {/* The whole picture, flowing straight into subject by subject
                (round 2, founder ask 2026-07-09: nothing between them). */}
            <h2 className="mt-9 font-display text-xl font-semibold text-strong">The whole picture</h2>
            <p className="mt-1 text-sm text-muted">
              One dot per subject. The line marks typical for {ageLabel(months)}. Yellow is ahead,
              green is on track, blue is growing right now.
              {anyMovement ? " Faded rings show where things stood last time." : ""}
            </p>
            <div className="mt-4 rounded-lg border border-border-subtle bg-card p-4">
              <ReportChart scores={ordered} prior={prior?.scores.domains ?? null} />
            </div>

            {/* Subject by subject: bare rows until opened (progressive
                disclosure). Open = what the subject is, the questions and
                answers, why it's interesting, the benchmarks, and the two
                places to take it. */}
            <h2 className="mt-9 font-display text-xl font-semibold text-strong">Subject by subject</h2>
            <p className="mt-1 text-sm text-muted">
              Open any subject to see what I asked, what you answered, and the benchmarks used.
            </p>
            <div className="mt-4 flex flex-col gap-2.5">
              {ordered.map((score) => {
                const domain = getMapDomain(score.domainId);
                const line = domainLine(score, report.childName);
                const subjectText = generatedPiece(
                  `subject.${score.domainId}`,
                  narrativeView?.narrative.subjects[score.domainId],
                );
                const drawerText = generatedPiece(
                  `drawer.${score.domainId}`,
                  narrativeView?.narrative.drawers[score.domainId],
                );
                // "Why this is interesting": the model-written subject line
                // continued by its drawer piece; the reviewed template
                // sentence when the model's words aren't available.
                const whyInteresting = [subjectText ?? line.sentence, drawerText]
                  .filter(Boolean)
                  .join(" ");
                const domainAnswers = answersByDomain.get(score.domainId) ?? [];
                const movement = movements.get(score.domainId);
                const badgeStyle =
                  score.position === "ahead"
                    ? { background: "var(--gold-100)", color: "var(--gold-ink)" }
                    : score.position === "on_track"
                      ? { background: "var(--accent-sage-soft)", color: "var(--sage-700)" }
                      : score.position === "growing"
                        ? { background: "var(--info-soft)", color: "var(--sky-600)" }
                        : { background: "var(--surface-sunken)", color: "var(--text-muted)" };
                const domainSources = Array.from(
                  new Set(domain?.items.flatMap((item) => [...item.sources]) ?? []),
                );
                return (
                  <details key={score.domainId} id={`subject-${score.domainId}`} className="group rounded-md border border-border-subtle">
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
                      {domainAnswers.length > 0 ? (
                        <>
                          <p className="mt-5 font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
                            Questions I asked {"\u00b7"} your answers
                          </p>
                          <ReceiptsList
                            childId={report.childId}
                            rows={domainAnswers}
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

                      {/* 5. The two places to take it. */}
                      {!score.exposureBased && score.position !== "not_mapped" ? (
                        <div className="mt-6 flex flex-wrap gap-2 print:hidden">
                          {sample ? (
                            <Link
                              href="/onboarding"
                              className={reportButtonClass(
                                "primary",
                                "inline-flex min-h-10 items-center px-4 py-2 text-xs font-semibold",
                              )}
                            >
                              Get your own report to unlock plans
                            </Link>
                          ) : (
                            <>
                              {/* Emphasis follows position: the 4-week plan is
                                  THE move on a growing subject, so only there
                                  does it get the solid clay primary. */}
                              <Link
                                href={`/onboarding/r/${report.token}/plan/${score.domainId}`}
                                className={reportButtonClass(
                                  score.position === "growing" ? "primary" : "secondary",
                                  "inline-flex min-h-10 items-center px-4 py-2 text-xs font-semibold",
                                )}
                              >
                                Build the 4-week plan
                              </Link>
                              {/* Says the action honestly: this one leaves the
                                  report and asks more questions. */}
                              <Link
                                href={`/onboarding?dd=${report.childId}.${score.domainId}`}
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
              })}
            </div>

            {/* After subject by subject, straight into the state card and
                methodology (round 2, founder ask 2026-07-09: "Things to
                try" and the memory-box letter removed; every subject
                card's own next step already carries that job). The
                state card: reference data joined at render, closed by
                default, so it can never go stale inside anyone's report. */}
            {stateRequirements ? (
              <StateCard summary={stateRequirements} childName={report.childName} />
            ) : null}

            {/* Methodology: closed by default, one plain paragraph, the
                sources one more tap down (founder ask 2026-07-08). */}
            <details className="group mt-9 rounded-lg bg-[var(--surface-sunken)]">
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

            {/* Sibling reports built in the same sitting. Deliberately no
                direct report links here: this page is a shareable token
                URL, and embedding a sibling's token would let anyone
                holding one kid's link open the other kid's report. The
                family page is session-scoped, so only the parent's own
                browser lands on the reports. */}
            {!sample && readyKids.length > 0 ? (
              <div className="mt-9 rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-5 print:hidden">
                <p className="font-display text-lg font-semibold text-strong">
                  {readyKids.length === 1
                    ? `${readyKids[0].name}'s report is ready too.`
                    : "The other reports are ready too."}
                </p>
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
              </div>
            ) : null}

            {/* Next kid handoff */}
            {!sample && nextKid ? (
              <div className="mt-9 rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-5 print:hidden">
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
            ) : null}

            {/* CTA band */}
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
                    Get your child&apos;s free report
                  </Link>
                  <p className="mt-3 text-xs" style={{ color: "var(--stone-400)" }}>
                    Five minutes of questions, benchmarked against national standards.
                  </p>
                </>
              ) : (
                // The founder-expected landing after results (2026-07-08):
                // the family dashboard, where the kids, chat, and settings
                // live from here on.
                <Link
                  href="/app"
                  className={reportButtonClass(
                    "primary",
                    "mt-4 inline-flex items-center px-5 py-2.5 text-sm font-bold",
                  )}
                >
                  Go to your family dashboard
                </Link>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-7 py-4 text-sm text-subtle sm:px-10">
            <span>Made with Homa for {report.childName}</span>
            {!sample ? (
              <ReportActions
                familyId={report.familyId}
                childId={report.childId}
                childName={report.childName}
                token={report.token}
              />
            ) : (
              <Link href="/onboarding" className="text-brand underline-offset-2 hover:underline">
                Get your own
              </Link>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-subtle print:hidden">
          {sample ? (
            <Link href="/onboarding" className="text-brand underline-offset-2 hover:underline">
              back to your family
            </Link>
          ) : (
            <Link href="/app" className="text-brand underline-offset-2 hover:underline">
              go to your family dashboard
            </Link>
          )}
        </p>
      </main>
    </div>
  );
}
