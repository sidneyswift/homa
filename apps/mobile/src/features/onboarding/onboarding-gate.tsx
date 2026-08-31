import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";

import { LoadingStatus } from "../../components/ui/loading-status";
import { getMyFamily } from "../../lib/family";
import { supabase } from "../../lib/supabase";
import { colors, space } from "../../theme/tokens";
import {
  bootstrapOnboarding,
  reportOnboardingResumed,
  THROUGH_CACHE_PREFIX,
  type OnboardingStep,
} from "./onboarding-state";

/**
 * Decides, once per signed-in session, whether the caller belongs in the
 * native onboarding walk or the app proper (v1 plan 2026-08-18).
 *
 *  - Web-born family (D6): straight through, the chat continues their
 *    sitting; the native flow never shows.
 *  - Mobile-born family, walk unfinished: redirect to the saved step
 *    (or the hello beat for a fresh walk) and report the resume.
 *  - Bootstrap error: fail OPEN into the app. A flaky network must never
 *    lock a signed-in parent out; the FamilyReadinessGate downstream
 *    still handles the truly family-less case with its existing card.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const [decision, setDecision] = useState<
    | { kind: "loading" }
    | { kind: "through" }
    | { kind: "walk"; step: OnboardingStep }
  >({ kind: "loading" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id ?? null;
      const cacheKey = userId ? `${THROUGH_CACHE_PREFIX}${userId}` : null;

      if (cacheKey) {
        const cached = await AsyncStorage.getItem(cacheKey).catch(() => null);
        if (cached === "1") {
          setDecision({ kind: "through" });
          return;
        }
      }

      const world = await bootstrapOnboarding();
      if (world.world === "error") {
        // Fail open, and do NOT cache: the next open retries.
        setDecision({ kind: "through" });
        return;
      }
      if (world.world === "web" || world.state?.completed) {
        if (cacheKey) {
          await AsyncStorage.setItem(cacheKey, "1").catch(() => {});
        }
        setDecision({ kind: "through" });
        return;
      }
      const step = world.state?.step ?? "hello";
      if (world.state) {
        // A saved row means she has been here before: count the comeback
        // exactly once per app open. Fire and forget; the family exists
        // by now because bootstrap just ensured it.
        const family = await getMyFamily().catch(() => null);
        if (family) reportOnboardingResumed(family.id, step);
      }
      setDecision({ kind: "walk", step });
    })();
  }, []);

  if (decision.kind === "loading") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.page,
          gap: space.md,
        }}
      >
        <LoadingStatus label="Opening Homa" />
      </View>
    );
  }

  if (decision.kind === "walk") {
    return <Redirect href={STEP_ROUTES[decision.step] as never} />;
  }

  return <>{children}</>;
}

/** The full walk: every step re-enters on its own screen, the paywall
 *  and decline beats included (walk v2; resumability is the law). */
const STEP_ROUTES: Record<OnboardingStep, string> = {
  door: "/hello",
  hello: "/hello",
  intent: "/intent",
  kids: "/kids",
  making: "/making",
  reveal: "/reveal",
  paywall: "/paywall",
  decline: "/decline",
  next: "/next",
};
