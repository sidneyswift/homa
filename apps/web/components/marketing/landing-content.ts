export const HERO_COPY = {
  eyebrow: "Made for homeschool parents",
  headline: "The homeschool assistant that does the prep.",
  body:
    "Homa is an AI assistant for parents. She plans each week. She makes practice pages for each child. She records the hours you share. Her progress reports show what looks solid and what comes next.",
  primaryAction: "Get your free report",
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

export type PainId = "planning" | "proof" | "scattered" | "paperwork";

export const PAIN_ITEMS: ReadonlyArray<{
  id: PainId;
  title: string;
  body: string;
}> = [
  {
    id: "planning",
    title: "Sunday-night planning",
    body: "Planning the week can take hours.",
  },
  {
    id: "proof",
    title: "Checking what is working",
    body: "You teach all day and may still wonder what to try next.",
  },
  {
    id: "scattered",
    title: "Plans and records in different places",
    body: "The notebook, spreadsheet, and saved screenshots do not stay connected.",
  },
  {
    id: "paperwork",
    title: "Hours and state rules",
    body: "Recording time and checking requirements happen after the lesson.",
  },
];

export const PAIN_CLOSING = "Homa prepares the week. She keeps the record.";

export type CapabilityId = "practice" | "plan" | "binder" | "records";

// Ordered by the parent's day: plan the week, get the pages, keep what
// happened, prove the hours.
export const CAPABILITY_ITEMS: ReadonlyArray<{
  id: CapabilityId;
  title: string;
  body: string;
}> = [
  {
    id: "plan",
    title: "The weekly plan",
    body:
      "When a day changes, Homa can revise the rest of the week. Sick days, field trips, and lighter mornings can all stay in the plan.",
  },
  {
    id: "practice",
    title: "Practice pages",
    body:
      "Homa makes practice pages for the lesson your child is working on. Each page can use what they love and stays in the binder for printing.",
  },
  {
    id: "binder",
    title: "The binder",
    body:
      "The binder keeps worksheets, photos, and reports in one place. You can browse the record or print a page again.",
  },
  {
    id: "records",
    title: "Hours and state rules",
    body:
      "Homa records the time you share by subject. A separate state-rules section shows each source and its last-checked date.",
  },
];

export const SAMPLE_REPORT_COPY = {
  eyebrow: "Free progress report",
  headline: "A progress report built from your answers.",
  body:
    "You answer a five-minute questionnaire per child. Homa checks each answer against published national standards and education research. The report groups the answers by subject.",
  reassurance:
    "This is not a test for your child. The report starts with strengths. Each area that is still growing includes a next step.",
  action: "See the sample report",
  href: "/onboarding/sample",
} as const;

export const FOUNDER_STORY_COPY = {
  eyebrow: "Our story",
  headline: "By homeschoolers, for homeschoolers.",
  body:
    "We built Homa at our kitchen table. We were planning lessons, teaching, and keeping records at the same time. The teaching mattered most. Planning and recordkeeping took time away from teaching. Homa first helped our family plan the week. It kept our records together. It showed us what to try next.",
  signature: "Alessa & Carolyng",
} as const;
