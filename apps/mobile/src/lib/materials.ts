import { supabase } from "./supabase";

/**
 * Reads and the keep (finalize) write for materials, ported from
 * apps/web/lib/materials/library.ts. Assets (pdf_url, preview_url) are
 * plain public Vercel Blob URLs, no auth header needed, matching how
 * apps/mobile/src/features/chat/material-card.tsx already opens them.
 */

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
export type MaterialStatus = "draft" | "final" | "superseded";

export interface MaterialSummary {
  id: string;
  title: string;
  kind: MaterialKind;
  status: MaterialStatus;
  skill: string | null;
  subject: string | null;
  theme: string | null;
  childId: string | null;
  previewUrl: string;
  pdfUrl: string;
  createdAt: string;
  pageCount: number;
  pagePreviewUrls: string[] | null;
}

interface MaterialDbRow {
  id: string;
  title: string;
  kind: string;
  status: string;
  skill: string | null;
  subject: string | null;
  theme: string | null;
  child_id: string | null;
  preview_url: string;
  pdf_url: string;
  created_at: string;
  page_count: number | string | null;
  page_preview_urls: string[] | null;
}

const SUMMARY_COLUMNS =
  "id, title, kind, status, skill, subject, theme, child_id, preview_url, pdf_url, created_at, " +
  "page_count:generation->pageCount, page_preview_urls:generation->pagePreviewUrls";

function normalizePageCount(raw: number | string | null | undefined): number {
  const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : raw;
  return typeof parsed === "number" && Number.isFinite(parsed) && parsed > 1 ? parsed : 1;
}

function normalizePagePreviewUrls(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const urls = raw.filter((entry): entry is string => typeof entry === "string");
  return urls.length > 1 ? urls : null;
}

function isMaterialKind(value: string): value is MaterialKind {
  return (MATERIAL_KINDS as readonly string[]).includes(value);
}

function toSummary(row: MaterialDbRow): MaterialSummary {
  return {
    id: row.id,
    title: row.title,
    kind: isMaterialKind(row.kind) ? row.kind : "other",
    status: (row.status as MaterialStatus) ?? "draft",
    skill: row.skill,
    subject: row.subject,
    theme: row.theme,
    childId: row.child_id,
    previewUrl: row.preview_url,
    pdfUrl: row.pdf_url,
    createdAt: row.created_at,
    pageCount: normalizePageCount(row.page_count),
    pagePreviewUrls: normalizePagePreviewUrls(row.page_preview_urls),
  };
}

/** Comfortably above what one family accrues before search matters; a
 * hard ceiling is a stopgap, matching web's own MAX_FINAL_MATERIALS. */
const MAX_MATERIALS = 300;

export async function getFinalMaterials(familyId: string): Promise<MaterialSummary[]> {
  const { data, error } = await supabase
    .from("materials")
    .select(SUMMARY_COLUMNS)
    .eq("family_id", familyId)
    .eq("status", "final")
    .order("created_at", { ascending: false })
    .limit(MAX_MATERIALS);
  if (error) throw new Error(`materials read failed: ${error.message}`);
  return ((data ?? []) as unknown as MaterialDbRow[]).map(toSummary);
}

interface InProgressCandidate {
  id: string;
  revisesId: string | null;
  status: MaterialStatus;
  reviewPass: boolean | null;
  order: number;
  row: MaterialDbRow;
}

/** The dedup pass ported from apps/web/lib/materials/parent-visible.ts:
 * one card per revision chain, never one per attempt (a chain revised
 * ten times over should not show ten cards). */
function selectInProgressCandidates(candidates: readonly InProgressCandidate[]): InProgressCandidate[] {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  function rootIdFor(candidate: InProgressCandidate): string {
    let current = candidate;
    const visited = new Set<string>();
    while (current.revisesId && !visited.has(current.id)) {
      visited.add(current.id);
      const parent = byId.get(current.revisesId);
      if (!parent) return current.revisesId;
      current = parent;
    }
    return current.id;
  }

  function newest(rows: readonly InProgressCandidate[]): InProgressCandidate {
    return [...rows].sort((left, right) => right.order - left.order || right.id.localeCompare(left.id))[0];
  }

  const chains = new Map<string, InProgressCandidate[]>();
  for (const candidate of candidates) {
    const rootId = rootIdFor(candidate);
    const chain = chains.get(rootId) ?? [];
    chain.push(candidate);
    chains.set(rootId, chain);
  }

  const selected: InProgressCandidate[] = [];
  for (const chain of chains.values()) {
    const finals = chain.filter((candidate) => candidate.status === "final");
    if (finals.length > 0) continue; // already kept: not "in progress"
    const available = chain.filter(
      (candidate) => candidate.status !== "superseded" && candidate.reviewPass !== false,
    );
    if (available.length > 0) selected.push(newest(available));
  }
  return selected;
}

export async function getInProgressMaterials(familyId: string): Promise<MaterialSummary[]> {
  const { data, error } = await supabase
    .from("materials")
    .select(`${SUMMARY_COLUMNS}, revises, subject_lesson_id, review_pass:generation->review->>pass`)
    .eq("family_id", familyId)
    .order("created_at", { ascending: false })
    .limit(MAX_MATERIALS);
  if (error) throw new Error(`in-progress materials read failed: ${error.message}`);
  const rows = (data ?? []) as unknown as (MaterialDbRow & {
    revises: string | null;
    subject_lesson_id: string | null;
    review_pass: string | null;
  })[];
  const candidates: InProgressCandidate[] = rows
    .filter((row) => !row.subject_lesson_id)
    .map((row) => ({
      id: row.id,
      revisesId: row.revises,
      status: (row.status as MaterialStatus) ?? "draft",
      reviewPass: row.review_pass === null ? null : row.review_pass !== "false",
      order: Date.parse(row.created_at),
      row,
    }));
  return selectInProgressCandidates(candidates)
    .filter((candidate) => candidate.status === "draft")
    .sort((left, right) => right.order - left.order)
    .map((candidate) => toSummary(candidate.row));
}

export interface FinalizeResult {
  finalized: boolean;
  note: string;
}

export async function keepMaterial(familyId: string, materialId: string): Promise<FinalizeResult> {
  const { data, error } = await supabase.rpc("finalize_family_material", {
    p_family_id: familyId,
    p_material_id: materialId,
  });
  if (error) return { finalized: false, note: "That didn't save. Try once more in a moment." };
  const row = Array.isArray(data) ? data[0] : data;
  return { finalized: Boolean(row?.finalized), note: row?.finalized ? "Kept." : "That didn't save." };
}
