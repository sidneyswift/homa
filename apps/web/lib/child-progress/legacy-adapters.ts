import { createHash } from "node:crypto";

import { getMapItem, type MapAnswer } from "@homa/core";
import {
  getProgressTaxonomyDomain,
  getProgressTaxonomyTopic,
} from "@homa/taxonomy/progress";
import type postgres from "postgres";

import { isProgressEvidenceAnswer } from "./evidence-policy";
import { liveProgressEnabled } from "./flag";
import {
  CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY,
} from "./postgres-repository-helpers";
import {
  correctProgressAnswers,
  recordProgressEvidence,
} from "./runtime";
import { mapDb } from "../map/db";

export type LegacyProgressAnswerSource =
  | "checklist"
  | "deep_dive"
  | "onboarding_walk"
  | "conversation";

export interface LegacyProgressAnswerInput {
  familyId: string;
  childId: string;
  itemId: string;
  answer: MapAnswer;
  source: LegacyProgressAnswerSource;
  memberUserId: string | null;
  channel?: "web" | "sms" | "email";
  messageId?: string;
  providerMessageId?: string;
  observedAt: string;
  idempotencyKey: string;
}

export interface LegacyProgressCorrectionInput {
  familyId: string;
  childId: string;
  changes: Array<{ itemId: string; answer: MapAnswer | null }>;
  source:
    | LegacyProgressAnswerSource
    | "report_correction"
    | "report_probe"
    | "recheck"
    | "conversation"
    | "correction";
  memberUserId: string | null;
  observedAt: string;
  idempotencyKey: string;
}

export interface LegacyProgressDeleteInput {
  familyId: string;
  childId: string;
  itemId: string;
  memberUserId: string | null;
  observedAt: string;
  idempotencyKey: string;
}

export type LegacyProgressAdapterResult =
  | { status: "saved"; mode: "legacy" | "child_progress" }
  | { status: "unknown_child_or_item" }
  | { status: "unknown_actor" }
  | { status: "idempotency_mismatch" }
  | { status: "conflict_pending"; conflictId: string };

export interface LegacyProgressAdapterDependencies {
  liveProgressEnabled(): boolean;
  isKnownAnswerItem(itemId: string): boolean;
  isKnownWalkAssessmentTopic(itemId: string): boolean;
  saveLegacyAnswer(
    input: LegacyProgressAnswerInput,
  ): Promise<boolean>;
  deleteLegacyAnswer(input: {
    familyId: string;
    childId: string;
    itemId: string;
  }): Promise<boolean>;
  correctLegacyAnswers(input: {
    familyId: string;
    childId: string;
    changes: Array<{ itemId: string; answer: MapAnswer }>;
    source: LegacyProgressCorrectionInput["source"];
  }): Promise<boolean>;
  saveWalkCoverageAnswer(
    input: LegacyProgressAnswerInput,
  ): Promise<boolean>;
  recordChildProgressEvidence(
    input: LegacyProgressAnswerInput,
  ): Promise<{
    status: string;
    conflictId?: string;
    original?: { status: string; conflictId?: string };
  }>;
  correctChildProgressAnswers(
    input: LegacyProgressCorrectionInput,
  ): Promise<{
    status: string;
    conflictId?: string;
    original?: { status: string; conflictId?: string };
  }>;
}

export interface LegacyProgressAdapters {
  saveAnswer(
    input: LegacyProgressAnswerInput,
  ): Promise<LegacyProgressAdapterResult>;
  deleteAnswer(
    input: LegacyProgressDeleteInput,
  ): Promise<LegacyProgressAdapterResult>;
  correctAnswers(
    input: LegacyProgressCorrectionInput,
  ): Promise<LegacyProgressAdapterResult>;
}

export function legacyProgressTransportIdempotencyKey(input: {
  operation: string;
  channel: "web" | "sms" | "email";
  providerMessageId: string | null;
  inboundReceiptId?: string | null;
  runtimeSessionId: string;
  turnId: string;
}): string {
  if (
    input.operation.trim().length === 0 ||
    input.runtimeSessionId.trim().length === 0 ||
    input.turnId.trim().length === 0
  ) {
    throw new TypeError(
      "Legacy progress idempotency requires operation, session, and turn identity",
    );
  }
  const providerMessageId = input.providerMessageId?.trim() || null;
  const inboundReceiptId = input.inboundReceiptId?.trim() || null;
  const identity =
    providerMessageId !== null
      ? [
          "provider",
          input.channel,
          providerMessageId,
        ]
      : inboundReceiptId !== null
        ? [
            "receipt",
            input.channel,
            inboundReceiptId,
          ]
        : [
            "runtime",
            input.runtimeSessionId,
            input.turnId,
          ];
  const digest = createHash("sha256")
    .update([input.operation, ...identity].join("\u0000"))
    .digest("hex");
  return `legacy-progress:${input.operation}:${digest}`;
}

/**
 * Keeps rollout branching in one service so flag-off writers never reach
 * ChildProgress tables before the additive migration exists.
 */
export function createLegacyProgressAdapters(
  dependencies: LegacyProgressAdapterDependencies,
): LegacyProgressAdapters {
  async function saveChildProgressCorrection(
    input: LegacyProgressCorrectionInput,
  ): Promise<LegacyProgressAdapterResult> {
    const result =
      await dependencies.correctChildProgressAnswers(input);
    if (
      result.status === "answers_corrected" ||
      (
        result.status === "duplicate" &&
        result.original?.status === "answers_corrected"
      )
    ) {
      return { status: "saved", mode: "child_progress" };
    }
    const conflictId =
      result.status === "conflict_pending"
        ? result.conflictId
        : result.status === "duplicate" &&
            result.original?.status === "conflict_pending"
          ? result.original.conflictId
          : undefined;
    if (conflictId) {
      return {
        status: "conflict_pending",
        conflictId,
      };
    }
    if (result.status === "idempotency_mismatch") {
      return { status: "idempotency_mismatch" };
    }
    if (
      result.status === "unknown_child" ||
      result.status === "unknown_item"
    ) {
      return { status: "unknown_child_or_item" };
    }
    if (result.status === "unknown_actor") {
      return { status: "unknown_actor" };
    }
    throw new Error("Unsupported ChildProgress correction result");
  }

  return {
    async saveAnswer(input) {
      if (!dependencies.liveProgressEnabled()) {
        const saved =
          input.source === "conversation"
            ? await dependencies.correctLegacyAnswers({
                familyId: input.familyId,
                childId: input.childId,
                changes: [{
                  itemId: input.itemId,
                  answer: input.answer,
                }],
                source: input.source,
              })
            : await dependencies.saveLegacyAnswer(input);
        return saved
          ? { status: "saved", mode: "legacy" }
          : { status: "unknown_child_or_item" };
      }
      if (
        input.source === "onboarding_walk" &&
        !dependencies.isKnownWalkAssessmentTopic(input.itemId)
      ) {
        return { status: "unknown_child_or_item" };
      }
      if (
        input.source === "onboarding_walk" &&
        !isProgressEvidenceAnswer(input.answer)
      ) {
        const saved =
          await dependencies.saveWalkCoverageAnswer(input);
        return saved
          ? { status: "saved", mode: "child_progress" }
          : { status: "unknown_child_or_item" };
      }
      if (isProgressEvidenceAnswer(input.answer)) {
        const result =
          await dependencies.recordChildProgressEvidence(input);
        if (
          result.status === "recorded" ||
          result.status === "conflict_open" ||
          (
            result.status === "duplicate" &&
            (
              result.original?.status === "recorded" ||
              result.original?.status === "conflict_open"
            )
          )
        ) {
          return { status: "saved", mode: "child_progress" };
        }
        const conflictId =
          result.status === "conflict_pending"
            ? result.conflictId
            : result.status === "duplicate" &&
                result.original?.status === "conflict_pending"
              ? result.original.conflictId
              : undefined;
        if (conflictId) {
          return { status: "conflict_pending", conflictId };
        }
        if (result.status === "idempotency_mismatch") {
          return { status: "idempotency_mismatch" };
        }
        if (
          result.status === "unknown_child" ||
          result.status === "unknown_actor"
        ) {
          return result.status === "unknown_actor"
            ? { status: "unknown_actor" }
            : { status: "unknown_child_or_item" };
        }
      } else {
        return saveChildProgressCorrection({
          familyId: input.familyId,
          childId: input.childId,
          changes: [{
            itemId: input.itemId,
            answer: input.answer,
          }],
          source: input.source,
          memberUserId: input.memberUserId,
          observedAt: input.observedAt,
          idempotencyKey: input.idempotencyKey,
        });
      }
      throw new Error("Unsupported ChildProgress answer result");
    },
    async deleteAnswer(input) {
      if (!dependencies.liveProgressEnabled()) {
        const deleted = await dependencies.deleteLegacyAnswer(input);
        return deleted
          ? { status: "saved", mode: "legacy" }
          : { status: "unknown_child_or_item" };
      }
      return saveChildProgressCorrection({
        familyId: input.familyId,
        childId: input.childId,
        changes: [{ itemId: input.itemId, answer: null }],
        source: "correction",
        memberUserId: input.memberUserId,
        observedAt: input.observedAt,
        idempotencyKey: input.idempotencyKey,
      });
    },
    async correctAnswers(input) {
      if (!dependencies.liveProgressEnabled()) {
        const legacyChanges = input.changes.flatMap((change) =>
          change.answer === null ||
          !dependencies.isKnownAnswerItem(change.itemId)
            ? []
            : [{ itemId: change.itemId, answer: change.answer }]
        );
        if (legacyChanges.length === 0) {
          return { status: "unknown_child_or_item" };
        }
        const corrected =
          await dependencies.correctLegacyAnswers({
            familyId: input.familyId,
            childId: input.childId,
            changes: legacyChanges,
            source: input.source,
          });
        return corrected
          ? { status: "saved", mode: "legacy" }
          : { status: "unknown_child_or_item" };
      }
      const unknownItem = input.changes.find(
        (change) =>
          !dependencies.isKnownAnswerItem(change.itemId),
      );
      if (unknownItem !== undefined) {
        return { status: "unknown_child_or_item" };
      }
      return saveChildProgressCorrection(input);
    },
  };
}

type LegacyProgressTransaction = postgres.TransactionSql;

function isKnownWalkAssessmentTopic(itemId: string): boolean {
  const topic = getProgressTaxonomyTopic(itemId);
  if (!topic) return false;
  const domain = getProgressTaxonomyDomain(topic.domain);
  return (
    domain?.kind === "assessment" &&
    domain.subject === topic.subject
  );
}

async function withLegacyProgressWrite<T>(
  operation: (
    sql: LegacyProgressTransaction,
  ) => Promise<T>,
  database: postgres.Sql = mapDb(),
): Promise<T> {
  const wrapped = await database.begin(async (transactionSql) => {
    await transactionSql`
      select pg_advisory_xact_lock_shared(
        ${CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY}::bigint
      )
    `;
    return { value: await operation(transactionSql) };
  });
  return wrapped.value;
}

export async function saveWalkCoverageAnswerWithDatabase(
  input: LegacyProgressAnswerInput,
  database: postgres.Sql = mapDb(),
): Promise<boolean> {
  if (
    input.source !== "onboarding_walk" ||
    isProgressEvidenceAnswer(input.answer) ||
    !isKnownWalkAssessmentTopic(input.itemId)
  ) {
    return false;
  }
  return withLegacyProgressWrite(async (sql) => {
    if (
      !await legacyChildExists(
        sql,
        input.familyId,
        input.childId,
      )
    ) {
      return false;
    }
    const conflicts = await sql<{ id: string }[]>`
      select conflict.id
      from public.child_progress_conflicts conflict
      where conflict.child_id = ${input.childId}
        and conflict.family_id = ${input.familyId}
        and conflict.item_id = ${input.itemId}
        and conflict.state = 'open'
      limit 1
    `;
    if (conflicts.length > 0) return false;
    await sql`
      update public.child_progress_evidence evidence
      set superseded_at = ${input.observedAt}
      where evidence.child_id = ${input.childId}
        and evidence.family_id = ${input.familyId}
        and evidence.item_id = ${input.itemId}
        and evidence.superseded_at is null
        and evidence.observed_at <= ${input.observedAt}
    `;
    await sql`
      insert into public.child_answers (
        child_id, question_id, answer, source, answered_at
      )
      values (
        ${input.childId}, ${input.itemId}, ${input.answer},
        'onboarding_walk', ${input.observedAt}
      )
      on conflict (child_id, question_id)
      do update set answer = excluded.answer,
                    source = excluded.source,
                    answered_at = excluded.answered_at
    `;
    return true;
  }, database);
}

async function legacyChildExists(
  sql: LegacyProgressTransaction,
  familyId: string,
  childId: string,
): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    select child.id
    from public.children child
    where child.id = ${childId}
      and child.family_id = ${familyId}
    for update
  `;
  return rows.length === 1;
}

async function touchLegacyProgressFamily(
  sql: LegacyProgressTransaction,
  familyId: string,
): Promise<void> {
  await sql`
    update public.families
    set updated_at = now()
    where id = ${familyId}
  `;
}

export function createDefaultLegacyProgressAdapters(
  database?: postgres.Sql,
): LegacyProgressAdapters {
  return createLegacyProgressAdapters({
    liveProgressEnabled,
    isKnownAnswerItem: (itemId) => getMapItem(itemId) !== undefined,
    isKnownWalkAssessmentTopic,
    async saveLegacyAnswer(input) {
      return withLegacyProgressWrite(async (sql) => {
        if (
          !await legacyChildExists(
            sql,
            input.familyId,
            input.childId,
          )
        ) {
          return false;
        }
        const legacySource =
          input.source === "onboarding_walk"
            ? "onboarding_walk"
            : "checklist";
        await sql`
          insert into public.child_answers (
            child_id, question_id, answer, source
          )
          values (
            ${input.childId}, ${input.itemId}, ${input.answer},
            ${legacySource}
          )
          on conflict (child_id, question_id)
          do update set answer = excluded.answer, answered_at = now()
        `;
        if (input.source !== "onboarding_walk") {
          await touchLegacyProgressFamily(sql, input.familyId);
        }
        return true;
      }, database ?? mapDb());
    },
    async deleteLegacyAnswer(input) {
      return withLegacyProgressWrite(async (sql) => {
        if (
          !await legacyChildExists(
            sql,
            input.familyId,
            input.childId,
          )
        ) {
          return false;
        }
        await sql`
          delete from public.child_answers
          where child_id = ${input.childId}
            and question_id = ${input.itemId}
        `;
        await touchLegacyProgressFamily(sql, input.familyId);
        return true;
      }, database ?? mapDb());
    },
    async correctLegacyAnswers(input) {
      return withLegacyProgressWrite(async (sql) => {
        if (
          !await legacyChildExists(
            sql,
            input.familyId,
            input.childId,
          )
        ) {
          return false;
        }
        for (const change of input.changes) {
          await sql`
            insert into public.child_answers (
              child_id, question_id, answer, source
            )
            values (
              ${input.childId}, ${change.itemId}, ${change.answer},
              ${input.source}
            )
            on conflict (child_id, question_id)
            do update set answer = excluded.answer,
                          answered_at = now(),
                          source = excluded.source
          `;
        }
        await touchLegacyProgressFamily(sql, input.familyId);
        return true;
      }, database ?? mapDb());
    },
    async saveWalkCoverageAnswer(input) {
      return saveWalkCoverageAnswerWithDatabase(
        input,
        database ?? mapDb(),
      );
    },
    recordChildProgressEvidence(input) {
      if (!isProgressEvidenceAnswer(input.answer)) {
        throw new TypeError(
          "ChildProgress evidence requires an evidence answer",
        );
      }
      return recordProgressEvidence({
        familyId: input.familyId,
        childId: input.childId,
        memberUserId: input.memberUserId,
        itemId: input.itemId,
        answer: input.answer,
        source: input.source,
        quote: null,
        channel: input.channel ?? null,
        messageId: input.messageId ?? null,
        providerMessageId: input.providerMessageId ?? null,
        observedAt: input.observedAt,
        idempotencyKey: input.idempotencyKey,
      });
    },
    correctChildProgressAnswers(input) {
      return correctProgressAnswers({
        ...input,
        source:
          input.source === "conversation"
            ? "correction"
            : input.source,
      });
    },
  });
}

const defaultLegacyProgressAdapters =
  createDefaultLegacyProgressAdapters();

export const saveLegacyProgressAnswer =
  defaultLegacyProgressAdapters.saveAnswer;
export const deleteLegacyProgressAnswer =
  defaultLegacyProgressAdapters.deleteAnswer;
export const correctLegacyProgressAnswers =
  defaultLegacyProgressAdapters.correctAnswers;
