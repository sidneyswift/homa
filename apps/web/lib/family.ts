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
  /** Onboarding's address (migration #29), editable on /app/settings. */
  address_line: string | null;
  address_city: string | null;
  address_zip: string | null;
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
      "id, name, us_state, parent_display_name, profile_completed_at, parent_avatar_url, time_zone, address_line, address_city, address_zip",
    )
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`families read failed: ${error.message}`);
  return data;
}

export interface FamilyMemberRecord {
  user_id: string;
  role: string;
  display_name: string | null;
  /** This adult's own photo (migration #74); null falls back to an
   * initial. */
  avatar_url: string | null;
}

/**
 * getMyFamilyMembers(familyId): FamilyMemberRecord[]
 * The family's adults, oldest membership first, under the caller's RLS
 * (the migration #49 roster policy). Feeds the settings adults card.
 */
export async function getMyFamilyMembers(familyId: string): Promise<FamilyMemberRecord[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("family_members")
    .select("user_id, role, display_name, avatar_url")
    .eq("family_id", familyId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`family members read failed: ${error.message}`);
  return (data ?? []) as FamilyMemberRecord[];
}

export interface MyMemberProfile {
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * getMyMemberProfile(): MyMemberProfile | null
 * The signed-in adult's OWN membership row (multi-parent v0): their
 * display name ("Sidney" on Sidney's login, "Alessa" on Alessa's, where
 * the family-level parent_display_name can only hold one of them) and
 * their own photo (migration #74). Null when signed out or memberless.
 * The user_id filter matters: since migration #49 members can read the
 * whole roster, and this must be the CALLER's row, not the first row.
 */
export async function getMyMemberProfile(): Promise<MyMemberProfile | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("family_members")
    .select("display_name, avatar_url")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`membership read failed: ${error.message}`);
  return data ?? null;
}

/** The signed-in adult's own display name; see getMyMemberProfile. */
export async function getMyMemberDisplayName(): Promise<string | null> {
  const profile = await getMyMemberProfile();
  return profile?.display_name ?? null;
}

export interface FamilyHomeschool {
  /** Homeschool style values (HOMESCHOOL_STYLES); first is primary. */
  styles: string[];
  strictness: string | null;
  curriculums: string[];
  values: string | null;
}

/**
 * getMyFamilyHomeschool(familyId): the "About your homeschool" answers
 * from onboarding (families.context: styles, strictness, curriculums,
 * values), read under the caller's RLS for the settings editor. Context
 * bags written before 2026-07-06 hold a single `style` string; it reads
 * as a one-item list.
 */
export async function getMyFamilyHomeschool(familyId: string): Promise<FamilyHomeschool> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("families")
    .select("context")
    .eq("id", familyId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`family context read failed: ${error.message}`);
  const context = (data?.context ?? {}) as Record<string, unknown>;
  const listOf = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const styles = listOf(context.styles);
  return {
    styles: styles.length > 0 ? styles : typeof context.style === "string" ? [context.style] : [],
    strictness: typeof context.strictness === "string" ? context.strictness : null,
    curriculums: listOf(context.curriculums),
    values: typeof context.values === "string" && context.values.trim() ? context.values : null,
  };
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
