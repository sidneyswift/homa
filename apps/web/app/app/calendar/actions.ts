"use server";

import { revalidatePath } from "next/cache";

import { getMyFamily } from "../../../lib/family";
import { parseFamilyEventInput, type FamilyEventInput } from "../../../lib/family-events";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

/**
 * Planner appointment server actions (issue #176, CG-03, the touch-and-do
 * round: both ICP judges' "next wow" was adding and changing events
 * directly on the grid). Same posture as /app/hours actions:
 * family_events carries a full member-scoped RLS policy set (the
 * 2026-07-26 migration), writes go through the caller's own Supabase
 * client, familyId always comes from the caller's OWN membership
 * (getMyFamily) and never from the form, every write re-scopes by it on
 * top of RLS, and a model- or client-supplied childId is re-checked
 * against this family's real children before it rides an insert or
 * update. Validation is parseFamilyEventInput, the exact same rules the
 * agent's add_family_event tool uses, so chat-created and grid-created
 * events can never drift apart.
 */

export interface CalendarActionResult {
  error: string | null;
}

/** Resolves a client-supplied child id inside the caller's own family,
 * or reports honestly. Null means a whole-family event. */
async function rescopeChildId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  familyId: string,
  childId: string | null,
): Promise<{ ok: true; childId: string | null } | { ok: false; error: string }> {
  if (!childId) return { ok: true, childId: null };
  const { data, error } = await supabase
    .from("children")
    .select("id")
    .eq("id", childId)
    .eq("family_id", familyId)
    .maybeSingle();
  if (error) {
    console.error("family_events child rescope failed:", error.message);
    return { ok: false, error: "That didn't save. Nothing changed; try again in a minute." };
  }
  if (!data) return { ok: false, error: "Pick one of your own kids, or the whole family." };
  return { ok: true, childId: data.id };
}

export async function createFamilyEventAction(
  input: FamilyEventInput,
): Promise<CalendarActionResult> {
  const family = await getMyFamily();
  if (!family) return { error: "Set up your family first." };
  const parsed = parseFamilyEventInput(input);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createSupabaseServerClient();
  const child = await rescopeChildId(supabase, family.id, input.childId ?? null);
  if (!child.ok) return { error: child.error };

  const { error } = await supabase.from("family_events").insert({
    family_id: family.id,
    child_id: child.childId,
    title: parsed.value.title,
    starts_on: parsed.value.startsOn,
    ends_on: parsed.value.endsOn,
    start_time: parsed.value.startTime,
    end_time: parsed.value.endTime,
    note: parsed.value.note,
  });
  if (error) {
    console.error("family_events insert failed:", error.message);
    return { error: "That didn't save. Nothing changed; try again in a minute." };
  }
  revalidatePath("/app/planner");
  revalidatePath("/app/calendar");
  return { error: null };
}

export async function updateFamilyEventAction(
  eventId: string,
  input: FamilyEventInput,
): Promise<CalendarActionResult> {
  const family = await getMyFamily();
  if (!family) return { error: "Set up your family first." };
  const parsed = parseFamilyEventInput(input);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createSupabaseServerClient();
  const child = await rescopeChildId(supabase, family.id, input.childId ?? null);
  if (!child.ok) return { error: child.error };

  // .select("id") back so a silent zero-row match (RLS filtered it out,
  // or the row never existed) reports honestly instead of a false
  // "saved", the same honesty check the hours actions established.
  const { data, error } = await supabase
    .from("family_events")
    .update({
      child_id: child.childId,
      title: parsed.value.title,
      starts_on: parsed.value.startsOn,
      ends_on: parsed.value.endsOn,
      start_time: parsed.value.startTime,
      end_time: parsed.value.endTime,
      note: parsed.value.note,
    })
    .eq("id", eventId)
    .eq("family_id", family.id)
    .select("id");
  if (error) {
    console.error("family_events update failed:", error.message);
    return { error: "That didn't save. Nothing changed; try again in a minute." };
  }
  if (!data || data.length === 0) {
    return { error: "That event isn't on your calendar anymore. Refresh and try again." };
  }
  revalidatePath("/app/planner");
  revalidatePath("/app/calendar");
  return { error: null };
}

export async function deleteFamilyEventAction(eventId: string): Promise<CalendarActionResult> {
  const family = await getMyFamily();
  if (!family) return { error: "Set up your family first." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("family_events")
    .delete()
    .eq("id", eventId)
    .eq("family_id", family.id)
    .select("id");
  if (error) {
    console.error("family_events delete failed:", error.message);
    return { error: "That didn't delete. Nothing changed; try again in a minute." };
  }
  if (!data || data.length === 0) {
    return { error: "That event isn't on your calendar anymore. Refresh and try again." };
  }
  revalidatePath("/app/planner");
  revalidatePath("/app/calendar");
  return { error: null };
}
