import type { SupabaseClient } from "@supabase/supabase-js";

import { mapDb } from "../map/db";

export interface RestoreRecordInput {
  familyId: string;
  sourceMaterialId: string;
  expectedDeletedAt: string | null;
  pdfUrl: string;
  previewUrl: string;
  generation: Record<string, unknown>;
  channel: "web" | "sms" | "email" | "dispatch";
}

export async function insertRestoredMaterialCaller(
  db: SupabaseClient,
  input: RestoreRecordInput,
): Promise<{ id: string } | null> {
  const { data, error } = await db.rpc("restore_family_material_version", {
    p_family_id: input.familyId,
    p_source_material_id: input.sourceMaterialId,
    p_expected_deleted_at: input.expectedDeletedAt,
    p_pdf_url: input.pdfUrl,
    p_preview_url: input.previewUrl,
    p_generation: input.generation,
  });
  return !error && typeof data === "string" ? { id: data } : null;
}

/** Same short transaction as the caller RPC, for authenticated server channels. */
export async function insertRestoredMaterialPinned(
  input: RestoreRecordInput,
): Promise<{ id: string } | null> {
  const sql = mapDb();
  return await sql.begin(async (tx) => {
    await tx`
      select pg_advisory_xact_lock(hashtextextended(
        'material-collection:' || ${input.familyId}::uuid::text, 0
      ))
    `;
    const source = await tx<{ id: string }[]>`
      select id from public.materials
      where id = ${input.sourceMaterialId} and family_id = ${input.familyId}
        and subject_lesson_id is null
        and deleted_at is not distinct from ${input.expectedDeletedAt}::text::timestamptz
      for update
    `;
    if (!source[0]) return null;
    const inserted = await tx<{ id: string }[]>`
      insert into public.materials
        (family_id, child_id, title, kind, skill, subject, curriculum,
         theme, characters, tags, pdf_url, preview_url, html, source,
         status, revises, approved_at, channel, generation)
      select ${input.familyId}, source.child_id, source.title, source.kind,
             source.skill, source.subject, source.curriculum, source.theme,
             source.characters, source.tags, ${input.pdfUrl},
             ${input.previewUrl}, source.html, source.source, 'final',
             source.id, now(), ${input.channel}, ${tx.json(input.generation as never)}
      from public.materials source
      where source.id = ${input.sourceMaterialId}
        and source.family_id = ${input.familyId}
        and source.subject_lesson_id is null
      returning id
    `;
    if (!inserted[0]) return null;
    await tx`
      update public.materials set deleted_at = null
      where id = ${inserted[0].id} and family_id = ${input.familyId}
    `;
    return inserted[0];
  });
}
