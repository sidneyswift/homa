import type { WorldConfig } from "../world/scroll-world-engine";

/**
 * /world-real: the "real-world companion" sibling of /world. Every
 * environment is genuinely photoreal (a real phone, a real kitchen, a real
 * desk); the only stylized element in any frame is Homa herself, rendered
 * as a small solid warm house-shaped character with no arms or legs,
 * always the exact logo color. Same beat sheet and copy as /world's v2
 * (docs/homa-planning/plans/2026-07-21-world-v2-beats.md), so the two
 * routes are a controlled art-direction comparison, not a copy comparison.
 *
 * No connectors: these are grounded, real rooms, not a diorama world, so the
 * "pull up and fly to the next miniature scene" technique doesn't apply.
 * Scenes crossfade directly, which the engine already supports when a
 * connector slot is absent. Portrait-only pending a desktop pass.
 *
 * Assets live in Vercel Blob under worldreal/.
 */

const A = "https://pkvvudjdhxk33dig.public.blob.vercel-storage.com/worldreal";

export const WORLD_REAL_CONFIG: WorldConfig = {
  diveScroll: 1.25,
  connScroll: 0.85,
  hint: "scroll",
  sections: [
    {
      id: "hero",
      label: "The claim",
      still: `${A}/hero-m.webp`,
      stillMobile: `${A}/hero-m.webp`,
      clip: `${A}/hero-m.mp4`,
      clipMobile: `${A}/hero-m.mp4`,
      accent: "var(--homa-brand-text)",
      scroll: 1.6,
      linger: 0.35,
      eyebrow: "For homeschool parents",
      title: "The homeschool assistant that does the prep.",
      body: "The binder, the planner, the assistant, and your kid's progress, all in one place. Kids never use a screen.",
      tags: ["Kids never use a screen"],
    },
    {
      id: "report",
      label: "The report",
      still: `${A}/report-m.webp`,
      stillMobile: `${A}/report-m.webp`,
      clip: `${A}/report-m.mp4`,
      clipMobile: `${A}/report-m.mp4`,
      accent: "var(--homa-constructive-ink)",
      linger: 0.4,
      eyebrow: "See it, first",
      title: "Where she's at, subject by subject.",
      body: "What looks solid. What comes next. This is not a test for your child.",
      tags: ["Free progress report"],
    },
    {
      id: "worksheet",
      label: "Made for her",
      still: `${A}/worksheet-m.webp`,
      stillMobile: `${A}/worksheet-m.webp`,
      clip: `${A}/worksheet-m.mp4`,
      clipMobile: `${A}/worksheet-m.mp4`,
      accent: "var(--homa-info-ink)",
      linger: 0.3,
      eyebrow: "Act on it",
      title: "Not a grade level. Her level, in her dinosaurs.",
      body: "Say \"make the numbers bigger\" and it comes back fixed. Every page kept in the binder.",
      tags: ["Worksheets", "The binder"],
    },
    {
      id: "planner",
      label: "It builds itself",
      still: `${A}/planner-m.webp`,
      stillMobile: `${A}/planner-m.webp`,
      clip: `${A}/planner-m.mp4`,
      clipMobile: `${A}/planner-m.mp4`,
      accent: "var(--homa-midnight-action)",
      linger: 0.3,
      eyebrow: "The loop",
      title: "When life happens, the week bends.",
      body: "Tell her about your day in a sentence. The hours log themselves, and next week reshapes around what actually happened.",
      tags: ["Weekly plan", "Hours log"],
    },
    {
      id: "observatory",
      label: "She never stops",
      still: `${A}/observatory-m.webp`,
      stillMobile: `${A}/observatory-m.webp`,
      clip: `${A}/observatory-m.mp4`,
      clipMobile: `${A}/observatory-m.mp4`,
      accent: "var(--homa-highlight-ink)",
      linger: 0.35,
      eyebrow: "Always working",
      title: "While you sleep, she's still thinking about your kids.",
      body: "Text her, call her, email her. She answers where you are.",
      tags: ["Text", "Call", "Email"],
    },
    {
      id: "finale",
      label: "Start",
      still: `${A}/finale-m.webp`,
      stillMobile: `${A}/finale-m.webp`,
      clip: `${A}/finale-m.mp4`,
      clipMobile: `${A}/finale-m.mp4`,
      accent: "var(--homa-visual-coral)",
      scroll: 1.8,
      linger: 0.45,
      eyebrow: "Start with the free report",
      title: "You've got this. Homa's got the rest.",
      body: "Start with a snapshot today. Watch it fill in from your real days. About five minutes per child, no card needed.",
      cta: {
        primary: { label: "Get your free report", href: "/onboarding" },
        secondary: { label: "See the sample report", href: "/onboarding/sample" },
      },
    },
  ],
  connectors: [null, null, null, null, null],
  connectorsMobile: [null, null, null, null, null],
};
