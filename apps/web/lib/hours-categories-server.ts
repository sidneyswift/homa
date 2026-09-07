import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hoursCategorySchema, saveHoursCategorySchema, type SaveHoursCategory } from "./hours-categories";
import { mapDb } from "./map/db";

export type CategoryAccess = { familyId: string; mode: "pinned" } | { familyId: string; mode: "caller"; db: SupabaseClient };

export async function readHoursCategories(access: CategoryAccess) {
  let raw: unknown;
  if (access.mode === "caller") {
    const { data, error, count } = await access.db.from("hours_categories").select("id,subject,name", { count: "exact" }).eq("family_id", access.familyId).order("subject").order("name").limit(5000).abortSignal(AbortSignal.timeout(15_000));
    if (error || count === null || data?.length !== count) throw new Error("Categories could not load completely.");
    raw = data;
  } else {
    raw = await mapDb().begin("read only", async tx => {
      await tx`set local statement_timeout='15s'`;
      return tx`select id,subject,name from public.hours_categories where family_id=${access.familyId} order by subject,name limit 5001`;
    });
  }
  return z.array(hoursCategorySchema).max(5000).parse(raw);
}

export async function saveHoursCategory(access: CategoryAccess, request: SaveHoursCategory) {
  const input = saveHoursCategorySchema.parse(request);
  let raw: unknown;
  if (access.mode === "caller") {
    const { data, error } = await access.db.rpc("save_hours_category", { target_family_id: access.familyId, target_subject: input.subject, target_name: input.name, target_category_id: input.categoryId ?? null, expected_name: input.expectedName ?? null }).abortSignal(AbortSignal.timeout(15_000));
    if (error) throw new Error("Category change could not be confirmed.");
    raw = data;
  } else {
    raw = await mapDb().begin(async tx => {
      await tx`set local statement_timeout='15s'`;
      await tx`set local lock_timeout='2s'`;
      return (await tx`select public.save_hours_category(${access.familyId}::uuid,${input.subject},${input.name},${input.categoryId ?? null}::uuid,${input.expectedName ?? null}) as result`)[0]?.result;
    });
  }
  return z.discriminatedUnion("status", [
    z.object({ status: z.literal("saved"), category: hoursCategorySchema }),
    z.object({ status: z.enum(["invalid", "not_found", "conflict", "duplicate"]) }),
  ]).parse(raw);
}
