import { createHash } from "node:crypto";

import type { Sql } from "postgres";

import {
  citationSourceNames,
  type ResearchCitation,
} from "../knowledge/citation-source";
import type { BriefKnowledgeRow } from "../knowledge/select-brief";
import { mapDb } from "../map/db";
import {
  loadBriefV2Context,
  type BriefChildContext,
} from "./brief-context";
import {
  usesResearchBriefV2Delivery,
  type TaskDeliveryVersion,
} from "./delivery-version";
import { validateResearchBriefFormat } from "./research-brief-format";

export interface ResearchBriefSourceSnapshot {
  kind: "knowledge_cited";
  id: string;
  title: string;
  sourceNames: string[];
  citationUrls: string[];
  topic: string;
  claims: string[];
  topicType: BriefKnowledgeRow["topicType"];
  lens: NonNullable<BriefKnowledgeRow["lens"]>;
  stage: string | null;
  confidence: Exclude<BriefKnowledgeRow["confidence"], "low">;
  sourceTier: number | null;
}

export interface ResearchBriefReservationKnowledgeRow {
  id: string;
  status: string;
  supersededBy: string | null;
  title: string;
  topicType: BriefKnowledgeRow["topicType"];
  topicKey: string;
  lens: BriefKnowledgeRow["lens"];
  stage: string | null;
  confidence: BriefKnowledgeRow["confidence"];
  sourceTier: number | null;
  citations: readonly ResearchCitation[];
  lastVerifiedAt: string;
  freshnessTtlDays: number;
}

export interface ResearchBriefPreparationScope {
  taskKind: string;
  taskStatus: string;
  child: BriefChildContext;
  siblingNames: readonly string[];
  observationIds: readonly string[];
  sourceId: string;
  sourceSnapshot: ResearchBriefSourceSnapshot;
}

export interface ResearchBriefPreparationRecord {
  familyId: string;
  taskRunId: string;
  knowledgeId: string;
  childId: string;
  observationId?: string;
  draft: string;
  draftHash: string;
  sourceSnapshot: ResearchBriefSourceSnapshot;
}

export interface ResearchBriefPreparationDependencies {
  loadScope(input: {
    familyId: string;
    taskRunId: string;
    knowledgeId: string;
    childId: string;
  }): Promise<ResearchBriefPreparationScope | null>;
  upsert(
    record: ResearchBriefPreparationRecord,
  ): Promise<ResearchBriefPreparationPersistenceResult>;
}

export interface PrepareResearchBriefInput {
  familyId: string;
  taskRunId: string;
  deliveryVersion: TaskDeliveryVersion;
  knowledgeId: string;
  childId: string;
  observationId?: string;
  draft: string;
}

export type PrepareResearchBriefFailureCategory =
  | "dispatch_unavailable"
  | "parent_task"
  | "disabled"
  | "scope_unavailable"
  | "inactive_run"
  | "ineligible_source"
  | "stale_observation"
  | "validation"
  | ResearchBriefPreparationRejection;

export type PrepareResearchBriefResult =
  | { ok: true; draft: string }
  | {
      ok: false;
      retryable: boolean;
      category: PrepareResearchBriefFailureCategory;
      errors: string[];
    };

export type ResearchBriefPreparationRejection =
  | "already_delivered"
  | "inactive_run"
  | "knowledge_row_changed"
  | "knowledge_row_recently_used"
  | "source_reserved";

export type ResearchBriefPreparationPersistenceResult =
  | { prepared: true }
  | { prepared: false; reason: ResearchBriefPreparationRejection };

const APOSTROPHE_VARIANTS = /[\u02BC\u2018\u2019\uFF07]/gu;
const HYPHEN_VARIANTS = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/gu;

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

export function knowledgeRowMatchesPreparationSnapshot(
  row: ResearchBriefReservationKnowledgeRow,
  snapshot: ResearchBriefSourceSnapshot,
  now: Date,
): boolean {
  const verifiedAt = Date.parse(row.lastVerifiedAt);
  const fresh =
    Number.isFinite(verifiedAt) &&
    now.getTime() - verifiedAt <=
      row.freshnessTtlDays * 24 * 60 * 60 * 1000;
  const stageAndTierEligible =
    row.lens === "method" ||
    (row.lens === "current_study"
      ? row.stage !== null &&
        row.sourceTier !== null &&
        row.sourceTier >= 1 &&
        row.sourceTier <= 3
      : row.stage !== null ||
        (row.topicType === "subject" && row.stage === null));
  return (
    row.id === snapshot.id &&
    row.status === "active" &&
    row.supersededBy === null &&
    row.lens !== null &&
    row.confidence !== "low" &&
    fresh &&
    stageAndTierEligible &&
    row.title === snapshot.title &&
    row.topicType === snapshot.topicType &&
    row.topicKey === snapshot.topic &&
    row.lens === snapshot.lens &&
    row.stage === snapshot.stage &&
    row.confidence === snapshot.confidence &&
    row.sourceTier === snapshot.sourceTier &&
    sameStrings(citationSourceNames(row.citations), snapshot.sourceNames) &&
    sameStrings(
      row.citations.map((citation) => citation.url),
      snapshot.citationUrls,
    ) &&
    sameStrings(
      row.citations.map((citation) => citation.claim),
      snapshot.claims,
    )
  );
}

function blockText(draft: string, label: string): string {
  return draft
    .replace(/\r\n/gu, "\n")
    .split("\n")
    .find((line) => line.startsWith(label))
    ?.slice(label.length) ?? "";
}

function normalizedPhrase(value: string): string {
  return value
    .normalize("NFC")
    .replace(APOSTROPHE_VARIANTS, "'")
    .replace(HYPHEN_VARIANTS, "-")
    .replace(/\s+/gu, " ")
    .trim()
    .normalize("NFC");
}

function escapedRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function containsWholePhrase(text: string, phrase: string): boolean {
  const normalizedText = normalizedPhrase(text);
  const normalizedNeedle = normalizedPhrase(phrase);
  if (!normalizedNeedle) return false;
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escapedRegularExpression(normalizedNeedle)}(?![\\p{L}\\p{N}])`,
    "u",
  ).test(normalizedText);
}

function validationErrors(
  draft: string,
  childName: string,
  siblingNames: readonly string[],
  sourceNames: readonly string[],
): string[] {
  const format = validateResearchBriefFormat(draft);
  const errors = format.ok ? [] : [...format.errors];
  const learned = blockText(draft, "What I learned: ");
  const interesting = blockText(draft, "Why it's interesting: ");
  const cta = blockText(draft, "Want me to ");
  if (!sourceNames.some((sourceName) => containsWholePhrase(learned, sourceName))) {
    errors.push("selected source name must appear in What I learned");
  }
  if (!containsWholePhrase(interesting, childName)) {
    errors.push("selected child name must appear in Why it's interesting");
  }
  const siblingAppears = siblingNames.some((siblingName) =>
    containsWholePhrase(draft, siblingName)
  );
  if (siblingAppears) {
    errors.push(
      "nonselected child name must not appear in research brief",
    );
  }
  if (
    siblingNames.some((siblingName) =>
      containsWholePhrase(cta, siblingName)
    )
  ) {
    errors.push("CTA child name must be the selected child");
  }
  return errors;
}

function hashDraft(draft: string): string {
  return createHash("sha256").update(draft).digest("hex");
}

function persistenceError(
  rejection: ResearchBriefPreparationRejection,
): string {
  switch (rejection) {
    case "already_delivered":
      return "research brief preparation was already delivered";
    case "inactive_run":
      return "task run is not an active morning brief";
    case "knowledge_row_changed":
      return "selected knowledge row changed after context loading";
    case "knowledge_row_recently_used":
      return "selected knowledge row was delivered within the last 14 days";
    case "source_reserved":
      return "selected knowledge source is already reserved by another morning brief";
    default: {
      const exhaustive: never = rejection;
      throw new Error(`unhandled preparation rejection: ${String(exhaustive)}`);
    }
  }
}

function preparationFailure(
  category: PrepareResearchBriefFailureCategory,
  errors: string[],
): PrepareResearchBriefResult {
  return {
    ok: false,
    retryable: category === "validation",
    category,
    errors,
  };
}

export function createResearchBriefPreparationService(
  dependencies: ResearchBriefPreparationDependencies,
): (input: PrepareResearchBriefInput) => Promise<PrepareResearchBriefResult> {
  return async (input) => {
    if (!usesResearchBriefV2Delivery(input.deliveryVersion)) {
      return preparationFailure("disabled", [
        "morning research brief v2 is not enabled",
      ]);
    }
    const scope = await dependencies.loadScope(input);
    if (!scope) {
      return preparationFailure("scope_unavailable", [
        "task, child, or source is not available for this family",
      ]);
    }
    if (
      scope.taskKind !== "morning_brief" ||
      scope.taskStatus !== "running"
    ) {
      return preparationFailure("inactive_run", [
        "task run is not an active morning brief",
      ]);
    }
    if (scope.sourceId !== input.knowledgeId) {
      return preparationFailure("ineligible_source", [
        "selected knowledge source is not eligible for this child",
      ]);
    }
    if (input.observationId && !scope.observationIds.includes(input.observationId)) {
      return preparationFailure("stale_observation", [
        "observation is not available for this child",
      ]);
    }
    const errors = validationErrors(
      input.draft,
      scope.child.name,
      scope.siblingNames,
      scope.sourceSnapshot.sourceNames,
    );
    if (errors.length > 0) {
      return preparationFailure("validation", errors);
    }
    const persistence = await dependencies.upsert({
      familyId: input.familyId,
      taskRunId: input.taskRunId,
      knowledgeId: input.knowledgeId,
      childId: input.childId,
      observationId: input.observationId,
      draft: input.draft,
      draftHash: hashDraft(input.draft),
      sourceSnapshot: scope.sourceSnapshot,
    });
    if (!persistence.prepared) {
      return preparationFailure(persistence.reason, [
        persistenceError(persistence.reason),
      ]);
    }
    return { ok: true, draft: input.draft };
  };
}

async function loadProductionScope(input: {
  familyId: string;
  taskRunId: string;
  knowledgeId: string;
  childId: string;
}): Promise<ResearchBriefPreparationScope | null> {
  const sql = mapDb();
  const [taskRows, familyRows, childRows] = await Promise.all([
    sql<{ kind: string; status: string }[]>`
      select kind, status from public.homa_task_runs
      where id = ${input.taskRunId} and family_id = ${input.familyId}
        and kind = 'morning_brief' and status = 'running'
        and delivery_version = 'research_brief_v2'
    `,
    sql<{ time_zone: string | null }[]>`
      select time_zone from public.families where id = ${input.familyId}
    `,
    sql<{ id: string; name: string }[]>`
      select id, name
      from public.children
      where family_id = ${input.familyId}
    `,
  ]);
  const task = taskRows[0];
  const timeZone = familyRows[0]?.time_zone;
  if (!task || !timeZone) return null;
  const context = await loadBriefV2Context(input.familyId, timeZone);
  const child = context.children.find((candidate) => candidate.id === input.childId);
  const source = child?.candidates.find((candidate) => candidate.id === input.knowledgeId);
  if (
    !child ||
    !source ||
    source.lens === null ||
    source.confidence === "low"
  ) {
    return null;
  }
  const observationIds = context.observations
    .filter((observation) => observation.childId === child.id)
    .map((observation) => observation.id);
  return {
    taskKind: task.kind,
    taskStatus: task.status,
    child,
    siblingNames: childRows
      .filter((candidate) => candidate.id !== child.id)
      .map((candidate) => candidate.name),
    observationIds,
    sourceId: source.id,
    sourceSnapshot: {
      kind: "knowledge_cited",
      id: source.id,
      title: source.title,
      sourceNames: source.sourceNames,
      citationUrls: source.citations.map((citation) => citation.url),
      topic: source.topicKey,
      claims: source.citations.map((citation) => citation.claim),
      topicType: source.topicType,
      lens: source.lens,
      stage: source.stage,
      confidence: source.confidence,
      sourceTier: source.sourceTier,
    },
  };
}

/**
 * Task 4 preparation and Task 5 finalization must take this exact
 * transaction-scoped advisory lock before reading or changing source use.
 */
export function researchBriefSourceLockIdentity(
  familyId: string,
  knowledgeId: string,
): string {
  return `research-brief-source:${familyId}:${knowledgeId}`;
}

export async function reserveResearchBriefPreparationWithDatabase(
  database: Sql,
  record: ResearchBriefPreparationRecord,
  now: Date = new Date(),
): Promise<ResearchBriefPreparationPersistenceResult> {
  const sourceSnapshot = {
    kind: record.sourceSnapshot.kind,
    id: record.sourceSnapshot.id,
    title: record.sourceSnapshot.title,
    sourceNames: record.sourceSnapshot.sourceNames,
    citationUrls: record.sourceSnapshot.citationUrls,
    topic: record.sourceSnapshot.topic,
    claims: record.sourceSnapshot.claims,
    topicType: record.sourceSnapshot.topicType,
    lens: record.sourceSnapshot.lens,
    stage: record.sourceSnapshot.stage,
    confidence: record.sourceSnapshot.confidence,
    sourceTier: record.sourceSnapshot.sourceTier,
  };
  return await database.begin<ResearchBriefPreparationPersistenceResult>(
    async (transaction) => {
      // The knowledge gate takes this topic lock before superseding an active
      // row. Reservation takes the same lock first, then locks the exact row,
      // so a concurrent supersession either wins before this recheck or waits
      // until the preparation commits.
      await transaction`
        select pg_advisory_xact_lock(
          hashtextextended(${record.sourceSnapshot.topic}, 0)
        )
      `;
      await transaction`
        select pg_advisory_xact_lock(
          hashtextextended(
            ${researchBriefSourceLockIdentity(
              record.familyId,
              record.knowledgeId,
            )},
            0
          )
        )
      `;

      const activeRuns = await transaction<{ id: string }[]>`
        select id
        from public.homa_task_runs
        where id = ${record.taskRunId}
          and family_id = ${record.familyId}
          and kind = 'morning_brief'
          and status = 'running'
          and delivery_version = 'research_brief_v2'
        for update
      `;
      if (activeRuns.length === 0) {
        return { prepared: false, reason: "inactive_run" };
      }

      const knowledgeRows = await transaction<{
        id: string;
        status: string;
        superseded_by: string | null;
        title: string;
        topic_type: BriefKnowledgeRow["topicType"];
        topic_key: string;
        lens: BriefKnowledgeRow["lens"];
        stage: string | null;
        confidence: BriefKnowledgeRow["confidence"];
        source_tier: number | null;
        citations: ResearchCitation[];
        last_verified_at: string;
        freshness_ttl_days: number;
      }[]>`
        select id, status, superseded_by, title, topic_type, topic_key, lens,
               stage, confidence, source_tier, citations,
               last_verified_at::text, freshness_ttl_days
        from public.knowledge_bank
        where id = ${record.knowledgeId}
        for share
      `;
      const knowledgeRow = knowledgeRows[0];
      if (
        !knowledgeRow ||
        !knowledgeRowMatchesPreparationSnapshot(
          {
            id: knowledgeRow.id,
            status: knowledgeRow.status,
            supersededBy: knowledgeRow.superseded_by,
            title: knowledgeRow.title,
            topicType: knowledgeRow.topic_type,
            topicKey: knowledgeRow.topic_key,
            lens: knowledgeRow.lens,
            stage: knowledgeRow.stage,
            confidence: knowledgeRow.confidence,
            sourceTier: knowledgeRow.source_tier,
            citations: knowledgeRow.citations,
            lastVerifiedAt: knowledgeRow.last_verified_at,
            freshnessTtlDays: knowledgeRow.freshness_ttl_days,
          },
          record.sourceSnapshot,
          now,
        )
      ) {
        return { prepared: false, reason: "knowledge_row_changed" };
      }

      const recentUses = await transaction<{ found: number }[]>`
        select 1 as found
        from public.family_knowledge_use
        where family_id = ${record.familyId}
          and knowledge_bank_id = ${record.knowledgeId}
          and used_at > ${now.toISOString()}::timestamptz - interval '14 days'
        limit 1
      `;
      if (recentUses.length > 0) {
        return { prepared: false, reason: "knowledge_row_recently_used" };
      }

      const reservations = await transaction<{ found: number }[]>`
        select 1 as found
        from public.research_brief_preparations p
        join public.homa_task_runs r
          on r.id = p.task_run_id
         and r.family_id = p.family_id
        where p.family_id = ${record.familyId}
          and p.knowledge_bank_id = ${record.knowledgeId}
          and p.task_run_id <> ${record.taskRunId}
          and p.delivered_at is null
          and r.family_id = ${record.familyId}
          and r.kind = 'morning_brief'
          and r.status = 'running'
        limit 1
      `;
      if (reservations.length > 0) {
        return { prepared: false, reason: "source_reserved" };
      }

      const preparedRows = await transaction<{ task_run_id: string }[]>`
        insert into public.research_brief_preparations (
          task_run_id, family_id, child_id, knowledge_bank_id, observation_id,
          draft, draft_hash, source_snapshot, prepared_at
        )
        values (
          ${record.taskRunId}, ${record.familyId}, ${record.childId},
          ${record.knowledgeId}, ${record.observationId ?? null},
          ${record.draft}, ${record.draftHash},
          ${transaction.json(sourceSnapshot)}, ${now.toISOString()}
        )
        on conflict (task_run_id) do update
        set child_id = excluded.child_id,
            knowledge_bank_id = excluded.knowledge_bank_id,
            observation_id = excluded.observation_id,
            draft = excluded.draft,
            draft_hash = excluded.draft_hash,
            source_snapshot = excluded.source_snapshot,
            prepared_at = excluded.prepared_at
        where public.research_brief_preparations.delivered_at is null
        returning task_run_id
      `;
      return preparedRows.length === 1
        ? { prepared: true }
        : { prepared: false, reason: "already_delivered" };
    },
  );
}

async function upsertProductionPreparation(
  record: ResearchBriefPreparationRecord,
): Promise<ResearchBriefPreparationPersistenceResult> {
  return await reserveResearchBriefPreparationWithDatabase(mapDb(), record);
}

export const prepareResearchBrief = createResearchBriefPreparationService({
  loadScope: loadProductionScope,
  upsert: upsertProductionPreparation,
});
