"use server";

import { revalidatePath } from "next/cache";

import { isValidBirthDate, normalizeUsPhoneE164 } from "@homa/core";

import { cancelFamilyInvite, sendFamilyInvite } from "../../../lib/family-invites";
import { addFamilyPhone, removeFamilyPhone } from "../../../lib/family-phone";
import { isValidTimeZone, setFamilyTimeZone } from "../../../lib/family-time-zone";
import { getMyFamily, getMyMemberDisplayName, parentFirstName } from "../../../lib/family";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

/**
 * /app/settings server actions, moved here with their cards from the
 * dashboard (founder ask 2026-07-09: settings left it). Children write
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
  /** Set when the number belongs to another family: the card offers
   * the verified claim (text a code) instead of a dead end. */
  phoneTaken?: string;
}

export async function addFamilyPhoneAction(
  _prev: SetupFormState,
  formData: FormData,
): Promise<SetupFormState> {
  const raw = String(formData.get("phone") ?? "").trim();

  const family = await getMyFamily();
  if (!family) return { error: "Set up your family first." };

  const phoneE164 = normalizeUsPhoneE164(raw);
  if (!phoneE164) {
    return { error: "That doesn't look like a US cell number yet. Ten digits does it." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await addFamilyPhone({
    familyId: family.id,
    phoneE164,
    addedBy: user?.id ?? null,
    // "home" is the family_phones check constraint's historical name for
    // the in-app settings card (migration #22), kept to avoid a migration.
    source: "home",
  });
  if (!result.ok) {
    return {
      error:
        "That number is connected to a different Homa family right now. If it's your number, verify it below and it moves here.",
      phoneTaken: phoneE164,
    };
  }
  revalidatePath("/app/settings");
  return { error: null };
}

export async function removeFamilyPhoneAction(
  _prev: SetupFormState,
  formData: FormData,
): Promise<SetupFormState> {
  const raw = String(formData.get("phone") ?? "").trim();
  const phoneE164 = normalizeUsPhoneE164(raw);

  const family = await getMyFamily();
  if (!family) return { error: "Set up your family first." };
  if (!phoneE164) return { error: "That number didn't parse; nothing was removed." };

  // familyId from the caller's own membership: removing can only ever
  // touch the caller's own family's rows (tenancy law).
  await removeFamilyPhone(family.id, phoneE164);
  revalidatePath("/app/settings");
  return { error: null };
}

/** Simple shape check; the invite email itself is the real verification
 * (possession of the inbox is what joining requires). */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function inviteCoParentAction(
  _prev: SetupFormState,
  formData: FormData,
): Promise<SetupFormState> {
  const raw = String(formData.get("email") ?? "").trim().toLowerCase();

  const family = await getMyFamily();
  if (!family) {
    return { error: "The invite didn't send. Finish setting up your family first." };
  }
  if (!looksLikeEmail(raw)) {
    return { error: "That doesn't look like an email address." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const inviterName = (await getMyMemberDisplayName()) ?? parentFirstName(family);

  const result = await sendFamilyInvite({
    familyId: family.id,
    email: raw,
    invitedBy: user?.id ?? null,
    inviterName,
    familyName: family.name,
  });
  if (!result.ok) {
    switch (result.reason) {
      case "already-member":
        return { error: "They're already part of this family." };
      case "send-limit":
        return {
          error:
            "This one didn't send: that's three invites to this address today. Ask them to check spam. You can send another tomorrow.",
        };
      case "email-failed":
        return { error: "The invite didn't send. Try again in a minute." };
      default: {
        const exhaustive: never = result.reason;
        return { error: String(exhaustive) };
      }
    }
  }
  revalidatePath("/app/settings");
  return { error: null };
}

export async function cancelInviteAction(
  _prev: SetupFormState,
  formData: FormData,
): Promise<SetupFormState> {
  const inviteId = String(formData.get("invite_id") ?? "").trim();

  const family = await getMyFamily();
  if (!family) {
    return { error: "That didn't cancel. Finish setting up your family first." };
  }
  if (!inviteId) {
    return { error: "That cancel didn't go through. Refresh the page and try again." };
  }

  // familyId from the caller's own membership scopes the delete; a
  // forged invite_id can never touch another family's invites.
  await cancelFamilyInvite(family.id, inviteId);
  revalidatePath("/app/settings");
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
  // The zone drives the dashboard greeting and the planner's week dates
  // too; one layout-wide revalidate refreshes every /app page.
  revalidatePath("/app", "layout");
  return { error: null };
}

export async function addChildAction(
  _prev: SetupFormState,
  formData: FormData,
): Promise<SetupFormState> {
  const name = String(formData.get("child_name") ?? "").trim();
  const birthYear = Number(formData.get("birth_year"));
  const birthMonth = Number(formData.get("birth_month"));
  const birthDay = Number(formData.get("birth_day"));

  const family = await getMyFamily();
  if (!family) return { error: "Set up your family first." };
  if (!name) return { error: "A name is required." };
  // The full birthday (founder ruling 2026-07-11). isValidBirthDate
  // checks it is a real calendar date (no Feb 30) in an 18-year window.
  const birthDate = [
    String(birthYear),
    String(birthMonth).padStart(2, "0"),
    String(birthDay).padStart(2, "0"),
  ].join("-");
  if (
    !Number.isInteger(birthYear) ||
    !Number.isInteger(birthMonth) ||
    !Number.isInteger(birthDay) ||
    !isValidBirthDate(birthDate)
  ) {
    return { error: "Pick a valid birthday: month, day, and year." };
  }

  const supabase = await createSupabaseServerClient();
  // Interests and focus fill in later, through the questionnaire's extras
  // beat (or the chat agent's update_child_profile tool), never this form.
  const { error } = await supabase.from("children").insert({
    family_id: family.id,
    name,
    birth_month: birthDate,
    profile: {},
  });
  if (error) {
    return { error: error.message };
  }
  // A new kid shows up on the dashboard's cards, the planner's columns,
  // and the sidebar's kid list on every page of the group; one
  // layout-wide revalidate covers them all.
  revalidatePath("/app", "layout");
  return { error: null };
}
