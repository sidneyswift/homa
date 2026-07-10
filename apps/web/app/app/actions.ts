"use server";

import { revalidatePath } from "next/cache";

import { fillFamilyTimeZoneIfEmpty, isValidTimeZone } from "../../lib/family-time-zone";
import { getMyFamily } from "../../lib/family";
import { emitMapEvent } from "../../lib/map/events";
import { createSupabaseServerClient } from "../../lib/supabase/server";

/**
 * The dashboard's (/app/home) server actions: the device time-zone
 * capture and the memories card's one-tap undo. The settings-card
 * actions (add a child, the texting line, the time-zone picker) moved
 * with their cards to app/app/settings/actions.ts (founder ask
 * 2026-07-09: settings left the dashboard). Both actions here scope by
 * the caller's OWN membership (getMyFamily / RLS), never by client input.
 */

/**
 * The device-capture path: called once by TimeZoneSync when the family
 * row has no zone yet. Fills only while unset, so it can never clobber a
 * choice made on the settings card.
 */
export async function autoFillTimeZoneAction(timeZone: string): Promise<void> {
  if (typeof timeZone !== "string" || !isValidTimeZone(timeZone)) return;
  const family = await getMyFamily();
  if (!family || family.time_zone) return;
  await fillFamilyTimeZoneIfEmpty(family.id, timeZone);
  // The zone shows on the dashboard greeting, the planner's dates, and
  // the settings card; one layout-wide revalidate refreshes every /app
  // page (they share the frame's segment).
  revalidatePath("/app", "layout");
}

/**
 * The memories card's one-tap undo (FR-9 posture): deletes one saved
 * memory under the caller's OWN RLS (the members-delete policy is the
 * wall; a memory id from another family deletes nothing). The event
 * emits server-side after the delete proves ownership.
 */
export async function forgetMemoryAction(memoryId: string): Promise<void> {
  if (typeof memoryId !== "string" || memoryId.length === 0) return;
  const supabase = await createSupabaseServerClient();
  const { data: deleted } = await supabase
    .from("family_memories")
    .delete()
    .eq("id", memoryId)
    .select("family_id, source")
    .maybeSingle();
  if (deleted) {
    await emitMapEvent("memory.forgotten", {
      family_id: deleted.family_id,
      source: deleted.source as "homa" | "parent" | "onboarding" | "call" | "review",
    });
    revalidatePath("/app/home");
  }
}
