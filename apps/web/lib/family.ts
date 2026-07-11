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

/**
 * getMyMemberDisplayName(): string | null
 * The signed-in adult's own display name (family_members.display_name,
 * multi-parent v0): "Sidney" on Sidney's login and "Alessa" on Alessa's,
 * where the family-level parent_display_name can only hold one of them.
 * Null when unset; callers fall back to parentFirstName(family).
 * The user_id filter matters: since migration #49 members can read the
 * whole roster, and this must be the CALLER's row, not the first row.
 */
export async function getMyMemberDisplayName(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("children")
    .select("id, family_id, name, birth_month, profile")
    .eq("family_id", familyId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`children read failed: ${error.message}`);
  return (data ?? []) as ChildRecord[];
}
