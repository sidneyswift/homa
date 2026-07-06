"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "../../lib/supabase/server";

/**
 * Family + child setup actions (minimal M2-03(i) form intake). Writes go
 * through RLS: family creation via the create_my_family RPC (migration #6),
 * children via the "members add children" INSERT policy from tenancy v0.
 */

export interface SetupFormState {
  error: string | null;
}

export async function createFamilyAction(
  _prev: SetupFormState,
  formData: FormData,
): Promise<SetupFormState> {
  const name = String(formData.get("family_name") ?? "").trim() || "My family";
  const usState = String(formData.get("us_state") ?? "").trim() || null;
  const parentName = String(formData.get("parent_name") ?? "").trim() || null;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_my_family", {
    family_name: name,
    family_us_state: usState,
    parent_name: parentName,
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/home");
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
  const interests = String(formData.get("interests") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const focus = String(formData.get("focus") ?? "").trim();

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
  const { error } = await supabase.from("children").insert({
    family_id: familyId,
    name,
    // Day is always 01 by design: age-band math needs month + year only.
    birth_month: `${birthYear}-${String(birthMonth).padStart(2, "0")}-01`,
    profile: { interests, focus },
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/home");
  return { error: null };
}
