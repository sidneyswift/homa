import type { SupabaseClient } from "@supabase/supabase-js";

import { mapDb } from "../map/db";
import {
  blobConfigured,
  type MaterialArtifactUrls,
  uploadMaterialArtifacts,
} from "./artifact-store";
import {
  printableSlug,
  splitPageBodies,
  wrapPrintableDocument,
} from "./page-shell";
import {
  PREVIEW_PAGE_CAP,
  renderPrintableHtml,
} from "./render-page";
import { buildRenderProvenance } from "./render-provenance";
import { insertRestoredMaterialCaller, insertRestoredMaterialPinned } from "./restore-record";

import { prepareHandwritingDocument, handwritingFailureNote } from "./handwriting/document";

const RESTORABLE_SINCE = Date.parse("2026-07-29T00:00:00.000Z");

export interface RestoreRow {
  id: string;
  family_id: string;
  child_id: string | null;
  child_name: string | null;
  title: string;
  kind: string;
  skill: string | null;
  subject: string | null;
  curriculum: string | null;
  theme: string | null;
  characters: string[];
  tags: string[];
  html: string;
  source: "html" | "image" | "hybrid";
  status: "draft" | "final" | "superseded";
  revises: string | null;
  preview_url: string;
  created_at: string;
  generation: unknown;
  subject_lesson_id: string | null;
  deleted_at: string | null;
}

export interface RestoredMaterial {
  id: string;
  title: string;
  kind: string;
  skill: string | null;
  childName: string | null;
  previewUrl: string;
  pdfUrl: string;
  pageCount: number;
  pagePreviewUrls: string[] | null;
  restoredFromId: string;
  restoredFromOrdinal: number;
}

export type RestoreMaterialResult =
  | { restored: true; material: RestoredMaterial; note: string }
  | { restored: false; note: string };

interface InsertRestoreInput {
  row: RestoreRow;
  artifacts: MaterialArtifactUrls;
  generation: Record<string, unknown>;
  channel: "web" | "sms" | "email" | "dispatch";
}

interface RestoreAccess {
  loadRows(): Promise<RestoreRow[]>;
  insert(input: InsertRestoreInput): Promise<{ id: string } | null>;
}

function connectedIds(rows: readonly RestoreRow[], startingId: string): Set<string> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const children = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.revises) continue;
    children.set(row.revises, [...(children.get(row.revises) ?? []), row.id]);
  }
  const connected = new Set<string>();
  const queue = [startingId];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (connected.has(id)) continue;
    const row = byId.get(id);
    if (!row) continue;
    connected.add(id);
    if (row.revises) queue.push(row.revises);
    queue.push(...(children.get(id) ?? []));
  }
  return connected;
}

export function selectRestorableVersion(input: {
  rows: readonly RestoreRow[];
  materialId: string;
  sourceMaterialId?: string;
  versionOrdinal?: number;
}): RestoreRow | null {
  const connected = connectedIds(input.rows, input.materialId);
  if (!connected.has(input.materialId)) return null;
  const chain = input.rows
    .filter((row) => connected.has(row.id))
    .sort(
      (left, right) =>
        Date.parse(left.created_at) - Date.parse(right.created_at)
        || left.id.localeCompare(right.id),
    );
  const currentIndex = chain.findIndex((row) => row.id === input.materialId);
  const selected = input.sourceMaterialId
    ? chain.find((row) => row.id === input.sourceMaterialId) ?? null
    : input.versionOrdinal
      ? chain[input.versionOrdinal - 1] ?? null
      : chain[currentIndex - 1] ?? null;
  if (!selected || selected.id === input.materialId) return null;
  if (Date.parse(selected.created_at) < RESTORABLE_SINCE) return null;
  if (!selected.preview_url.trim()) return null;
  if (selected.subject_lesson_id) return null;
  return selected;
}

function restoredGeneration(input: {
  original: unknown;
  sourceMaterialId: string;
  artifacts: MaterialArtifactUrls;
  pageCount: number;
  renderer: string;
  rendererVersion: string | null;
}): Record<string, unknown> {
  const original =
    input.original && typeof input.original === "object" && !Array.isArray(input.original)
      ? input.original as Record<string, unknown>
      : {};
  const next = { ...original };
  delete next.pagePreviewUrls;
  return {
    ...next,
    pageCount: input.pageCount,
    ...(input.artifacts.pagePreviewUrls.length > 1
      ? { pagePreviewUrls: input.artifacts.pagePreviewUrls }
      : {}),
    render: buildRenderProvenance({
      renderer: input.renderer,
      rendererVersion: input.rendererVersion,
      previewPageCap: PREVIEW_PAGE_CAP,
    }),
    restore: {
      sourceMaterialId: input.sourceMaterialId,
      restoredAt: new Date().toISOString(),
    },
  };
}

async function restoreWithAccess(input: {
  access: RestoreAccess;
  familyId: string;
  materialId: string;
  sourceMaterialId?: string;
  versionOrdinal?: number;
  channel: "web" | "sms" | "email" | "dispatch";
}): Promise<RestoreMaterialResult> {
  if (!blobConfigured()) {
    return { restored: false, note: "I could not bring that version back. Nothing changed. Try again in a moment." };
  }
  const rows = await input.access.loadRows();
  const selected = selectRestorableVersion({
    rows,
    materialId: input.materialId,
    sourceMaterialId: input.sourceMaterialId,
    versionOrdinal: input.versionOrdinal,
  });
  if (!selected) {
    return {
      restored: false,
      note: "That earlier version is no longer available. Nothing changed.",
    };
  }

  const pageBodies = splitPageBodies(selected.html);
  if (pageBodies.length === 0) {
    return { restored: false, note: "That earlier version is no longer available. Nothing changed." };
  }
  const priorGeneration = selected.generation && typeof selected.generation === "object"
    ? selected.generation as Record<string, unknown> : {};
  let rendered;
  let handwriting;
  try {
    handwriting = prepareHandwritingDocument(pageBodies.map((body, index) => ({
      body, fresh: false, carriedMaterialId: selected.id, carriedRows: priorGeneration.handwritingRows, carriedPage: index + 1,
    })));
    rendered = await renderPrintableHtml(
      wrapPrintableDocument(handwriting.bodies, selected.child_name ?? ""),
      undefined,
      handwriting.expectations,
    );
  } catch (error) {
    const note = handwritingFailureNote(error);
    if (note) return { restored: false, note };
    throw error;
  }
  const artifacts = await uploadMaterialArtifacts({
    familyId: input.familyId,
    slug: `${printableSlug(selected.title)}-restored`,
    pdf: rendered.pdf,
    pageJpegs: rendered.pageJpegs.slice(0, PREVIEW_PAGE_CAP),
  });
  const generation = restoredGeneration({
    original: handwriting.receipts.length ? { ...priorGeneration, handwritingRows: handwriting.receipts, handwritingRender: rendered.handwriting } : selected.generation,
    sourceMaterialId: selected.id,
    artifacts,
    pageCount: rendered.pageCount,
    renderer: rendered.renderer,
    rendererVersion: rendered.rendererVersion,
  });
  const inserted = await input.access.insert({
    row: selected,
    artifacts,
    generation,
    channel: input.channel,
  });
  if (!inserted) {
    return { restored: false, note: "I could not bring that version back. Nothing changed. Try again in a moment." };
  }
  const selectedChainIds = connectedIds(rows, selected.id);
  const restoredFromOrdinal = rows
    .filter((row) => selectedChainIds.has(row.id))
    .sort(
      (left, right) =>
        Date.parse(left.created_at) - Date.parse(right.created_at)
        || left.id.localeCompare(right.id),
    )
    .findIndex((row) => row.id === selected.id) + 1;
  return {
    restored: true,
    material: {
      id: inserted.id,
      title: selected.title,
      kind: selected.kind,
      skill: selected.skill,
      childName: selected.child_name,
      previewUrl: artifacts.previewUrl,
      pdfUrl: artifacts.pdfUrl,
      pageCount: rendered.pageCount,
      pagePreviewUrls:
        artifacts.pagePreviewUrls.length > 1 ? artifacts.pagePreviewUrls : null,
      restoredFromId: selected.id,
      restoredFromOrdinal,
    },
    note: `Version ${restoredFromOrdinal} is back. The other versions are still here.`,
  };
}

const RESTORE_COLUMNS =
  "id, family_id, child_id, title, kind, skill, subject, curriculum, theme, "
  + "characters, tags, html, source, status, revises, preview_url, created_at, "
  + "generation, subject_lesson_id, deleted_at";

export async function restoreMaterialVersionCaller(input: {
  db: SupabaseClient;
  familyId: string;
  materialId: string;
  sourceMaterialId?: string;
  versionOrdinal?: number;
}): Promise<RestoreMaterialResult> {
  return await restoreWithAccess({
    ...input,
    channel: "web",
    access: {
      async loadRows() {
        const { data, error } = await input.db
          .from("materials")
          .select(RESTORE_COLUMNS)
          .eq("family_id", input.familyId)
          .limit(3000);
        if (error) throw new Error(error.message);
        const rows = (data ?? []) as unknown as Omit<RestoreRow, "child_name">[];
        const childIds = [...new Set(rows.flatMap((row) => row.child_id ? [row.child_id] : []))];
        const childNames = new Map<string, string>();
        if (childIds.length > 0) {
          const children = await input.db
            .from("children")
            .select("id, name")
            .eq("family_id", input.familyId)
            .in("id", childIds);
          if (children.error) throw new Error(children.error.message);
          for (const child of children.data ?? []) childNames.set(child.id, child.name);
        }
        return rows.map((row) => ({
          ...row,
          child_name: row.child_id ? childNames.get(row.child_id) ?? null : null,
        }));
      },
      async insert({ row, artifacts, generation, channel }) {
        return await insertRestoredMaterialCaller(input.db, {
          familyId: input.familyId,
          sourceMaterialId: row.id,
          expectedDeletedAt: row.deleted_at,
          pdfUrl: artifacts.pdfUrl,
          previewUrl: artifacts.previewUrl,
          generation,
          channel,
        });
      },
    },
  });
}

export async function restoreMaterialVersionPinned(input: {
  familyId: string;
  materialId: string;
  sourceMaterialId?: string;
  versionOrdinal?: number;
  channel: "web" | "sms" | "email" | "dispatch";
}): Promise<RestoreMaterialResult> {
  const sql = mapDb();
  return await restoreWithAccess({
    ...input,
    access: {
      async loadRows() {
        return await sql<RestoreRow[]>`
          select material.id, material.family_id, material.child_id,
                 child.name as child_name, material.title, material.kind,
                 material.skill, material.subject, material.curriculum,
                 material.theme, material.characters, material.tags,
                 material.html, material.source, material.status,
                 material.revises, material.preview_url, material.created_at,
                 material.generation, material.subject_lesson_id,
                 material.deleted_at::text as deleted_at
          from public.materials material
          left join public.children child
            on child.id = material.child_id
           and child.family_id = material.family_id
          where material.family_id = ${input.familyId}
          order by material.created_at asc
          limit 3000
        `;
      },
      async insert({ row, artifacts, generation, channel }) {
        return await insertRestoredMaterialPinned({
          familyId: input.familyId,
          sourceMaterialId: row.id,
          expectedDeletedAt: row.deleted_at,
          pdfUrl: artifacts.pdfUrl,
          previewUrl: artifacts.previewUrl,
          generation,
          channel,
        });
      },
    },
  });
}
