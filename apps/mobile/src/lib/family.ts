import { isValidBirthDate } from "@homa/core";
import { AuthSessionMissingError } from "@supabase/supabase-js";

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
  time_zone: string | null;
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
    .select("id, name, us_state, parent_display_name, profile_completed_at, time_zone")
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

/**
 * App Review 5.1.2(i): explicit, affirmative consent that conversation
 * content and family info are processed by third-party AI providers, kept
 * as a durable record (ai_processing_consented_at), not a local flag. True
 * only once the signed-in adult has consented; a signed-in adult with no
 * family_members row yet (mid web onboarding) reads as not yet consented,
 * which is correct: nothing has been sent to Homa for them either.
 */
export async function getMyConsentStatus(): Promise<boolean> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new AuthSessionMissingError();
  const { data, error } = await supabase
    .from("family_members")
    .select("ai_processing_consented_at")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`consent read failed: ${error.message}`);
  return Boolean(data?.ai_processing_consented_at);
}

/**
 * Calls record_ai_processing_consent(), the SECURITY DEFINER function in
 * supabase/migrations/20260728190000_ai_processing_consent.sql. Idempotent
 * server-side; safe to call more than once.
 */
export async function recordAiProcessingConsent(): Promise<void> {
  const { error } = await supabase.rpc("record_ai_processing_consent");
  if (error) throw new Error(`consent write failed: ${error.message}`);
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
