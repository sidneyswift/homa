"use server";

import { getAppData } from "../../../lib/app-data";
import {
  findMaterialVersionsCaller,
  type MaterialVersion,
} from "../../../lib/materials/history";
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
