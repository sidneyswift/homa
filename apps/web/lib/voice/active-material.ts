import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { selectParentVisibleMaterialRevisions } from "../materials/parent-visible";
import { mapDb } from "../map/db";

/**
 * Temporary material-only seam for gh#537/gh#538 while the general active
 * object contract in gh#536 is still open. The native client identifies the
 * material card it is showing. This module turns that hint into bounded agent
 * context only after an RLS read and a family predicate agree that the exact
 * revision is still the parent-visible node of its chain.
 *
 * Replace this adapter with gh#536's general resolver, never grow it into a
 * second active-object system.
 */

export const VOICE_ACTIVE_MATERIAL_HEADER = "x-homa-active-material-id";

export const MATERIAL_PAGE_ROLES = [
  "child",
  "answer_key",
  "parent_guide",
  "other",
] as const;

export type MaterialPageRole = (typeof MATERIAL_PAGE_ROLES)[number];

const activeMaterialSchema = z.object({
  kind: z.literal("material"),
  id: z.uuid(),
});

export interface ActiveMaterialReference {
  kind: "material";
  id: string;
}

export interface ResolvedActiveMaterial {
  id: string;
  title: string;
  status: "draft" | "final";
  revisesId: string | null;
  pageCount: number;
  pageRoles: MaterialPageRole[] | null;
}

interface ActiveMaterialRow {
  id: string;
  title: string;
  status: "draft" | "final" | "superseded";
  revises: string | null;
  created_at: string;
  review_pass: string | null;
  page_count: number | string | null;
  page_roles: unknown;
}

export function parseActiveMaterialReference(
  value: unknown,
): ActiveMaterialReference | null {
  const parsed = activeMaterialSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function pageCount(value: number | string | null): number {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return typeof parsed === "number" && Number.isInteger(parsed) && parsed > 0
    ? parsed
    : 1;
}

export function parseMaterialPageRoles(
  value: unknown,
  expectedPages: number,
): MaterialPageRole[] | null {
  if (!Array.isArray(value) || value.length !== expectedPages) return null;
  const parsed = z.array(z.enum(MATERIAL_PAGE_ROLES)).safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function selectActiveMaterial(
  rows: readonly ActiveMaterialRow[],
  requestedId: string,
): ResolvedActiveMaterial | null {
  const selected = selectParentVisibleMaterialRevisions(
    rows.map((row) => ({
      ...row,
      revisesId: row.revises,
      reviewPass: row.review_pass === null ? null : row.review_pass !== "false",
      order: Date.parse(row.created_at),
    })),
  ).find((row) => row.id === requestedId);
  if (!selected || selected.status === "superseded") return null;
  const count = pageCount(selected.page_count);
  return {
    id: selected.id,
    title: selected.title,
    status: selected.status,
    revisesId: selected.revises,
    pageCount: count,
    pageRoles: parseMaterialPageRoles(selected.page_roles, count),
  };
}

export async function resolveActiveMaterialCaller(
  db: SupabaseClient,
  familyId: string,
  requestedId: string,
): Promise<ResolvedActiveMaterial | null> {
  const { data, error } = await db
    .from("materials")
    .select(
      "id, title, status, revises, created_at, review_pass:generation->review->>pass, " +
        "page_count:generation->pageCount, page_roles:generation->pageRoles",
    )
    .eq("family_id", familyId)
    .limit(3000);
  if (error) {
    console.error("active material lookup failed:", error.message);
    return null;
  }
  return selectActiveMaterial((data ?? []) as unknown as ActiveMaterialRow[], requestedId);
}

export async function resolveActiveMaterialPinned(
  familyId: string,
  requestedId: string,
): Promise<ResolvedActiveMaterial | null> {
  const sql = mapDb();
  const rows = await sql<ActiveMaterialRow[]>`
    select id, title, status, revises, created_at,
           generation->'review'->>'pass' as review_pass,
           generation->'pageCount' as page_count,
           generation->'pageRoles' as page_roles
    from public.materials
    where family_id = ${familyId}
    order by created_at asc
    limit 3000
  `;
  return selectActiveMaterial(rows, requestedId);
}

export function activeMaterialContext(material: ResolvedActiveMaterial): string {
  const roles = material.pageRoles
    ? material.pageRoles.map((role, index) => `${index + 1}:${role}`).join(", ")
    : "not labelled";
  return [
    "## Visible material (server verified)",
    "",
    `The parent is looking at exactly this material: \"${material.title}\".`,
    `materialId: ${material.id}`,
    `status: ${material.status}`,
    `revisesId: ${material.revisesId ?? "none"}`,
    `pageCount: ${material.pageCount}`,
    `pageRoles: ${roles}`,
    "",
    "Use this id when she says this, it, or that one. If she asks for any",
    "change, revise this node and do not finalize it first. If this block is",
    "present but she explicitly names a different child or material, do not",
    "apply an effect to this id. Ask only: Which material do you mean? If this block is",
    "absent or says the reference is unavailable, ask one short question",
    "instead of selecting another material.",
  ].join("\n");
}

export const INVALID_ACTIVE_MATERIAL_CONTEXT = [
  "## Visible material reference unavailable",
  "",
  "The client reported a visible material, but the authenticated family and",
  "revision checks did not resolve it. Do not guess from conversation history.",
  "Ask the parent to tap or show the material again in one short question.",
].join("\n");
