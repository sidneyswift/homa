"use server";

import { revalidatePath } from "next/cache";

import { normalizeUsPhoneE164 } from "@homa/core";

import { clearFamilyPhone, setFamilyPhone } from "../../lib/family-phone";
import {
  fillFamilyTimeZoneIfEmpty,
  isValidTimeZone,
  setFamilyTimeZone,
} from "../../lib/family-time-zone";
import { getMyFamily } from "../../lib/family";
import { createSupabaseServerClient } from "../../lib/supabase/server";

/**
 * Child setup + texting-line actions (minimal M2-03(i) form intake).
 * Children write through RLS via the "members add children" INSERT policy
 * from tenancy v0. Family creation left this file for /onboarding's
 * FamilyStep (founder call 2026-07-08: one onboarding for every door);
 * the create_my_family RPC stays in the database for the mobile app.
 * The texting-line actions are the exception by design: family_phones is
 * deny-all, so they write through lib/family-phone on the server-only
 * connection, with familyId derived from the caller's OWN membership
 * (getMyFamily under RLS), never from the form. The time-zone actions
 * follow the same posture through lib/family-time-zone.
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
    revalidatePath("/home");
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
    source: "home",
  });
  if (!result.ok) {
    return { error: "That number is already linked to another Homa family." };
  }
  revalidatePath("/home");
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
  revalidatePath("/home");
  return { error: null };
}

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
  revalidatePath("/home");
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
  revalidatePath("/home");
  return { error: null };
}
