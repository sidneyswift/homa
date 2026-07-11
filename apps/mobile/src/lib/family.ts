import { isValidBirthDate } from "@homa/core";

import { supabase } from "./supabase";

/**
 * Family and child reads/writes for the signed-in app, ported from
 * apps/web/lib/family.ts and app/app/actions.ts (keep the shapes and
 * rules in sync with those files until a shared package exists). Every
 * query runs under the caller's RLS context, so rows are family-scoped
 * by the database itself, not by trust in this code.
 */

export interface FamilyRecord {
  id: string;
  name: string;
  us_state: string | null;
  parent_display_name: string | null;
  profile_completed_at: string | null;
}

export interface ChildProfile {
  interests?: string[];
  focus?: string;
  notes?: string;
}

export interface ChildRecord {
  id: string;
  family_id: string;
  name: string;
  birth_month: string;
  profile: ChildProfile;
}

export async function getMyFamily(): Promise<FamilyRecord | null> {
  const { data, error } = await supabase
    .from("families")
    .select("id, name, us_state, parent_display_name, profile_completed_at")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`families read failed: ${error.message}`);
  return data;
}

/** The signed-in adult's own display name, not the family-level fallback. */
export async function getMyMemberDisplayName(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("family_members")
    .select("display_name")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`membership read failed: ${error.message}`);
  return data?.display_name ?? null;
}

export async function getMyChildren(familyId: string): Promise<ChildRecord[]> {
  const { data, error } = await supabase
    .from("children")
    .select("id, family_id, name, birth_month, profile")
    .eq("family_id", familyId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`children read failed: ${error.message}`);
  return (data ?? []) as ChildRecord[];
}

export interface AddChildInput {
  familyId: string;
  name: string;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  interests: string[];
  focus: string;
}

export async function addChild(
  input: AddChildInput,
): Promise<{ error: string | null }> {
  if (!input.name.trim()) return { error: "A name is required." };
  const birthDate = [
    String(input.birthYear),
    String(input.birthMonth).padStart(2, "0"),
    String(input.birthDay).padStart(2, "0"),
  ].join("-");
  if (
    !Number.isInteger(input.birthYear) ||
    !Number.isInteger(input.birthMonth) ||
    !Number.isInteger(input.birthDay) ||
    !isValidBirthDate(birthDate)
  ) {
    return { error: "Pick a valid birthday: month, day, and year." };
  }

  const { error } = await supabase.from("children").insert({
    family_id: input.familyId,
    name: input.name.trim(),
    // Historical column name; the stored value is the child's full birthday.
    birth_month: birthDate,
    profile: { interests: input.interests, focus: input.focus },
  });
  return { error: error ? error.message : null };
}
