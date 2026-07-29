import { del } from "@vercel/blob";
import type { SupabaseClient } from "@supabase/supabase-js";
import type postgres from "postgres";

import { mapDb } from "../map/db";
import { subjectLessonsEnabled } from "../subject-lessons/flag";
import {
  SUBJECT_LESSON_MATERIAL_VALIDITY_SQL,
} from "../subject-lessons/material-validity";
import type { MaterialKind, MaterialSource } from "./artifact-store";
import { selectInProgressMaterialRevisions } from "./parent-visible";

/**
 * The family materials library (MS-3/MS-4): retrieval over finals and
 * drafts, and the finalize flow that turns a critique chain into one
 * keeper. Both auth paths live here (caller-RLS for web, family-pinned
 * server reads for SMS/email/dispatch), mirroring lib/agent-pinned: on
 * the pinned path the explicit family_id predicate in every query IS
 * the tenancy wall.
 *
 * Finalize semantics (founder direction 2026-07-10, D-ms-3): the
 * approved row goes final; every other row in its revision chain goes
 * superseded; superseded DRAFT rows lose their Blob bytes (rows and
 * html stay for the record and reuse), while anything that was once
 * final keeps its bytes because it may have been printed or shared.
 */

export interface MaterialSummary {
  id: string;
  title: string;
  kind: MaterialKind;
  status: "draft" | "final" | "superseded";
  source: MaterialSource;
  skill: string | null;
  subject: string | null;
  curriculum: string | null;
  theme: string | null;
  characters: string[];
  childId: string | null;
  previewUrl: string;
  pdfUrl: string;
  createdAt: string;
  /** PDF pages (1 for classic single-page materials). */
  pageCount: number;
  /** Per-page previews for multi-page materials, page 1 first. */
  pagePreviewUrls: string[] | null;
  html?: string;
}

export interface MaterialFilters {
  childId?: string;
  kind?: MaterialKind;
  subject?: string;
  theme?: string;
  character?: string;
  status?: "final" | "draft" | "any";
  limit: number;
}

interface MaterialDbRow {
  id: string;
  title: string;
  kind: MaterialKind;
  status: "draft" | "final" | "superseded";
  source: MaterialSource;
  skill: string | null;
  subject: string | null;
  curriculum: string | null;
  theme: string | null;
  characters: string[] | null;
  child_id: string | null;
  preview_url: string;
  pdf_url: string;
  created_at: string;
  page_count: number | string | null;
  page_preview_urls: string[] | null;
  html?: string;
  subject_lesson_id?: string | null;
}

const SUMMARY_COLUMNS =
  "id, title, kind, status, source, skill, subject, curriculum, theme, characters, child_id, preview_url, pdf_url, created_at, " +
  "page_count:generation->pageCount, page_preview_urls:generation->pagePreviewUrls";

/** Rows older than the packet work carry no pageCount; they are one page. */
function normalizePageCount(raw: number | string | null | undefined): number {
  const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : raw;
  return typeof parsed === "number" && Number.isFinite(parsed) && parsed > 1
    ? parsed
    : 1;
}

function normalizePagePreviewUrls(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const urls = raw.filter((entry): entry is string => typeof entry === "string");
  return urls.length > 1 ? urls : null;
}

export function pinnedMaterialVisible(input: {
  status: "draft" | "final" | "superseded";
  subjectLessonId: string | null;
  finalOnly?: boolean;
}): boolean {
  if (input.finalOnly && input.status !== "final") return false;
  return input.subjectLessonId === null || input.status === "final";
}

export async function runPinnedMaterialReadWithCompatibility<T>(input: {
  subjectLessonsEnabled: boolean;
  schemaPresent: boolean;
  readLegacy(): Promise<T>;
  readProtected(): Promise<T>;
  failClosed(): T;
}): Promise<T> {
  if (!input.schemaPresent) return await input.readLegacy();
  try {
    return await input.readProtected();
  } catch (error) {
    if (!isMissingSubjectLessonProvenanceColumn(error)) {
      throw error;
    }
    return input.subjectLessonsEnabled
      ? input.failClosed()
      : await input.readLegacy();
  }
}

function toSummary(row: MaterialDbRow): MaterialSummary {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    status: row.status,
    source: row.source,
    skill: row.skill,
    subject: row.subject,
    curriculum: row.curriculum,
    theme: row.theme,
    characters: row.characters ?? [],
    childId: row.child_id,
    previewUrl: row.preview_url,
    pdfUrl: row.pdf_url,
    createdAt: row.created_at,
    pageCount: normalizePageCount(row.page_count),
    pagePreviewUrls: normalizePagePreviewUrls(row.page_preview_urls),
    ...(row.html !== undefined ? { html: row.html } : {}),
  };
}

/**
 * What show_material needs to put an existing material back in front of
 * the parent: the card fields (child as a display name, not an id), the
 * stored quality-check verdict (SMS re-sends stay behind the same review
 * gate create_printable enforces), and the status (superseded drafts
 * lose their Blob bytes at finalize, so they are not re-showable).
 */
export interface MaterialCardView {
  id: string;
  title: string;
  kind: MaterialKind;
  status: "draft" | "final" | "superseded";
  skill: string | null;
  childName: string | null;
  previewUrl: string;
  pdfUrl: string;
  /** PDF pages (1 for classic single-page materials). */
  pageCount: number;
  /** Per-page previews for multi-page materials, page 1 first. */
  pagePreviewUrls: string[] | null;
  /** The stored review verdict; true when no review ran (create_printable's rule). */
  reviewPassed: boolean;
}

interface MaterialCardRow {
  id: string;
  title: string;
  kind: MaterialKind;
  status: "draft" | "final" | "superseded";
  skill: string | null;
  child_name: string | null;
  preview_url: string;
  pdf_url: string;
  page_count: number | string | null;
  page_preview_urls: string[] | null;
  review_pass: string | null;
  subject_lesson_id?: string | null;
}

function toCardView(row: MaterialCardRow): MaterialCardView {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    status: row.status,
    skill: row.skill,
    childName: row.child_name,
    previewUrl: row.preview_url,
    pdfUrl: row.pdf_url,
    pageCount: normalizePageCount(row.page_count),
    pagePreviewUrls: normalizePagePreviewUrls(row.page_preview_urls),
    reviewPassed: row.review_pass !== "false",
  };
}

async function getMaterialCardPinnedLegacy(
  familyId: string,
  materialId: string,
): Promise<MaterialCardView | null> {
  const sql = mapDb();
  const rows = await sql<MaterialCardRow[]>`
    select m.id, m.title, m.kind, m.status, m.skill,
           c.name as child_name, m.preview_url, m.pdf_url,
           m.generation->'pageCount' as page_count,
           m.generation->'pagePreviewUrls' as page_preview_urls,
           m.generation->'review'->>'pass' as review_pass
    from public.materials m
    left join public.children c
      on c.id = m.child_id and c.family_id = m.family_id
    where m.id = ${materialId} and m.family_id = ${familyId}
  `;
  return rows[0] ? toCardView(rows[0]) : null;
}

async function getMaterialCardPinnedProtected(
  familyId: string,
  materialId: string,
): Promise<MaterialCardView | null> {
  const sql = mapDb();
  const rows = await sql<MaterialCardRow[]>`
    select m.id, m.title, m.kind, m.status, m.skill, m.subject_lesson_id,
           c.name as child_name, m.preview_url, m.pdf_url,
           m.generation->'pageCount' as page_count,
           m.generation->'pagePreviewUrls' as page_preview_urls,
           m.generation->'review'->>'pass' as review_pass
    from public.materials m
    left join public.children c
      on c.id = m.child_id and c.family_id = m.family_id
    where m.id = ${materialId} and m.family_id = ${familyId}
      and (
        m.subject_lesson_id is null
        or m.status = 'final'
      )
  `;
  const row = rows[0];
  return row
    && pinnedMaterialVisible({
      status: row.status,
      subjectLessonId: row.subject_lesson_id ?? null,
    })
    ? toCardView(row)
    : null;
}

export async function getMaterialCardPinned(
  familyId: string,
  materialId: string,
): Promise<MaterialCardView | null> {
  const enabled = subjectLessonsEnabled();
  return await runPinnedMaterialReadWithCompatibility({
    subjectLessonsEnabled: enabled,
    schemaPresent: await materialSubjectLessonProvenanceExists(),
    readLegacy: async () =>
      await getMaterialCardPinnedLegacy(familyId, materialId),
    readProtected: async () =>
      await getMaterialCardPinnedProtected(familyId, materialId),
    failClosed: () => null,
  });
}

export async function getMaterialCardCaller(
  db: SupabaseClient,
  familyId: string,
  materialId: string,
): Promise<MaterialCardView | null> {
  const { data, error } = await db
    .from("materials")
    .select(
      "id, title, kind, status, skill, preview_url, pdf_url, " +
        "page_count:generation->pageCount, " +
        "page_preview_urls:generation->pagePreviewUrls, " +
        "review_pass:generation->review->>pass, children(name)",
    )
    .eq("family_id", familyId)
    .eq("id", materialId)
    .maybeSingle();
  if (error) {
    console.error("material card read failed:", error.message);
    throw new Error("Could not read saved materials.");
  }
  if (!data) return null;
  const row = data as unknown as Omit<MaterialCardRow, "child_name"> & {
    children: { name: string } | null;
  };
  return toCardView({ ...row, child_name: row.children?.name ?? null });
}

/** One material with its html (the reuse path), or null. */
async function getMaterialPinnedLegacy(
  familyId: string,
  materialId: string,
): Promise<MaterialSummary | null> {
  const sql = mapDb();
  const rows = await sql<MaterialDbRow[]>`
    select id, title, kind, status, source, skill, subject, curriculum,
           theme, characters, child_id, preview_url, pdf_url,
           created_at::text as created_at,
           generation->'pageCount' as page_count,
           generation->'pagePreviewUrls' as page_preview_urls, html
    from public.materials
    where id = ${materialId} and family_id = ${familyId}
  `;
  return rows[0] ? toSummary(rows[0]) : null;
}

async function getMaterialPinnedProtected(
  familyId: string,
  materialId: string,
  options: { finalOnly?: boolean } = {},
): Promise<MaterialSummary | null> {
  const sql = mapDb();
  const rows = await sql<MaterialDbRow[]>`
    select id, title, kind, status, source, skill, subject, curriculum,
           theme, characters, child_id, preview_url, pdf_url,
           created_at::text as created_at, html, subject_lesson_id,
           generation->'pageCount' as page_count,
           generation->'pagePreviewUrls' as page_preview_urls
    from public.materials
    where id = ${materialId} and family_id = ${familyId}
      and (
        subject_lesson_id is null
        or status = 'final'
      )
      and (${!options.finalOnly} or status = 'final')
  `;
  const row = rows[0];
  return row
    && pinnedMaterialVisible({
      status: row.status,
      subjectLessonId: row.subject_lesson_id ?? null,
      finalOnly: options.finalOnly,
    })
    ? toSummary(row)
    : null;
}

export async function getMaterialPinned(
  familyId: string,
  materialId: string,
  options: { finalOnly?: boolean } = {},
): Promise<MaterialSummary | null> {
  const enabled = subjectLessonsEnabled();
  const schemaPresent = await materialSubjectLessonProvenanceExists();
  if (options.finalOnly && !schemaPresent) return null;
  return await runPinnedMaterialReadWithCompatibility({
    subjectLessonsEnabled: enabled,
    schemaPresent,
    readLegacy: async () =>
      await getMaterialPinnedLegacy(familyId, materialId),
    readProtected: async () =>
      await getMaterialPinnedProtected(familyId, materialId, options),
    failClosed: () => null,
  });
}

export async function getMaterialCaller(
  db: SupabaseClient,
  familyId: string,
  materialId: string,
): Promise<MaterialSummary | null> {
  const { data, error } = await db
    .from("materials")
    .select(`${SUMMARY_COLUMNS}, html`)
    .eq("family_id", familyId)
    .eq("id", materialId)
    .maybeSingle();
  if (error) {
    console.error("materials single read failed:", error.message);
    throw new Error("Could not read saved materials.");
  }
  return data ? toSummary(data as unknown as MaterialDbRow) : null;
}

async function findMaterialsPinnedLegacy(
  familyId: string,
  filters: MaterialFilters,
): Promise<MaterialSummary[]> {
  const sql = mapDb();
  const status = filters.status ?? "final";
  const rows = await sql<MaterialDbRow[]>`
    select id, title, kind, status, source, skill, subject, curriculum,
           theme, characters, child_id, preview_url, pdf_url,
           created_at::text as created_at,
           generation->'pageCount' as page_count,
           generation->'pagePreviewUrls' as page_preview_urls
    from public.materials
    where family_id = ${familyId}
      and (${status === "any"} or status = ${status === "any" ? "final" : status})
      and (${!filters.childId} or child_id = ${filters.childId ?? null})
      and (${!filters.kind} or kind = ${filters.kind ?? null})
      and (${!filters.subject} or subject ilike ${"%" + (filters.subject ?? "") + "%"})
      and (${!filters.theme} or theme ilike ${"%" + (filters.theme ?? "") + "%"})
      and (${!filters.character} or exists (
        select 1 from unnest(characters) as c
        where c ilike ${"%" + (filters.character ?? "") + "%"}
      ))
    order by created_at desc
    limit ${filters.limit}
  `;
  return rows.map(toSummary);
}

async function findMaterialsPinnedProtected(
  familyId: string,
  filters: MaterialFilters,
): Promise<MaterialSummary[]> {
  const sql = mapDb();
  const status = filters.status ?? "final";
  const rows = await sql<MaterialDbRow[]>`
    select id, title, kind, status, source, skill, subject, curriculum,
           theme, characters, child_id, preview_url, pdf_url,
           created_at::text as created_at, subject_lesson_id,
           generation->'pageCount' as page_count,
           generation->'pagePreviewUrls' as page_preview_urls
    from public.materials
    where family_id = ${familyId}
      and (${status === "any"} or status = ${status === "any" ? "final" : status})
      and (
        subject_lesson_id is null
        or status = 'final'
      )
      and (${!filters.childId} or child_id = ${filters.childId ?? null})
      and (${!filters.kind} or kind = ${filters.kind ?? null})
      and (${!filters.subject} or subject ilike ${"%" + (filters.subject ?? "") + "%"})
      and (${!filters.theme} or theme ilike ${"%" + (filters.theme ?? "") + "%"})
      and (${!filters.character} or exists (
        select 1 from unnest(characters) as c
        where c ilike ${"%" + (filters.character ?? "") + "%"}
      ))
    order by created_at desc
    limit ${filters.limit}
  `;
  return rows
    .filter((row) =>
      pinnedMaterialVisible({
        status: row.status,
        subjectLessonId: row.subject_lesson_id ?? null,
      }),
    )
    .map(toSummary);
}

export async function findMaterialsPinned(
  familyId: string,
  filters: MaterialFilters,
): Promise<MaterialSummary[]> {
  const enabled = subjectLessonsEnabled();
  return await runPinnedMaterialReadWithCompatibility({
    subjectLessonsEnabled: enabled,
    schemaPresent: await materialSubjectLessonProvenanceExists(),
    readLegacy: async () =>
      await findMaterialsPinnedLegacy(familyId, filters),
    readProtected: async () =>
      await findMaterialsPinnedProtected(familyId, filters),
    failClosed: () => [],
  });
}

export async function findMaterialsCaller(
  db: SupabaseClient,
  familyId: string,
  filters: MaterialFilters,
): Promise<MaterialSummary[]> {
  let query = db
    .from("materials")
    .select(SUMMARY_COLUMNS)
    .eq("family_id", familyId)
    .order("created_at", { ascending: false })
    .limit(filters.limit);
  const status = filters.status ?? "final";
  if (status !== "any") query = query.eq("status", status);
  if (filters.childId) query = query.eq("child_id", filters.childId);
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.subject) query = query.ilike("subject", `%${filters.subject}%`);
  if (filters.theme) query = query.ilike("theme", `%${filters.theme}%`);
  // Array-contains is exact-match; the pinned path's ilike-over-unnest
  // has no PostgREST equivalent, so caller-side character filtering is
  // exact (case preserved by the tool's guidance to reuse stored names).
  if (filters.character) query = query.contains("characters", [filters.character]);
  const { data, error } = await query;
  if (error) {
    console.error("materials search failed:", error.message);
    throw new Error("Could not search saved materials.");
  }
  return ((data ?? []) as unknown as MaterialDbRow[]).map(toSummary);
}

/**
 * The materials a parent started and never kept, newest first.
 *
 * The binder shows finals only, chat scrollback rotates daily, and 59% of
 * revision chains never reach final (gh#348), so today this set is
 * invisible everywhere. Reads the whole family library and reduces it to
 * one card per unkept chain, so an abandoned 12-round packet contributes
 * one row rather than twelve.
 *
 * Subject-lesson drafts are excluded on purpose: pinnedMaterialVisible
 * already treats a lesson-linked material as parent-visible only once it
 * is final, and its Keep action belongs to the lesson surface.
 */
export async function findInProgressMaterialsCaller(
  db: SupabaseClient,
  familyId: string,
  limit: number,
): Promise<MaterialSummary[]> {
  const { data, error } = await db
    .from("materials")
    .select(
      `${SUMMARY_COLUMNS}, revises, subject_lesson_id, review_pass:generation->review->>pass`,
    )
    .eq("family_id", familyId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("in-progress materials search failed:", error.message);
    throw new Error("Could not load materials in progress.");
  }
  const rows = (data ?? []) as unknown as (MaterialDbRow & {
    revises: string | null;
    review_pass: string | null;
  })[];
  const candidates = rows
    .filter((row) => !row.subject_lesson_id)
    .map((row) => ({
      id: row.id,
      revisesId: row.revises,
      status: row.status,
      reviewPass: row.review_pass === null ? null : row.review_pass !== "false",
      order: Date.parse(row.created_at),
      row,
    }));
  return selectInProgressMaterialRevisions(candidates)
    .sort((left, right) => right.order - left.order)
    .map((candidate) => toSummary(candidate.row));
}

interface ChainRow {
  id: string;
  status: "draft" | "final" | "superseded";
  revises: string | null;
  pdf_url: string;
  preview_url: string;
  title: string;
  approved_at: string | null;
  subject_lesson_id?: string | null;
}

/** The whole revision chain containing `materialId` (ancestors via
 * `revises`, descendants via reverse lookup). */
function collectChain(rows: ChainRow[], materialId: string): ChainRow[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const children = new Map<string, ChainRow[]>();
  for (const row of rows) {
    if (!row.revises) continue;
    const list = children.get(row.revises) ?? [];
    list.push(row);
    children.set(row.revises, list);
  }

  const chain = new Map<string, ChainRow>();
  const queue = [materialId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (chain.has(id)) continue;
    const row = byId.get(id);
    if (!row) continue;
    chain.set(id, row);
    if (row.revises) queue.push(row.revises);
    for (const child of children.get(id) ?? []) queue.push(child.id);
  }
  return [...chain.values()];
}

export interface FinalizeResult {
  finalized: boolean;
  transitioned: boolean;
  note: string;
  title?: string;
  versionsSuperseded: number;
}

export interface MaterialFinalizationPlan {
  targetId: string | null;
  result: FinalizeResult;
  supersededRows: ChainRow[];
  draftRowsToDelete: ChainRow[];
}

interface MaterialFinalizationOptions {
  trustedSubjectLessonId?: string;
}

/**
 * Computes the exact first-transition receipt before either database adapter
 * writes. A final target is a successful replay with no cleanup work.
 */
export function planMaterialFinalization(
  rows: readonly ChainRow[],
  materialId: string,
  options: MaterialFinalizationOptions = {},
): MaterialFinalizationPlan {
  const target = rows.find((row) => row.id === materialId);
  if (!target) {
    return {
      targetId: null,
      result: {
        finalized: false,
        transitioned: false,
        versionsSuperseded: 0,
        note: "That material id is not in this family. Use an id from a create or find_materials result.",
      },
      supersededRows: [],
      draftRowsToDelete: [],
    };
  }
  const chain = collectChain([...rows], materialId);
  const lessonIds = new Set(
    chain.flatMap((row) =>
      row.subject_lesson_id ? [row.subject_lesson_id] : [],
    ),
  );
  const protectedChainAllowed =
    options.trustedSubjectLessonId !== undefined
    && lessonIds.size === 1
    && lessonIds.has(options.trustedSubjectLessonId)
    && chain.every(
      (row) => row.subject_lesson_id === options.trustedSubjectLessonId,
    );
  if (lessonIds.size > 0 && !protectedChainAllowed) {
    return {
      targetId: null,
      result: {
        finalized: false,
        transitioned: false,
        versionsSuperseded: 0,
        note: "Lesson-linked revision chains can only be finalized through the exact lesson Keep action.",
      },
      supersededRows: [],
      draftRowsToDelete: [],
    };
  }
  if (target.status === "final") {
    return {
      targetId: target.id,
      result: {
        finalized: true,
        transitioned: false,
        title: target.title,
        versionsSuperseded: 0,
        note: "This material is already kept as the final version.",
      },
      supersededRows: [],
      draftRowsToDelete: [],
    };
  }
  if (target.status === "superseded" && target.approved_at === null) {
    return {
      targetId: target.id,
      result: {
        finalized: false,
        transitioned: false,
        versionsSuperseded: 0,
        note: "That material was replaced before it was kept.",
      },
      supersededRows: [],
      draftRowsToDelete: [],
    };
  }
  const supersededRows = chain.filter(
    (row) => row.id !== materialId && row.status !== "superseded"
  );
  return {
    targetId: target.id,
    result: {
      finalized: true,
      transitioned: true,
      title: target.title,
      versionsSuperseded: supersededRows.length,
      note: "Final version kept; earlier drafts tidied away.",
    },
    supersededRows,
    draftRowsToDelete: supersededRows.filter((row) => row.status === "draft"),
  };
}

/**
 * Direct lesson Keep is intentionally narrower than explicit agent approval:
 * an attached superseded revision is never eligible for reactivation.
 */
export function planSubjectLessonMaterialFinalization(
  rows: readonly ChainRow[],
  materialId: string,
  attachedStatus: ChainRow["status"],
  trustedSubjectLessonId: string,
): MaterialFinalizationPlan | null {
  if (attachedStatus !== "draft" && attachedStatus !== "final") return null;
  const plan = planMaterialFinalization(rows, materialId, {
    trustedSubjectLessonId,
  });
  return plan.result.finalized ? plan : null;
}

type DeleteMaterialDraftUrls = (urls: readonly string[]) => Promise<void>;

/** Best-effort blob deletion after the database transaction commits. */
async function deleteMaterialDraftUrls(urls: readonly string[]): Promise<void> {
  const uniqueUrls = [...new Set(urls)];
  if (uniqueUrls.length === 0) return;
  try {
    await del(uniqueUrls);
  } catch (error) {
    console.error(
      "finalize: draft blob cleanup failed (rows already superseded):",
      error instanceof Error ? error.message : "unknown"
    );
  }
}

/**
 * Locks exactly one revision chain, the connected component of the
 * `revises` graph containing materialId, in the same shape collectChain
 * walks in memory (up through revises, down through children).
 *
 * Until 2026-07-28 this locked `where family_id = ...` with no further
 * predicate, so approving one worksheet took a row lock on every
 * material the family had ever made. A parent with 166 of them
 * approving four at once serialized four transactions behind each
 * other, and the 45s tool deadline expired mid-save: her worksheets
 * stayed draft and Homa could not tell her whether the save had landed
 * (gh#346). Chains are small, so this is the same correctness with a
 * lock that fits the work.
 */
async function loadPinnedMaterialRows(
  transaction: postgres.TransactionSql,
  familyId: string,
  includeSubjectLessonProvenance: boolean,
  materialId: string
): Promise<ChainRow[]> {
  if (!includeSubjectLessonProvenance) {
    return await transaction<ChainRow[]>`
      with recursive chain as (
        select id, revises
        from public.materials
        where family_id = ${familyId} and id = ${materialId}
        union
        select next.id, next.revises
        from public.materials next
        join chain on next.id = chain.revises or next.revises = chain.id
        where next.family_id = ${familyId}
      )
      select id, status, revises, pdf_url, preview_url, title,
             approved_at::text as approved_at
      from public.materials
      where family_id = ${familyId} and id in (select id from chain)
      order by id
      for update
    `;
  }
  return await transaction<ChainRow[]>`
    with recursive chain as (
      select id, revises
      from public.materials
      where family_id = ${familyId} and id = ${materialId}
      union
      select next.id, next.revises
      from public.materials next
      join chain on next.id = chain.revises or next.revises = chain.id
      where next.family_id = ${familyId}
    )
    select id, status, revises, pdf_url, preview_url, title,
           approved_at::text as approved_at, subject_lesson_id
    from public.materials
    where family_id = ${familyId} and id in (select id from chain)
    order by id
    for update
  `;
}

async function materialSubjectLessonProvenanceExists(): Promise<boolean> {
  if (subjectLessonsEnabled()) return true;
  try {
    const sql = mapDb();
    const rows = await sql<{ present: boolean }[]>`
      select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'materials'
          and column_name = 'subject_lesson_id'
      ) as present
    `;
    return rows[0]?.present === true;
  } catch {
    return false;
  }
}

async function applyPinnedMaterialFinalization(
  transaction: postgres.TransactionSql,
  familyId: string,
  plan: MaterialFinalizationPlan
): Promise<void> {
  if (!plan.result.transitioned || !plan.targetId) return;
  const transitionedRows = await transaction<{ id: string }[]>`
    update public.materials
    set status = 'final', approved_at = now()
    where id = ${plan.targetId} and family_id = ${familyId}
      and status <> 'final'
    returning id
  `;
  if (transitionedRows.length !== 1) {
    throw new Error("material finalization lost its status transition");
  }
  if (plan.supersededRows.length === 0) return;
  await transaction`
    update public.materials
    set status = 'superseded'
    where family_id = ${familyId}
      and id in ${transaction(plan.supersededRows.map((row) => row.id))}
  `;
}

export async function finalizeMaterialPinned(
  familyId: string,
  materialId: string
): Promise<FinalizeResult> {
  const sql = mapDb();
  const hasSubjectLessonProvenance =
    await materialSubjectLessonProvenanceExists();
  const plan = await sql.begin(async (transaction) => {
    const rows = await loadPinnedMaterialRows(
      transaction,
      familyId,
      hasSubjectLessonProvenance,
      materialId
    );
    const nextPlan = planMaterialFinalization(rows, materialId);
    await applyPinnedMaterialFinalization(transaction, familyId, nextPlan);
    return nextPlan;
  });
  if (plan.result.transitioned) {
    await deleteMaterialDraftUrls(
      plan.draftRowsToDelete.flatMap((row) => [row.pdf_url, row.preview_url])
    );
  }
  return plan.result;
}

export interface SubjectLessonMaterialFinalization {
  childId: string;
  subjectId: string;
  materialId: string;
  result: FinalizeResult;
}

/**
 * Finalizes only the worksheet attached to this family's current ready lesson.
 * The lesson lock and material transition share one database transaction.
 */
export async function finalizeSubjectLessonMaterialPinned(
  familyId: string,
  lessonId: string
): Promise<SubjectLessonMaterialFinalization | null> {
  const sql = mapDb();
  const execution = await sql.begin(async (transaction) => {
    const lessonRows = await transaction<
      Array<{
        child_id: string;
        subject_id: string;
        material_id: string;
        material_status: ChainRow["status"];
      }>
    >`
      select lesson.child_id,
             lesson.subject_id,
             material.id as material_id,
             material.status as material_status
      from public.subject_lessons lesson
      join public.children child on child.id = lesson.child_id
      join public.materials material
        on lesson.material_id = material.id
        and material.family_id = child.family_id
      where lesson.id = ${lessonId}
        and child.family_id = ${familyId}
        and lesson.build_status = 'ready'
        and lesson.superseded_at is null
        and lesson.material_id = material.id
        and ${transaction.unsafe(SUBJECT_LESSON_MATERIAL_VALIDITY_SQL)}
      for update of lesson
    `;
    const lesson = lessonRows[0];
    if (!lesson) return null;
    // The lesson row names the material, so its chain can only be locked
    // after this query. That makes this path lock the lesson before the
    // materials; nothing else in the codebase takes those two locks in
    // the other order, and the generic path takes no lesson lock at all.
    const rows = await loadPinnedMaterialRows(
      transaction,
      familyId,
      true,
      lesson.material_id
    );
    const plan = planSubjectLessonMaterialFinalization(
      rows,
      lesson.material_id,
      lesson.material_status,
      lessonId,
    );
    if (!plan) return null;
    await applyPinnedMaterialFinalization(transaction, familyId, plan);
    return { lesson, plan };
  });
  if (!execution) return null;
  if (execution.plan.result.transitioned) {
    await deleteMaterialDraftUrls(
      execution.plan.draftRowsToDelete.flatMap((row) => [
        row.pdf_url,
        row.preview_url,
      ])
    );
  }
  return {
    childId: execution.lesson.child_id,
    subjectId: execution.lesson.subject_id,
    materialId: execution.lesson.material_id,
    result: execution.plan.result,
  };
}

interface MaterialFinalizationRpcRow {
  finalized: boolean;
  transitioned: boolean;
  title: string | null;
  versions_superseded: number;
  draft_urls: string[];
}

function decodeMaterialFinalizationRpcRow(
  value: unknown
): MaterialFinalizationRpcRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.finalized !== "boolean" ||
    typeof row.transitioned !== "boolean" ||
    (row.title !== null && typeof row.title !== "string") ||
    !Number.isInteger(row.versions_superseded) ||
    (row.versions_superseded as number) < 0 ||
    !Array.isArray(row.draft_urls) ||
    !row.draft_urls.every((url) => typeof url === "string")
  ) {
    return null;
  }
  return {
    finalized: row.finalized,
    transitioned: row.transitioned,
    title: row.title,
    versions_superseded: row.versions_superseded as number,
    draft_urls: row.draft_urls,
  };
}

interface MaterialFinalizationRpcError {
  code?: string;
  message: string;
}

function isMissingMaterialFinalizationRpc(
  error: MaterialFinalizationRpcError
): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /could not find (?:the )?function[\s\S]*finalize_family_material/iu.test(
      error.message
    ) ||
    /function[\s\S]*finalize_family_material[\s\S]*does not exist/iu.test(
      error.message
    )
  );
}

export function isMissingSubjectLessonProvenanceColumn(
  error: unknown,
): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message =
    typeof candidate.message === "string" ? candidate.message : "";
  return (
    (code === "PGRST204" || code === "42703")
    && /subject_lesson_id/iu.test(message)
    && /(?:column|schema cache|does not exist)/iu.test(message)
  );
}

/**
 * Temporary code-first compatibility for deployments where the lesson flag is
 * off and its additive migration has not installed the atomic RPC yet.
 */
async function finalizeMaterialCallerLegacy(
  db: SupabaseClient,
  familyId: string,
  materialId: string,
  deleteDraftUrls: DeleteMaterialDraftUrls
): Promise<FinalizeResult> {
  const provenance = await db
    .from("materials")
    .select("id, subject_lesson_id")
    .eq("id", materialId)
    .eq("family_id", familyId);
  if (
    provenance.error &&
    !isMissingSubjectLessonProvenanceColumn(provenance.error)
  ) {
    return {
      finalized: false,
      transitioned: false,
      versionsSuperseded: 0,
      note: `Could not finalize: ${provenance.error.message}`,
    };
  }
  const provenanceRow = (
    provenance.data as Array<{ subject_lesson_id?: string | null }> | null
  )?.[0];
  if (provenanceRow?.subject_lesson_id) {
    return {
      finalized: false,
      transitioned: false,
      versionsSuperseded: 0,
      note: "Account owner approval is required from the lesson's Keep action.",
    };
  }

  const { data, error } = await db
    .from("materials")
    .select("id, status, revises, pdf_url, preview_url, title, approved_at")
    .eq("family_id", familyId);
  if (error) {
    return {
      finalized: false,
      transitioned: false,
      versionsSuperseded: 0,
      note: `Could not finalize: ${error.message}`,
    };
  }

  const plan = planMaterialFinalization(
    (data ?? []) as unknown as ChainRow[],
    materialId
  );
  if (!plan.result.finalized || !plan.result.transitioned || !plan.targetId) {
    return plan.result;
  }

  const { error: finalError } = await db
    .from("materials")
    .update({ status: "final", approved_at: new Date().toISOString() })
    .eq("id", plan.targetId)
    .eq("family_id", familyId);
  if (finalError) {
    return {
      finalized: false,
      transitioned: false,
      versionsSuperseded: 0,
      note: `Could not finalize: ${finalError.message}`,
    };
  }
  if (plan.supersededRows.length > 0) {
    await db
      .from("materials")
      .update({ status: "superseded" })
      .eq("family_id", familyId)
      .in(
        "id",
        plan.supersededRows.map((row) => row.id)
      );
  }
  await deleteDraftUrls(
    plan.draftRowsToDelete.flatMap((row) => [row.pdf_url, row.preview_url])
  );
  return plan.result;
}

/**
 * Uses the caller's Supabase client so the security-invoker RPC keeps the
 * caller JWT and RLS. The RPC commits both status updates before returning
 * draft URLs for best-effort Blob cleanup.
 */
export async function finalizeMaterialCaller(
  db: SupabaseClient,
  familyId: string,
  materialId: string,
  deleteDraftUrls: DeleteMaterialDraftUrls = deleteMaterialDraftUrls,
  isSubjectLessonsEnabled: () => boolean = subjectLessonsEnabled
): Promise<FinalizeResult> {
  const { data, error } = await db.rpc("finalize_family_material", {
    p_family_id: familyId,
    p_material_id: materialId,
  });
  if (error) {
    if (
      !isSubjectLessonsEnabled()
      && (
        isMissingMaterialFinalizationRpc(error)
        || isMissingSubjectLessonProvenanceColumn(error)
      )
    ) {
      return await finalizeMaterialCallerLegacy(
        db,
        familyId,
        materialId,
        deleteDraftUrls
      );
    }
    return {
      finalized: false,
      transitioned: false,
      versionsSuperseded: 0,
      note: `Could not finalize: ${error.message}`,
    };
  }
  const receipt = decodeMaterialFinalizationRpcRow(
    Array.isArray(data) ? data[0] : null
  );
  if (!receipt) {
    return {
      finalized: false,
      transitioned: false,
      versionsSuperseded: 0,
      note: "Could not finalize that material.",
    };
  }
  if (!receipt.finalized) {
    return {
      finalized: false,
      transitioned: false,
      versionsSuperseded: 0,
      note: "That material was not kept.",
    };
  }
  if (!receipt.transitioned) {
    return {
      finalized: true,
      transitioned: false,
      ...(receipt.title
        ? {
            title: receipt.title,
          }
        : {}),
      versionsSuperseded: 0,
      note: "This material is already kept as the final version.",
    };
  }
  await deleteDraftUrls(receipt.draft_urls);
  return {
    finalized: true,
    transitioned: true,
    ...(receipt.title ? { title: receipt.title } : {}),
    versionsSuperseded: receipt.versions_superseded,
    note: "Final version kept; earlier drafts tidied away.",
  };
}
