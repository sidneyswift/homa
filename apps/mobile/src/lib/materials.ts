import { supabase } from "./supabase";

/**
 * Binder material reads for the signed-in app, ported from
 * apps/web/lib/materials/library.ts (findMaterialsCaller) and
 * apps/web/lib/materials/kinds.ts. Keep the shapes and the column list
 * in sync with those files until a shared package exists. Every query
 * runs under the caller's RLS context ("members read their materials"),
 * so rows are family-scoped by the database itself, not by trust in
 * this code.
 */

/** The material kind vocabulary (apps/web/lib/materials/kinds.ts). */
export const MATERIAL_KINDS = [
  "worksheet",
  "coloring",
  "flashcards",
  "reader",
  "poster",
  "infographic",
  "game",
  "packet",
  "other",
] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

/**
 * The web binder's hard ceiling (apps/web/app/app/binder/page.tsx):
 * comfortably above what one family accrues before search matters.
 */
export const MAX_FINAL_MATERIALS = 300;

/** The subset of web's MaterialSummary the mobile Binder renders. */
export interface MaterialSummary {
  id: string;
  title: string;
  kind: MaterialKind;
  subject: string | null;
  theme: string | null;
  skill: string | null;
  childId: string | null;
  previewUrl: string;
  pdfUrl: string;
  createdAt: string;
  /** PDF pages (1 for classic single-page materials). */
  pageCount: number;
  /** Per-page previews for multi-page materials, page 1 first. */
  pagePreviewUrls: string[] | null;
}

interface MaterialRow {
  id: string;
  title: string;
  kind: string;
  subject: string | null;
  theme: string | null;
  skill: string | null;
  child_id: string | null;
  preview_url: string;
  pdf_url: string;
  created_at: string;
  page_count: number | string | null;
  page_preview_urls: unknown;
}

// Mirrors web's SUMMARY_COLUMNS: pageCount and pagePreviewUrls live in
// the generation JSONB, surfaced through PostgREST's JSON operators.
const SUMMARY_COLUMNS =
  "id, title, kind, subject, theme, skill, child_id, preview_url, " +
  "pdf_url, created_at, page_count:generation->pageCount, " +
  "page_preview_urls:generation->pagePreviewUrls";

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

/**
 * A shipped app build outlives web deploys, so a kind this build has
 * never heard of must render as "other" instead of crashing label
 * lookups when the fleet gains a new material kind.
 */
function normalizeKind(raw: string): MaterialKind {
  return (MATERIAL_KINDS as readonly string[]).includes(raw)
    ? (raw as MaterialKind)
    : "other";
}

function toSummary(row: MaterialRow): MaterialSummary {
  return {
    id: row.id,
    title: row.title,
    kind: normalizeKind(row.kind),
    subject: row.subject,
    theme: row.theme,
    skill: row.skill,
    childId: row.child_id,
    previewUrl: row.preview_url,
    pdfUrl: row.pdf_url,
    createdAt: row.created_at,
    pageCount: normalizePageCount(row.page_count),
    pagePreviewUrls: normalizePagePreviewUrls(row.page_preview_urls),
  };
}

/**
 * The family's kept materials, newest first: the Binder's first-release
 * scope (finalized only), same as the web page's findMaterialsCaller
 * call with { status: "final", limit: MAX_FINAL_MATERIALS }.
 */
export async function listFinalMaterials(
  familyId: string,
): Promise<MaterialSummary[]> {
  const { data, error } = await supabase
    .from("materials")
    .select(SUMMARY_COLUMNS)
    .eq("family_id", familyId)
    .eq("status", "final")
    .order("created_at", { ascending: false })
    .limit(MAX_FINAL_MATERIALS);
  if (error) throw new Error(`materials read failed: ${error.message}`);
  return ((data ?? []) as unknown as MaterialRow[]).map(toSummary);
}
