import type { Metadata } from "next";

import { OnboardingShell } from "./onboarding-shell";

/**
 * /onboarding: the progress-report flow (lead magnet v2, replaces the plain
 * waitlist). Account first, then family setup, homeschool context, kids,
 * a five-minute observable checklist per child, optional child extras,
 * scoring, and the report. Every answer auto-saves server-side; the
 * httpOnly resume cookie restores the flow on return visits.
 *
 * Chrome (nav/footer) decisions live in OnboardingShell: full site chrome
 * on the page-like moments, quiet chrome during the focused steps.
 */

export const metadata: Metadata = {
  title: "See where your child stands",
  description:
    "Answer a five-minute questionnaire about what your child can do. Homa checks it against national benchmarks and sends you a free progress report.",
  alternates: { canonical: "/onboarding" },
};

export default function OnboardingPage() {
  return <OnboardingShell />;
}
