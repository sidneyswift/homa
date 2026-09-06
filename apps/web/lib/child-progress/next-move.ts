import {
  ageInMonths,
  type ChildProgressView,
  type ProgressNextMove,
  type ProgressNextMoveEvidence,
} from "@homa/core";
import { z } from "zod";

import type { ChildProgressProjectionInput } from "./repository";
import { resolveEffectiveProgressEvidence } from "./effective-evidence";
import { PROGRESS_EVIDENCE_FRESH_DAYS } from "./evidence-freshness";
import { SKILL_CATALOG_BY_ID } from "./skill-catalog";

export const PROGRESS_NEXT_MOVE_FRESH_DAYS = PROGRESS_EVIDENCE_FRESH_DAYS;
const MAX_MODEL_TARGETS = 8;
const MAX_MODEL_EVIDENCE = 12;
const DAY_MS = 24 * 60 * 60 * 1_000;

const itemIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160);
const proposalCopySchema = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .refine(
      (value) => Array.from(value).length <= maximum,
      `must contain at most ${maximum} characters`,
    )
    .refine((value) => !value.includes("\u2014"), "em dash is not allowed");

export const progressNextMoveCandidateSchema = z
  .object({
    childId: z.string().uuid(),
    targetItemId: itemIdSchema,
    evidenceItemIds: z
      .array(itemIdSchema)
      .min(1)
      .max(3)
      .refine(
        (values) => new Set(values).size === values.length,
        "evidence item ids must be distinct",
      ),
    minutes: z.union([z.literal(5), z.literal(10), z.literal(15)]),
    activity: proposalCopySchema(320),
    why: proposalCopySchema(240),
  })
  .strict();

export const progressNextMoveProposalSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("move"),
      candidate: progressNextMoveCandidateSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("stop"),
      childId: z.string().uuid(),
      reason: z.enum([
        "insufficient_fit",
        "needs_parent_choice",
        "unsafe_activity",
      ]),
    })
    .strict(),
]);

export type ProgressNextMoveCandidate = z.infer<
  typeof progressNextMoveCandidateSchema
>;
export type ProgressNextMoveProposal = z.infer<
  typeof progressNextMoveProposalSchema
>;

export type ProgressNextMoveRejectionReason =
  | "invalid_proposal"
  | "wrong_child"
  | "unknown_target"
  | "target_outside_working_edge"
  | "target_not_grounded"
  | "unknown_evidence"
  | "unknown_provenance"
  | "stale_evidence"
  | "conflicting_evidence"
  | "cross_subject_evidence";

function safeChildName(value: string): string {
  return Array.from(
    value
      .replace(/[\u0000-\u001f\u007f]/gu, " ")
      .replace(/\u2014/gu, "-")
      .trim(),
  )
    .slice(0, 80)
    .join("") || "your child";
}

function ageDays(observedAt: string, now: Date): number | null {
  const observedMs = Date.parse(observedAt);
  if (!Number.isFinite(observedMs)) return null;
  const days = (now.getTime() - observedMs) / DAY_MS;
  return days >= 0 && days <= PROGRESS_NEXT_MOVE_FRESH_DAYS ? days : null;
}

export interface ProgressNextMoveModelEvidence
  extends Omit<ProgressNextMoveEvidence, "evidenceId"> {
  subjectId: string;
  subjectName: string;
  sourceKind: ProgressNextMoveEvidence["sourceKind"];
  adultDisplayName: string | null;
  receipt: string;
}

const SOURCE_RECEIPT_LABELS: Record<
  ProgressNextMoveEvidence["sourceKind"],
  string
> = {
  journal: "journal note",
  conversation: "conversation",
  check_in: "check-in answer",
  checklist: "progress checklist answer",
  deep_dive: "focused check-in answer",
  correction: "correction",
  report_correction: "report correction",
  report_probe: "report follow-up",
  recheck: "follow-up check",
  onboarding_walk: "onboarding answer",
  legacy: "earlier progress answer",
  lesson_listen: "lesson recording",
};

function safeAdultDisplayName(value: string | null): string | null {
  if (!value) return null;
  const safe = Array.from(
    value
      .replace(/[\u0000-\u001f\u007f]/gu, " ")
      .replace(/\u2014/gu, "-")
      .trim(),
  )
    .slice(0, 80)
    .join("");
  return safe.length > 0 ? safe : null;
}

function evidenceReceipt(input: {
  sourceKind: ProgressNextMoveEvidence["sourceKind"];
  derivation: ProgressNextMoveEvidence["derivation"];
  adultDisplayName: string | null;
  observedAt: string;
  timeZone: string;
}): string {
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: input.timeZone,
  }).format(new Date(input.observedAt));
  const source = SOURCE_RECEIPT_LABELS[input.sourceKind];
  const adult = safeAdultDisplayName(input.adultDisplayName);
  const article = /^[AEIO]/u.test(date) ? "an" : "a";
  const receipt = adult
    ? `From ${adult}’s ${date} ${source}`
    : `From ${article} ${date} ${source}`;
  return input.derivation === "inferred"
    ? `${receipt}, matched by Homa`
    : receipt;
}

export interface ProgressNextMoveModelTarget {
  itemId: string;
  statement: string;
  subjectId: string;
  subjectName: string;
  role: "current_evidence";
}

export interface ProgressNextMoveModelContext {
  child: {
    childId: string;
    childName: string;
    ageMonths: number;
  };
  eligibleEvidence: ProgressNextMoveModelEvidence[];
  allowedTargets: ProgressNextMoveModelTarget[];
}

function clarification(input: {
  view: ChildProgressView;
  sourceRevision: string;
  reason: Extract<ProgressNextMove, { kind: "clarify" }>["reason"];
  statement?: string;
}): Extract<ProgressNextMove, { kind: "clarify" }> {
  const childName = safeChildName(input.view.childName);
  switch (input.reason) {
    case "conflict": {
      const statement = input.statement ?? "this skill";
      return {
        kind: "clarify",
        childId: input.view.childId,
        sourceRevision: input.sourceRevision,
        reason: input.reason,
        title: "One quick check",
        question: `What does “${statement}” look like for ${childName} right now?`,
        why: "Two recent family notes point in different directions. Your answer will help Homa suggest the right-sized next step.",
        chatDraft: `Right now, ${childName}: `,
      };
    }
    case "stale": {
      const statement = input.statement ?? "this skill";
      return {
        kind: "clarify",
        childId: input.view.childId,
        sourceRevision: input.sourceRevision,
        reason: input.reason,
        title: "Check what changed",
        question: `Has anything changed lately with “${statement}”?`,
        why: "The last clear answer is over a month old. A quick update will help Homa stay current.",
        chatDraft: `Lately, ${childName} has been: `,
      };
    }
    case "unknown_provenance": {
      const statement = input.statement ?? "this skill";
      return {
        kind: "clarify",
        childId: input.view.childId,
        sourceRevision: input.sourceRevision,
        reason: input.reason,
        title: "Confirm it first",
        question: `Can we confirm how “${statement}” went for ${childName}?`,
        why: "Some source details are missing, so Homa will wait for your confirmation before suggesting anything.",
        chatDraft: `Here is what happened with ${statement}: `,
      };
    }
    case "sparse":
      return {
        kind: "clarify",
        childId: input.view.childId,
        sourceRevision: input.sourceRevision,
        reason: input.reason,
        title: "Start with one moment",
        question: `What did ${childName} do recently that felt newly easy or still needed help?`,
        why: "One concrete moment gives Homa enough to suggest something that actually fits.",
        chatDraft: `${childName} recently: `,
      };
  }
}

/**
 * Produces the complete, bounded choice set for the judgment layer. The model
 * receives no raw ledger rows, source ids, sibling data, or targets that code
 * would reject later.
 */
export function buildProgressNextMoveModelContext(input: {
  familyId: string;
  view: ChildProgressView;
  ledger: ChildProgressProjectionInput;
  now: Date;
}): ProgressNextMoveModelContext {
  const resolved = resolveEffectiveProgressEvidence({
    childId: input.view.childId,
    familyId: input.familyId,
    evidence: input.ledger.evidence,
    conflicts: input.ledger.conflicts,
  });
  const childAgeMonths = ageInMonths(input.view.birthDate, input.now);
  const allEligibleEvidence = resolved.effectiveEvidence
    .flatMap((row): ProgressNextMoveModelEvidence[] => {
      const catalog = SKILL_CATALOG_BY_ID.get(row.itemId);
      if (
        !catalog ||
        row.derivation === "unknown" ||
        ageDays(row.observedAt, input.now) === null
      ) {
        return [];
      }
      return [
        {
          itemId: row.itemId,
          statement: catalog.statement,
          subjectId: catalog.subjectId,
          subjectName: catalog.subjectName,
          answer: row.answer,
          derivation: row.derivation,
          sourceKind: row.source,
          adultDisplayName: safeAdultDisplayName(row.adultDisplayName),
          observedAt: row.observedAt,
          receipt: evidenceReceipt({
            sourceKind: row.source,
            derivation: row.derivation,
            adultDisplayName: row.adultDisplayName,
            observedAt: row.observedAt,
            timeZone: input.view.timeZone,
          }),
        },
      ];
    })
    .sort(
      (left, right) =>
        Date.parse(right.observedAt) - Date.parse(left.observedAt) ||
        left.itemId.localeCompare(right.itemId),
    );

  const targetEvidence = allEligibleEvidence
    .filter((row) => row.answer !== "easily")
    .sort(
      (left, right) =>
        Number(right.answer === "not_yet") -
          Number(left.answer === "not_yet") ||
        Date.parse(right.observedAt) - Date.parse(left.observedAt) ||
        left.itemId.localeCompare(right.itemId),
    )
    .slice(0, MAX_MODEL_TARGETS);
  const currentIds = new Set(targetEvidence.map((row) => row.itemId));
  const allowedTargets = [...currentIds].flatMap(
    (itemId): ProgressNextMoveModelTarget[] => {
      const catalog = SKILL_CATALOG_BY_ID.get(itemId);
      if (!catalog) return [];
      return [
        {
          itemId,
          statement: catalog.statement,
          subjectId: catalog.subjectId,
          subjectName: catalog.subjectName,
          role: "current_evidence",
        },
      ];
    },
  );
  const targetSubjectIds = new Set(
    allowedTargets.map((target) => target.subjectId),
  );
  const eligibleEvidence = allEligibleEvidence
    .filter((row) => targetSubjectIds.has(row.subjectId))
    .slice(0, MAX_MODEL_EVIDENCE);

  return {
    child: {
      childId: input.view.childId,
      childName: safeChildName(input.view.childName),
      ageMonths: childAgeMonths,
    },
    eligibleEvidence,
    allowedTargets,
  };
}

export function progressNextMoveClarification(input: {
  familyId: string;
  view: ChildProgressView;
  ledger: ChildProgressProjectionInput;
  now: Date;
}): Extract<ProgressNextMove, { kind: "clarify" }> | null {
  const resolved = resolveEffectiveProgressEvidence({
    childId: input.view.childId,
    familyId: input.familyId,
    evidence: input.ledger.evidence,
    conflicts: input.ledger.conflicts,
  });
  const firstConflict = resolved.openConflicts[0];
  if (firstConflict) {
    return clarification({
      view: input.view,
      sourceRevision: input.ledger.sourceRevision.toString(),
      reason: "conflict",
      statement:
        SKILL_CATALOG_BY_ID.get(firstConflict.itemId)?.statement ??
        "this skill",
    });
  }

  const catalogEvidence = resolved.effectiveEvidence.filter((evidence) =>
    SKILL_CATALOG_BY_ID.has(evidence.itemId),
  );
  if (catalogEvidence.length === 0) {
    return clarification({
      view: input.view,
      sourceRevision: input.ledger.sourceRevision.toString(),
      reason: "sparse",
    });
  }
  const knownEvidence = catalogEvidence.filter(
    (evidence) => evidence.derivation !== "unknown",
  );
  const freshKnown = knownEvidence.filter(
    (evidence) => ageDays(evidence.observedAt, input.now) !== null,
  );
  if (freshKnown.length > 0) return null;

  const freshUnknown = catalogEvidence.filter(
    (evidence) =>
      evidence.derivation === "unknown" &&
      ageDays(evidence.observedAt, input.now) !== null,
  );
  // freshUnknown and knownEvidence can both be empty at once: every row
  // in catalogEvidence is derivation "unknown" AND stale (legacy-matcher
  // evidence with nothing newer to supersede it). catalogEvidence itself
  // is never empty here (the sparse check above already returned), so
  // falling back to it keeps `newest` defined and its itemId resolvable
  // in SKILL_CATALOG_BY_ID, instead of leaking the "this skill" default
  // to a parent.
  const clarificationEvidence =
    freshUnknown.length > 0
      ? freshUnknown
      : knownEvidence.length > 0
        ? knownEvidence
        : catalogEvidence;
  const newest = clarificationEvidence
    .slice()
    .sort(
      (left, right) =>
        Date.parse(right.observedAt) - Date.parse(left.observedAt),
    )[0];
  const statement = newest
    ? SKILL_CATALOG_BY_ID.get(newest.itemId)?.statement
    : undefined;
  return clarification({
    view: input.view,
    sourceRevision: input.ledger.sourceRevision.toString(),
    reason:
      freshUnknown.length > 0 || knownEvidence.length === 0
        ? "unknown_provenance"
        : "stale",
    ...(statement ? { statement } : {}),
  });
}

export type ProgressNextMoveVerification =
  | { accepted: true; nextMove: Extract<ProgressNextMove, { kind: "move" }> }
  | {
      accepted: false;
      reason: ProgressNextMoveRejectionReason;
      clarification: Extract<ProgressNextMove, { kind: "clarify" }> | null;
    };

export function verifyProgressNextMoveCandidate(input: {
  familyId: string;
  view: ChildProgressView;
  ledger: ChildProgressProjectionInput;
  candidate: unknown;
  now: Date;
}): ProgressNextMoveVerification {
  const parsed = progressNextMoveCandidateSchema.safeParse(input.candidate);
  if (
    input.ledger.child.id !== input.view.childId ||
    input.ledger.familyId !== input.familyId
  ) {
    return {
      accepted: false,
      reason: "wrong_child",
      clarification: null,
    };
  }
  const stateClarification = progressNextMoveClarification(input);
  if (!parsed.success) {
    return {
      accepted: false,
      reason: "invalid_proposal",
      clarification: stateClarification,
    };
  }
  const candidate = parsed.data;
  if (
    candidate.childId !== input.view.childId ||
    input.ledger.child.id !== input.view.childId ||
    input.ledger.familyId !== input.familyId
  ) {
    return {
      accepted: false,
      reason: "wrong_child",
      clarification: stateClarification,
    };
  }
  if (stateClarification) {
    const reason: ProgressNextMoveRejectionReason =
      stateClarification.reason === "conflict"
        ? "conflicting_evidence"
        : stateClarification.reason === "unknown_provenance"
          ? "unknown_provenance"
          : stateClarification.reason === "stale"
            ? "stale_evidence"
            : "unknown_evidence";
    return { accepted: false, reason, clarification: stateClarification };
  }

  const allowedTargetIds = new Set(
    buildProgressNextMoveModelContext(input).allowedTargets.map(
      (allowedTarget) => allowedTarget.itemId,
    ),
  );
  if (!allowedTargetIds.has(candidate.targetItemId)) {
    return {
      accepted: false,
      reason: "target_outside_working_edge",
      clarification: null,
    };
  }

  const target = SKILL_CATALOG_BY_ID.get(candidate.targetItemId);
  if (!target) {
    return {
      accepted: false,
      reason: "unknown_target",
      clarification: null,
    };
  }
  const resolved = resolveEffectiveProgressEvidence({
    childId: input.view.childId,
    familyId: input.familyId,
    evidence: input.ledger.evidence,
    conflicts: input.ledger.conflicts,
  });
  const evidenceByItemId = new Map(
    resolved.effectiveEvidence.map((evidence) => [evidence.itemId, evidence]),
  );
  const targetEvidence = evidenceByItemId.get(candidate.targetItemId);
  const targetIsCurrent =
    targetEvidence !== undefined &&
    targetEvidence.derivation !== "unknown" &&
    ageDays(targetEvidence.observedAt, input.now) !== null;
  if (!targetIsCurrent) {
    return {
      accepted: false,
      reason: "target_outside_working_edge",
      clarification: null,
    };
  }
  if (!candidate.evidenceItemIds.includes(candidate.targetItemId)) {
    return {
      accepted: false,
      reason: "target_not_grounded",
      clarification: null,
    };
  }

  const evidence: ProgressNextMoveEvidence[] = [];
  for (const itemId of candidate.evidenceItemIds) {
    const row = evidenceByItemId.get(itemId);
    if (!row) {
      return {
        accepted: false,
        reason: "unknown_evidence",
        clarification: null,
      };
    }
    if (row.derivation === "unknown") {
      return {
        accepted: false,
        reason: "unknown_provenance",
        clarification: null,
      };
    }
    if (ageDays(row.observedAt, input.now) === null) {
      return {
        accepted: false,
        reason: "stale_evidence",
        clarification: null,
      };
    }
    const catalog = SKILL_CATALOG_BY_ID.get(itemId);
    if (!catalog) {
      return {
        accepted: false,
        reason: "unknown_evidence",
        clarification: null,
      };
    }
    if (catalog.subjectId !== target.subjectId) {
      return {
        accepted: false,
        reason: "cross_subject_evidence",
        clarification: null,
      };
    }
    evidence.push({
      evidenceId: row.id,
      itemId,
      statement: catalog.statement,
      answer: row.answer,
      derivation: row.derivation,
      sourceKind: row.source,
      adultDisplayName: safeAdultDisplayName(row.adultDisplayName),
      observedAt: row.observedAt,
      receipt: evidenceReceipt({
        sourceKind: row.source,
        derivation: row.derivation,
        adultDisplayName: row.adultDisplayName,
        observedAt: row.observedAt,
        timeZone: input.view.timeZone,
      }),
    });
  }

  const childName = safeChildName(input.view.childName);
  return {
    accepted: true,
    nextMove: {
      kind: "move",
      childId: input.view.childId,
      sourceRevision: input.ledger.sourceRevision.toString(),
      targetItemId: target.itemId,
      targetStatement: target.statement,
      minutes: candidate.minutes,
      activity: candidate.activity,
      why: candidate.why,
      evidence,
      chatDraft: `Help me adjust this for ${childName}: ${candidate.activity}`,
    },
  };
}
