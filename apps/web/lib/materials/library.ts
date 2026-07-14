import { del } from "@vercel/blob";
import type { SupabaseClient } from "@supabase/supabase-js";

import { mapDb } from "../map/db";
import type { MaterialKind, MaterialSource } from "./artifact-store";

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

export async function getMaterialCardPinned(
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
export async function getMaterialPinned(
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

export async function findMaterialsPinned(
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

interface ChainRow {
  id: string;
  status: "draft" | "final" | "superseded";
  revises: string | null;
  pdf_url: string;
  preview_url: string;
  title: string;
  kind: MaterialKind;
  child_id: string | null;
  subject: string | null;
}

/** The whole revision chain containing `materialId` (ancestors via
 * `revises`, descendants via reverse lookup), capped defensively. */
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
  while (queue.length > 0 && chain.size < 50) {
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
  note: string;
  title?: string;
  versionsSuperseded?: number;
  /** The finalized material's kind, for downstream modality signaling. */
  kind?: MaterialKind;
  /** The child this material was made for (null = no child). */
  childId?: string | null;
  /** The subject this material covers (null = unspecified). */
  subject?: string | null;
}

/** Best-effort blob deletion for superseded draft bytes. */
async function deleteDraftBytes(drafts: ChainRow[]): Promise<void> {
  const urls = drafts.flatMap((row) => [row.pdf_url, row.preview_url]);
  if (urls.length === 0) return;
  try {
    await del(urls);
  } catch (error) {
    console.error(
      "finalize: draft blob cleanup failed (rows already superseded):",
      error instanceof Error ? error.message : "unknown",
    );
  }
}

export async function finalizeMaterialPinned(
  familyId: string,
  materialId: string,
): Promise<FinalizeResult> {
  const sql = mapDb();
  const rows = await sql<ChainRow[]>`
    select id, status, revises, pdf_url, preview_url, title, kind, child_id, subject
    from public.materials where family_id = ${familyId}
  `;
  const target = rows.find((row) => row.id === materialId);
  if (!target) {
    return {
      finalized: false,
      note: "That material id is not in this family. Use an id from a create or find_materials result.",
    };
  }

  const chain = collectChain(rows, materialId);
  const superseded = chain.filter(
    (row) => row.id !== materialId && row.status !== "superseded",
  );
  const draftsLosingBytes = superseded.filter((row) => row.status === "draft");

  await sql`
    update public.materials
    set status = 'final', approved_at = now()
    where id = ${materialId} and family_id = ${familyId}
  `;
  if (superseded.length > 0) {
    await sql`
      update public.materials
      set status = 'superseded'
      where family_id = ${familyId}
        and id in ${sql(superseded.map((row) => row.id))}
    `;
  }
  await deleteDraftBytes(draftsLosingBytes);
  return {
    finalized: true,
    title: target.title,
    versionsSuperseded: superseded.length,
    kind: target.kind,
    childId: target.child_id,
    subject: target.subject,
    note: "Final version kept; earlier drafts tidied away.",
  };
}

export async function finalizeMaterialCaller(
  db: SupabaseClient,
  familyId: string,
  materialId: string,
): Promise<FinalizeResult> {
  const { data } = await db
    .from("materials")
    .select("id, status, revises, pdf_url, preview_url, title, kind, child_id, subject")
    .eq("family_id", familyId);
  const rows = (data ?? []) as ChainRow[];
  const target = rows.find((row) => row.id === materialId);
  if (!target) {
    return {
      finalized: false,
      note: "That material id is not in this family. Use an id from a create or find_materials result.",
    };
  }

  const chain = collectChain(rows, materialId);
  const superseded = chain.filter(
    (row) => row.id !== materialId && row.status !== "superseded",
  );
  const draftsLosingBytes = superseded.filter((row) => row.status === "draft");

  const { error: finalError } = await db
    .from("materials")
    .update({ status: "final", approved_at: new Date().toISOString() })
    .eq("id", materialId)
    .eq("family_id", familyId);
  if (finalError) {
    return { finalized: false, note: `Could not finalize: ${finalError.message}` };
  }
  if (superseded.length > 0) {
    await db
      .from("materials")
      .update({ status: "superseded" })
      .eq("family_id", familyId)
      .in(
        "id",
        superseded.map((row) => row.id),
      );
  }
  await deleteDraftBytes(draftsLosingBytes);
  return {
    finalized: true,
    title: target.title,
    versionsSuperseded: superseded.length,
    kind: target.kind,
    childId: target.child_id,
    subject: target.subject,
    note: "Final version kept; earlier drafts tidied away.",
  };
}
