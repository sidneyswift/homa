"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { getMyFamily } from "../../../lib/family";
import {
  MAX_FAMILY_EVENT_CHILDREN,
  normalizedFamilyEventInputChildIds,
  parseFamilyEventInput,
  parseFamilyEventTiming,
  type FamilyEventInput,
  type FamilyEventTimingInput,
  type ParsedFamilyEvent,
} from "../../../lib/family-events";
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

/** Resolves every client-supplied child id inside the caller's own family.
 * An empty list means a whole-family event. */
async function rescopeChildIds(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  familyId: string,
  input: Pick<FamilyEventInput, "childId" | "childIds">,
): Promise<{ ok: true; childIds: string[] } | { ok: false; error: string }> {
  const childIds = normalizedFamilyEventInputChildIds(input);
  if (childIds.length === 0) return { ok: true, childIds: [] };
  if (childIds.length > MAX_FAMILY_EVENT_CHILDREN) {
    return { ok: false, error: "Choose fewer children for this event." };
  }
  const { data, error } = await supabase
    .from("children")
    .select("id")
    .eq("family_id", familyId)
    .in("id", childIds);
  if (error) {
    console.error("family_events child rescope failed:", error.message);
    return { ok: false, error: "That didn't save. Nothing changed; try again in a minute." };
  }
  if ((data ?? []).length !== childIds.length) {
    return { ok: false, error: "Pick only kids in your family, or choose the whole family." };
  }
  return { ok: true, childIds };
}

async function saveFamilyEvent(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  input: {
    mode: "create" | "update";
    eventId: string;
    familyId: string;
    childIds: string[];
    value: ParsedFamilyEvent;
  },
): Promise<CalendarActionResult> {
  const { data, error } = await supabase.rpc("save_family_event_with_children", {
    p_mode: input.mode,
    p_event_id: input.eventId,
    p_family_id: input.familyId,
    p_title: input.value.title,
    p_starts_on: input.value.startsOn,
    p_ends_on: input.value.endsOn,
    p_start_time: input.value.startTime,
    p_end_time: input.value.endTime,
    p_note: input.value.note,
    p_recurrence_rule: input.value.recurrence,
    p_child_ids: input.childIds,
  });
  if (error || data !== input.eventId) {
    console.error(
      `family_events ${input.mode} failed:`,
      error?.message ?? "missing mutation receipt",
    );
    return { error: "That didn't save. Nothing changed; try again in a minute." };
  }
  return { error: null };
}

export async function createFamilyEventAction(
  input: FamilyEventInput,
): Promise<CalendarActionResult> {
  const family = await getMyFamily();
  if (!family) return { error: "Set up your family first." };
  const parsed = parseFamilyEventInput(input);
  if (!parsed.ok) return { error: parsed.error };

  const supabase = await createSupabaseServerClient();
  const children = await rescopeChildIds(supabase, family.id, input);
  if (!children.ok) return { error: children.error };

  const saved = await saveFamilyEvent(supabase, {
    mode: "create",
    eventId: randomUUID(),
    familyId: family.id,
    childIds: children.childIds,
    value: parsed.value,
  });
  if (saved.error) return saved;
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
  const children = await rescopeChildIds(supabase, family.id, input);
  if (!children.ok) return { error: children.error };

  const saved = await saveFamilyEvent(supabase, {
    mode: "update",
    eventId,
    familyId: family.id,
    childIds: children.childIds,
    value: parsed.value,
  });
  if (saved.error) return saved;
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

async function saveOccurrenceException(input: {
  eventId: string;
  familyId: string;
  occurrenceOn: string;
  kind: "cancelled" | "moved";
  timing: FamilyEventTimingInput | null;
}): Promise<CalendarActionResult> {
  const occurrence = parseFamilyEventTiming({ startsOn: input.occurrenceOn });
  if (!occurrence.ok) return { error: occurrence.error };
  const timing = input.timing ? parseFamilyEventTiming(input.timing) : null;
  if (timing && !timing.ok) return { error: timing.error };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("save_family_event_occurrence_exception", {
    p_event_id: input.eventId,
    p_family_id: input.familyId,
    p_occurrence_on: input.occurrenceOn,
    p_kind: input.kind,
    p_starts_on: timing?.ok ? timing.value.startsOn : null,
    p_ends_on: timing?.ok ? timing.value.endsOn : null,
    p_start_time: timing?.ok ? timing.value.startTime : null,
    p_end_time: timing?.ok ? timing.value.endTime : null,
  });
  if (error || data !== input.occurrenceOn) {
    console.error(
      `family event occurrence ${input.kind} failed:`,
      error?.message ?? "missing mutation receipt",
    );
    return {
      error: input.kind === "moved"
        ? "That event didn't move. Nothing changed; try again in a minute."
        : "That event wasn't deleted. Nothing changed; try again in a minute.",
    };
  }
  revalidatePath("/app/planner");
  revalidatePath("/app/calendar");
  return { error: null };
}

export async function moveFamilyEventOccurrenceAction(
  eventId: string,
  occurrenceOn: string,
  timing: FamilyEventTimingInput,
): Promise<CalendarActionResult> {
  const family = await getMyFamily();
  if (!family) return { error: "Set up your family first." };
  return saveOccurrenceException({
    eventId,
    familyId: family.id,
    occurrenceOn,
    kind: "moved",
    timing,
  });
}

export async function deleteFamilyEventOccurrenceAction(
  eventId: string,
  occurrenceOn: string,
): Promise<CalendarActionResult> {
  const family = await getMyFamily();
  if (!family) return { error: "Set up your family first." };
  return saveOccurrenceException({
    eventId,
    familyId: family.id,
    occurrenceOn,
    kind: "cancelled",
    timing: null,
  });
}
