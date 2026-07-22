import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { familyWallCheckout } from "../../lib/billing/wall";
import { fetchChatHistory } from "../../lib/chat-history";
import {
  appWouldAdmit,
  chatOnboardingEnabled,
  familyOnboardingActive,
} from "../../lib/onboarding/state";
import { requireFamily } from "../../lib/map/session";
import { loadOnboardingChatFamily } from "../../lib/onboarding/store";
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
    "Answer a five-minute questionnaire about what your child can do. Homa checks it against national benchmarks and sends you a free progress report.",
  alternates: { canonical: "/onboarding" },
};

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
  const chat = await loadChatProps();
  return <OnboardingShell chat={chat} />;
}
