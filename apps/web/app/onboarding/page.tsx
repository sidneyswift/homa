import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  familyAccountCheckout,
  familyWallCheckout,
  signupPaywallEnabled,
} from "../../lib/billing/wall";
import { fetchChatHistory } from "../../lib/chat-history";
import {
  appWouldAdmit,
  chatOnboardingEnabled,
  familyOnboardingActive,
} from "../../lib/onboarding/state";
import { requireFamily } from "../../lib/map/session";
import {
  beginOnboarding,
  loadOnboardingChatFamily,
} from "../../lib/onboarding/store";
import { getSlashMenuSkills } from "../../lib/slash-skills";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { effectiveTimeZone } from "../../lib/time-zone";
import { OnboardingShell } from "./onboarding-shell";
import {
  visitShapeFromHistory,
  type OnboardingChatProps,
} from "./onboarding-chat-props";

/**
 * /onboarding: the progress-report flow (lead magnet v2, replaces the plain
 * waitlist). Account first, then family setup, homeschool context, kids,
 * a five-minute observable checklist per child, optional child extras,
 * scoring, and the report. Every answer auto-saves server-side; the
 * httpOnly resume cookie restores the flow on return visits.
 *
 * Chrome (nav/footer) decisions live in OnboardingShell: full site chrome
 * on the page-like moments, quiet chrome during the focused steps.
 *
 * Behind HOMA_CHAT_ONBOARDING the steps after the account become a
 * conversation instead (plans/2026-07-21-chat-first-onboarding.md). The
 * account step is unchanged and still first; everything this page adds
 * is the chat surface's props, read once here so the flow does not have
 * to fetch them from the browser.
 */

export const metadata: Metadata = {
  title: "See where your child stands",
  description:
    "Answer a five-minute questionnaire about what your child can do. Homa checks it against national benchmarks and builds your child's progress report.",
  alternates: { canonical: "/onboarding" },
};

/**
 * The signup paywall's routing decision for this page (founder
 * directive 2026-07-26). "off": flag dark, nothing changes. "entitled":
 * this family passed the gate (trial, subscription, or comp), run the
 * flow as always. "pending": somebody on this page will have to pass
 * through /onboarding/trial before the product; the client flow
 * forwards them there the moment their account exists. A walled family
 * whose account already exists never even renders: it redirects to the
 * gate here, server-side, so no client state can route around it.
 */
async function signupPaywallDisposition(): Promise<"off" | "entitled" | "pending"> {
  if (!signupPaywallEnabled()) return "off";
  const session = await requireFamily();
  if (!session) return "pending";
  const checkout = await familyAccountCheckout(session.id);
  if (!checkout) return "entitled";
  if (session.has_account) redirect("/onboarding/trial");
  // A walled family without a linked account is mid-signup (the
  // anonymous sitting, or a Google return the next /api/map/state call
  // will link): the account card still has to run, so the page renders
  // and the client forwards to the gate right after the account moment.
  return "pending";
}

async function loadChatProps(): Promise<OnboardingChatProps | null> {
  if (!chatOnboardingEnabled()) return null;

  const session = await requireFamily();
  if (!session) return null;
  const family = await loadOnboardingChatFamily(session.id);
  if (!family) return null;
  // Onboarding that has finished has one home, and it is /app. Sending
  // her back into the flow she completed would give her two places the
  // same conversation lives.
  //
  // Only ever hand off to a door that will actually open. /app admits a
  // family with a finished profile AND at least one child, so sending a
  // childless family there is an infinite redirect: /app bounces her to
  // /onboarding, /onboarding bounces her back, and the product is
  // unreachable. That family is not finished, whatever the profile
  // column says, and the reachable case is not exotic: anybody who made
  // an account and stopped before adding a child is sitting in it right
  // now, waiting for this flag to be turned on.
  if (
    !familyOnboardingActive({
      profileCompletedAt: family.profileCompletedAt,
      context: family.context,
    })
  ) {
    if (
      appWouldAdmit({
        profileCompletedAt: family.profileCompletedAt,
        childCount: family.children.length,
      })
    ) {
      redirect("/app");
    }
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;
  // The account step has not run yet, so there is nobody to hold a
  // conversation with. The card flow's own gate takes it from here.
  if (!userId) return null;

  // Entering the chat flow is what makes the durable record the truth
  // (state.ts). Without this write, the family has no record, so the
  // predicate falls back to profile_completed_at, and the basics card's
  // save stamps that column: from the very next turn the auth walk read
  // the family as done, onboarding-mode silently unloaded, and the rest
  // of the arc ran without its own instructions (found live in the
  // 2026-07-23 latency walks; the prompt shrank by the whole mode block
  // from turn two onward). Idempotent, and never reopens a done family.
  await beginOnboarding(session.id);

  const [slashSkills, wall, serverHistory] = await Promise.all([
    getSlashMenuSkills(),
    familyWallCheckout(session.id),
    fetchChatHistory({ familyId: session.id, userId }),
  ]);
  const visit = visitShapeFromHistory(serverHistory, Date.now());

  return {
    // The same key /app builds, so both surfaces read one transcript.
    storageKey: `homa-chat-${userId}`,
    familyId: session.id,
    timeZone: effectiveTimeZone(family.timeZone),
    parentName: family.parentName,
    kids: family.children,
    slashSkills,
    serverHistory,
    wall,
    firstVisit: visit.firstVisit,
    gapMs: visit.gapMs,
  };
}

export default async function OnboardingPage() {
  const paywall = await signupPaywallDisposition();
  // "pending" skips the chat props on purpose: building them runs
  // beginOnboarding (the durable record write) and would drop an
  // un-gated family straight into the conversation. Onboarding starts
  // after the gate, so the family Homa greets has already given a card.
  const chat = paywall === "pending" ? null : await loadChatProps();
  return <OnboardingShell chat={chat} paywallPending={paywall === "pending"} />;
}
