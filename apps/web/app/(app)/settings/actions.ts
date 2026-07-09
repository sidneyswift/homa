"use server";

import { revalidatePath } from "next/cache";

import { normalizeUsPhoneE164 } from "@homa/core";

import { clearFamilyPhone, setFamilyPhone } from "../../../lib/family-phone";
import { isValidTimeZone, setFamilyTimeZone } from "../../../lib/family-time-zone";
import { getMyFamily } from "../../../lib/family";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

/**
 * /settings server actions, moved here with their cards from /home
 * (founder ask 2026-07-09: settings left the dashboard). Children write
 * through RLS via the "members add children" INSERT policy from tenancy
 * v0. The texting-line actions are the exception by design: family_phones
 * is deny-all, so they write through lib/family-phone on the server-only
 * connection, with familyId derived from the caller's OWN membership
 * (getMyFamily under RLS), never from the form. The time-zone action
 * follows the same posture through lib/family-time-zone. Family creation
 * lives in /onboarding's FamilyStep (founder call 2026-07-08: one
 * onboarding for every door).
 */

export interface SetupFormState {
  error: string | null;
}

export async function setFamilyPhoneAction(
  _prev: SetupFormState,
  formData: FormData,
): Promise<SetupFormState> {
  const raw = String(formData.get("phone") ?? "").trim();

  const family = await getMyFamily();
  if (!family) return { error: "Set up your family first." };

  if (!raw) {
    await clearFamilyPhone(family.id);
    revalidatePath("/settings");
    return { error: null };
  }

  const phoneE164 = normalizeUsPhoneE164(raw);
  if (!phoneE164) {
    return { error: "That doesn't look like a US cell number yet. Ten digits does it." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await setFamilyPhone({
    familyId: family.id,
    phoneE164,
    addedBy: user?.id ?? null,
    // "home" is the family_phones check constraint's historical name for
    // the in-app settings card (migration #22), kept to avoid a migration.
    source: "home",
  });
  if (!result.ok) {
    return { error: "That number is already linked to another Homa family." };
  }
  revalidatePath("/settings");
  return { error: null };
}

export async function setFamilyTimeZoneAction(
  _prev: SetupFormState,
  formData: FormData,
): Promise<SetupFormState> {
  const timeZone = String(formData.get("time_zone") ?? "").trim();
  if (!isValidTimeZone(timeZone)) {
    return { error: "That time zone didn't take. Pick one from the list." };
  }
  const family = await getMyFamily();
  if (!family) return { error: "Set up your family first." };
  await setFamilyTimeZone(family.id, timeZone);
  // The zone drives /home's greeting and /planner's week dates too.
  revalidatePath("/settings");
  revalidatePath("/home");
  revalidatePath("/planner");
  return { error: null };
}

export async function addChildAction(
  _prev: SetupFormState,
  formData: FormData,
): Promise<SetupFormState> {
  const familyId = String(formData.get("family_id") ?? "");
  const name = String(formData.get("child_name") ?? "").trim();
  const birthYear = Number(formData.get("birth_year"));
  const birthMonth = Number(formData.get("birth_month"));

  if (!name || !familyId) return { error: "A name is required." };
  const currentYear = new Date().getFullYear();
  if (
    !Number.isInteger(birthYear) ||
    !Number.isInteger(birthMonth) ||
    birthMonth < 1 ||
    birthMonth > 12 ||
    birthYear < currentYear - 19 ||
    birthYear > currentYear
  ) {
    return { error: "Pick a valid birth month and year." };
  }

  const supabase = await createSupabaseServerClient();
  // Interests and focus fill in later, through the questionnaire's extras
  // beat (or the chat agent's update_child_profile tool), never this form.
  const { error } = await supabase.from("children").insert({
    family_id: familyId,
    name,
    // Day is always 01 by design: age-band math needs month + year only.
    birth_month: `${birthYear}-${String(birthMonth).padStart(2, "0")}-01`,
    profile: {},
  });
  if (error) {
    return { error: error.message };
  }
  // A new kid shows up on the dashboard's cards, the planner's columns,
  // and the sidebar's kid list on every page of the group.
  revalidatePath("/settings");
  revalidatePath("/home");
  revalidatePath("/planner");
  return { error: null };
}
