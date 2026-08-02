"use server";

import { revalidatePath } from "next/cache";

import { getMyFamily } from "../../../lib/family";
import { isHoursSubject } from "../../../lib/hours-model";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

/**
 * Planner Hours server actions (CG-02, issue #174). hours_log already
 * carries a real member-scoped RLS policy set (migration #37 plus the
 * update policy this ticket adds), so edits and deletes go straight
 * through the caller's own Supabase client, the same posture as
 * addChildAction in /app/settings. familyId always comes from the
 * caller's OWN membership (getMyFamily), never from the form, and every
 * write re-scopes by it in addition to RLS (tenancy law defense in
 * depth: a forged entryId can only ever miss, never touch another
 * family's row).
 */

export interface HoursActionState {
  error: string | null;
}

function parseMinutes(raw: FormDataEntryValue | null): number | { error: string } {
  const minutes = Number(raw);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) {
    return { error: "Minutes needs to be a whole number between 1 and 600." };
  }
  return minutes;
}

export async function updateHoursEntryAction(
  entryId: string,
  _prev: HoursActionState,
  formData: FormData,
): Promise<HoursActionState> {
  const family = await getMyFamily();
  if (!family) return { error: "Set up your family first." };

  const subjectRaw = String(formData.get("subject") ?? "");
  if (!isHoursSubject(subjectRaw)) {
    return { error: "Pick one of the listed subjects." };
  }
  const minutes = parseMinutes(formData.get("minutes"));
  if (typeof minutes !== "number") return { error: minutes.error };
  const noteRaw = String(formData.get("note") ?? "").trim();
  if (noteRaw.length > 200) {
    return { error: "Keep the note under 200 characters." };
  }

  const supabase = await createSupabaseServerClient();
  // familyId scopes the update on top of RLS: a forged entryId from
  // another family simply matches zero rows here, same shape as every
  // other /app write. .select("id") back so a silent zero-row match
  // (RLS filtered it out, or the row never existed) reports honestly
  // instead of a false "saved" -- PostgREST returns 200 with an empty
  // array for a well-formed update that touched nothing, it does not
  // error.
  const { data, error } = await supabase
    .from("hours_log")
    .update({ subject: subjectRaw, minutes, note: noteRaw || null })
    .eq("id", entryId)
    .eq("family_id", family.id)
    .select("id");
  if (error) {
    console.error("hours_log update failed:", error.message);
    return { error: "That didn't save. Nothing else changed; try again in a minute." };
  }
  if (!data || data.length === 0) {
    return { error: "That entry couldn't be found. Refresh the page and try again." };
  }
  revalidatePath("/app/planner");
  revalidatePath("/app/hours");
  return { error: null };
}

export async function deleteHoursEntryAction(entryId: string): Promise<HoursActionState> {
  const family = await getMyFamily();
  if (!family) return { error: "Set up your family first." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("hours_log")
    .delete()
    .eq("id", entryId)
    .eq("family_id", family.id);
  if (error) {
    console.error("hours_log delete failed:", error.message);
    return { error: "That didn't delete. Try again in a minute." };
  }
  revalidatePath("/app/planner");
  revalidatePath("/app/hours");
  return { error: null };
}
