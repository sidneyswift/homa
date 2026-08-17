"use server";

import { revalidatePath } from "next/cache";

import { getAppData } from "../../../lib/app-data";
import {
  findMaterialVersionsCaller,
  type MaterialVersion,
} from "../../../lib/materials/history";
import {
  restoreMaterialVersionCaller,
  type RestoreMaterialResult,
} from "../../../lib/materials/restore-version";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

/**
 * A material's earlier versions, fetched when she opens one (gh#350).
 *
 * On demand rather than with the page: a binder can hold 300 materials
 * and she looks at one at a time, so loading every chain up front would
 * pay for history nobody opened.
 */
export async function materialVersionsAction(
  materialId: string,
): Promise<MaterialVersion[]> {
  const data = await getAppData();
  if (!data) return [];
  const supabase = await createSupabaseServerClient();
  return await findMaterialVersionsCaller(supabase, data.family.id, materialId);
}

export async function restoreMaterialVersionAction(
  materialId: string,
  sourceMaterialId: string,
): Promise<RestoreMaterialResult> {
  const data = await getAppData();
  if (!data) return { restored: false, note: "Sign in to use an earlier version." };
  const supabase = await createSupabaseServerClient();
  try {
    const result = await restoreMaterialVersionCaller({
      db: supabase,
      familyId: data.family.id,
      materialId,
      sourceMaterialId,
    });
    if (result.restored) revalidatePath("/app/binder");
    return result;
  } catch (error) {
    console.error(
      "restoreMaterialVersionAction failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return {
      restored: false,
      note: "I could not bring that version back. Nothing changed. Try again in a moment.",
    };
  }
}
