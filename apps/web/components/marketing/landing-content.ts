import {
  TIER_NAMES,
  tierPriceAmount,
} from "../billing/wall-copy";

const MEMBERSHIP_TIERS = ["regular", "plus", "elite"] as const;

export type MembershipTier = (typeof MEMBERSHIP_TIERS)[number];

export const MONTHLY_MEMBERSHIP_PRICES = MEMBERSHIP_TIERS.map((tier) =>
  tierPriceAmount(tier, "monthly"),
);

const monthlyMembershipPriceList = (() => {
  const labels = MONTHLY_MEMBERSHIP_PRICES.map((price) => `$${price}`);
  return `${labels.slice(0, -1).join(", ")}, or ${labels.at(-1)}`;
})();

export const HERO_COPY = {
  eyebrow: "Homeschool, handled",
  headline: "Less admin. More teaching.",
  body:
    "Homa plans your week, builds tailored materials for each kid, and adapts to growth. Meet your kid where they are. Every day.",
  primaryAction: "Start your 7 free days",
  /** Under the primary CTA, everywhere it appears: the card ask must be
   *  visible BEFORE the click (trial-transparency research 2026-07-26:
   *  hiding the card step behind a soft CTA costs trust and day-0
   *  cancellations; naming it raised trial starts in the Blinkist
   *  case). One price, the trial length, and the way out. */
  primaryActionNote:
    `Add a credit card to start 7 free days. We do not charge it during those 7 days. Monthly memberships cost ${monthlyMembershipPriceList}. We email you before the first charge. Cancel before then to pay nothing.`,
  proofLabel: "One family membership",
  proof: "Adding children never changes the price.",
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
      "The parent asks Homa to move Leo's fractions review, record his 35-minute science lesson, and make Maya's counting page. Homa applies all three changes, then shows the updated week for review.",
    secondaryAction: "See the four steps",
  },
  how: {
    eyebrow: "How it works",
    headline: "Start with the week you actually have.",
    body:
      "Tell Homa who you are teaching, which curriculum you use, and how much time you have. Review what she prepares, change anything, and keep going when the week changes.",
  },
  features: {
    eyebrow: "What you get",
    headline: "One place for plans, pages, records, and teaching hours.",
    body:
      "Everything Homa prepares stays connected to your family and week. Open any part below to see exactly what it does.",
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
      "Add a credit card to start 7 free days. We email you before the first charge. Cancel before then to pay nothing.",
  },
} as const;

export const PRODUCT_PREVIEW_COPY = {
  status: "Fictional example",
  eyebrow: "Maya and Leo",
  headline: "Make Tuesday lighter.",
  states: {
    tell: {
      control: "Parent's note",
      title: "Three changes for Tuesday",
      description:
        "Move Leo's unfinished fractions review to Thursday. He finished science after 35 minutes. Make Maya a butterfly counting page for Tuesday.",
      activity: "Shared with Homa",
    },
    updating: {
      control: "Homa updates",
      title: "The week is updating",
      description:
        "She moves Leo's fractions review, records 35 minutes of science, and makes Maya's counting page.",
      activity: "Updating",
    },
    ready: {
      control: "Review changes",
      title: "The parent reviews the week",
      description: "Tuesday and Thursday are updated. The parent can keep or change anything.",
      activity: "Ready to review",
    },
  },
  dayTitle: "Tuesday and Thursday are updated",
  dayBody:
    "Maya's counting page is on Tuesday. Leo's fractions review moves to Thursday, and 35 minutes of science is added to his teaching hours.",
  artifactEyebrow: "A page made from the lesson",
  artifactTitle: "Maya's butterfly counting page is ready to print.",
  artifactBody: "Homa saves the page with Tuesday's weekly plan. You can print the page or ask for a change.",
} as const;

export type WorkflowId = "family" | "review" | "change" | "record";

export const WORKFLOW_ITEMS: ReadonlyArray<{
  id: WorkflowId;
  title: string;
  body: string;
}> = [
  {
    id: "family",
    title: "Tell Homa about your family",
    body: "Add each child, the curriculum you use, and the time you have this week.",
  },
  {
    id: "review",
    title: "Review what Homa prepares",
    body: "Homa builds the plan and practice pages. You decide what stays.",
  },
  {
    id: "change",
    title: "Change the week as life changes",
    body: "Move a lesson, lighten a day, or ask for a different page without starting over.",
  },
  {
    id: "record",
    title: "Keep the record",
    body: "Teaching hours, finished work, photos, and reports stay together for later.",
  },
];

export const WORKFLOW_CLOSING = "You stay in charge. Homa keeps the work moving.";

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

const LANDING_MEMBERSHIP_BODIES: Readonly<Record<MembershipTier, string>> = {
  regular:
    "Weekly plans, printable practice pages, teaching-hour records, and web chat are included.",
  plus:
    "Adds curriculum-file uploads for weekly planning. The membership picker shows any other current additions before checkout.",
  elite:
    "An optional service membership. The membership picker shows its current additions before checkout.",
};

export const MEMBERSHIP_ITEMS: ReadonlyArray<{
  tier: MembershipTier;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  body: string;
}> = MEMBERSHIP_TIERS.map((tier) => ({
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
  headline: "Turn your answers into one useful next step.",
  body:
    "Homa groups your answers by subject. The report starts with strengths and gives you one practical next step for each subject. Homa uses published sources for your child's age, and you can open each one. You decide what fits your child.",
  reassurance:
    "You spend about five minutes answering questions about things you have already seen. Your child never has to use Homa.",
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
