import {
  MAP_SUBJECTS,
  ageInMonths,
  domainForBankItem,
  getMapItem,
  getMapSubject,
  scoreMap,
} from "@homa/core";
import {
  PROGRESS_TAXONOMY_DOMAINS,
  getProgressTaxonomyDomain,
  getProgressTaxonomyTopic,
} from "@homa/taxonomy/progress";

import { zonedDateString } from "../time-zone";
import { selectNextProgressItem } from "./check-in-selection";
import {
  resolveEffectiveProgressEvidence,
} from "./effective-evidence";
import { parseOffsetIsoTimestampEpochNanoseconds } from "./timestamp";
import type {
  ChildProgressView,
  OpenProgressConflict,
  OpenProgressConflictView,
  ProgressConflict,
  ProgressDomainView,
  ProgressEvidence,
  ProgressEvidenceSourceView,
  ProgressSelectionAnswer,
  ProgressSourceKind,
  ProgressSubjectSummary,
  ProgressSubjectView,
  ProgressTopicView,
} from "./types";

interface LocatedProgressItem {
  subjectId: string;
  domainId: string;
  domainDisplayName: string;
  statement: string;
  orderMonths: number;
}

interface ProgressTopicCandidate {
  subjectId: string;
  domainId: string;
  domainDisplayName: string;
  orderMonths: number;
  evidenceCount: number;
  summary: ProgressSubjectSummary | null;
  topic: ProgressTopicView;
}

const DOMAIN_ORDER = new Map(
  PROGRESS_TAXONOMY_DOMAINS.map((domain, index) => [
    domain.id,
    index,
  ]),
);
const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const NANOSECONDS_PER_MILLISECOND = BigInt(1_000_000);

const SOURCE_DETAILS: Record<ProgressSourceKind, string> = {
  journal: "Observed in a journal note.",
  conversation: "Shared in conversation.",
  check_in: "Recorded in a check-in.",
  checklist: "Recorded in the progress checklist.",
  deep_dive: "Recorded in a focused check-in.",
  correction: "Updated from a correction.",
  report_correction: "Updated from a report correction.",
  report_probe: "Recorded from a report follow-up.",
  recheck: "Recorded in a follow-up check.",
  onboarding_walk: "Recorded during onboarding.",
  legacy: "Recorded in an earlier progress answer.",
  lesson_listen: "Heard in a recorded lesson.",
};

function compareAsciiIds(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function dateFromEpochNanoseconds(epochNanoseconds: bigint): Date {
  let epochMilliseconds =
    epochNanoseconds / NANOSECONDS_PER_MILLISECOND;
  if (
    epochNanoseconds < BIGINT_ZERO &&
    epochNanoseconds % NANOSECONDS_PER_MILLISECOND !== BIGINT_ZERO
  ) {
    epochMilliseconds -= BIGINT_ONE;
  }
  return new Date(Number(epochMilliseconds));
}

function utcNoonForDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function locateProgressItem(itemId: string): LocatedProgressItem {
  const bankEntry = getMapItem(itemId);
  if (bankEntry !== undefined) {
    const domainId = domainForBankItem(itemId);
    const domain =
      domainId === null
        ? undefined
        : getProgressTaxonomyDomain(domainId);
    if (
      domainId === null ||
      domain === undefined ||
      domain.subject !== bankEntry.subject.id
    ) {
      throw new TypeError(
        `Bank progress item "${itemId}" has no valid taxonomy domain`,
      );
    }
    return {
      subjectId: bankEntry.subject.id,
      domainId,
      domainDisplayName: domain.displayName,
      statement: bankEntry.item.statement,
      orderMonths: bankEntry.item.typicalMonths,
    };
  }

  const taxonomyTopic = getProgressTaxonomyTopic(itemId);
  if (taxonomyTopic === undefined) {
    throw new TypeError(`Unknown progress item "${itemId}"`);
  }
  const domain = getProgressTaxonomyDomain(taxonomyTopic.domain);
  const subject = getMapSubject(taxonomyTopic.subject);
  if (
    domain === undefined ||
    subject === undefined ||
    domain.subject !== subject.id
  ) {
    throw new TypeError(
      `Taxonomy progress item "${itemId}" has no renderable subject and domain`,
    );
  }
  if (domain.kind !== "assessment") {
    throw new TypeError(
      `Taxonomy progress item "${itemId}" is not an assessment topic`,
    );
  }
  return {
    subjectId: subject.id,
    domainId: domain.id,
    domainDisplayName: domain.displayName,
    statement: taxonomyTopic.name,
    orderMonths: taxonomyTopic.teachingWindowMonths[0],
  };
}

function evidenceDetail(evidence: ProgressEvidence): string {
  return SOURCE_DETAILS[evidence.source];
}

function buildEvidenceSourceView(
  evidence: ProgressEvidence,
): ProgressEvidenceSourceView {
  return {
    kind: evidence.source,
    adultDisplayName: evidence.adultDisplayName ?? null,
    checkInId: evidence.checkInId,
  };
}

function buildEvidenceTopicCandidate(
  evidence: ProgressEvidence,
  today: string,
  timeZone: string,
): ProgressTopicCandidate {
  const item = locateProgressItem(evidence.itemId);
  const isObservedToday =
    zonedDateString(
      dateFromEpochNanoseconds(
        parseOffsetIsoTimestampEpochNanoseconds(
          evidence.observedAt,
        ),
      ),
      timeZone,
    ) === today;
  const topicFields = {
    itemId: evidence.itemId,
    statement: item.statement,
    answer: evidence.answer,
    source: buildEvidenceSourceView(evidence),
    observedAt: evidence.observedAt,
    detail: evidenceDetail(evidence),
  };
  const topic: ProgressTopicView = isObservedToday
    ? { ...topicFields, state: "observed_today" }
    : { ...topicFields, state: "older" };
  return {
    ...item,
    evidenceCount: 1,
    summary: {
      kind: "evidence",
      source: topicFields.source,
      observedAt: evidence.observedAt,
    },
    topic,
  };
}

function evidenceForConflict(
  conflict: OpenProgressConflict,
  evidenceById: ReadonlyMap<string, ProgressEvidence>,
  evidenceId: string,
): ProgressEvidence {
  const evidence = evidenceById.get(evidenceId);
  if (evidence === undefined) {
    throw new TypeError(
      `Progress conflict "${conflict.id}" is missing evidence "${evidenceId}"`,
    );
  }
  return evidence;
}

function buildOpenConflict(
  conflict: OpenProgressConflict,
  evidenceById: ReadonlyMap<string, ProgressEvidence>,
): {
  candidate: ProgressTopicCandidate;
  view: OpenProgressConflictView;
} {
  const item = locateProgressItem(conflict.itemId);
  const evidenceA = evidenceForConflict(
    conflict,
    evidenceById,
    conflict.evidenceIdA,
  );
  const evidenceB = evidenceForConflict(
    conflict,
    evidenceById,
    conflict.evidenceIdB,
  );
  const adultAnswers: OpenProgressConflictView["adultAnswers"] = [
    {
      evidenceId: evidenceA.id,
      adultDisplayName: evidenceA.adultDisplayName ?? null,
      answer: evidenceA.answer,
      observedAt: evidenceA.observedAt,
      source: buildEvidenceSourceView(evidenceA),
    },
    {
      evidenceId: evidenceB.id,
      adultDisplayName: evidenceB.adultDisplayName ?? null,
      answer: evidenceB.answer,
      observedAt: evidenceB.observedAt,
      source: buildEvidenceSourceView(evidenceB),
    },
  ];
  const latestEvidence =
    parseOffsetIsoTimestampEpochNanoseconds(evidenceA.observedAt) >=
    parseOffsetIsoTimestampEpochNanoseconds(evidenceB.observedAt)
      ? evidenceA
      : evidenceB;
  return {
    candidate: {
      ...item,
      evidenceCount: 2,
      summary: {
        kind: "conflict",
        observedAt: latestEvidence.observedAt,
        adultDisplayNames: [
          evidenceA.adultDisplayName ?? null,
          evidenceB.adultDisplayName ?? null,
        ],
      },
      topic: {
        itemId: conflict.itemId,
        statement: item.statement,
        answer: null,
        state: "conflict",
        source: null,
        observedAt: latestEvidence.observedAt,
        detail:
          "Two adults shared different answers. Both are kept for confirmation.",
      },
    },
    view: {
      id: conflict.id,
      childId: conflict.childId,
      familyId: conflict.familyId,
      itemId: conflict.itemId,
      state: conflict.state,
      adultAnswers,
      observedAt: conflict.observedAt,
      resolvedAnswer: null,
      resolvedEvidenceId: null,
      resolvedAt: null,
    },
  };
}

function buildAskNextCandidate(itemId: string): ProgressTopicCandidate {
  const item = locateProgressItem(itemId);
  return {
    ...item,
    evidenceCount: 0,
    summary: null,
    topic: {
      itemId,
      statement: item.statement,
      answer: null,
      state: "ask_next",
      source: null,
      observedAt: null,
      detail: "An age-eligible skill Homa can ask about next.",
    },
  };
}

export function buildProgressSelectionAnswers(input: {
  childId: string;
  familyId: string;
  evidence: readonly ProgressEvidence[];
  conflicts: readonly ProgressConflict[];
  selectionAnswers: readonly ProgressSelectionAnswer[];
}): ProgressSelectionAnswer[] {
  const resolved = resolveEffectiveProgressEvidence({
    childId: input.childId,
    familyId: input.familyId,
    evidence: input.evidence,
    conflicts: input.conflicts,
  });
  const evidenceById = new Map(
    input.evidence.map((evidence) => [evidence.id, evidence]),
  );
  const selectionEvidence = [
    ...resolved.effectiveEvidence,
    ...resolved.openConflicts.flatMap((conflict) => [
      evidenceForConflict(conflict, evidenceById, conflict.evidenceIdA),
      evidenceForConflict(conflict, evidenceById, conflict.evidenceIdB),
    ]),
  ];
  const ledgerEvidenceIds = new Set(
    input.evidence.map((evidence) => evidence.id),
  );
  const independentSelectionAnswers = input.selectionAnswers.filter(
    (answer) =>
      answer.evidenceId === null ||
      !ledgerEvidenceIds.has(answer.evidenceId),
  );
  const mergedSelectionAnswers = new Map(
    independentSelectionAnswers.map((answer) => [
      answer.selectionId,
      answer,
    ]),
  );
  for (const evidence of selectionEvidence) {
    mergedSelectionAnswers.set(evidence.id, {
      selectionId: evidence.id,
      evidenceId: evidence.id,
      itemId: evidence.itemId,
      answer: evidence.answer,
      answeredAt: evidence.observedAt,
    });
  }
  return [...mergedSelectionAnswers.values()];
}

function latestObservedAt(
  candidates: readonly ProgressTopicCandidate[],
): string | null {
  let latest: string | null = null;
  let latestEpochNanoseconds: bigint | null = null;
  for (const candidate of candidates) {
    const observedAt = candidate.topic.observedAt;
    if (observedAt === null) continue;
    const epochNanoseconds =
      parseOffsetIsoTimestampEpochNanoseconds(observedAt);
    if (
      latestEpochNanoseconds === null ||
      epochNanoseconds > latestEpochNanoseconds
    ) {
      latest = observedAt;
      latestEpochNanoseconds = epochNanoseconds;
    }
  }
  return latest;
}

function latestSubjectSummary(
  candidates: readonly ProgressTopicCandidate[],
  hasConflict: boolean,
): ProgressSubjectSummary | null {
  const summaries = candidates
    .map((candidate) => ({
      itemId: candidate.topic.itemId,
      summary: candidate.summary,
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        itemId: string;
        summary: ProgressSubjectSummary;
      } =>
        candidate.summary !== null &&
        (!hasConflict || candidate.summary.kind === "conflict"),
    );
  let latest:
    | {
        itemId: string;
        summary: ProgressSubjectSummary;
        epochNanoseconds: bigint;
      }
    | null = null;
  for (const candidate of summaries) {
    const epochNanoseconds =
      parseOffsetIsoTimestampEpochNanoseconds(
        candidate.summary.observedAt,
      );
    if (
      latest === null ||
      epochNanoseconds > latest.epochNanoseconds ||
      (
        epochNanoseconds === latest.epochNanoseconds &&
        compareAsciiIds(candidate.itemId, latest.itemId) > 0
      )
    ) {
      latest = { ...candidate, epochNanoseconds };
    }
  }
  return latest?.summary ?? null;
}

function buildSubjectView(
  subjectId: string,
  candidates: readonly ProgressTopicCandidate[],
): ProgressSubjectView {
  const subject = getMapSubject(subjectId);
  if (subject === undefined) {
    throw new TypeError(`Unknown progress subject "${subjectId}"`);
  }
  const byDomain = new Map<string, ProgressTopicCandidate[]>();
  for (const candidate of candidates) {
    const domainCandidates = byDomain.get(candidate.domainId) ?? [];
    domainCandidates.push(candidate);
    byDomain.set(candidate.domainId, domainCandidates);
  }
  const domains: ProgressDomainView[] = [...byDomain]
    .sort(
      ([leftId], [rightId]) =>
        (DOMAIN_ORDER.get(leftId) ?? Number.MAX_SAFE_INTEGER) -
          (DOMAIN_ORDER.get(rightId) ?? Number.MAX_SAFE_INTEGER) ||
        compareAsciiIds(leftId, rightId),
    )
    .map(([domainId, domainCandidates]) => ({
      domainId,
      displayName: domainCandidates[0].domainDisplayName,
      topics: [...domainCandidates]
        .sort(
          (left, right) =>
            left.orderMonths - right.orderMonths ||
            compareAsciiIds(left.topic.itemId, right.topic.itemId),
        )
        .map((candidate) => candidate.topic),
    }));
  const hasConflict = candidates.some(
    (candidate) => candidate.topic.state === "conflict",
  );
  const hasToday = candidates.some(
    (candidate) => candidate.topic.state === "observed_today",
  );
  return {
    subjectId,
    displayName: subject.displayName,
    evidenceCount: candidates.reduce(
      (total, candidate) => total + candidate.evidenceCount,
      0,
    ),
    latestObservedAt: latestObservedAt(candidates),
    state: hasConflict
      ? "conflict"
      : hasToday
        ? "updated_recently"
        : "older",
    summary: latestSubjectSummary(candidates, hasConflict),
    domains,
  };
}

/**
 * Builds the rebuildable subject, domain, and topic projection without I/O.
 */
export function buildChildProgressView(input: {
  child: { id: string; name: string; birthDate: string };
  familyId: string;
  timeZone: string;
  evidence: readonly ProgressEvidence[];
  conflicts: readonly ProgressConflict[];
  selectionAnswers: readonly ProgressSelectionAnswer[];
  now: Date;
}): ChildProgressView {
  if (!Number.isFinite(input.now.getTime())) {
    throw new TypeError("Progress projection requires a valid current time");
  }
  let today: string;
  try {
    today = zonedDateString(input.now, input.timeZone);
  } catch {
    throw new TypeError(`Invalid IANA time zone "${input.timeZone}"`);
  }

  const resolved = resolveEffectiveProgressEvidence({
    childId: input.child.id,
    familyId: input.familyId,
    evidence: input.evidence,
    conflicts: input.conflicts,
  });
  const evidenceById = new Map(
    input.evidence.map((evidence) => [evidence.id, evidence]),
  );
  const candidates = resolved.effectiveEvidence.map((evidence) =>
    buildEvidenceTopicCandidate(evidence, today, input.timeZone),
  );
  const conflictViews: OpenProgressConflictView[] = [];
  for (const conflict of resolved.openConflicts) {
    const built = buildOpenConflict(conflict, evidenceById);
    candidates.push(built.candidate);
    conflictViews.push(built.view);
  }

  const ageMonths = ageInMonths(
    input.child.birthDate,
    utcNoonForDateKey(today),
  );
  const renderedSubjectIds = new Set(
    candidates.map((candidate) => candidate.subjectId),
  );
  const selectionAnswers = buildProgressSelectionAnswers({
    childId: input.child.id,
    familyId: input.familyId,
    evidence: input.evidence,
    conflicts: input.conflicts,
    selectionAnswers: input.selectionAnswers,
  });
  const answeredItemIds = new Set(
    selectionAnswers.map((answer) => answer.itemId),
  );
  for (const subject of MAP_SUBJECTS) {
    if (!renderedSubjectIds.has(subject.id)) continue;
    const nextItem = selectNextProgressItem({
      ageMonths,
      subjectIds: [subject.id],
      answers: selectionAnswers,
    });
    if (
      nextItem !== null &&
      !answeredItemIds.has(nextItem.id)
    ) {
      candidates.push(buildAskNextCandidate(nextItem.id));
    }
  }

  const subjects = MAP_SUBJECTS.flatMap((subject) => {
    const subjectCandidates = candidates.filter(
      (candidate) => candidate.subjectId === subject.id,
    );
    return subjectCandidates.length === 0
      ? []
      : [buildSubjectView(subject.id, subjectCandidates)];
  });
  const scoreInputs = resolved.effectiveEvidence.flatMap((evidence) =>
    getMapItem(evidence.itemId) === undefined
      ? []
      : [{ itemId: evidence.itemId, answer: evidence.answer }],
  );

  return {
    childId: input.child.id,
    childName: input.child.name,
    birthDate: input.child.birthDate,
    timeZone: input.timeZone,
    projectedAt: input.now.toISOString(),
    scores: scoreMap(ageMonths, scoreInputs),
    subjects,
    conflicts: conflictViews,
  };
}
