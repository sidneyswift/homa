import type { WorldConfig } from "./scroll-world-engine";

/**
 * The /world experiment's journey: a homeschool day told as one continuous
 * camera flight through a miniature clay world, morning table to golden-hour
 * home. Every claim maps to a shipped feature (chat, materials + binder,
 * planner + hours, lesson listen + progress report); the finale scene is the
 * brand mark itself and carries the one conversion this page shares with the
 * static landing page, the free report at /onboarding.
 *
 * Assets live in Vercel Blob under world/ (not the repo): pre-rendered
 * Higgsfield clips, a native 9:16 chain for phones (-m suffix) and a 16:9
 * chain for desktop, plus webp posters. The engine picks the chain by
 * viewport. Accents are Homa tokens only, deeper steps where the accent
 * colors text on cream.
 */

const A = "https://pkvvudjdhxk33dig.public.blob.vercel-storage.com/world";

export const WORLD_CONFIG: WorldConfig = {
  diveScroll: 1.25,
  connScroll: 0.85,
  hint: "scroll",
  sections: [
    {
      id: "morning",
      label: "Morning",
      still: `${A}/morning.webp`,
      stillMobile: `${A}/morning-m.webp`,
      clip: `${A}/morning.mp4`,
      clipMobile: `${A}/morning-m.mp4`,
      accent: "#C44C22",
      scroll: 1.6,
      linger: 0.35,
      eyebrow: "For homeschool parents",
      title: "The homeschool assistant that does the prep.",
      body: "Homa plans the week, makes the pages, and keeps the record. The table time stays yours.",
      tags: ["Kids never use a screen"],
    },
    {
      id: "park",
      label: "Anywhere",
      still: `${A}/park.webp`,
      stillMobile: `${A}/park-m.webp`,
      clip: `${A}/park.mp4`,
      clipMobile: `${A}/park-m.mp4`,
      accent: "#3A8FA9",
      linger: 0.3,
      eyebrow: "Always in your pocket",
      title: "Text her like a friend.",
      body: "Ask for a worksheet, a reset after a rough morning, or what to work on this week. Homa already knows what each child is working on.",
      tags: ["Text message", "Web chat", "Phone friendly"],
    },
    {
      id: "studio",
      label: "Pages",
      still: `${A}/studio.webp`,
      stillMobile: `${A}/studio-m.webp`,
      clip: `${A}/studio.mp4`,
      clipMobile: `${A}/studio-m.mp4`,
      accent: "#2E6BE6",
      linger: 0.3,
      eyebrow: "Practice pages",
      title: "Made for this child, not a grade level.",
      body: "Worksheets and coloring pages built around what your child loves, ready to print and kept in the binder.",
      tags: ["Worksheets", "Coloring pages", "The binder"],
    },
    {
      id: "planner",
      label: "The week",
      still: `${A}/planner.webp`,
      stillMobile: `${A}/planner-m.webp`,
      clip: `${A}/planner.mp4`,
      clipMobile: `${A}/planner-m.mp4`,
      accent: "#23304F",
      linger: 0.3,
      eyebrow: "The week, handled",
      title: "A plan that bends with real life.",
      body: "Month goals become daily cards you can check off. When a week falls apart, Homa adjusts, and the hours your state asks for stay recorded.",
      tags: ["Weekly plan", "Hours log", "State rules"],
    },
    {
      id: "progress",
      label: "Progress",
      still: `${A}/progress.webp`,
      stillMobile: `${A}/progress-m.webp`,
      clip: `${A}/progress.mp4`,
      clipMobile: `${A}/progress-m.mp4`,
      accent: "#2F7C40",
      linger: 0.35,
      eyebrow: "See it working",
      title: "Growth you can actually see.",
      body: "Teach like always. When you choose to record a lesson, Homa listens, writes the review, and keeps the record for you.",
      tags: ["Progress report", "Lesson reviews"],
    },
    {
      id: "home",
      label: "Start",
      still: `${A}/home.webp`,
      stillMobile: `${A}/home-m.webp`,
      clip: `${A}/home.mp4`,
      clipMobile: `${A}/home-m.mp4`,
      accent: "#E7602F",
      scroll: 1.8,
      linger: 0.45,
      eyebrow: "Start with the free report",
      title: "You've got this. Homa's got the rest.",
      body: "About five minutes of questions per child, then a free progress report that shows what looks solid and what comes next. No card is needed.",
      cta: {
        primary: { label: "Get your free report", href: "/onboarding" },
        secondary: { label: "See the sample report", href: "/onboarding/sample" },
      },
    },
  ],
  connectors: [`${A}/conn1-2.mp4`, `${A}/conn2.mp4`, `${A}/conn3-2.mp4`, `${A}/conn4-2.mp4`, `${A}/conn5.mp4`],
  // conn1-m2 (kling3_0 fallback past a content-filter flag) and conn4-m2
  // (arrival re-roll) are versioned filenames: Blob assets carry a 1-year
  // CDN max-age, so a replaced clip must ship under a new name.
  connectorsMobile: [`${A}/conn1-m2.mp4`, `${A}/conn2-m.mp4`, `${A}/conn3-m.mp4`, `${A}/conn4-m2.mp4`, `${A}/conn5-m.mp4`],
};
