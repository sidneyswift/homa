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
const plusMonthlyPrice = tierPriceAmount("plus", "monthly");

export const HERO_COPY = {
  eyebrow: "Your homeschool assistant",
  headline: "Homeschool, handled.",
  body:
    "Homa is an AI assistant for homeschool parents. She plans the week for every child you add, records the teaching hours you report, and keeps finished work together. For children ages 2 to 7, she also makes practice pages. You review every change.",
  primaryAction: "Start your 7 free days",
  /** Under the primary CTA, everywhere it appears: the card ask must be
   *  visible BEFORE the click (trial-transparency research 2026-07-26:
   *  hiding the card step behind a soft CTA costs trust and day-0
   *  cancellations; naming it raised trial starts in the Blinkist
   *  case). One price, the trial length, and the way out. */
  primaryActionNote:
    `Choose a monthly membership when you sign up: Homa is $${regularMonthlyPrice} and Homa Plus is $${plusMonthlyPrice}. Both start with 7 free days and require a credit card. We email you before the first charge. Cancel before then to pay nothing.`,
  proofLabel: "One membership for your family",
  proof: "Add every child. The price stays the same.",
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
    eyebrow: "One note, three updates",
    headline: "Tell Homa what changed. Review the updated week.",
    body:
      "Change the plan, add teaching time, and make a practice page in one note. Homa shows you the result before you keep it.",
    secondaryAction: "See prices",
  },
  features: {
    eyebrow: "What you get",
    headline: "One place for plans, pages, records, and teaching hours.",
    body:
      "Open the plan, a printable page, the family binder, and the teaching-hour record below. Each example shows what you tell Homa, what she prepares, and what you can review or change.",
  },
  memberships: {
    eyebrow: "Membership prices",
    headline: "Every price, before you choose.",
    body:
      "Every membership includes the progress report, weekly plans, practice pages for ages 2 to 7, teaching-hour records, and web chat. Adding children never changes the price.",
  },
  faq: {
    eyebrow: "Before you start",
    headline: "Ages, curriculum, state rules, and memberships.",
  },
  final: {
    eyebrow: "Start with next week",
    headline: "Let Homa prepare the week.",
    body:
      "Choose the $19 Homa membership or the $49 Homa Plus membership when you sign up. Both start with 7 free days and require a credit card. We email you before the first charge. Cancel before then to pay nothing.",
  },
} as const;

export const PRODUCT_PREVIEW_COPY = {
  status: "Fictional example",
  eyebrow: "Maya, age 4, and Leo, age 9",
  headline: "Make Tuesday lighter.",
  states: {
    tell: {
      control: "Read note",
      title: "Parent's note",
      description:
        "Move Leo's unfinished fractions review to Thursday. He finished science after 35 minutes. Make Maya a butterfly counting page for Tuesday.",
      activity: "Shared with Homa",
    },
    updating: {
      control: "Homa updates",
      title: "Homa is making three changes",
      description:
        "The weekly plan, teaching hours, and practice page update together.",
      activity: "Making changes",
    },
    ready: {
      control: "Review changes",
      title: "Ready for the parent",
      description: "Review each change before it becomes part of the week.",
      activity: "Ready to review",
    },
  },
  dayTitle: "The week reflects all three changes",
  dayBody:
    "Maya's counting page is on Tuesday. Leo's fractions review moves to Thursday, and 35 minutes of science is added to his teaching hours.",
  artifactEyebrow: "A page made from the lesson",
  artifactTitle: "Maya's butterfly counting page is ready to print.",
  artifactBody: "Homa saves the page with Tuesday's weekly plan. You can print the page or ask for a change.",
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
      "Tell Homa which children you are planning for, how much time you have, and which curriculum you use. She builds the weekly plan from those details. Homa Plus can also read curriculum files you upload. Move a lesson or lighten a day without starting over.",
    action: "See the weekly plan",
  },
  {
    id: "practice",
    title: "Practice pages",
    body:
      "Practice pages currently cover ages 2 to 7. Tell Homa the lesson and what your child is practicing. She makes the page, saves it in your family binder, and keeps it ready to print.",
    action: "See practice pages",
  },
  {
    id: "binder",
    title: "The binder",
    body:
      "Finished work, photos, notes, and reports stay together in your family binder. Find them later or print a page again.",
    action: "See the binder",
  },
  {
    id: "records",
    title: "Teaching hours and state rules",
    body:
      "Tell Homa how long you taught. She records teaching hours by child and subject. The state-rules section links to each source and shows the date it was last reviewed.",
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
  "Annual memberships are paid once for the year and cost 20% less than twelve monthly payments. You can stop the next renewal in your settings.";

export const SAMPLE_REPORT_COPY = {
  eyebrow: "The progress report",
  headline: "See what is going well and what to try next.",
  body:
    "Homa organizes your answers by subject. Early ages use published developmental milestones; school ages use national grade standards, with source links. This is not a test or evaluation. You get one practical activity for each subject, and you decide what fits your child.",
  reassurance:
    "About five minutes per child. You answer from what you have already seen, and your child never has to use Homa.",
  action: "See the sample report",
  href: "/onboarding/sample",
} as const;

export const FOUNDER_STORY_COPY = {
  eyebrow: "Our story",
  headline: "Homa started at our kitchen table.",
  body:
    "We built Homa while teaching our own children and trying to keep every plan, page, and record together. The paperwork kept taking time from the teaching. She prepares the week and keeps the record, while we stay in charge of our children's learning.",
  signature: "Alessa & Carolyng",
} as const;
