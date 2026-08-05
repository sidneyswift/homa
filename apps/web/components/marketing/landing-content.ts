import {
  PURCHASABLE_HOMA_PLANS,
  type PlanTier,
} from "@homa/core";

import {
  TIER_NAMES,
  tierDescription,
  tierPriceAmount,
} from "../billing/wall-copy";

export type MembershipTier = PlanTier;

export const MONTHLY_MEMBERSHIP_PRICES = PURCHASABLE_HOMA_PLANS.map(({ tier }) =>
  tierPriceAmount(tier, "monthly"),
);

const regularMonthlyPrice = tierPriceAmount("regular", "monthly");

export const HERO_COPY = {
  eyebrow: "Your homeschool assistant",
  headline: "Homeschool, handled.",
  body:
    "Homa is an AI assistant for homeschool parents. She plans the week, makes practice pages, and keeps your records together. Your child never has to use Homa. You review every update.",
  primaryAction: "Start your 7 free days",
  /** Under the primary CTA, everywhere it appears: the card ask must be
   *  visible BEFORE the click (trial-transparency research 2026-07-26:
   *  hiding the card step behind a soft CTA costs trust and day-0
   *  cancellations; naming it raised trial starts in the Blinkist
   *  case). One price, the trial length, and the way out. */
  primaryActionNote:
    `7 free days, then from $${regularMonthlyPrice} a month. Credit card required. Cancel before the first charge to pay nothing.`,
  proofLabel: "Your whole family",
  proof: "Add every child at no extra cost.",
} as const;

export type PlatformKind = "message" | "web" | "phone";

export const PLATFORM_ITEMS: ReadonlyArray<{
  kind: PlatformKind;
  label: string;
}> = [
  { kind: "message", label: "Text message" },
  { kind: "web", label: "Web chat" },
  { kind: "phone", label: "Phone friendly" },
];

export const LANDING_SECTION_COPY = {
  authority: {
    eyebrow: "How it works",
    headline: "Tell Homa what changed.",
    body:
      "She updates the plan, records the hours, and prepares the page. You review the result.",
    secondaryAction: "See what Homa handles",
  },
  features: {
    eyebrow: "What Homa handles",
    headline: "The plan. The pages. The records.",
    body: "Everything stays together, even when the week changes.",
  },
  memberships: {
    eyebrow: "Simple pricing",
    headline: "One price for your whole family.",
    body: "Choose Homa or Homa Plus. Add every child at no extra cost.",
  },
  faq: {
    eyebrow: "Questions",
    headline: "The details, without the fine print.",
  },
  final: {
    eyebrow: "Start with next week",
    headline: "Let Homa handle the plan.",
    body:
      `7 free days, then from $${regularMonthlyPrice} a month. Credit card required. Cancel before the first charge to pay nothing.`,
  },
} as const;

export const PRODUCT_PREVIEW_COPY = {
  status: "Fictional example",
  eyebrow: "Maya, age 4, and Leo, age 9",
  headline: "One note updates the week.",
  states: {
    tell: {
      control: "Read note",
      title: "Parent's note",
      description:
        "Move Leo's unfinished fractions review to Thursday. He finished science after 35 minutes. Make Maya a butterfly counting page for Tuesday.",
      activity: "Sent to Homa",
    },
    updating: {
      control: "Homa updates",
      title: "Homa is updating the week",
      description:
        "She moves the lesson, records the time, and makes the practice page.",
      activity: "Making changes",
    },
    ready: {
      control: "Review changes",
      title: "Ready to review",
      description: "Check each change before you keep it.",
      activity: "Ready to review",
    },
  },
  dayTitle: "The week is up to date",
  dayBody:
    "Maya's page is ready. Leo's fractions review moved to Thursday. His 35 minutes of science are recorded.",
  artifactEyebrow: "Made from the lesson",
  artifactTitle: "Maya's counting page is ready to print.",
  artifactBody: "Print it, or ask Homa for a change.",
} as const;

export type CapabilityId = "practice" | "plan" | "binder" | "records";

export const CAPABILITY_FEATURE_HREFS: Readonly<Record<CapabilityId, string>> = {
  plan: "/features/homeschool-planner",
  practice: "/features/personalized-practice-pages",
  binder: "/features/homeschool-record-keeping",
  records: "/features/homeschool-hours-tracker",
};

// Ordered by the parent's day: plan the week, get the pages, keep what
// happened, prove the hours.
export const CAPABILITY_ITEMS: ReadonlyArray<{
  id: CapabilityId;
  title: string;
  body: string;
  action: string;
}> = [
  {
    id: "plan",
    title: "The weekly plan",
    body:
      "Homa builds each child's week from the schedule and curriculum details you share. Homa Plus can read curriculum files for you. Move a lesson without rebuilding the plan.",
    action: "See the weekly plan",
  },
  {
    id: "practice",
    title: "Practice pages",
    body:
      "For ages 2 to 7, Homa makes printable practice pages from the lesson you are teaching.",
    action: "See practice pages",
  },
  {
    id: "binder",
    title: "The binder",
    body:
      "Add finished work, photos, and notes. Homa keeps them with reports and practice pages, ready to find later.",
    action: "See the binder",
  },
  {
    id: "records",
    title: "Teaching hours and state rules",
    body:
      "Report the time you taught. Homa records it by child and subject, with dated state-rule sources nearby.",
    action: "See teaching hours",
  },
];

const LANDING_MEMBERSHIP_BODIES: Readonly<Record<PlanTier, string>> = {
  regular:
    "Weekly plans, printable practice pages, teaching-hour records, and web chat are included.",
  plus: tierDescription("plus"),
  elite: tierDescription("elite"),
};

export const MEMBERSHIP_ITEMS: ReadonlyArray<{
  tier: MembershipTier;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  body: string;
}> = PURCHASABLE_HOMA_PLANS.map(({ tier }) => ({
  tier,
  name: TIER_NAMES[tier],
  monthlyPrice: tierPriceAmount(tier, "monthly"),
  annualPrice: tierPriceAmount(tier, "annual"),
  body: LANDING_MEMBERSHIP_BODIES[tier],
}));

export const MEMBERSHIP_NOTE =
  "Annual plans cost 20% less and are paid once a year. Stop renewal anytime in settings.";

export const SAMPLE_REPORT_COPY = {
  eyebrow: "Progress report",
  headline: "See what is going well and what to try next.",
  body:
    "Answer from what you have already seen. Homa turns your answers into one practical activity for each subject. It never turns your child into a number or a verdict. You decide what fits.",
  reassurance:
    "About five minutes per child. Your child never has to use Homa.",
  action: "See the sample report",
  href: "/onboarding/sample",
} as const;

export const FOUNDER_STORY_COPY = {
  eyebrow: "Our story",
  headline: "Homa started at our kitchen table.",
  body:
    "We built Homa while teaching our own children. We wanted planning and paperwork to stop stealing time from teaching. Homa prepares the week and keeps the record. You stay in charge.",
  signature: "Alessa & Carolyng",
} as const;
