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
    .select("id, name, us_state, parent_display_name")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`families read failed: ${error.message}`);
  return data;
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

export interface CreateFamilyInput {
  name: string;
  usState: string | null;
  parentName: string | null;
}

/** Family creation goes through the create_my_family RPC (migration #6). */
export async function createMyFamily(
  input: CreateFamilyInput,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("create_my_family", {
    family_name: input.name.trim() || "My family",
    family_us_state: input.usState,
    parent_name: input.parentName,
  });
  return { error: error ? error.message : null };
}

export interface AddChildInput {
  familyId: string;
  name: string;
  birthYear: number;
  birthMonth: number;
  interests: string[];
  focus: string;
}

export async function addChild(
  input: AddChildInput,
): Promise<{ error: string | null }> {
  if (!input.name.trim()) return { error: "A name is required." };
  const currentYear = new Date().getFullYear();
  if (
    !Number.isInteger(input.birthYear) ||
    !Number.isInteger(input.birthMonth) ||
    input.birthMonth < 1 ||
    input.birthMonth > 12 ||
    input.birthYear < currentYear - 19 ||
    input.birthYear > currentYear
  ) {
    return { error: "Pick a valid birth month and year." };
  }

  const { error } = await supabase.from("children").insert({
    family_id: input.familyId,
    name: input.name.trim(),
    // Day is always 01 by design: age-band math needs month + year only.
    birth_month: `${input.birthYear}-${String(input.birthMonth).padStart(2, "0")}-01`,
    profile: { interests: input.interests, focus: input.focus },
  });
  return { error: error ? error.message : null };
}
