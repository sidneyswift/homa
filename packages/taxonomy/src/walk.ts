import type { TaxonomyDomain, TaxonomyTopic } from "./types";
import { domainsForSubject, getTaxonomyDomain } from "./domains";
import { prerequisitesOf, unlockedBy } from "./graph";
import { getTopic, topicsForSubject } from "./topics";

/**
 * The graph walk: the adaptive per-subject question engine behind the
 * onboarding depth fork (plans/2026-07-11-onboarding-depth-fork.md).
 * Pure and deterministic given the answers, same contract as
 * nextDeepDiveItem in @homa/core, but over the prerequisite DAG instead
 * of the anchored age ladder:
 *
 *   - seed at the age-appropriate, highest-centrality assessment topics
 *   - "easily" climbs (candidates from what the topic unlocks), and
 *     implicitly confirms the topic's hard prerequisite closure, which
 *     is never asked (an answer must always buy information)
 *   - "not yet" and "getting there" prune every topic that hard-depends
 *     on the missed one, and aim the probe at its direct prerequisites
 *   - the walk ends at the sitting budget or when no informative card
 *     remains; where the climbing stops is where the child tops out
 *
 * Walk answers are deliberately invisible to the months-ahead scorer
 * (topics are unanchored; the scorer skips unknown ids). They feed the
 * frontier, plans, and the agent, and graduate into the scored set per
 * topic when an anchor is authored with a citation.
 */

/** Per-sitting question budget. Starts at the deep dive's proven cap;
 * the day-one events exist so data can move it. */
export const WALK_BUDGET = 8;

/** Chip answers, mirroring @homa/core's MAP_ANSWERS (no dependency:
 * core depends on this package, never the reverse). */
export type WalkAnswer = "easily" | "getting_there" | "not_yet" | "not_sure" | "skip";

export type WalkAnswers = Readonly<Record<string, WalkAnswer>>;

export type WalkOutcome = "frontier_found" | "budget_reached";

export interface WalkCard {
  topic: TaxonomyTopic;
  domain: TaxonomyDomain;
}

/** Everything the walk knows once the answers are folded over the graph. */
export interface WalkKnowledge {
  /** Topics the child has: answered "easily", plus each one's hard
   * prerequisite closure (must-know-first edges imply she has them).
   * An explicit "not yet" or "getting there" always beats an implied
   * confirmation, so a contradictory pair never double-counts. */
  confirmed: ReadonlySet<string>;
  /** Answered "getting there": emerging, not mastered. */
  emerging: ReadonlySet<string>;
  /** Unaskable because they hard-depend (transitively) on a topic the
   * child missed ("not yet") or is still forming ("getting there"). */
  blocked: ReadonlySet<string>;
  /** Every answered topic id, whatever the chip: never re-asked. */
  consumed: ReadonlySet<string>;
}

/** Transitive hard prerequisites: everything "easily" on this topic
 * implies the child already has. */
export function hardPrerequisiteClosure(topicId: string): Set<string> {
  const closure = new Set<string>();
  const queue = [topicId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const edge of prerequisitesOf(current)) {
      if (edge.strength !== "hard" || closure.has(edge.prerequisiteId)) continue;
      closure.add(edge.prerequisiteId);
      queue.push(edge.prerequisiteId);
    }
  }
  return closure;
}

/** Transitive hard dependents: everything a "not yet" on this topic
 * makes unreachable. */
export function hardUnlockClosure(topicId: string): Set<string> {
  const closure = new Set<string>();
  const queue = [topicId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const edge of unlockedBy(current)) {
      if (edge.strength !== "hard" || closure.has(edge.topicId)) continue;
      closure.add(edge.topicId);
      queue.push(edge.topicId);
    }
  }
  return closure;
}

export function walkKnowledge(answers: WalkAnswers): WalkKnowledge {
  const confirmed = new Set<string>();
  const emerging = new Set<string>();
  const blocked = new Set<string>();
  const consumed = new Set<string>();
  const missed: string[] = [];

  for (const [topicId, answer] of Object.entries(answers)) {
    if (!getTopic(topicId)) continue;
    consumed.add(topicId);
    switch (answer) {
      case "easily":
        confirmed.add(topicId);
        for (const implied of hardPrerequisiteClosure(topicId)) confirmed.add(implied);
        break;
      case "getting_there":
        emerging.add(topicId);
        missed.push(topicId);
        break;
      case "not_yet":
        missed.push(topicId);
        break;
      case "not_sure":
      case "skip":
        break;
      default: {
        const exhausted: never = answer;
        throw new Error(`unhandled walk answer: ${String(exhausted)}`);
      }
    }
  }

  // Explicit signal beats implied confirmation.
  for (const topicId of missed) confirmed.delete(topicId);
  for (const seed of missed) {
    for (const dependent of hardUnlockClosure(seed)) blocked.add(dependent);
  }

  return { confirmed, emerging, blocked, consumed };
}

/** Deterministic candidate order: most informative first (centrality),
 * then earliest teaching window, then id, so equal inputs always serve
 * the same card. */
function byInformativeness(a: TaxonomyTopic, b: TaxonomyTopic): number {
  return (
    b.centrality - a.centrality ||
    a.teachingWindowMonths[0] - b.teachingWindowMonths[0] ||
    a.id.localeCompare(b.id)
  );
}

function isAssessmentTopic(topic: TaxonomyTopic): boolean {
  return getTaxonomyDomain(topic.domain)?.kind === "assessment";
}

/**
 * The next card of a subject walk, or null when the sitting is done.
 * `askable`, when given, restricts SERVING to topics with an authored
 * card (curation ships in batches; the graph still reasons over every
 * topic). Windows gate only the seed: once the walk has signal it roams
 * wherever the answers point, which is how a 3-year-old doing fractions
 * gets found.
 */
export function nextWalkCard(
  subject: string,
  ageMonths: number,
  answers: WalkAnswers,
  answeredThisSitting: number,
  askable?: ReadonlySet<string>,
): WalkCard | null {
  if (answeredThisSitting >= WALK_BUDGET) return null;

  const knowledge = walkKnowledge(answers);
  const candidates = topicsForSubject(subject).filter(
    (topic) =>
      isAssessmentTopic(topic) &&
      !knowledge.consumed.has(topic.id) &&
      !knowledge.confirmed.has(topic.id) &&
      !knowledge.blocked.has(topic.id) &&
      (askable === undefined || askable.has(topic.id)),
  );
  if (candidates.length === 0) return null;

  // Probe the boundary of what the answers established: direct hard
  // unlocks of a confirmed topic (climbing) and direct prerequisites of
  // a missed one (finding her footing). Both are maximally informative.
  const adjacent = candidates.filter((topic) => {
    const climbs = prerequisitesOf(topic.id).some(
      (edge) => edge.strength === "hard" && knowledge.confirmed.has(edge.prerequisiteId),
    );
    if (climbs) return true;
    return unlockedBy(topic.id).some((edge) => {
      const dependentAnswer = answers[edge.topicId];
      return dependentAnswer === "not_yet" || dependentAnswer === "getting_there";
    });
  });

  const pool =
    adjacent.length > 0
      ? adjacent
      : (() => {
          const seeds = candidates.filter(
            (topic) =>
              ageMonths >= topic.teachingWindowMonths[0] &&
              ageMonths < topic.teachingWindowMonths[1],
          );
          return seeds.length > 0 ? seeds : candidates;
        })();

  const topic = [...pool].sort(byInformativeness)[0];
  const domain = getTaxonomyDomain(topic.domain);
  if (!domain) return null;
  return { topic, domain };
}

/** Why a finished sitting ended, for the walk_ended event. */
export function walkOutcome(
  subject: string,
  ageMonths: number,
  answers: WalkAnswers,
  answeredThisSitting: number,
  askable?: ReadonlySet<string>,
): WalkOutcome {
  if (answeredThisSitting >= WALK_BUDGET) {
    const remaining = nextWalkCard(subject, ageMonths, answers, 0, askable);
    return remaining ? "budget_reached" : "frontier_found";
  }
  return "frontier_found";
}

export interface WalkDomainSummary {
  domainId: string;
  displayName: string;
  /** Explicitly confirmed plus implied via hard prerequisites. */
  confirmedIds: string[];
  /** Answered "getting there": emerging right now. */
  emergingIds: string[];
  /** Explicit "not yet" answers: the named next steps. */
  notYetIds: string[];
  /** Unanswered topics whose hard prerequisites are all confirmed:
   * the readiness frontier the plan and the agent read. */
  readyIds: string[];
}

/** Per-domain reading of a subject's walk: where she tops out, domain by
 * domain. Pure display/planning data; the scorer never reads it. */
export function walkSummary(subject: string, answers: WalkAnswers): WalkDomainSummary[] {
  const knowledge = walkKnowledge(answers);
  const summaries: WalkDomainSummary[] = [];
  for (const domain of domainsForSubject(subject)) {
    if (domain.kind !== "assessment") continue;
    const summary: WalkDomainSummary = {
      domainId: domain.id,
      displayName: domain.displayName,
      confirmedIds: [],
      emergingIds: [],
      notYetIds: [],
      readyIds: [],
    };
    for (const topic of topicsForSubject(subject)) {
      if (topic.domain !== domain.id) continue;
      if (knowledge.confirmed.has(topic.id)) {
        summary.confirmedIds.push(topic.id);
        continue;
      }
      if (knowledge.emerging.has(topic.id)) {
        summary.emergingIds.push(topic.id);
        continue;
      }
      if (answers[topic.id] === "not_yet") {
        summary.notYetIds.push(topic.id);
        continue;
      }
      if (knowledge.consumed.has(topic.id) || knowledge.blocked.has(topic.id)) continue;
      const ready = prerequisitesOf(topic.id).every(
        (edge) => edge.strength !== "hard" || knowledge.confirmed.has(edge.prerequisiteId),
      );
      if (ready) summary.readyIds.push(topic.id);
    }
    summaries.push(summary);
  }
  return summaries;
}
