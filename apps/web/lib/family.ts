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
   * is unfinished and /app routes back into /onboarding. */
  profile_completed_at: string | null;
  parent_avatar_url: string | null;
  /** IANA time zone (migration #27); null until captured from the
   * parent's device or set on the settings card. */
  time_zone: string | null;
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

/**
 * parentFirstName(family): string
 * The parent's first name for greetings and the sidebar footer: first
 * word of the display name, falling back to the family name.
 */
export function parentFirstName(family: FamilyRecord): string {
  return (family.parent_display_name ?? family.name).trim().split(/\s+/)[0] || family.name;
}

export async function getMyFamily(): Promise<FamilyRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("families")
    .select(
      "id, name, us_state, parent_display_name, profile_completed_at, parent_avatar_url, time_zone",
    )
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
