"use server";

import { revalidatePath } from "next/cache";

import {
  HOMESCHOOL_STYLES,
  isValidBirthDate,
  MAP_INTERESTS_CAP,
  normalizeUsPhoneE164,
  US_STATES,
} from "@homa/core";

import {
  setFamilyAddress,
  setFamilyName,
  setMemberAvatarUrl,
  setMemberDisplayName,
} from "../../../lib/family-profile";
import { addFamilyPhone, getFamilyPhones, removeFamilyPhone } from "../../../lib/family-phone";
import { setFamilyTimeZone, timeZoneFromState } from "../../../lib/family-time-zone";
import { getMyFamily } from "../../../lib/family";
import { saveFamilyContext } from "../../../lib/map/store";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import type { SetupFormState } from "./actions";

/**
 * The settings redesign's edit actions (2026-07-12): a child's name and
 * birthday, the signed-in adult's own name and photo, and the family's
 * name, address, and time zone. Children write through RLS (the tenancy
 * v0 "members update their children" policy) with an explicit family_id
 * belt on top. families and family_members are deny-all for writes, so
 * those go through lib/family-profile on the server-only connection,
 * with familyId always derived from the caller's OWN membership
 * (getMyFamily under RLS), never from the form (BUILD.md law #1).
 */

/** Full birthday from the three selects, validated as a real calendar
 * date in the 18-year window (same rule as addChildAction). */
function parseBirthDate(formData: FormData): string | null {
  const year = Number(formData.get("birth_year"));
  const month = Number(formData.get("birth_month"));
  const day = Number(formData.get("birth_day"));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  const birthDate = [
    String(year),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
  return isValidBirthDate(birthDate) ? birthDate : null;
}

export async function updateChildAction(
  _prev: SetupFormState,
  formData: FormData,
): Promise<SetupFormState> {
  const childId = String(formData.get("child_id") ?? "").trim();
  const name = String(formData.get("child_name") ?? "").trim();
  const interests = formData
    .getAll("interests")
    .map((value) => String(value).trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, MAP_INTERESTS_CAP);
  const focus = String(formData.get("focus") ?? "").trim().slice(0, 200);
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 1000);

  const family = await getMyFamily();
  if (!family) return { error: "Set up your family first." };
  if (!childId) return { error: "That didn't save. Refresh the page and try again." };
  if (!name) return { error: "Add their name and try again." };
  const birthDate = parseBirthDate(formData);
  if (!birthDate) return { error: "Pick a valid birthday: month, day, and year." };

  const supabase = await createSupabaseServerClient();
  // RLS enforces membership; the family_id filter is the belt on top, so
  // a forged child_id can never touch another family's row.
  const { data: current, error: readError } = await supabase
    .from("children")
    .select("profile")
    .eq("id", childId)
    .eq("family_id", family.id)
    .maybeSingle();
  if (readError || !current) {
    return { error: "That didn't save. Refresh the page and try again." };
  }

  // Full replace of the profile keys this form owns; other keys (from
  // chat's update_child_profile tool or the questionnaire) ride along.
  const profile = {
    ...(current.profile as Record<string, unknown>),
    interests,
    focus: focus || undefined,
    notes: notes || undefined,
  };

  const { error } = await supabase
    .from("children")
    .update({ name, birth_month: birthDate, profile, updated_at: new Date().toISOString() })
    .eq("id", childId)
    .eq("family_id", family.id);
  if (error) {
    console.error("update child failed:", error.message);
    return { error: "That didn't save. Your changes are still here, try once more." };
  }
  // The name shows on the drawer's kid rows, the planner's columns, and
  // the kid's own page; one layout-wide revalidate covers them all.
  revalidatePath("/app", "layout");
  return { error: null, saved: true };
}

/**
 * Links the caller's own cell, retiring their previous number(s) so each
 * adult carries one. Empty input unlinks. "unchanged" and "cleared" are
 * quiet successes; "taken" hands back the number for the verified claim.
 */
async function syncMyPhone(
  familyId: string,
  userId: string,
  raw: string,
): Promise<{ ok: true } | { ok: false; taken: string } | { ok: false; invalid: true }> {
  const phones = await getFamilyPhones(familyId);
  const mine = phones.filter((phone) => phone.member_user_id === userId);

  if (!raw) {
    for (const phone of mine) {
      await removeFamilyPhone(familyId, phone.phone_e164);
    }
    return { ok: true };
  }

  const phoneE164 = normalizeUsPhoneE164(raw);
  if (!phoneE164) return { ok: false, invalid: true };
  if (mine.length === 1 && mine[0].phone_e164 === phoneE164) return { ok: true };

  const result = await addFamilyPhone({
    familyId,
    phoneE164,
    addedBy: userId,
    source: "home",
  });
  if (!result.ok) return { ok: false, taken: phoneE164 };

  for (const phone of mine) {
    if (phone.phone_e164 !== phoneE164) {
      await removeFamilyPhone(familyId, phone.phone_e164);
    }
  }
  return { ok: true };
}

export async function updateMyProfileAction(
  _prev: SetupFormState,
  formData: FormData,
): Promise<SetupFormState> {
  const displayName = String(formData.get("display_name") ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const rawAvatarUrl = String(formData.get("avatar_url") ?? "").trim();
  const rawPhone = String(formData.get("phone") ?? "").trim();

  const family = await getMyFamily();
  if (!family) return { error: "Set up your family first." };
  if (!displayName) return { error: "Add your name so Homa knows what to call you." };
  if (displayName.length > 60) return { error: "That name is too long. Try a shorter one." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You're signed out. Sign in and try again." };

  await setMemberDisplayName(family.id, user.id, displayName);

  // The photo must live in OUR avatars bucket, under the caller's OWN
  // folder; anything else is dropped rather than stored (same posture as
  // /api/map/family, one folder stricter).
  if (rawAvatarUrl) {
    const ownPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${user.id}/`;
    if (rawAvatarUrl.startsWith(ownPrefix)) {
      await setMemberAvatarUrl(family.id, user.id, rawAvatarUrl);
    }
  }

  // The number rides the same editor (a number is a fact about a person,
  // founder direction 2026-07-12). Name and photo are already saved when
  // a phone problem comes back, so the error speaks only about the phone.
  const phoneResult = await syncMyPhone(family.id, user.id, rawPhone);
  if (!phoneResult.ok) {
    revalidatePath("/app", "layout");
    if ("invalid" in phoneResult) {
      return {
        error:
          "Your name and photo saved. That doesn't look like a US cell number, it needs all ten digits.",
      };
    }
    return {
      error:
        "Your name and photo saved. That number is linked to a different Homa family right now; if it's yours, verify it below and it moves here.",
      phoneTaken: phoneResult.taken,
    };
  }

  // The name and photo sit in the sidebar's account row on every page.
  revalidatePath("/app", "layout");
  return { error: null, saved: true };
}

export async function updateFamilyDetailsAction(
  _prev: SetupFormState,
  formData: FormData,
): Promise<SetupFormState> {
  const familyName = String(formData.get("family_name") ?? "").trim();
  const addressLine = String(formData.get("address_line") ?? "").trim();
  const city = String(formData.get("address_city") ?? "").trim();
  const usState = String(formData.get("us_state") ?? "").trim();
  const zip = String(formData.get("address_zip") ?? "").trim();

  const family = await getMyFamily();
  if (!family) return { error: "Set up your family first." };
  if (!familyName) return { error: "Add a family name and try again." };
  if (familyName.length > 80) return { error: "That family name is too long. Try a shorter one." };
  if (!addressLine || !city || !usState || !zip) {
    return { error: "Add the full address: street, city, state, and ZIP." };
  }
  if (!US_STATES.some((state) => state.code === usState)) {
    return { error: "That state didn't save. Pick one from the list." };
  }

  await setFamilyName(family.id, familyName);
  await setFamilyAddress(family.id, { addressLine, city, usState, zip });

  // The address names the clock (founder direction 2026-07-12): fill the
  // zone when it's empty, and follow a move into a single-zone state.
  // Split states keep whatever the device capture set.
  const derivedZone = timeZoneFromState(usState);
  if (derivedZone && (!family.time_zone || usState !== family.us_state)) {
    await setFamilyTimeZone(family.id, derivedZone);
  }

  // The family name sits in the sidebar footer and this page's header.
  revalidatePath("/app", "layout");
  return { error: null, saved: true };
}

export async function updateHomeschoolAction(
  _prev: SetupFormState,
  formData: FormData,
): Promise<SetupFormState> {
  const styleValues = new Set<string>(HOMESCHOOL_STYLES);
  const styles = formData
    .getAll("styles")
    .map((value) => String(value))
    .filter((value) => styleValues.has(value));
  const strictnessRaw = String(formData.get("strictness") ?? "").trim();
  const strictness = ["closely", "loosely", "exploring"].includes(strictnessRaw)
    ? strictnessRaw
    : "";
  const curriculums = formData
    .getAll("curriculums")
    .map((value) => String(value).trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 12);
  const values = String(formData.get("values") ?? "").trim().slice(0, 500);

  const family = await getMyFamily();
  if (!family) return { error: "Set up your family first." };

  // Empty selections clear their keys on purpose: this editor owns them.
  // saveFamilyContext merges into the same context bag onboarding's
  // homeschool step writes, so plans and materials read one source.
  await saveFamilyContext(family.id, { styles, strictness, curriculums, values });
  revalidatePath("/app/settings");
  return { error: null, saved: true };
}

