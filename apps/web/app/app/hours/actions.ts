"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hoursEditContextSchema, hoursMutationError, type HoursEditContext } from "../../../lib/hours-edit";
import { isHoursSubject } from "../../../lib/hours-model";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export interface HoursActionState { error: string | null }

export async function getHoursEntryEditContextAction(entryId: string): Promise<
  | { context: HoursEditContext; error: null }
  | { context: null; error: string }
> {
  if (!z.string().uuid().safeParse(entryId).success) return { context: null, error: "That entry couldn't be found." };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_hours_entry_edit_context", { target_entry_id: entryId });
    if (error) return { context: null, error: "That record couldn't load. Try again." };
    const parsed = hoursEditContextSchema.safeParse(data);
    return parsed.success && parsed.data.entry.id === entryId
      ? { context: parsed.data, error: null }
      : { context: null, error: hoursMutationError(data) ?? "That record couldn't load. Try again." };
  } catch {
    return { context: null, error: "That record couldn't load. Check your connection and try again." };
  }
}

export async function updateHoursEntryAction(entryId: string, revision: string, formData: FormData): Promise<HoursActionState> {
  if (!z.string().uuid().safeParse(entryId).success) return { error: "That entry couldn't be found." };
  const subject = String(formData.get("subject") ?? "");
  if (!isHoursSubject(subject)) return { error: "Pick one of the listed subjects." };
  const minutes = Number(formData.get("minutes"));
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) {
    return { error: "Minutes needs to be a whole number between 1 and 600." };
  }
  const note = String(formData.get("note") ?? "").trim();
  const customLabel = String(formData.get("customLabel") ?? "").trim();
  if (Array.from(note).length > 200) return { error: "Keep the note to 200 characters or fewer." };
  if (Array.from(customLabel).length > 40) return { error: "Keep the category name to 40 characters or fewer." };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("update_hours_entry", {
      target_entry_id: entryId, target_revision: revision,
      target_subject: subject, target_minutes: minutes,
      target_custom_label: customLabel || null, target_note: note || null,
    });
    if (error) return { error: "That change couldn't be confirmed. Reopen the record to check before trying again." };
    const failure = hoursMutationError(data);
    if (failure) return { error: failure };
    const receipt = z.object({ result: z.literal("applied"), entryId: z.string().uuid() }).safeParse(data);
    if (!receipt.success || receipt.data.entryId !== entryId) return { error: "The change couldn't be confirmed. Reopen the record to check." };
    revalidatePath("/app/planner");
    revalidatePath("/app/hours");
    return { error: null };
  } catch {
    return { error: "That change couldn't be confirmed. Check your connection and reopen the record." };
  }
}

export async function deleteHoursEntryAction(entryId: string, revision: string): Promise<HoursActionState> {
  if (!z.string().uuid().safeParse(entryId).success) return { error: "That entry couldn't be found." };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("delete_hours_entry", {
      target_entry_id: entryId, target_revision: revision,
    });
    if (error) return { error: "The removal couldn't be confirmed. Reopen the record to check before trying again." };
    const failure = hoursMutationError(data);
    if (failure) return { error: failure };
    const receipt = z.object({ result: z.literal("applied"), entryId: z.string().uuid() }).safeParse(data);
    if (!receipt.success || receipt.data.entryId !== entryId) return { error: "The change couldn't be confirmed. Reopen the record to check." };
    revalidatePath("/app/planner");
    revalidatePath("/app/hours");
    return { error: null };
  } catch {
    return { error: "The removal couldn't be confirmed. Check your connection and reopen the record." };
  }
}
