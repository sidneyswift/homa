import {
  ageInMonths,
  getMapSubject,
  selectSubjectLessonTarget,
  type MapAnswer,
} from "@homa/core";

import { mapDb, type DbJson } from "../map/db";
import { finalizeSubjectLessonMaterialPinned } from "../materials/library";
import {
  isCompleteSubjectLessonContent,
  planSubjectLessonContentSave,
} from "./content-save";
import { type SubjectLessonClaimedSessionInput } from "./dispatch-input";
import { lessonSourceFingerprint } from "./fingerprint";
import { subjectLessonsEnabled } from "./flag";
import { SUBJECT_LESSON_MATERIAL_VALIDITY_SQL } from "./material-validity";
import {
  filterSubjectLessonSummariesForCurrentTargets,
  type SubjectLessonSummaryCandidate,
} from "./summary-filter";
import {
  decodeSubjectLessonContent,
  type StaleSubjectLessonTransitionReceipt,
  type SubjectLessonBuildPhase,
  type SubjectLessonBuildStatus,
  type SubjectLessonContent,
  type SubjectLessonKeepResult,
  type SubjectLessonMaterialStatus,
  type SubjectLessonOwnerStateView,
  type SubjectLessonRecord,
  type SubjectLessonSummary,
  type SubjectLessonView,
} from "./types";
import {
  subjectLessonWorksheetCreateKey,
  type SubjectLessonWorksheetEffectClaim,
} from "./worksheet-effect";

const EMPTY_SUBJECT_LESSON_CONTENT: SubjectLessonContent = {
  title: "",
  materials: [],
  steps: [],
  practice: "",
};

const SUBJECT_LESSON_COLUMNS = `
  lesson.id,
  lesson.child_id,
  lesson.subject_id,
  lesson.target_item_id,
  lesson.target_statement,
  lesson.starting_line,
  lesson.source_report_generated_at::text as source_report_generated_at,
  lesson.source_fingerprint,
  lesson.bank_version,
  lesson.content,
  lesson.build_status,
  lesson.build_phase,
  lesson.attempt_count,
  lesson.idempotency_key,
  lesson.runtime_session_id,
  lesson.material_id,
  lesson.error_code,
  lesson.superseded_at::text as superseded_at,
  lesson.created_at::text as created_at,
  lesson.updated_at::text as updated_at
`;

interface SubjectLessonSqlRow {
  id: string;
  child_id: string;
  subject_id: string;
  target_item_id: string | null;
  target_statement: string;
  starting_line: string | null;
  source_report_generated_at: string;
  source_fingerprint: string;
  bank_version: string;
  content: unknown;
  build_status: SubjectLessonBuildStatus;
  build_phase: SubjectLessonBuildPhase;
  attempt_count: number;
  idempotency_key: string;
  runtime_session_id: string | null;
  material_id: string | null;
  error_code: string | null;
  superseded_at: string | null;
  created_at: string;
  updated_at: string;
}

type SubjectLessonDatabase = ReturnType<typeof mapDb>;

export interface FinishSubjectLessonRunResult {
  lesson: SubjectLessonRecord;
  transitioned: boolean;
}

function toSubjectLessonRecord(row: SubjectLessonSqlRow): SubjectLessonRecord {
  const content = decodeSubjectLessonContent(row.content);
  if (!content) {
    throw new TypeError("Invalid subject lesson content row");
  }
  return {
    id: row.id,
    childId: row.child_id,
    subjectId: row.subject_id,
    targetItemId: row.target_item_id,
    targetStatement: row.target_statement,
    startingLine: row.starting_line,
    sourceReportGeneratedAt: row.source_report_generated_at,
    sourceFingerprint: row.source_fingerprint,
    bankVersion: row.bank_version,
    content,
    buildStatus: row.build_status,
    buildPhase: row.build_phase,
    attemptCount: row.attempt_count,
    idempotencyKey: row.idempotency_key,
    runtimeSessionId: row.runtime_session_id,
    materialId: row.material_id,
    errorCode: row.error_code,
    supersededAt: row.superseded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findCurrentSubjectLesson(
  sql: SubjectLessonDatabase,
  familyId: string,
  childId: string,
  subjectId: string
): Promise<SubjectLessonRecord | null> {
  const rows = await sql<SubjectLessonSqlRow[]>`
    select ${sql.unsafe(SUBJECT_LESSON_COLUMNS)}
    from public.subject_lessons lesson
    join public.children child on child.id = lesson.child_id
    where lesson.child_id = ${childId}
      and lesson.subject_id = ${subjectId}
      and lesson.superseded_at is null
      and child.family_id = ${familyId}
  `;
  return rows[0] ? toSubjectLessonRecord(rows[0]) : null;
}

async function findSubjectLessonById(
  sql: SubjectLessonDatabase,
  familyId: string,
  lessonId: string
): Promise<SubjectLessonRecord | null> {
  const rows = await sql<SubjectLessonSqlRow[]>`
    select ${sql.unsafe(SUBJECT_LESSON_COLUMNS)}
    from public.subject_lessons lesson
    join public.children child on child.id = lesson.child_id
    where lesson.id = ${lessonId}
      and child.family_id = ${familyId}
  `;
  return rows[0] ? toSubjectLessonRecord(rows[0]) : null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function normalizedSubjectLessonErrorCode(
  errorCode: string | null | undefined
): string {
  const candidate = errorCode?.trim() ?? "";
  return /^[a-z0-9_:-]{1,80}$/u.test(candidate) ? candidate : "build_failed";
}

/**
 * Returns the current lesson when the target facts still match. A changed
 * fingerprint supersedes the current row and creates or restores exactly one
 * row for the new source identity.
 */
export async function claimOrReuseSubjectLesson(input: {
  familyId: string;
  childId: string;
  subjectId: string;
  mode?: "create-or-reuse" | "reuse-only";
}): Promise<{
  lesson: SubjectLessonRecord;
  created: boolean;
  token: string;
} | null> {
  if (!subjectLessonsEnabled()) return null;

  const subject = getMapSubject(input.subjectId);
  if (!subject) return null;
  const subjectItemIds = subject.items.map((item) => item.id);
  const sql = mapDb();
  const conflictRecovery: {
    source: {
      sourceFingerprint: string;
      token: string;
    } | null;
  } = { source: null };

  try {
    return await sql.begin(async (transaction) => {
      const scopedChildren = await transaction<{ id: string }[]>`
        select child.id
        from public.children child
        where child.id = ${input.childId}
          and child.family_id = ${input.familyId}
        for update
      `;
      if (!scopedChildren[0]) return null;

      const sourceRows = await transaction<
        {
          token: string;
          generated_at: string;
          birth_date: string;
          answers: Array<{ itemId: string; answer: MapAnswer }>;
        }[]
      >`
        select report.token,
               report.generated_at::text as generated_at,
               to_char(child.birth_month, 'YYYY-MM-DD') as birth_date,
               coalesce(
                 jsonb_agg(
                   jsonb_build_object(
                     'itemId', answer.question_id,
                     'answer', answer.answer
                   )
                   order by answer.question_id
                 ) filter (where answer.question_id is not null),
                 '[]'::jsonb
               ) as answers
        from public.child_reports report
        join public.children child on child.id = report.child_id
        left join public.child_answers answer
          on answer.child_id = child.id
          and answer.question_id in ${transaction(subjectItemIds)}
        where report.child_id = ${input.childId}
          and child.family_id = ${input.familyId}
          and report.revoked_at is null
          and report.token is not null
        group by report.token, report.generated_at, child.birth_month
      `;
      const source = sourceRows[0];
      if (!source) return null;
      const target = selectSubjectLessonTarget(
        input.subjectId,
        ageInMonths(source.birth_date),
        source.answers
      );
      if (!target) return null;
      const sourceFingerprint = lessonSourceFingerprint({
        subjectId: input.subjectId,
        ...target,
      });
      conflictRecovery.source = {
        sourceFingerprint,
        token: source.token,
      };

      const currentRows = await transaction<SubjectLessonSqlRow[]>`
        select ${transaction.unsafe(SUBJECT_LESSON_COLUMNS)}
        from public.subject_lessons lesson
        join public.children child on child.id = lesson.child_id
        where lesson.child_id = ${input.childId}
          and lesson.subject_id = ${input.subjectId}
          and lesson.superseded_at is null
          and child.family_id = ${input.familyId}
        for update of lesson
      `;
      const lockedCurrent = currentRows[0];
      if (lockedCurrent?.source_fingerprint === sourceFingerprint) {
        return {
          lesson: toSubjectLessonRecord(lockedCurrent),
          created: false,
          token: source.token,
        };
      }

      const reusableRows = await transaction<SubjectLessonSqlRow[]>`
        select ${transaction.unsafe(SUBJECT_LESSON_COLUMNS)}
        from public.subject_lessons lesson
        join public.children child on child.id = lesson.child_id
        where lesson.child_id = ${input.childId}
          and lesson.subject_id = ${input.subjectId}
          and lesson.idempotency_key = ${sourceFingerprint}
          and child.family_id = ${input.familyId}
        for update of lesson
      `;
      const reusable = reusableRows[0];
      if (!reusable && input.mode === "reuse-only") return null;

      if (lockedCurrent) {
        await transaction`
          update public.subject_lessons lesson
          set superseded_at = now(), updated_at = now()
          where lesson.id = ${lockedCurrent.id}
            and lesson.superseded_at is null
            and exists (
              select 1
              from public.children child
              where child.id = lesson.child_id
                and child.family_id = ${input.familyId}
            )
        `;
      }

      if (reusable) {
        const restoredRows = await transaction<SubjectLessonSqlRow[]>`
          update public.subject_lessons as lesson
          set superseded_at = null,
              source_report_generated_at = ${source.generated_at},
              updated_at = now()
          from public.children child
          where lesson.id = ${reusable.id}
            and child.id = lesson.child_id
            and child.family_id = ${input.familyId}
          returning ${transaction.unsafe(SUBJECT_LESSON_COLUMNS)}
        `;
        const restored = restoredRows[0];
        if (!restored) {
          throw new Error("subject lesson restore lost its locked row");
        }
        return {
          lesson: toSubjectLessonRecord(restored),
          created: false,
          token: source.token,
        };
      }

      const insertedRows = await transaction<SubjectLessonSqlRow[]>`
        insert into public.subject_lessons as lesson (
          child_id,
          subject_id,
          target_item_id,
          target_statement,
          starting_line,
          source_report_generated_at,
          source_fingerprint,
          bank_version,
          content,
          idempotency_key
        )
        select
          child.id,
          ${input.subjectId},
          ${target.targetItemId},
          ${target.targetStatement},
          ${target.startingLine},
          ${source.generated_at},
          ${sourceFingerprint},
          ${target.bankVersion},
          ${transaction.json(
            EMPTY_SUBJECT_LESSON_CONTENT as unknown as DbJson
          )},
          ${sourceFingerprint}
        from public.children child
        where child.id = ${input.childId}
          and child.family_id = ${input.familyId}
        returning ${transaction.unsafe(SUBJECT_LESSON_COLUMNS)}
      `;
      const inserted = insertedRows[0];
      if (!inserted) return null;
      return {
        lesson: toSubjectLessonRecord(inserted),
        created: true,
        token: source.token,
      };
    });
  } catch (error) {
    const source = conflictRecovery.source;
    if (!isUniqueViolation(error) || !source) throw error;
    const winner = await findCurrentSubjectLesson(
      sql,
      input.familyId,
      input.childId,
      input.subjectId
    );
    if (!winner || winner.sourceFingerprint !== source.sourceFingerprint) {
      throw error;
    }
    return { lesson: winner, created: false, token: source.token };
  }
}

/**
 * Atomically changes a queued row, or an explicitly retried failed row, into
 * one running attempt. A running, ready, or superseded row cannot be claimed.
 */
export async function claimSubjectLessonRun(
  familyId: string,
  lessonId: string,
  retry: boolean
): Promise<SubjectLessonRecord | null> {
  if (!subjectLessonsEnabled()) return null;
  const sql = mapDb();
  const rows = await sql<SubjectLessonSqlRow[]>`
    update public.subject_lessons as lesson
    set build_status = 'running',
        build_phase = case
          when lesson.material_id is not null then 'reviewing_worksheet'
          when nullif(btrim(lesson.content->>'title'), '') is not null
            then 'making_worksheet'
          else 'writing_lesson'
        end,
        attempt_count = lesson.attempt_count + 1,
        runtime_session_id = null,
        error_code = null,
        updated_at = now()
    from public.children child
    where lesson.id = ${lessonId}
      and child.id = lesson.child_id
      and child.family_id = ${familyId}
      and lesson.superseded_at is null
      and (
        (${retry} and lesson.build_status = 'failed')
        or (${!retry} and lesson.build_status = 'queued')
      )
    returning ${sql.unsafe(SUBJECT_LESSON_COLUMNS)}
  `;
  const claimed = rows[0] ? toSubjectLessonRecord(rows[0]) : null;
  if (!claimed || !retry || claimed.materialId !== null) return claimed;

  const recoveredMaterialId = await recoverSubjectLessonMaterialPinned({
    familyId,
    lessonId,
    attempt: claimed.attemptCount,
  });
  if (!recoveredMaterialId) return claimed;
  const recovered = await findSubjectLessonById(sql, familyId, lessonId);
  if (!recovered) {
    throw new Error("subject lesson recovery lost the claimed row");
  }
  return recovered;
}

/**
 * Loads the family-scoped display facts before claiming one queued or explicit
 * retry attempt, then adapts the claimed row to Task 4A's trusted input.
 */
export async function claimSubjectLessonSessionInput(
  familyId: string,
  lessonId: string,
  retry: boolean
): Promise<SubjectLessonClaimedSessionInput | null> {
  if (!subjectLessonsEnabled()) return null;
  const sql = mapDb();
  const identityRows = await sql<
    Array<{ child_name: string; subject_id: string }>
  >`
    select child.name as child_name, lesson.subject_id
    from public.subject_lessons lesson
    join public.children child on child.id = lesson.child_id
    where lesson.id = ${lessonId}
      and child.family_id = ${familyId}
      and lesson.superseded_at is null
  `;
  const identity = identityRows[0];
  if (!identity) return null;
  const subject = getMapSubject(identity.subject_id);
  if (!subject) return null;

  const lesson = await claimSubjectLessonRun(familyId, lessonId, retry);
  if (!lesson) return null;
  return {
    lessonId: lesson.id,
    familyId,
    childId: lesson.childId,
    childName: identity.child_name,
    subjectId: lesson.subjectId,
    subjectName: subject.displayName,
    targetItemId: lesson.targetItemId,
    targetStatement: lesson.targetStatement,
    startingLine: lesson.startingLine,
    attempt: lesson.attemptCount,
    hasContent: isCompleteSubjectLessonContent(lesson.content),
    materialId: lesson.materialId,
  };
}

export async function setSubjectLessonRuntimeSession(
  familyId: string,
  lessonId: string,
  attempt: number,
  sessionId: string,
): Promise<boolean> {
  if (!subjectLessonsEnabled()) return false;
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    update public.subject_lessons as lesson
    set runtime_session_id = ${sessionId}, updated_at = now()
    from public.children child
    where lesson.id = ${lessonId}
      and child.id = lesson.child_id
      and child.family_id = ${familyId}
      and lesson.superseded_at is null
      and lesson.build_status = 'running'
      and lesson.attempt_count = ${attempt}
      and (
        lesson.runtime_session_id is null
        or lesson.runtime_session_id = ${sessionId}
      )
    returning lesson.id
  `;
  return rows.length === 1;
}

/**
 * Claims one logical worksheet creation before rendering or provider work.
 * Completed receipts replay their attached material. An existing in-flight
 * receipt is uncertain and must never be billed again in the same attempt.
 */
export async function claimSubjectLessonWorksheetEffectPinned(input: {
  familyId: string;
  lessonId: string;
  childId: string;
  attempt: number;
  revisesId: string | null;
}): Promise<SubjectLessonWorksheetEffectClaim> {
  if (!subjectLessonsEnabled()) return { status: "invalid" };
  const sql = mapDb();
  const createKey = subjectLessonWorksheetCreateKey(input.revisesId);
  const existingEffectRows = await sql<
    Array<{ status: "in_flight" | "completed" }>
  >`
    select receipt.status
    from public.subject_lesson_effect_receipts receipt
    join public.subject_lessons lesson
      on lesson.id = receipt.subject_lesson_id
    join public.children child on child.id = lesson.child_id
    where receipt.subject_lesson_id = ${input.lessonId}
      and receipt.attempt = ${input.attempt}
      and receipt.create_key = ${createKey}
      and child.family_id = ${input.familyId}
      and lesson.child_id = ${input.childId}
      and lesson.superseded_at is null
      and lesson.attempt_count = ${input.attempt}
      and lesson.build_status in ('running', 'ready')
  `;
  const existingEffect = existingEffectRows[0];
  if (existingEffect?.status === "in_flight") {
    return { status: "in_flight" };
  }
  const revisionEligible =
    existingEffect?.status === "completed"
    || input.revisesId === null
    || (
      await sql<{ eligible: boolean }[]>`
        select exists (
          select 1
          from public.subject_lessons lesson
          join public.children child on child.id = lesson.child_id
          join public.materials material
            on material.id = ${input.revisesId}
            and material.family_id = child.family_id
          where lesson.id = ${input.lessonId}
            and child.family_id = ${input.familyId}
            and lesson.child_id = ${input.childId}
            and lesson.superseded_at is null
            and lesson.build_status = 'running'
            and lesson.attempt_count = ${input.attempt}
            and lesson.material_id is null
            and material.subject_lesson_id = lesson.id
            and material.child_id = lesson.child_id
            and material.subject = lesson.subject_id
            and material.skill = lesson.target_statement
            and material.kind = 'worksheet'
            and material.status = 'draft'
            and material.generation->'review'->'pass' = 'false'::jsonb
            and not exists (
              select 1
              from public.materials newer
              where newer.revises = material.id
                and newer.family_id = material.family_id
                and newer.subject_lesson_id = lesson.id
            )
        ) as eligible
      `
    )[0]?.eligible === true;
  if (!revisionEligible) return { status: "invalid" };

  const inserted = await sql<{ subject_lesson_id: string }[]>`
    insert into public.subject_lesson_effect_receipts (
      subject_lesson_id,
      attempt,
      create_key
    )
    select lesson.id, ${input.attempt}, ${createKey}
    from public.subject_lessons lesson
    join public.children child on child.id = lesson.child_id
    where lesson.id = ${input.lessonId}
      and child.family_id = ${input.familyId}
      and lesson.child_id = ${input.childId}
      and lesson.superseded_at is null
      and lesson.build_status = 'running'
      and lesson.attempt_count = ${input.attempt}
      and nullif(btrim(lesson.content->>'title'), '') is not null
      and jsonb_array_length(lesson.content->'steps') between 3 and 5
      and nullif(btrim(lesson.content->>'practice'), '') is not null
    on conflict do nothing
    returning subject_lesson_id
  `;
  if (inserted[0]) return { status: "claimed" };

  const receiptRows = await sql<Array<{ status: "in_flight" | "completed" }>>`
    select receipt.status
    from public.subject_lesson_effect_receipts receipt
    join public.subject_lessons lesson
      on lesson.id = receipt.subject_lesson_id
    join public.children child on child.id = lesson.child_id
    where receipt.subject_lesson_id = ${input.lessonId}
      and receipt.attempt = ${input.attempt}
      and receipt.create_key = ${createKey}
      and child.family_id = ${input.familyId}
      and lesson.child_id = ${input.childId}
      and lesson.superseded_at is null
      and lesson.attempt_count = ${input.attempt}
      and lesson.build_status in ('running', 'ready')
  `;
  const receipt = receiptRows[0];
  if (!receipt) return { status: "invalid" };
  if (receipt.status === "in_flight") return { status: "in_flight" };

  const completedRows = await sql<
    Array<{
      id: string;
      title: string;
      skill: string | null;
      child_name: string;
      preview_url: string;
      pdf_url: string;
      status: "draft" | "final";
    }>
  >`
    select material.id,
           material.title,
           material.skill,
           child.name as child_name,
           material.preview_url,
           material.pdf_url,
           material.status
    from public.subject_lesson_effect_receipts receipt
    join public.subject_lessons lesson
      on lesson.id = receipt.subject_lesson_id
    join public.children child on child.id = lesson.child_id
    join public.materials material
      on material.id = receipt.material_id
      and material.id = lesson.material_id
    where receipt.subject_lesson_id = ${input.lessonId}
      and receipt.attempt = ${input.attempt}
      and receipt.create_key = ${createKey}
      and receipt.status = 'completed'
      and child.family_id = ${input.familyId}
      and lesson.child_id = ${input.childId}
      and lesson.superseded_at is null
      and lesson.attempt_count = ${input.attempt}
      and lesson.build_status in ('running', 'ready')
      and ${sql.unsafe(SUBJECT_LESSON_MATERIAL_VALIDITY_SQL)}
  `;
  const material = completedRows[0];
  return material
    ? {
        status: "completed",
        material: {
          id: material.id,
          title: material.title,
          kind: "worksheet",
          skill: material.skill,
          childName: material.child_name,
          previewUrl: material.preview_url,
          pdfUrl: material.pdf_url,
          status: material.status,
        },
      }
    : { status: "invalid" };
}

export async function saveSubjectLessonContentPinned(input: {
  familyId: string;
  lessonId: string;
  attempt: number;
  content: SubjectLessonContent;
}): Promise<boolean> {
  if (!subjectLessonsEnabled()) return false;
  if (!isCompleteSubjectLessonContent(input.content)) return false;
  const sql = mapDb();
  return await sql.begin(async (transaction) => {
    const currentRows = await transaction<{ content: unknown }[]>`
      select lesson.content
      from public.subject_lessons lesson
      join public.children child on child.id = lesson.child_id
      where lesson.id = ${input.lessonId}
        and child.family_id = ${input.familyId}
        and lesson.superseded_at is null
        and lesson.build_status = 'running'
        and lesson.attempt_count = ${input.attempt}
      for update of lesson
    `;
    const current = currentRows[0]
      ? decodeSubjectLessonContent(currentRows[0].content)
      : null;
    if (!current) return false;

    const decision = planSubjectLessonContentSave(current, input.content);
    if (decision === "reject") return false;
    if (decision === "reuse") return true;

    const rows = await transaction<{ id: string }[]>`
      update public.subject_lessons as lesson
      set content = ${transaction.json(input.content as unknown as DbJson)},
          build_phase = 'making_worksheet',
          updated_at = now()
      from public.children child
      where lesson.id = ${input.lessonId}
        and child.id = lesson.child_id
        and child.family_id = ${input.familyId}
        and lesson.superseded_at is null
        and lesson.build_status = 'running'
        and lesson.attempt_count = ${input.attempt}
      returning lesson.id
    `;
    return rows.length === 1;
  });
}

export async function attachSubjectLessonMaterialPinned(input: {
  familyId: string;
  lessonId: string;
  attempt: number;
  materialId: string;
}): Promise<boolean> {
  if (!subjectLessonsEnabled()) return false;
  const sql = mapDb();
  return await sql.begin(async (transaction) => {
    const candidates = await transaction<
      Array<{ receipt_status: "in_flight" | "completed" }>
    >`
      select receipt.status as receipt_status
      from public.subject_lessons lesson
      join public.children child on child.id = lesson.child_id
      join public.materials material
        on material.id = ${input.materialId}
        and material.family_id = child.family_id
      join public.subject_lesson_effect_receipts receipt
        on receipt.subject_lesson_id = lesson.id
        and receipt.attempt = ${input.attempt}
        and receipt.created_material_id = material.id
        and receipt.create_key = coalesce(material.revises::text, 'initial')
      where lesson.id = ${input.lessonId}
        and child.family_id = ${input.familyId}
        and lesson.superseded_at is null
        and lesson.build_status = 'running'
        and lesson.attempt_count = ${input.attempt}
        and (
          lesson.material_id is null
          or lesson.material_id = material.id
        )
        and (
          receipt.status = 'in_flight'
          or lesson.material_id = material.id
        )
        and ${sql.unsafe(SUBJECT_LESSON_MATERIAL_VALIDITY_SQL)}
      for update of receipt, lesson, material
    `;
    const candidate = candidates[0];
    if (!candidate) return false;
    if (candidate.receipt_status === "completed") return true;

    const attachedRows = await transaction<{ id: string }[]>`
      update public.subject_lessons as lesson
      set material_id = material.id,
          build_phase = 'reviewing_worksheet',
          updated_at = now()
      from public.children child, public.materials material
      where lesson.id = ${input.lessonId}
        and child.id = lesson.child_id
        and child.family_id = ${input.familyId}
        and material.id = ${input.materialId}
        and material.family_id = child.family_id
        and lesson.superseded_at is null
        and lesson.build_status = 'running'
        and lesson.attempt_count = ${input.attempt}
        and (
          lesson.material_id is null
          or lesson.material_id = material.id
        )
      returning lesson.id
    `;
    if (!attachedRows[0]) {
      throw new Error("subject lesson worksheet attachment lost its lock");
    }

    const completedRows = await transaction<{ subject_lesson_id: string }[]>`
      update public.subject_lesson_effect_receipts
      set status = 'completed',
          material_id = ${input.materialId},
          finished_at = now()
      where subject_lesson_id = ${input.lessonId}
        and attempt = ${input.attempt}
        and created_material_id = ${input.materialId}
        and status = 'in_flight'
      returning subject_lesson_id
    `;
    if (!completedRows[0]) {
      throw new Error("subject lesson worksheet receipt lost its lock");
    }
    return true;
  });
}

/**
 * Reconnects a material created for this lesson when generation succeeded but
 * the original attachment write did not. Server-stamped provenance and the
 * durable effect receipt replace model-authored generation metadata.
 */
export async function recoverSubjectLessonMaterialPinned(input: {
  familyId: string;
  lessonId: string;
  attempt: number;
}): Promise<string | null> {
  if (!subjectLessonsEnabled()) return null;
  const sql = mapDb();
  return await sql.begin(async (transaction) => {
    const existingRows = await transaction<
      Array<{
        material_id: string;
        receipt_attempt: number;
        receipt_status: "in_flight" | "completed";
      }>
    >`
      select material.id as material_id,
             receipt.attempt as receipt_attempt,
             receipt.status as receipt_status
      from public.subject_lessons lesson
      join public.children child on child.id = lesson.child_id
      join public.materials material on material.id = lesson.material_id
      join public.subject_lesson_effect_receipts receipt
        on receipt.subject_lesson_id = lesson.id
        and receipt.created_material_id = material.id
      where lesson.id = ${input.lessonId}
        and child.family_id = ${input.familyId}
        and lesson.superseded_at is null
        and lesson.build_status = 'running'
        and lesson.attempt_count = ${input.attempt}
        and ${sql.unsafe(SUBJECT_LESSON_MATERIAL_VALIDITY_SQL)}
      for update of receipt, lesson, material
    `;
    const existing = existingRows[0];
    if (existing) {
      if (existing.receipt_status === "in_flight") {
        const completedRows = await transaction<
          Array<{ subject_lesson_id: string }>
        >`
          update public.subject_lesson_effect_receipts
          set status = 'completed',
              material_id = ${existing.material_id},
              finished_at = now()
          where subject_lesson_id = ${input.lessonId}
            and attempt = ${existing.receipt_attempt}
            and created_material_id = ${existing.material_id}
            and status = 'in_flight'
          returning subject_lesson_id
        `;
        if (!completedRows[0]) {
          throw new Error("subject lesson recovery lost its receipt");
        }
      }
      return existing.material_id;
    }

    const candidateRows = await transaction<
      Array<{ material_id: string; receipt_attempt: number }>
    >`
      select material.id as material_id,
             receipt.attempt as receipt_attempt
      from public.subject_lessons lesson
      join public.children child on child.id = lesson.child_id
      join public.subject_lesson_effect_receipts receipt
        on receipt.subject_lesson_id = lesson.id
        and receipt.status = 'in_flight'
        and receipt.created_material_id is not null
        and receipt.attempt <= ${input.attempt}
      join public.materials material
        on material.id = receipt.created_material_id
      where lesson.id = ${input.lessonId}
        and child.family_id = ${input.familyId}
        and lesson.superseded_at is null
        and lesson.build_status = 'running'
        and lesson.attempt_count = ${input.attempt}
        and lesson.material_id is null
        and ${sql.unsafe(SUBJECT_LESSON_MATERIAL_VALIDITY_SQL)}
      order by receipt.attempt desc, material.created_at desc
      limit 1
      for update of receipt, lesson, material
    `;
    const candidate = candidateRows[0];
    if (!candidate) return null;

    const attachedRows = await transaction<{ id: string }[]>`
      update public.subject_lessons as lesson
      set material_id = ${candidate.material_id},
          build_phase = 'reviewing_worksheet',
          updated_at = now()
      from public.children child
      where lesson.id = ${input.lessonId}
        and child.id = lesson.child_id
        and child.family_id = ${input.familyId}
        and lesson.superseded_at is null
        and lesson.build_status = 'running'
        and lesson.attempt_count = ${input.attempt}
        and lesson.material_id is null
      returning lesson.id
    `;
    if (!attachedRows[0]) {
      throw new Error("subject lesson recovery lost its attachment lock");
    }

    const completedRows = await transaction<
      Array<{ subject_lesson_id: string }>
    >`
      update public.subject_lesson_effect_receipts
      set status = 'completed',
          material_id = ${candidate.material_id},
          finished_at = now()
      where subject_lesson_id = ${input.lessonId}
        and attempt = ${candidate.receipt_attempt}
        and created_material_id = ${candidate.material_id}
        and status = 'in_flight'
      returning subject_lesson_id
    `;
    if (!completedRows[0]) {
      throw new Error("subject lesson recovery lost its receipt lock");
    }
    return candidate.material_id;
  });
}

export async function finishSubjectLessonRun(input: {
  familyId: string;
  lessonId: string;
  attempt: number;
  status: "ready" | "failed";
  errorCode?: string | null;
}): Promise<FinishSubjectLessonRunResult | null> {
  if (!subjectLessonsEnabled()) return null;
  const sql = mapDb();
  return sql.begin(async (transaction) => {
    const rows = await transaction<
      Array<SubjectLessonSqlRow & { material_valid: boolean }>
    >`
      select ${transaction.unsafe(SUBJECT_LESSON_COLUMNS)},
             exists (
               select 1
               from public.materials material
               where material.id = lesson.material_id
                 and ${transaction.unsafe(SUBJECT_LESSON_MATERIAL_VALIDITY_SQL)}
             ) as material_valid
      from public.subject_lessons lesson
      join public.children child on child.id = lesson.child_id
      where lesson.id = ${input.lessonId}
        and child.family_id = ${input.familyId}
        and lesson.superseded_at is null
        and lesson.attempt_count = ${input.attempt}
      for update of lesson
    `;
    const current = rows[0];
    if (!current) return null;
    if (current.build_status !== "running") {
      return current.build_status === "ready" ||
        current.build_status === "failed"
        ? {
            lesson: toSubjectLessonRecord(current),
            transitioned: false,
          }
        : null;
    }

    const currentContent = decodeSubjectLessonContent(current.content);
    if (!currentContent) {
      throw new TypeError("Invalid subject lesson content row");
    }
    const complete =
      isCompleteSubjectLessonContent(currentContent) &&
      current.material_id !== null &&
      current.material_valid;
    const nextStatus =
      input.status === "ready" && complete ? "ready" : "failed";
    const errorCode =
      nextStatus === "ready"
        ? null
        : input.status === "ready"
        ? "incomplete_build"
        : normalizedSubjectLessonErrorCode(input.errorCode);
    const updatedRows = await transaction<SubjectLessonSqlRow[]>`
      update public.subject_lessons as lesson
      set build_status = ${nextStatus},
          build_phase = case
            when ${nextStatus} = 'ready' then 'reviewing_worksheet'
            else lesson.build_phase
          end,
          error_code = ${errorCode},
          updated_at = now()
      from public.children child
      where lesson.id = ${input.lessonId}
        and child.id = lesson.child_id
        and child.family_id = ${input.familyId}
        and lesson.superseded_at is null
        and lesson.build_status = 'running'
        and lesson.attempt_count = ${input.attempt}
      returning ${transaction.unsafe(SUBJECT_LESSON_COLUMNS)}
    `;
    return updatedRows[0]
      ? {
          lesson: toSubjectLessonRecord(updatedRows[0]),
          transitioned: true,
        }
      : null;
  });
}

export async function keepSubjectLessonMaterialWithReceipt(
  familyId: string,
  lessonId: string
): Promise<SubjectLessonKeepResult | null> {
  if (!subjectLessonsEnabled()) return null;
  const finalization = await finalizeSubjectLessonMaterialPinned(
    familyId,
    lessonId
  );
  if (!finalization) return null;
  if (!finalization.result.finalized) {
    return { status: "finalize-failed" };
  }
  return {
    status: "kept",
    childId: finalization.childId,
    subjectId: finalization.subjectId,
    transitioned: finalization.result.transitioned,
    versionsSuperseded: finalization.result.versionsSuperseded,
  };
}

export async function getSubjectLessonForFamily(
  familyId: string,
  lessonId: string
): Promise<{
  lesson: SubjectLessonRecord;
  token: string;
} | null> {
  if (!subjectLessonsEnabled()) return null;
  const sql = mapDb();
  const rows = await sql<Array<SubjectLessonSqlRow & { token: string }>>`
    select ${sql.unsafe(SUBJECT_LESSON_COLUMNS)},
           report.token
    from public.subject_lessons lesson
    join public.children child on child.id = lesson.child_id
    join public.child_reports report on report.child_id = child.id
    left join public.materials material
      on material.id = lesson.material_id
      and material.family_id = child.family_id
    where lesson.id = ${lessonId}
      and child.family_id = ${familyId}
      and report.revoked_at is null
      and report.token is not null
      and lesson.superseded_at is null
      and (
        lesson.build_status <> 'ready'
        or ${sql.unsafe(SUBJECT_LESSON_MATERIAL_VALIDITY_SQL)}
      )
  `;
  const row = rows[0];
  return row
    ? {
        lesson: toSubjectLessonRecord(row),
        token: row.token,
      }
    : null;
}

export async function getSubjectLessonByToken(
  token: string,
  subjectId: string
): Promise<SubjectLessonView | null> {
  if (!subjectLessonsEnabled()) return null;
  const sql = mapDb();
  const rows = await sql<
    {
      id: string;
      token: string;
      subject_id: string;
      target_statement: string;
      starting_line: string | null;
      content: unknown;
      child_name: string;
      material_id: string;
      material_title: string;
      material_kind: string;
      material_skill: string | null;
      material_preview_url: string;
      material_pdf_url: string;
    }[]
  >`
    select lesson.id,
           report.token,
           lesson.subject_id,
           lesson.target_statement,
           lesson.starting_line,
           lesson.content,
           child.name as child_name,
           lesson.material_id,
           material.title as material_title,
           material.kind as material_kind,
           material.skill as material_skill,
           material.preview_url as material_preview_url,
           material.pdf_url as material_pdf_url
    from public.subject_lessons lesson
    join public.children child on child.id = lesson.child_id
    join public.families family on family.id = child.family_id
    join public.child_reports report on report.child_id = child.id
    join public.materials material
      on material.id = lesson.material_id
      and material.family_id = child.family_id
    where report.token = ${token}
      and report.revoked_at is null
      and family.status <> 'deleted'
      and lesson.subject_id = ${subjectId}
      and lesson.superseded_at is null
      and lesson.build_status = 'ready'
      and ${sql.unsafe(SUBJECT_LESSON_MATERIAL_VALIDITY_SQL)}
  `;
  const row = rows[0];
  if (!row) return null;
  const content = decodeSubjectLessonContent(row.content);
  if (!content) return null;
  return {
    id: row.id,
    token: row.token,
    subjectId: row.subject_id,
    targetStatement: row.target_statement,
    startingLine: row.starting_line,
    content,
    childName: row.child_name,
    subjectName: getMapSubject(row.subject_id)?.displayName ?? row.subject_id,
    material: {
      id: row.material_id,
      title: row.material_title,
      kind: row.material_kind,
      skill: row.material_skill,
      childName: row.child_name,
      previewUrl: row.material_preview_url,
      pdfUrl: row.material_pdf_url,
    },
  };
}

/**
 * Loads build state only after the caller has pinned an authenticated family.
 * The later owner policy stays separate from this family-scoped data access.
 */
export async function getSubjectLessonStateByTokenForFamily(
  familyId: string,
  token: string,
  subjectId: string
): Promise<SubjectLessonOwnerStateView | null> {
  if (!subjectLessonsEnabled()) return null;
  const sql = mapDb();
  const rows = await sql<
    Array<
      SubjectLessonSqlRow & {
        child_name: string;
        material_status: SubjectLessonMaterialStatus | null;
      }
    >
  >`
    select ${sql.unsafe(SUBJECT_LESSON_COLUMNS)},
           child.name as child_name,
           material.status as material_status
    from public.subject_lessons lesson
    join public.children child on child.id = lesson.child_id
    join public.child_reports report on report.child_id = child.id
    left join public.materials material
      on material.id = lesson.material_id
      and material.family_id = child.family_id
    where child.family_id = ${familyId}
      and report.token = ${token}
      and report.revoked_at is null
      and lesson.subject_id = ${subjectId}
      and lesson.superseded_at is null
      and (
        lesson.build_status <> 'ready'
        or ${sql.unsafe(SUBJECT_LESSON_MATERIAL_VALIDITY_SQL)}
      )
  `;
  const row = rows[0];
  return row
    ? {
        ...toSubjectLessonRecord(row),
        childName: row.child_name,
        subjectName:
          getMapSubject(row.subject_id)?.displayName ?? row.subject_id,
        materialStatus: row.material_status,
      }
    : null;
}

export async function listCurrentSubjectLessonSummaries(
  familyId: string,
  childId: string
): Promise<SubjectLessonSummary[]> {
  if (!subjectLessonsEnabled()) return [];
  const sql = mapDb();
  const rows = await sql<
    {
      birth_date: string;
      answers: Array<{ itemId: string; answer: MapAnswer }>;
      lessons: SubjectLessonSummaryCandidate[];
    }[]
  >`
    select to_char(child.birth_month, 'YYYY-MM-DD') as birth_date,
           coalesce(
             (
               select jsonb_agg(
                 jsonb_build_object(
                   'itemId', answer.question_id,
                   'answer', answer.answer
                 )
                 order by answer.question_id
               )
               from public.child_answers answer
               where answer.child_id = child.id
             ),
             '[]'::jsonb
           ) as answers,
           coalesce(
             (
               select jsonb_agg(
                 jsonb_build_object(
                   'id', lesson.id,
                   'subjectId', lesson.subject_id,
                   'buildStatus', lesson.build_status,
                   'sourceFingerprint', lesson.source_fingerprint
                 )
                 order by lesson.created_at
               )
               from public.subject_lessons lesson
               left join public.materials material
                 on material.id = lesson.material_id
                 and material.family_id = child.family_id
               where lesson.child_id = child.id
                 and lesson.superseded_at is null
                 and (
                   lesson.build_status <> 'ready'
                   or ${sql.unsafe(SUBJECT_LESSON_MATERIAL_VALIDITY_SQL)}
                 )
             ),
             '[]'::jsonb
           ) as lessons
    from public.children child
    join public.child_reports report on report.child_id = child.id
    where child.id = ${childId}
      and child.family_id = ${familyId}
      and report.revoked_at is null
      and report.token is not null
  `;
  const row = rows[0];
  return row
    ? filterSubjectLessonSummariesForCurrentTargets({
        ageMonths: ageInMonths(row.birth_date),
        answers: row.answers,
        lessons: row.lessons,
      })
    : [];
}

/**
 * The trusted cron may fail stale global work because it receives no
 * model-supplied identity. The child join keeps the sweep on valid child rows.
 */
export async function reapStaleSubjectLessons(
  now: Date = new Date()
): Promise<StaleSubjectLessonTransitionReceipt[]> {
  if (!subjectLessonsEnabled()) return [];
  const sql = mapDb();
  const cutoff = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const rows = await sql<
    Array<{
      family_id: string;
      child_id: string;
      subject: string;
      attempt: number;
    }>
  >`
    with stale as (
      select lesson.id,
             child.family_id,
             lesson.child_id,
             lesson.subject_id as subject,
             lesson.attempt_count as attempt
      from public.subject_lessons lesson
      join public.children child on child.id = lesson.child_id
      where lesson.superseded_at is null
        and lesson.build_status = 'running'
        and lesson.updated_at < ${cutoff}
      order by lesson.updated_at
      limit 100
      for update of lesson skip locked
    )
    update public.subject_lessons as lesson
    set build_status = 'failed',
        error_code = 'stale_run',
        updated_at = now()
    from stale
    where lesson.id = stale.id
    returning stale.family_id,
              stale.child_id,
              stale.subject,
              stale.attempt
  `;
  return rows.map((row) => ({
    familyId: row.family_id,
    childId: row.child_id,
    subject: row.subject,
    attempt: row.attempt,
    errorCode: "stale_run",
  }));
}
