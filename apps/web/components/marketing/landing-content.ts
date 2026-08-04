export const HERO_COPY = {
  eyebrow: "Your homeschool assistant",
  headline: "Homeschool, handled.",
  body:
    "Homa is an AI assistant for homeschool parents. She plans the week, makes practice pages for each child, records teaching time and finished work, and shows you what to try next.",
  primaryAction: "Start your 7 free days",
  /** Under the primary CTA, everywhere it appears: the card ask must be
   *  visible BEFORE the click (trial-transparency research 2026-07-26:
   *  hiding the card step behind a soft CTA costs trust and day-0
   *  cancellations; naming it raised trial starts in the Blinkist
   *  case). One price, the trial length, and the way out. */
  primaryActionNote:
    "Add a credit card to start 7 free days. We do not charge it during those 7 days. Homa memberships start at $19 a month after that. We email you before the first charge. Cancel before then to pay nothing.",
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
    eyebrow: "What Homa handles",
    headline: "You teach. Homa handles the prep and paperwork.",
    body:
      "Tell Homa about your children, curriculum, and week. She turns that into a weekly plan, practice pages, organized records, and teaching time you can review. When plans change, she updates the week with you.",
    secondaryAction: "See how Homa works",
  },
  how: {
    eyebrow: "How it works",
    headline: "Start with the week you actually have.",
    body:
      "Tell Homa who you are teaching, what you use, and how much time you have. Review what she prepares, change anything, and keep going when the week changes.",
  },
  features: {
    eyebrow: "What you get",
    headline: "One place for plans, pages, records, and hours.",
    body:
      "Everything Homa prepares stays connected to your family and week. Open any part below to see exactly what it does.",
  },
  faq: {
    eyebrow: "Before you start",
    headline: "Ages, curriculum, state rules, and memberships.",
  },
  final: {
    eyebrow: "Try Homa",
    headline: "Start with 7 free days.",
    body:
      "Add a credit card to start 7 free days. We do not charge it during those 7 days, and we email you before the first charge.",
  },
} as const;

export const PRODUCT_PREVIEW_COPY = {
  status: "This week is ready",
  eyebrow: "Your family",
  headline: "What changed this week?",
  states: {
    tell: {
      control: "Tell Homa",
      title: "Tell Homa what changed",
      description: "We need a lighter math day. Leo finished science early after 35 minutes.",
      activity: "Your note",
    },
    updating: {
      control: "Homa updates",
      title: "Homa updates the week",
      description:
        "She moves the unfinished lesson, records the science time, and prepares the next page.",
      activity: "Updating",
    },
    ready: {
      control: "Your plan",
      title: "Tuesday is ready",
      description: "The new plan is saved. You can review every change.",
      activity: "Ready",
    },
  },
  dayTitle: "Tuesday is ready for both children",
  dayBody:
    "Maya's counting page, Leo's fractions review, and today's teaching time already recorded.",
  artifactEyebrow: "A page made from the lesson",
  artifactTitle: "Maya's butterfly math is ready to print.",
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
    body: "Add each child, the curriculum you use, and the week you have.",
  },
  {
    id: "review",
    title: "Review what Homa prepares",
    body: "Homa builds the plan and practice pages. You decide what stays.",
  },
  {
    id: "change",
    title: "Change it as life changes",
    body: "Move a lesson, lighten a day, or ask for a different page without starting over.",
  },
  {
    id: "record",
    title: "Keep the record",
    body: "Hours, finished work, photos, and reports stay together for later.",
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
      "Homa builds a plan around each child, the curriculum you use, and the time you have. Move a lesson or lighten a day without starting over.",
    action: "See the weekly planner",
  },
  {
    id: "practice",
    title: "Practice pages",
    body:
      "Ask for a page for today's lesson. Homa builds the page for the skill your child is practicing, then saves it in your binder ready to print.",
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
    title: "Hours and state rules",
    body:
      "Tell Homa how long you taught. She records time by child and subject. A separate state-rules section shows each source and its last-checked date.",
    action: "See hours tracking",
  },
];

export const SAMPLE_REPORT_COPY = {
  eyebrow: "The progress report",
  headline: "See what is going well and what to try next.",
  body:
    "You spend about five minutes answering questions about what you have seen each child do. Homa organizes your answers by subject and checks them against published national benchmarks. The report shows the sources Homa used and one next step for each subject.",
  reassurance:
    "You answer the questions. Your child never has to use Homa. The report starts with strengths and gives you one next step for each subject.",
  action: "See the sample report",
  href: "/onboarding/sample",
} as const;

export const FOUNDER_STORY_COPY = {
  eyebrow: "Our story",
  headline: "Homa started at our kitchen table.",
  body:
    "We were teaching our children while also planning lessons and keeping records. We wanted more time for the work only a parent can do. Homa grew from that need. She plans the week, keeps the record together, and helps us see what to try next.",
  signature: "Alessa & Carolyng",
} as const;
