"use server";

import { revalidatePath } from "next/cache";

import { getAppData } from "../../../lib/app-data";
import { softDeleteMaterialCaller } from "../../../lib/materials/library";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

/**
 * Delete a saved or in-progress material from the Binder (Carolyng
 * feedback, 2026-08-27): "We should be able to delete in progress and
 * saved items from binder... As people keep using Homa the binder will
 * fill up and feel overwhelming."
 *
 * Same shape as keepMaterialAction: runs on the caller's own session so
 * RLS is the wall, re-scopes the id inside the caller's family before
 * touching anything, and the underlying soft delete is idempotent (a
 * double click reports "Already removed.").
 */
export async function deleteMaterialAction(
  materialId: string,
): Promise<{ deleted: boolean; note: string }> {
  try {
    const data = await getAppData();
    if (!data) return { deleted: false, note: "Sign in to delete this." };
    const supabase = await createSupabaseServerClient();
    const result = await softDeleteMaterialCaller(supabase, data.family.id, materialId);
    if (result.deleted) {
      revalidatePath("/app/binder");
      revalidatePath("/app");
    }
    return result;
  } catch (error) {
    console.error(
      "deleteMaterialAction failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return { deleted: false, note: "That did not delete. Try again in a moment." };
  }
}
