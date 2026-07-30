"use server";

import { revalidatePath } from "next/cache";

import { getAppData } from "../../../lib/app-data";
import { finalizeMaterialCaller } from "../../../lib/materials/library";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

/**
 * Keep an in-progress material from the binder (gh#197, gh#175).
 *
 * Until now the only way a material became final was the agent calling
 * mark_material_final after hearing clear approval in conversation. A
 * parent who liked a worksheet and simply printed it, or who came back
 * the next day after the chat session rotated, had no way to say so:
 * fleet-wide, 59% of revision chains never reach final (gh#348).
 *
 * Runs on the caller's own session so RLS is the wall, and re-scopes the
 * id inside the caller's family before finalizing. The finalize path
 * itself is idempotent, so a double click is harmless.
 */
export async function keepMaterialAction(
  materialId: string,
): Promise<{ kept: boolean; note: string }> {
  const data = await getAppData();
  if (!data) return { kept: false, note: "Sign in to keep this." };

  const supabase = await createSupabaseServerClient();
  try {
    const result = await finalizeMaterialCaller(
      supabase,
      data.family.id,
      materialId,
    );
    if (result.finalized) revalidatePath("/app/binder");
    return { kept: result.finalized, note: result.note };
  } catch (error) {
    console.error(
      "keepMaterialAction failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return {
      kept: false,
      note: "That did not save. Try once more in a moment.",
    };
  }
}
