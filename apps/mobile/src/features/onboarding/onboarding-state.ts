import type {
  MobileOnboardingIntent,
  MobileOnboardingStep,
} from "@homa/core";

import { emitFamilyEvent } from "../../lib/events";
import { EVE_CHANNEL_HEADER, env } from "../../lib/env";
import { supabase } from "../../lib/supabase";

/**
 * Durable native-onboarding state (mobile onboarding v1, plan
 * docs/homa-planning/plans/2026-08-18-mobile-onboarding-v1-plan.md).
 * The law is pausable-everywhere: every answer persists the moment it
 * is given, and re-entry lands on the exact screen the parent left.
 * The bootstrap call is the only server round-trip this feature owns;
 * step and answer persistence go straight to Postgres under RLS.
 */

export type OnboardingStep = MobileOnboardingStep;
export type OnboardingIntent = MobileOnboardingIntent;

/** A child mid-introduction: the assembling card's fields. */
export interface DraftKid {
  name: string;
  age: number | null;
  love: string | null;
  workingOn: string | null;
  level: "starting" | "getting_it" | "flying" | null;
  /** Set once the kid is written as a real children row. */
  childId: string | null;
}

export interface OnboardingAnswers {
  intent?: OnboardingIntent;
  kids?: DraftKid[];
}

export interface OnboardingState {
  step: OnboardingStep;
  answers: OnboardingAnswers;
  completed: boolean;
}

export type OnboardingWorld =
  | { world: "web" }
  | { world: "native"; state: OnboardingState | null }
  | { world: "error" };

/**
 * Ensures the signed-in caller has a family (creating a mobile-born one
 * server-side when needed) and reports which onboarding world applies.
 * "web" means the family began onboarding on the web: the native flow
 * never shows (founder ruling D6, 2026-08-18).
 */
export async function bootstrapOnboarding(): Promise<OnboardingWorld> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return { world: "error" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(
      `${env.apiUrl.replace(/\/+$/u, "")}/api/mobile/onboarding`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...EVE_CHANNEL_HEADER,
        },
        signal: controller.signal,
      },
    );
    if (!response.ok) return { world: "error" };
    const body = (await response.json()) as {
      ok: boolean;
      world?: "web" | "native";
      state?: {
        step: OnboardingStep;
        answers: OnboardingAnswers;
        completed: boolean;
      } | null;
    };
    if (!body.ok || !body.world) return { world: "error" };
    if (body.world === "web") return { world: "web" };
    return { world: "native", state: body.state ?? null };
  } catch {
    return { world: "error" };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Reads the saved draft answers so a resumed screen shows her words
 * exactly as she left them. RLS scopes the read to the caller's family.
 */
export async function loadOnboardingAnswers(
  familyId: string,
): Promise<OnboardingAnswers | null> {
  const { data, error } = await supabase
    .from("mobile_onboarding_state")
    .select("answers")
    .eq("family_id", familyId)
    .maybeSingle();
  if (error || !data) return null;
  return (data.answers as OnboardingAnswers) ?? null;
}

/**
 * Persists the walk position and draft answers. RLS scopes the write to
 * the caller's own family; a wrong familyId simply fails. Errors are
 * surfaced so screens can retry, but saving never blocks navigation.
 */
export async function saveOnboardingState(
  familyId: string,
  step: OnboardingStep,
  answers: OnboardingAnswers,
): Promise<boolean> {
  const { error } = await supabase.from("mobile_onboarding_state").upsert(
    {
      family_id: familyId,
      step,
      answers,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "family_id" },
  );
  if (error) {
    console.error("saveOnboardingState failed:", error.message);
    return false;
  }
  return true;
}

export async function markOnboardingComplete(
  familyId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("mobile_onboarding_state")
    .update({
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("family_id", familyId);
  if (error) {
    console.error("markOnboardingComplete failed:", error.message);
    return false;
  }
  return true;
}

/** One funnel beat per screen arrival. Fire and forget. */
export function reportOnboardingStep(
  familyId: string,
  step: OnboardingStep,
  intent?: OnboardingIntent,
): void {
  void emitFamilyEvent(familyId, "mobile_onboarding.step_reached", {
    step,
    ...(intent ? { intent } : {}),
  });
}

export function reportOnboardingResumed(
  familyId: string,
  step: OnboardingStep,
): void {
  void emitFamilyEvent(familyId, "mobile_onboarding.resumed", { step });
}

export function reportOnboardingCompleted(
  familyId: string,
  props: {
    kids_added: number;
    intent: OnboardingIntent;
    next_door: "another_worksheet" | "plan_week" | "look_around";
    second_create_tapped: boolean;
  },
): void {
  void emitFamilyEvent(familyId, "mobile_onboarding.completed", props);
}
