import { isValidBirthDate } from "@homa/core";
import { AuthSessionMissingError } from "@supabase/supabase-js";

import { createIdempotencyKey } from "./idempotency-key";
import {
  MutationReceiptError,
  requireMutationReceipt,
  requireReceiptValue,
} from "./mutation-receipt";
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
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`families read failed: ${error.message}`);
  return data;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const FAMILY_MUTATION_TIMEOUT_MS = 10_000;

type MutationResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

function deviceTimeZone(): string | null {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timeZone || null;
  } catch {
    return null;
  }
}

export interface CreateFamilyInput {
  familyName: string;
  parentName: string;
  usState?: string | null;
}

/** Creates the caller's first family and returns the exact database receipt. */
export async function createMyFamily(input: CreateFamilyInput): Promise<string> {
  const familyName = input.familyName.trim();
  const parentName = input.parentName.trim();
  if (!familyName || !parentName) {
    throw new MutationReceiptError(
      "create_my_family",
      "contradictory_receipt",
      "family and parent names are required",
    );
  }
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    FAMILY_MUTATION_TIMEOUT_MS,
  );
  let result: MutationResult<{ family_id?: unknown }>;
  try {
    result = await supabase.rpc("create_my_family", {
      family_name: familyName,
      family_us_state: input.usState ?? null,
      parent_name: parentName,
    }).abortSignal(controller.signal).single() as MutationResult<{
      family_id?: unknown;
    }>;
  } finally {
    clearTimeout(timeout);
  }
  const rawReceipt = requireMutationReceipt<{ family_id?: unknown }>(
    "create_my_family",
    result,
  );
  const familyId = rawReceipt.family_id;
  requireReceiptValue(
    "create_my_family",
    typeof familyId === "string" && UUID_RE.test(familyId),
  );
  return familyId as string;
}

/** Completes setup for an existing family after a learner receipt is present. */
export async function completeMyFamilySetup(): Promise<{
  familyId: string;
  profileCompletedAt: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    FAMILY_MUTATION_TIMEOUT_MS,
  );
  try {
    const result = await supabase.rpc("complete_my_family_setup", {
      p_time_zone: deviceTimeZone(),
    }).abortSignal(controller.signal).single() as MutationResult<{
      family_id?: unknown;
      profile_completed_at?: unknown;
    }>;
    const receipt = requireMutationReceipt(
      "complete_my_family_setup",
      result,
    );
    requireReceiptValue(
      "complete_my_family_setup",
      typeof receipt.family_id === "string"
        && UUID_RE.test(receipt.family_id)
        && typeof receipt.profile_completed_at === "string",
    );
    return {
      familyId: receipt.family_id as string,
      profileCompletedAt: receipt.profile_completed_at as string,
    };
  } catch (cause) {
    if (cause instanceof MutationReceiptError) throw cause;
    throw new MutationReceiptError(
      "complete_my_family_setup",
      "provider_error",
      cause instanceof Error ? cause.message : "request did not complete",
    );
  } finally {
    clearTimeout(timeout);
  }
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
  requestId?: string;
  name: string;
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  interests: string[];
  focus: string;
}

export async function addChild(
  input: AddChildInput,
): Promise<{
  error: string | null;
  childId?: string;
  familyId?: string;
  profileCompletedAt?: string | null;
}> {
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

  const childId = input.requestId ?? createIdempotencyKey();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    FAMILY_MUTATION_TIMEOUT_MS,
  );
  try {
    const result = await supabase.rpc("add_my_child_native_v1", {
      p_child_id: childId,
      p_family_id: input.familyId,
      p_name: input.name.trim(),
      p_birth_date: birthDate,
      p_profile: { interests: input.interests, focus: input.focus },
      p_time_zone: deviceTimeZone(),
    }).abortSignal(controller.signal).single() as MutationResult<{
      child_id?: unknown;
      family_id?: unknown;
      child_name?: unknown;
      birth_date?: unknown;
      profile_completed_at?: unknown;
    }>;
    const receipt = requireMutationReceipt(
      "add_my_child_native_v1",
      result,
    );
    requireReceiptValue(
      "add_my_child_native_v1",
      typeof receipt.child_id === "string"
        && UUID_RE.test(receipt.child_id)
        && receipt.child_id === childId
        && receipt.family_id === input.familyId
        && receipt.child_name === input.name.trim()
        && receipt.birth_date === birthDate
        && typeof receipt.profile_completed_at === "string",
    );
    return {
      error: null,
      childId,
      familyId: input.familyId,
      profileCompletedAt: receipt.profile_completed_at as string,
    };
  } catch (cause) {
    if (cause instanceof MutationReceiptError) throw cause;
    throw new MutationReceiptError(
      "add_my_child_native_v1",
      "provider_error",
      cause instanceof Error ? cause.message : "request did not complete",
    );
  } finally {
    clearTimeout(timeout);
  }
}
