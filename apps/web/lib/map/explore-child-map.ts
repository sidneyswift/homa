import {
  domainForBankItem,
  getMapItem,
  getMapSubject,
  MAP_SUBJECTS,
  scoreMap,
  type MapAnswer,
  type MapItem,
} from "@homa/core";
import {
  allTopics,
  bottleneck,
  domainsForSubject,
  getTaxonomyDomain,
  getTopic,
  personalizePrompt,
  prerequisiteClosure,
  prerequisitesOf,
  readyTopics,
  teachingOrder,
  topicsForDomain,
  topicsForSubject,
  unlockedBy,
  type TaxonomyTopic,
} from "@homa/taxonomy";

import { chartMonthsForScore, displayMonths } from "./trajectory-format";

/**
 * The explore_child_map query engine: read-only questions over the child's
 * own evidence joined with the two content graphs, the anchored bank
 * ladder (measurement) and the taxonomy prerequisite graph (teaching
 * order). Pure functions, no I/O: the tool loads the child's rows and
 * passes them in, so every query is deterministic and unit-testable.
 *
 * Laws this module keeps:
 * - Measurements stay the scorer's: positions and chart figures come from
 *   scoreMap + the shared chart value law, never synthesized here.
 * - Teaching windows are typical TEACHING ages, never norms or deadlines;
 *   results carry them as data and the instructions gate the framing.
 * - Every list and string is bounded, so a result can never flood the
 *   model's context.
 */

export interface ExploreAnswerRow {
  itemId: string;
  answer: MapAnswer;
}

export interface ExploreChildContext {
  childName: string;
  ageMonths: number;
  answers: readonly ExploreAnswerRow[];
}

export type ExploreChildMapQuery =
  | { query: "subject_map"; subjectId: string }
  | { query: "topic"; topicId: string }
  | {
      query: "ready_next";
      subjectId?: string;
      domainId?: string;
      limit?: number;
    }
  | { query: "bottleneck"; topicId: string }
  | { query: "teaching_order"; topicIds: readonly string[] }
  | { query: "search_topics"; searchText: string; subjectId?: string; limit?: number };

const MAX_STATEMENT_CHARS = 160;
const MAX_REASON_CHARS = 140;
const MAX_DESCRIPTION_CHARS = 280;
const MAX_LADDER_ITEMS = 24;
const MAX_DOMAINS = 14;
const MAX_PREREQUISITES = 10;
const MAX_UNLOCKS = 10;
const MAX_READY_LIMIT = 8;
const DEFAULT_READY_LIMIT = 6;
const MAX_ORDER_TOPICS = 12;
const MAX_SEARCH_LIMIT = 10;
const DEFAULT_SEARCH_LIMIT = 8;
const MAX_EVIDENCE_LINES = 3;

function bounded(value: string, maxChars: number): string {
  return Array.from(value).slice(0, maxChars).join("");
}

/** The child's standing on one id, from their latest saved answer. */
export type ChildItemStatus =
  | "confirmed_easily"
  | "getting_there"
  | "not_yet"
  | "unsure"
  | "no_evidence";

function statusFromAnswer(answer: MapAnswer | undefined): ChildItemStatus {
  switch (answer) {
    case "easily":
      return "confirmed_easily";
    case "getting_there":
      return "getting_there";
    case "not_yet":
      return "not_yet";
    case "not_sure":
    case "skip":
      return "unsure";
    case undefined:
      return "no_evidence";
    default: {
      const exhaustive: never = answer;
      throw new Error(`Unhandled map answer: ${exhaustive}`);
    }
  }
}

function latestAnswerByItem(
  answers: readonly ExploreAnswerRow[],
): Map<string, MapAnswer> {
  // child_answers keeps one row per (child, item); later rows in the load
  // order still win deterministically if a caller ever passes duplicates.
  const byItem = new Map<string, MapAnswer>();
  for (const row of answers) byItem.set(row.itemId, row.answer);
  return byItem;
}

/** Taxonomy topics the child has confirmed (easily), the graph's basis. */
function confirmedTopicIds(
  byItem: ReadonlyMap<string, MapAnswer>,
): Set<string> {
  const confirmed = new Set<string>();
  for (const [itemId, answer] of byItem) {
    if (answer === "easily" && getTopic(itemId) !== undefined) {
      confirmed.add(itemId);
    }
  }
  return confirmed;
}

function topicSummary(
  topic: TaxonomyTopic,
  byItem: ReadonlyMap<string, MapAnswer>,
) {
  return {
    topicId: topic.id,
    name: bounded(topic.name, MAX_STATEMENT_CHARS),
    domainId: topic.domain,
    teachingWindowMonths: topic.teachingWindowMonths,
    childStatus: statusFromAnswer(byItem.get(topic.id)),
  };
}

const SUBJECT_IDS = MAP_SUBJECTS.map((subject) => subject.id);

function unknownSubject(subjectId: string) {
  return {
    error: "unknown_subject" as const,
    note: `No subject "${subjectId}". Subjects: ${SUBJECT_IDS.join(", ")}.`,
  };
}

function unknownTopic(topicId: string) {
  return {
    error: "unknown_topic" as const,
    note:
      `No topic or checklist item "${topicId}". ` +
      "Find real ids with the search_topics query first.",
  };
}

function subjectMap(
  context: ExploreChildContext,
  subjectId: string,
) {
  const subject = getMapSubject(subjectId);
  if (!subject) return unknownSubject(subjectId);

  const byItem = latestAnswerByItem(context.answers);
  const scores = scoreMap(
    context.ageMonths,
    context.answers.map((row) => ({ itemId: row.itemId, answer: row.answer })),
  );
  const score = scores.subjects.find(
    (entry) => entry.subjectId === subjectId,
  );
  const chartMonths = score ? chartMonthsForScore(score) : null;

  const ladder = [...subject.items]
    .sort((a, b) => a.typicalMonths - b.typicalMonths)
    .slice(0, MAX_LADDER_ITEMS)
    .map((item) => ({
      itemId: item.id,
      statement: bounded(item.statement, MAX_STATEMENT_CHARS),
      typicalMonths: item.typicalMonths,
      childStatus: statusFromAnswer(byItem.get(item.id)),
      frontier: item.statement === score?.frontierStatement,
    }));

  const confirmed = confirmedTopicIds(byItem);
  const domains = domainsForSubject(subjectId)
    .slice(0, MAX_DOMAINS)
    .map((domain) => {
      const topics = topicsForDomain(domain.id);
      const inWindow = topics.filter(
        (topic) =>
          context.ageMonths >= topic.teachingWindowMonths[0] &&
          context.ageMonths < topic.teachingWindowMonths[1],
      );
      const bankEvidence = [...byItem.keys()].filter(
        (itemId) => domainForBankItem(itemId) === domain.id,
      );
      return {
        domainId: domain.id,
        displayName: domain.displayName,
        kind: domain.kind,
        graphTopics: topics.length,
        graphTopicsAtThisAge: inWindow.length,
        confirmedGraphTopics: topics.filter((topic) =>
          confirmed.has(topic.id),
        ).length,
        checklistAnswers: bankEvidence.length,
      };
    });

  return {
    subjectId,
    displayName: subject.displayName,
    exposureBased: subject.exposureBased,
    position: score?.position ?? "not_mapped",
    chartReads:
      chartMonths !== null && score
        ? `${displayMonths(chartMonths, score.beyondScale)} mo`
        : null,
    observations: score?.observations ?? 0,
    ladder,
    domains,
    note:
      "The ladder is the anchored measurement spine (typicalMonths are cited norms). Domains summarize the teaching graph; use ready_next or topic for detail. Teaching windows are typical teaching ages, never deadlines.",
  };
}

function bankItemDetail(
  context: ExploreChildContext,
  item: MapItem,
  subjectId: string,
) {
  const byItem = latestAnswerByItem(context.answers);
  return {
    kind: "bank_item" as const,
    itemId: item.id,
    subjectId,
    domainId: domainForBankItem(item.id) ?? null,
    statement: bounded(item.statement, MAX_STATEMENT_CHARS),
    typicalMonths: item.typicalMonths,
    typicalRangeMonths: item.typicalRangeMonths ?? null,
    childStatus: statusFromAnswer(byItem.get(item.id)),
    note: "An anchored checklist item (the measurement spine). Graph prerequisites live on taxonomy topics; use search_topics to find the related topic.",
  };
}

function topicDetail(context: ExploreChildContext, topicId: string) {
  const topic = getTopic(topicId);
  if (!topic) {
    const bankEntry = getMapItem(topicId);
    if (bankEntry) {
      return bankItemDetail(context, bankEntry.item, bankEntry.subject.id);
    }
    return unknownTopic(topicId);
  }

  const byItem = latestAnswerByItem(context.answers);
  const domain = getTaxonomyDomain(topic.domain);

  const prerequisites = prerequisitesOf(topic.id)
    .slice(0, MAX_PREREQUISITES)
    .map((edge) => {
      const prerequisite = getTopic(edge.prerequisiteId);
      return {
        topicId: edge.prerequisiteId,
        name: prerequisite
          ? bounded(prerequisite.name, MAX_STATEMENT_CHARS)
          : edge.prerequisiteId,
        strength: edge.strength,
        reason: edge.reason ? bounded(edge.reason, MAX_REASON_CHARS) : null,
        childStatus: statusFromAnswer(byItem.get(edge.prerequisiteId)),
      };
    });

  const unlocks = unlockedBy(topic.id)
    .slice(0, MAX_UNLOCKS)
    .map((edge) => {
      const next = getTopic(edge.topicId);
      return {
        topicId: edge.topicId,
        name: next ? bounded(next.name, MAX_STATEMENT_CHARS) : edge.topicId,
        strength: edge.strength,
        childStatus: statusFromAnswer(byItem.get(edge.topicId)),
      };
    });

  return {
    kind: "topic" as const,
    topicId: topic.id,
    name: bounded(topic.name, MAX_STATEMENT_CHARS),
    description: bounded(topic.description, MAX_DESCRIPTION_CHARS),
    subjectId: topic.subject,
    domainId: topic.domain,
    domainKind: domain?.kind ?? null,
    topicKind: topic.kind,
    teachingWindowMonths: topic.teachingWindowMonths,
    evidenceLooksLike: topic.evidence
      .slice(0, MAX_EVIDENCE_LINES)
      .map((line) => bounded(line, MAX_STATEMENT_CHARS)),
    tryAtHome: topic.assessmentPrompt
      ? bounded(
          personalizePrompt(topic.assessmentPrompt, context.childName),
          MAX_DESCRIPTION_CHARS,
        )
      : null,
    childStatus: statusFromAnswer(byItem.get(topic.id)),
    prerequisites,
    unlocks,
  };
}

function readyNext(
  context: ExploreChildContext,
  input: { subjectId?: string; domainId?: string; limit?: number },
) {
  if (input.subjectId && !getMapSubject(input.subjectId)) {
    return unknownSubject(input.subjectId);
  }
  if (input.domainId && !getTaxonomyDomain(input.domainId)) {
    return {
      error: "unknown_domain" as const,
      note: `No domain "${input.domainId}". Subject_map lists a subject's domains.`,
    };
  }

  const byItem = latestAnswerByItem(context.answers);
  const confirmed = confirmedTopicIds(byItem);
  const limit = Math.min(
    Math.max(1, input.limit ?? DEFAULT_READY_LIMIT),
    MAX_READY_LIMIT,
  );

  // The teaching window RANKS, never gates: the imported graph's windows
  // floor at age 4, and a 3-year-old's "what next" must not come back
  // empty, nor may an older child's unfinished early topic hide because
  // its window passed. In-window first, then nearest window, centrality
  // inside each ring.
  const windowDistance = (topic: TaxonomyTopic): number => {
    const [start, end] = topic.teachingWindowMonths;
    if (context.ageMonths >= start && context.ageMonths < end) return 0;
    return context.ageMonths < start
      ? start - context.ageMonths
      : context.ageMonths - end + 1;
  };

  const ready = readyTopics(confirmed)
    .filter(({ topic }) => {
      if (input.subjectId && topic.subject !== input.subjectId) return false;
      if (input.domainId && topic.domain !== input.domainId) return false;
      // Assessment spine only: content clusters feed materials, not "next".
      if (getTaxonomyDomain(topic.domain)?.kind !== "assessment") return false;
      // A confirmed-easily topic is not "next"; everything else can be.
      return statusFromAnswer(byItem.get(topic.id)) !== "confirmed_easily";
    })
    .sort(
      (left, right) =>
        windowDistance(left.topic) - windowDistance(right.topic) ||
        right.topic.centrality - left.topic.centrality ||
        (left.topic.id < right.topic.id ? -1 : 1),
    )
    .slice(0, limit)
    .map(({ topic, satisfiedBy }) => ({
      ...topicSummary(topic, byItem),
      windowFit:
        windowDistance(topic) === 0
          ? ("now" as const)
          : context.ageMonths < topic.teachingWindowMonths[0]
            ? ("usually_later" as const)
            : ("usually_earlier" as const),
      whyReady: satisfiedBy.slice(0, 2).map((edge) => ({
        prerequisiteId: edge.prerequisiteId,
        reason: edge.reason ? bounded(edge.reason, MAX_REASON_CHARS) : null,
      })),
    }));

  return {
    readyNow: ready,
    basis: {
      confirmedGraphTopics: confirmed.size,
      note:
        confirmed.size === 0
          ? "No graph topics confirmed yet, so these are this age's graph entry points (no unmet hard prerequisites). The checklist ladder in subject_map is the measured picture."
          : "Ready = every hard prerequisite confirmed from this family's own evidence. Soft edges advise order but never block.",
    },
  };
}

function bottleneckFor(context: ExploreChildContext, topicId: string) {
  const topic = getTopic(topicId);
  if (!topic) return unknownTopic(topicId);

  const byItem = latestAnswerByItem(context.answers);
  const confirmed = confirmedTopicIds(byItem);
  const blocking = bottleneck(topicId, confirmed);
  const unconfirmedHardChain = prerequisiteClosure(topicId)
    .filter((entry) => !confirmed.has(entry.id))
    .slice(0, MAX_PREREQUISITES)
    .map((entry) => topicSummary(entry, byItem));

  return {
    topicId: topic.id,
    name: bounded(topic.name, MAX_STATEMENT_CHARS),
    childStatus: statusFromAnswer(byItem.get(topic.id)),
    deepestBlocking: blocking
      ? topicSummary(blocking, byItem)
      : null,
    unconfirmedPrerequisites: unconfirmedHardChain,
    note: blocking
      ? "deepestBlocking is the earliest unconfirmed hard prerequisite: the honest place to start."
      : "No unconfirmed hard prerequisites: the path to this topic is open on current evidence.",
  };
}

function teachingOrderFor(
  context: ExploreChildContext,
  topicIds: readonly string[],
) {
  const unique = [...new Set(topicIds)].slice(0, MAX_ORDER_TOPICS);
  const unknown = unique.filter((id) => getTopic(id) === undefined);
  if (unknown.length > 0) {
    return {
      error: "unknown_topic" as const,
      note: `Not graph topics: ${unknown.join(", ")}. Use search_topics for real ids.`,
    };
  }
  const byItem = latestAnswerByItem(context.answers);
  return {
    ordered: teachingOrder(unique).map((topic) => topicSummary(topic, byItem)),
    note: "Prerequisites first (topological order over the graph's edges).",
  };
}

function searchTopics(input: {
  searchText: string;
  subjectId?: string;
  limit?: number;
}) {
  if (input.subjectId && !getMapSubject(input.subjectId)) {
    return unknownSubject(input.subjectId);
  }
  const needle = input.searchText.trim().toLowerCase();
  if (needle.length < 2) {
    return {
      error: "search_too_short" as const,
      note: "Give search_topics at least two characters.",
    };
  }
  const limit = Math.min(
    Math.max(1, input.limit ?? DEFAULT_SEARCH_LIMIT),
    MAX_SEARCH_LIMIT,
  );

  const scored: Array<{
    rank: number;
    id: string;
    hit:
      | { kind: "topic"; topicId: string; name: string; subjectId: string; domainId: string; teachingWindowMonths: readonly [number, number] }
      | { kind: "bank_item"; itemId: string; statement: string; subjectId: string; typicalMonths: number };
  }> = [];

  // Content-cluster topics stay searchable on purpose (they feed
  // materials and conversation); readiness queries stay assessment-only.
  const graphTopics = input.subjectId
    ? topicsForSubject(input.subjectId)
    : allTopics();
  for (const topic of graphTopics) {
    const name = topic.name.toLowerCase();
    const rank =
      name === needle ? 3 : name.includes(needle) ? 2 : topic.description.toLowerCase().includes(needle) ? 1 : 0;
    if (rank === 0) continue;
    scored.push({
      rank,
      id: topic.id,
      hit: {
        kind: "topic",
        topicId: topic.id,
        name: bounded(topic.name, MAX_STATEMENT_CHARS),
        subjectId: topic.subject,
        domainId: topic.domain,
        teachingWindowMonths: topic.teachingWindowMonths,
      },
    });
  }

  for (const subject of MAP_SUBJECTS) {
    if (input.subjectId && subject.id !== input.subjectId) continue;
    for (const item of subject.items) {
      const statement = item.statement.toLowerCase();
      const rank = statement.includes(needle) ? 2 : 0;
      if (rank === 0) continue;
      scored.push({
        rank,
        id: item.id,
        hit: {
          kind: "bank_item",
          itemId: item.id,
          statement: bounded(item.statement, MAX_STATEMENT_CHARS),
          subjectId: subject.id,
          typicalMonths: item.typicalMonths,
        },
      });
    }
  }

  const results = scored
    .sort((a, b) => b.rank - a.rank || (a.id < b.id ? -1 : 1))
    .slice(0, limit)
    .map((entry) => entry.hit);

  return {
    results,
    note:
      results.length === 0
        ? "Nothing matched. Try a shorter, more common word."
        : "bank_item ids are the anchored checklist (measurement); topic ids are the teaching graph (prerequisites, readiness).",
  };
}

/** Runs one explore query against the child's loaded evidence. */
export function exploreChildMap(
  context: ExploreChildContext,
  query: ExploreChildMapQuery,
): Record<string, unknown> {
  switch (query.query) {
    case "subject_map":
      return subjectMap(context, query.subjectId);
    case "topic":
      return topicDetail(context, query.topicId);
    case "ready_next":
      return readyNext(context, query);
    case "bottleneck":
      return bottleneckFor(context, query.topicId);
    case "teaching_order":
      return teachingOrderFor(context, query.topicIds);
    case "search_topics":
      return searchTopics(query);
    default: {
      const exhaustive: never = query;
      throw new Error(`Unhandled explore query: ${JSON.stringify(exhaustive)}`);
    }
  }
}
