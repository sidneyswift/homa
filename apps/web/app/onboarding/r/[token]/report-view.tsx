import Link from "next/link";

import {
  ageInMonths,
  ageLabel,
  domainLine,
  getMapDomain,
  growingActivityFor,
  homaNote,
  ladderRungs,
  MAP_SOURCES,
  nextDeepDiveItem,
  reportStaleness,
  reportSubtitle,
  tryHeading,
  US_STATES,
  type DomainScore,
  type MapAnswer,
  type MapScores,
  type ReportNarrative,
} from "@homa/core";

import type { StateRequirementsSummary } from "../../../../lib/map/state-requirements";
import { Logo } from "../../../../components/brand/Logo";
import { ConsentCard } from "./consent-card";
import { GrowthStory, type GrowthEra } from "./growth-story";
import { HomeschoolContextCard } from "./homeschool-context-card";
import { ReceiptsList, type ReceiptRow } from "./receipts-list";
import { ReportActions } from "./report-actions";
import { ReportChart } from "./report-chart";
import { SharpenInline } from "./sharpen-inline";
import { StalenessBanner } from "./staleness-banner";
import { StateCard } from "./state-card";
import { WhatsWorkingForm } from "./whats-working-form";

/**
 * The progress report renderer, shared by the live tokenized page and the
 * public sample. Strengths first, always; growing subjects arrive with a
 * named next step and an activity; every subject card expands to show what
 * was asked, what she answered, and the benchmarks behind it. Movement
 * chips show dated, POSITIVE change only (anti-guilt law: a drop renders
 * as a quiet re-check note, never a down-arrow). No red, no "behind".
 *
 * With a narrativeView (D8 overturn), the model-written pieces render in
 * place of the template sentences, per piece: a gate-rejected piece falls
 * back to its template line while the rest of the narrative stands. Every
 * number, badge, chart point, and citation stays computed, either way.
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
  askHomeschool = false,
  narrativeView = null,
  stateRequirements = null,
}: {
  data: ReportViewData;
  sample?: boolean;
  /** Shows the relocated "About your homeschool" card (once, until the
   * family context bag has anything in it; the server page decides). */
  askHomeschool?: boolean;
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
  const synthesisText = generatedPiece("synthesis", narrativeView?.narrative.synthesis);
  const keepsakeText = generatedPiece("keepsake", narrativeView?.narrative.keepsake);
  const months = ageInMonths(report.birthMonth);
  const editable = !sample;
  const staleness = reportStaleness(report.birthMonth, report.generatedAt);
  const scores = report.scores.domains;
  const byId = new Map(scores.map((score) => [score.domainId, score]));
  const ordered: DomainScore[] = [
    ...report.scores.strengthOrder.map((id) => byId.get(id)).filter((s): s is DomainScore => Boolean(s)),
    ...scores.filter((score) => score.position === "not_mapped"),
  ];
  const strengths = ordered
    .filter((score) => score.position === "ahead" && !score.exposureBased)
    .slice(0, 3);
  const growing = scores.filter((score) => score.position === "growing" && !score.exposureBased);
  const trySection = tryHeading(growing.length);

  const prior = report.history[0];
  const movements = new Map<string, Movement>();
  for (const score of scores) {
    const movement = movementFor(score, prior);
    if (movement) movements.set(score.domainId, movement);
  }
  const anyMovement = movements.size > 0;
  const recheckedNote =
    prior && !anyMovement
      ? `Re-checked ${new Date(report.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}. Holding steady is normal; these are long skills.`
      : null;

  const answersByDomain = new Map<string, ReceiptRow[]>();
  const answersLookup: Record<string, MapAnswer> = {};
  for (const entry of report.answers) {
    const found = getMapDomain(entry.itemId.split(".")[0]);
    const domainId = found?.id ?? entry.itemId.split(".")[0];
    const item = found?.items.find((candidate) => candidate.id === entry.itemId);
    if (!item) continue;
    answersLookup[entry.itemId] = entry.answer;
    const list = answersByDomain.get(domainId) ?? [];
    list.push({
      itemId: item.id,
      statement: item.statement,
      typicalMonths: item.typicalMonths,
      typicalRangeMonths: item.typicalRangeMonths ? [...item.typicalRangeMonths] : null,
      answer: entry.answer,
    });
    answersByDomain.set(domainId, list);
  }

  // The living record's month memory and the one-tap month offer.
  const planByDomain = new Map(report.plans.map((plan) => [plan.domainId, plan]));
  const practice = report.plans.filter((plan) => plan.done > 0);
  const consentCandidate = (() => {
    if (!editable) return null;
    const growingIds = report.scores.strengthOrder
      .map((id) => byId.get(id))
      .filter(
        (score): score is DomainScore =>
          Boolean(score) && score!.position === "growing" && !score!.exposureBased,
      )
      .filter((score) => !planByDomain.has(score.domainId));
    const withFrontier = growingIds.find((score) => score.frontierStatement);
    const pick = withFrontier ?? growingIds[0];
    if (!pick) return null;
    const domain = getMapDomain(pick.domainId);
    return domain ? { domainId: pick.domainId, subjectName: domain.displayName } : null;
  })();

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
            <p className="mt-2 font-serif text-lg italic text-strong/75">{reportSubtitle(months)}</p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-strong/70">
              <span>
                age <b className="text-strong">{ageLabel(months)}</b>
              </span>
              <span>
                subjects mapped <b className="text-strong">{report.scores.mappedCount} of {report.scores.totalDomains}</b>
              </span>
              <span>
                your observations <b className="text-strong">{report.scores.observationCount}</b>
              </span>
              <span>
                benchmarks <b className="text-strong">national</b>
              </span>
            </div>
          </div>

          <div className="px-7 py-7 sm:px-10">
            {/* Note from Homa */}
            <div className="flex gap-4 rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-5">
              <div className="flex-shrink-0 pt-0.5">
                <Logo variant="mark" size={34} />
              </div>
              <div>
                <p className="font-mono text-[0.65rem] uppercase tracking-widest text-sage">
                  A note from Homa
                </p>
                {noteText ? (
                  <p className="mt-1 whitespace-pre-line text-body">{noteText}</p>
                ) : (
                  <>
                    <p className="mt-1 text-body">
                      {homaNote(report.scores, report.childName, report.parentFirstName ?? undefined)}
                    </p>
                    {anyMovement ? (
                      <p className="mt-2 text-body">
                        And the part worth circling: {movements.size}{" "}
                        {movements.size === 1 ? "subject" : "subjects"} moved since last time. Your work
                        is showing up in the numbers.
                      </p>
                    ) : null}
                    {recheckedNote ? <p className="mt-2 text-sm text-muted">{recheckedNote}</p> : null}
                  </>
                )}
                {/* The month's memory: her own synced check-offs, counted by
                    code, positive-only (unchecked boxes say nothing). */}
                {practice.length > 0 ? (
                  <p className="mt-2 font-hand text-xl text-sage">
                    {practice
                      .map(
                        (plan) =>
                          `${plan.done} of ${plan.total} ${(getMapDomain(plan.domainId)?.displayName ?? plan.domainId).toLowerCase()} plan activities done`,
                      )
                      .join(" \u00b7 ")}{" "}
                    {"\u270e"}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Strengths first */}
            {strengths.length > 0 ? (
              <>
                <h2 className="mt-9 font-display text-xl font-semibold text-strong">
                  {report.childName}&apos;s strengths, first
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Where {report.childName} is ahead of what&apos;s typical for {ageLabel(months)}.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {strengths.map((score) => {
                    const domain = getMapDomain(score.domainId);
                    const line = domainLine(score, report.childName);
                    const movement = movements.get(score.domainId);
                    return (
                      <div key={score.domainId} className="rounded-lg p-4" style={{ background: "var(--gold-100)" }}>
                        <p className="font-semibold" style={{ color: "var(--gold-ink-strong)" }}>
                          {domain?.displayName} <span aria-hidden="true">{"\u2605"}</span>
                        </p>
                        <p className="mt-1 font-mono text-2xl" style={{ color: "var(--gold-ink)" }}>
                          +{score.monthsAhead}
                          <span className="text-sm"> mo ahead</span>
                        </p>
                        {movement ? (
                          <p className="mt-0.5 font-mono text-xs font-bold" style={{ color: "var(--gold-ink)" }}>
                            {"\u2191"} {movement.label}
                          </p>
                        ) : null}
                        {score.strongestObservedStatement ? (
                          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--gold-ink)" }}>
                            You&apos;ve seen it: {score.strongestObservedStatement.charAt(0).toLowerCase()}{score.strongestObservedStatement.slice(1)}.
                          </p>
                        ) : (
                          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--gold-ink)" }}>
                            {line.sentence}
                          </p>
                        )}
                        {!sample ? (
                          <WhatsWorkingForm
                            childId={report.childId}
                            domainId={score.domainId}
                            subjectName={domain?.displayName ?? score.domainId}
                            childName={report.childName}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}

            {/* The whole picture */}
            <h2 className="mt-9 font-display text-xl font-semibold text-strong">The whole picture</h2>
            <p className="mt-1 text-sm text-muted">
              One dot per subject. The line marks typical for {ageLabel(months)}. Yellow is ahead,
              green is on track, blue is growing right now.
              {anyMovement ? " Faded rings show where things stood last time." : ""}
            </p>
            <div className="mt-4 rounded-lg border border-border-subtle bg-card p-4">
              <ReportChart scores={ordered} prior={prior?.scores.domains ?? null} />
            </div>

            {/* The model-written cross-subject story (D8 overturn): the one
                place interpretation is wanted. Renders only when generated
                and gate-approved; there is no template equivalent. */}
            {synthesisText ? (
              <div className="mt-4 rounded-lg border border-border-subtle bg-[var(--surface-sunken)] p-5">
                <p className="whitespace-pre-line text-body">{synthesisText}</p>
              </div>
            ) : null}

            {/* Subject by subject */}
            <h2 className="mt-9 font-display text-xl font-semibold text-strong">Subject by subject</h2>
            <p className="mt-1 text-sm text-muted">
              Open any subject to see what I asked, what you answered, and the benchmarks behind it.
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
                const activity = domain ? growingActivityFor(domain, months) : null;
                // The sharpness meter: honest instrument quality per
                // subject, with the single highest-information question
                // inline when one clear look is all we have.
                const thinLook =
                  score.position !== "not_mapped" && !score.highConfidence && score.observations > 0;
                const probe =
                  editable && thinLook
                    ? nextDeepDiveItem(score.domainId, months, answersLookup, 0)
                    : null;
                // The subject's ladder, drawn as the lit path her answers
                // already traced (plus the one rung ahead).
                const rungs =
                  score.position !== "not_mapped"
                    ? ladderRungs(score.domainId, months, answersLookup)
                    : [];
                return (
                  <details key={score.domainId} id={`subject-${score.domainId}`} className="group rounded-md border border-border-subtle">
                    <summary className="flex cursor-pointer list-none items-start gap-3 p-4 [&::-webkit-details-marker]:hidden">
                      <span
                        className="mt-0.5 flex-shrink-0 whitespace-nowrap rounded-pill px-3 py-1 text-xs font-bold"
                        style={badgeStyle}
                      >
                        {line.badge}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-strong">{domain?.displayName}</span>
                        <span className="mt-0.5 block text-sm text-muted">{subjectText ?? line.sentence}</span>
                        <span className="mt-1 block text-xs font-medium text-brand group-open:hidden">
                          see the questions and benchmarks {"\u2193"}
                        </span>
                        <span className="mt-1 hidden text-xs font-medium text-brand group-open:block">
                          hide {"\u2191"}
                        </span>
                      </span>
                      <span className="flex-shrink-0 pt-0.5 text-right">
                        {/* Speaks only when it adds information beyond the
                            badge ("+9 mo"); "at age" next to "On track" was
                            the same fact in two vocabularies. */}
                        {line.numberLabel ? (
                          <span className="block font-mono text-sm text-strong">{line.numberLabel}</span>
                        ) : null}
                        {movement ? (
                          <span
                            className="mt-1 inline-block rounded-pill px-2 py-0.5 font-mono text-[0.65rem] font-bold"
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
                    </summary>
                    {/* The receipts drawer, rebuilt for top-down reading
                        (founder call 2026-07-06: "hard to read, bad eye
                        tracking, I would rather it expand longer and give
                        room, explain more"). The old layout put the question
                        far left and the answer far right with nothing
                        connecting them; now each answer is its own soft
                        block that reads like a sentence, and every zone
                        opens with a one-line plain-language explainer. */}
                    <div className="border-t border-border-subtle px-5 pb-5 pt-4">
                      {score.position !== "not_mapped" ? (
                        <p className="mb-2 font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
                          {score.highConfidence
                            ? `well observed \u00b7 ${score.observations} answers`
                            : "one clear look so far"}
                        </p>
                      ) : null}
                      {drawerText ? (
                        <p className="mb-4 whitespace-pre-line text-sm text-body">{drawerText}</p>
                      ) : null}
                      {probe ? (
                        <SharpenInline
                          childId={report.childId}
                          statement={probe.statement}
                          itemId={probe.id}
                        />
                      ) : null}
                      {rungs.length >= 2 ? (
                        <div className="mb-4 mt-3">
                          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
                            The path so far
                          </p>
                          <ul className="mt-2 flex flex-col gap-1">
                            {rungs.map((rung) => (
                              <li key={rung.itemId} className="flex items-start gap-2.5 text-xs">
                                <span
                                  aria-hidden="true"
                                  className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold"
                                  style={
                                    rung.state === "confirmed"
                                      ? { background: "var(--gold-100)", color: "var(--gold-ink)" }
                                      : rung.state === "emerging"
                                        ? { background: "var(--accent-sage-soft)", color: "var(--sage-700)" }
                                        : { background: "var(--info-soft)", color: "var(--sky-600)" }
                                  }
                                >
                                  {rung.state === "confirmed" ? "\u2713" : rung.state === "emerging" ? "\u007e" : "\u2192"}
                                </span>
                                <span className={rung.state === "next_up" ? "text-strong" : "text-muted"}>
                                  {rung.statement}
                                  <span className="ml-1 font-mono text-[0.6rem] text-subtle">
                                    {rung.state === "next_up"
                                      ? `next up \u00b7 typical by ${ageLabel(rung.typicalMonths)}`
                                      : `typical by ${ageLabel(rung.typicalMonths)}`}
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {domainAnswers.length > 0 ? (
                        <>
                          <p className="font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
                            What I asked {"\u00b7"} your answers
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            Each question, your answer, and where the national benchmark sits next
                            to {report.childName}&apos;s age today.
                            {editable ? " Something changed? Tap change and save; the report rescores around it." : ""}
                          </p>
                          <ReceiptsList
                            childId={report.childId}
                            childName={report.childName}
                            ageMonths={months}
                            rows={domainAnswers}
                            editable={editable}
                          />
                        </>
                      ) : (
                        <p className="text-sm text-muted">
                          No answers here yet. A few would fill this subject in.
                        </p>
                      )}

                      {score.position === "growing" && activity ? (
                        <div className="mt-5 rounded-md p-4" style={{ background: "var(--info-soft)" }}>
                          <p className="text-sm font-semibold text-strong">{activity.title}</p>
                          <p className="mt-0.5 text-sm text-body">{activity.description}</p>
                          <p className="mt-2 text-xs text-muted">
                            This is the kind of spot Homa builds a plan around: materials, a pace,
                            and a re-check so you can watch the number move.
                          </p>
                        </div>
                      ) : null}

                      <p className="mt-6 font-mono text-[0.65rem] uppercase tracking-widest text-subtle">
                        Benchmarks checked against
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        The {"\u201c"}most kids by{"\u201d"} ages above come from these published
                        sources:
                      </p>
                      {/* Muted, not brand orange: four stacked brand links
                          had the visual mass of a nav menu, and these are
                          citations (receipts should whisper). Still real
                          links, underlined so they read as clickable. */}
                      <ul className="mt-2 flex flex-col gap-1">
                        {domainSources.map((key) => {
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

                      {!score.exposureBased && score.position !== "not_mapped" ? (
                        <div className="mt-6 print:hidden">
                          <p className="text-xs text-muted">
                            Where to take {domain?.displayName?.toLowerCase()} next:
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                          {sample ? (
                            <Link
                              href="/onboarding"
                              className="inline-flex min-h-10 items-center rounded-pill bg-brand px-4 py-2 text-xs font-semibold text-on-brand hover:bg-brand-hover"
                            >
                              Get your own report to unlock plans
                            </Link>
                          ) : (
                            <>
                              {/* Emphasis follows position: the 4-week plan is
                                  THE move on a growing subject (the callout
                                  above literally says so), so only there does
                                  it get the solid clay primary. Sixteen
                                  identical primaries pointed nowhere. */}
                              <Link
                                href={`/onboarding/r/${report.token}/plan/${score.domainId}`}
                                className={
                                  score.position === "growing"
                                    ? "inline-flex min-h-10 items-center rounded-pill bg-brand px-4 py-2 text-xs font-semibold text-on-brand hover:bg-brand-hover"
                                    : "inline-flex min-h-10 items-center rounded-pill border border-border bg-card px-4 py-2 text-xs font-semibold text-strong hover:border-brand"
                                }
                              >
                                Build the 4-week plan
                              </Link>
                              {/* Says the action honestly: this one leaves the
                                  report and asks more questions ("go deeper:
                                  see how far, then push further" was a riddle
                                  that navigated away without warning). */}
                              <Link
                                href={`/onboarding?dd=${report.childId}.${score.domainId}`}
                                className="inline-flex min-h-10 items-center rounded-pill border border-border bg-card px-4 py-2 text-xs font-semibold text-strong hover:border-brand"
                              >
                                Answer a few deeper questions
                              </Link>
                            </>
                          )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </details>
                );
              })}
            </div>

            {/* Things to try */}
            {growing.length > 0 ? (
              <>
                <h2 className="mt-9 font-display text-xl font-semibold text-strong">{trySection.title}</h2>
                <p className="mt-1 text-sm text-muted">{trySection.sub}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {growing.slice(0, 2).map((score) => {
                    const domain = getMapDomain(score.domainId);
                    if (!domain) return null;
                    const activity = growingActivityFor(domain, months);
                    return (
                      <div key={score.domainId} className="rounded-lg p-4" style={{ background: "var(--info-soft)" }}>
                        <p className="font-mono text-[0.65rem] uppercase tracking-widest" style={{ color: "var(--sky-600)" }}>
                          {domain.displayName}
                        </p>
                        <p className="mt-1 font-semibold text-strong">{activity.title}</p>
                        <p className="mt-1 text-sm text-body">{activity.description}</p>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}

            {/* The one-tap month: consent IS the explicit ask that lets the
                28-day retest email arm; nothing is ever armed silently. */}
            {consentCandidate ? (
              <ConsentCard
                childId={report.childId}
                childName={report.childName}
                domainId={consentCandidate.domainId}
                subjectName={consentCandidate.subjectName}
              />
            ) : null}

            {/* The growth story: the archive read back as chapters. Renders
                nothing until a second scoring exists. */}
            <GrowthStory childName={report.childName} eras={eras} />

            {/* The memory-box letter, the one piece written TO the child. */}
            {keepsakeText ? (
              <div className="mt-9 rounded-lg p-6" style={{ background: "var(--gold-100)" }}>
                <p
                  className="font-mono text-[0.65rem] uppercase tracking-widest"
                  style={{ color: "var(--gold-ink)" }}
                >
                  For {report.childName}&apos;s memory box {"\u00b7"} {generatedDate}
                </p>
                <p
                  className="mt-2 whitespace-pre-line font-serif text-lg italic leading-relaxed"
                  style={{ color: "var(--gold-ink-strong)" }}
                >
                  {keepsakeText}
                </p>
                <p className="mt-2 text-xs print:hidden" style={{ color: "var(--gold-ink)" }}>
                  Print the report and this letter keeps.
                </p>
              </div>
            ) : null}

            {/* The state card: reference data joined at render, so it can
                never go stale inside anyone's permanent report. */}
            {stateRequirements ? (
              <StateCard summary={stateRequirements} childName={report.childName} />
            ) : null}

            {/* Methodology */}
            <div className="mt-9 rounded-lg bg-[var(--surface-sunken)] p-5 text-sm">
              <h3 className="font-display text-base font-semibold text-strong">
                How this report is made (and what it is not)
              </h3>
              <p className="mt-2 text-muted">
                {/* Explicit join: Turbopack's SWC JSX transform strips the
                    leading space of a multi-line text node right after an
                    expression, which rendered "Mayadoes". */}
                Your answers describe what {report.childName}
                {" "}does day to day. Each one is checked
                against published national benchmarks for their age, the same sources schools and
                pediatricians use. Where you said &ldquo;not sure&rdquo;, the report says so
                instead of guessing.
              </p>
              <p className="mt-2 text-muted">
                This is built from a parent&apos;s observations. It is not a test and not medical
                advice. Every child grows in their own order, and a first report is an estimate
                that sharpens as you answer more.
              </p>
              {stateName && !stateRequirements ? (
                <p className="mt-2 text-muted">
                  One more thing, because it matters: homeschooling is legal in all 50 states,
                  including {stateName}. When your invite opens, Homa tracks {stateName}&apos;s
                  requirements for you.
                </p>
              ) : null}
              <p className="mt-3 font-mono text-[0.65rem] leading-relaxed text-subtle">
                SOURCES {"\u00b7"} {Array.from(sourceKeys).map((key) => MAP_SOURCES[key]?.label).filter(Boolean).join(" \u00b7 ")} {"\u00b7"} bank {report.bankVersion} {"\u00b7"}{" "}
                <Link href="/onboarding/method" className="text-brand underline">
                  how the report works, in full
                </Link>
              </p>
            </div>

            {/* About your homeschool: relocated from the pre-report extras
                step (UX review 2026-07-06), asked after the payoff. */}
            {!sample && askHomeschool ? (
              <HomeschoolContextCard childName={report.childName} />
            ) : null}

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
                  className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-hover"
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
                  className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-hover"
                >
                  Map {nextKid.name} next
                </Link>
              </div>
            ) : null}

            {/* CTA band */}
            <div className="mt-9 rounded-lg p-6 print:hidden" style={{ background: "var(--surface-inverse)" }}>
              <h3 className="font-display text-2xl font-bold" style={{ color: "#fff" }}>
                This report is the &ldquo;before&rdquo; picture.
              </h3>
              <p className="mt-2 max-w-lg" style={{ color: "var(--stone-300)" }}>
                Homa moves it: a plan for every blue subject, materials made for exactly
                what&apos;s growing, and this report re-drawn as {report.childName} grows, so you
                watch the numbers move.
              </p>
              {sample ? (
                <Link
                  href="/onboarding"
                  className="mt-4 inline-flex items-center rounded-pill bg-brand px-5 py-2.5 text-sm font-bold text-on-brand hover:bg-brand-hover"
                >
                  Get your child&apos;s free report
                </Link>
              ) : (
                <p
                  className="mt-4 inline-flex items-center rounded-pill px-5 py-2.5 text-sm font-bold"
                  style={{ background: "var(--accent-sage-soft)", color: "var(--sage-700)" }}
                >
                  You&apos;re on the invite list {"\u2713"}
                </p>
              )}
              <p className="mt-3 text-xs" style={{ color: "var(--stone-400)" }}>
                We invite families a few at a time. Your invite comes by email, with{" "}
                {report.childName}&apos;s report waiting inside.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-7 py-4 text-sm text-subtle sm:px-10">
            <span>made with Homa for {report.childName}</span>
            {!sample ? (
              <ReportActions
                familyId={report.familyId}
                childId={report.childId}
                childName={report.childName}
                token={report.token}
              />
            ) : (
              <Link href="/onboarding" className="text-brand underline-offset-2 hover:underline">
                get your own
              </Link>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-subtle print:hidden">
          <Link href="/onboarding" className="text-brand underline-offset-2 hover:underline">
            back to your family
          </Link>
        </p>
      </main>
    </div>
  );
}
