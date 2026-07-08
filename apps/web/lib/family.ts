import { createSupabaseServerClient } from "./supabase/server";

/**
 * Server-side family/child reads for signed-in pages. All queries run under
 * the caller's RLS context (publishable key + session JWT), so every row is
 * family-scoped by the database itself, not by trust in this code.
 */

export interface FamilyRecord {
  id: string;
  name: string;
  us_state: string | null;
  parent_display_name: string | null;
  /** Stamped by the onboarding create-your-family step; null means setup
   * is unfinished and /home routes back into /onboarding. */
  profile_completed_at: string | null;
  parent_avatar_url: string | null;
}

export interface ChildRecord {
  id: string;
  family_id: string;
  name: string;
  birth_month: string;
  profile: ChildProfile;
}

export interface ChildProfile {
  interests?: string[];
  focus?: string;
  notes?: string;
}

export async function getMyFamily(): Promise<FamilyRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("families")
    .select("id, name, us_state, parent_display_name, profile_completed_at, parent_avatar_url")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`families read failed: ${error.message}`);
  return data;
}

export async function getMyChildren(familyId: string): Promise<ChildRecord[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("children")
    .select("id, family_id, name, birth_month, profile")
    .eq("family_id", familyId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`children read failed: ${error.message}`);
  return (data ?? []) as ChildRecord[];
}

/** Which of these children already have a built report (RLS-scoped, so
 * only the caller's own kids ever match). For /home's "has the family
 * seen results yet" gate. */
export async function getChildIdsWithReports(childIds: string[]): Promise<Set<string>> {
  if (childIds.length === 0) return new Set();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("child_reports")
    .select("child_id")
    .in("child_id", childIds);
  if (error) throw new Error(`child_reports read failed: ${error.message}`);
  return new Set((data ?? []).map((row) => row.child_id as string));
}
