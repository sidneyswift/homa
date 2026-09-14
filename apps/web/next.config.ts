import path from "node:path";
import type { NextConfig } from "next";
import { withEve } from "eve/next";

const isVercelPreview = process.env.VERCEL_ENV === "preview";
const chromiumArchives = [
  "../../node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**",
];

const nextConfig: NextConfig = {
  // Pull requests are already required to pass the repository-wide tsc
  // job before merge. Skipping Next's duplicate preview check removes the
  // measured 41-second repeat; production and local builds still fail on
  // type errors because this is false outside Vercel previews.
  typescript: {
    ignoreBuildErrors: isVercelPreview,
  },
  experimental: {
    // Next 16.2 considers build caching experimental, so canary it only on
    // disposable previews. Production keeps the default compiler path.
    turbopackFileSystemCacheForBuild: isVercelPreview,
  },
  // Trace from the monorepo root (matches Next's own lockfile-based
  // detection; stated explicitly because /admin/studio's funnel traces
  // the repo-root .cosmo corpus, which lives outside apps/web).
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
  // Workspace packages ship raw TypeScript; Next compiles them in-place.
  // @homa/taxonomy joined when the graph walk's routes became the first
  // full-package import under Next (only the /domains subpath was used
  // before, and only inside eve-compiled tool bundles).
  transpilePackages: ["@homa/core", "@homa/taxonomy"],
  // The materials studio's renderer (lib/materials/render-page.ts): the
  // Chromium binary and puppeteer must stay real node_modules, never
  // bundled. The runtime .br archives also need the explicit traces below.
  // pdfjs-dist and @napi-rs/canvas joined 2026-07-28 when the state pack
  // route became the first NEXT lambda to import the raster stack (the
  // eve build always kept them external via agent.ts
  // build.externalDependencies): bundling pdf.mjs evaluates DOMMatrix at
  // module load with no canvas polyfill and drops the native .node
  // addon, which 500ed POST /api/compliance/pack on every request.
  serverExternalPackages: [
    "pdf-lib",
    "@sparticuz/chromium",
    "puppeteer-core",
    "pdfjs-dist",
    "@napi-rs/canvas",
  ],
  // AVIF first for the hero LCP image (roughly 20-30% smaller than webp),
  // webp as the fallback.
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Markdown prompt files still read from disk at runtime must be included
  // explicitly. Report writing and memory compaction use generated mirrors
  // instead because Eve-hosted code can reach those modules too.
  outputFileTracingIncludes: {
    "/api/dev/foreground": ["./agent/instructions.md"],
    // NOTE (gh#335): do NOT re-add node_modules globs here for
    // @napi-rs/canvas. Tracing-include globs copy pnpm's symlinked
    // directories verbatim and Vercel's packager rejects the function
    // ("invalid deployment package... files in symlinked directories",
    // 2026-07-28). The canvas ships correctly because
    // lib/materials/rasterize-pdf.ts imports it with a plain literal
    // specifier that nft can see and resolve to real files.
    //
    // The chromium binaries are the one legitimate include (gh#335,
    // same day): @sparticuz/chromium reads its .br archives via fs at
    // runtime, which no static trace can see, so the pack route's
    // lambda shipped without them. The glob points at the real .pnpm
    // package directory and matches plain files only, never a
    // symlinked directory, which is what broke packaging before.
    "/api/compliance/pack": chromiumArchives,
    "/api/compliance/filing": chromiumArchives,
    // Bring back rebuilds a saved version's PDF in this server action.
    // Externalizing Chromium alone does not trace its runtime archives.
    "/app/binder": chromiumArchives,
    // The founder mirror mounts the same Binder component and actions.
    "/admin/families/*/screen": chromiumArchives,
    "/api/chat/suggestions": ["./agent/prompt-suggestions.md"],
    "/api/voice/curriculum/insights": ["./agent/curriculum-writer.md"],
    // The learning loops' extraction prompt: the cron route runs the
    // post-call memory turn, the review route runs the post-turn review.
    "/api/map/cron": ["./agent/memory-extractor.md"],
    "/api/learning/review": ["./agent/memory-extractor.md"],
    // The OG card and its vendored fonts render at build time, but trace
    // them anyway so any future dynamic render finds the files.
    "/opengraph-image": ["./assets/fonts/*.woff"],
    // The founder console's material studio reads the skill package
    // (SKILL.md + reference images) off the deployed filesystem, plus
    // the inspo funnel's sources: the activity-format registry and
    // Cosmo's analysis corpus at the repo root (.cosmo JSON and
    // markdown only; the heavy inspo images and PDFs stay untraced).
    "/admin/studio": [
      "./agent/skills/materials-studio/**",
      "./agent/activity-formats.md",
      "../../.cosmo/*.md",
      "../../.cosmo/references/*.json",
      "../../.cosmo/curriculums/*.json",
    ],
    "/admin/studio/reference/[file]": ["./agent/skills/materials-studio/**"],
    // The library shelf reads the same analysis corpus as the funnel
    // above, and nothing else: original bytes and cover thumbnails come
    // from Blob at runtime, never from the bundle.
    "/admin/library": [
      "../../.cosmo/references/*.json",
      "../../.cosmo/curriculums/*.json",
    ],
    "/admin/library/[id]": [
      "../../.cosmo/references/*.json",
      "../../.cosmo/curriculums/*.json",
    ],
  },
  // The funnel's fs reads make Next's tracer emit the whole .cosmo
  // directory into the studio functions; the source PDFs and page
  // images (~28 MB) are never read by product code, only the JSON and
  // markdown are. Both key shapes on purpose: "/*" is the docs' global
  // form, the explicit routes cover strict single-segment matching.
  outputFileTracingExcludes: {
    "/*": ["../../.cosmo/inspo-images/**", "../../.cosmo/inspo-files/**"],
    "/admin/studio": ["../../.cosmo/inspo-images/**", "../../.cosmo/inspo-files/**"],
    "/admin/studio/runs/[runId]": [
      "../../.cosmo/inspo-images/**",
      "../../.cosmo/inspo-files/**",
    ],
    "/admin/studio/reference/[file]": [
      "../../.cosmo/inspo-images/**",
      "../../.cosmo/inspo-files/**",
    ],
    "/admin/library": ["../../.cosmo/inspo-images/**", "../../.cosmo/inspo-files/**"],
    "/admin/library/[id]": ["../../.cosmo/inspo-images/**", "../../.cosmo/inspo-files/**"],
  },
  async redirects() {
    return [
      // The child's-map flow replaced the bare waitlist (lead magnet v2),
      // then /map was renamed /onboarding (founder call, 2026-07-06);
      // every link ever shared keeps working.
      { source: "/conference", destination: "/onboarding", permanent: true },
      { source: "/waitlist", destination: "/onboarding", permanent: true },
      { source: "/map", destination: "/onboarding", permanent: true },
      { source: "/map/:path*", destination: "/onboarding/:path*", permanent: true },
      // The signed-in app moved under one /app prefix (founder call,
      // 2026-07-09); every link ever sent (journal emails deep-link
      // /chat?draft=journal, report emails link /home) keeps working.
      // 307 on purpose, not 308: these pages are noindex (no SEO equity
      // to transfer) and the freed top-level names may become marketing
      // pages later, which a browser-cached permanent redirect would
      // fight. Query strings carry over automatically.
      { source: "/home", destination: "/app/progress", permanent: false },
      { source: "/chat", destination: "/app", permanent: false },
      { source: "/planner", destination: "/app/planner", permanent: false },
      { source: "/kids/:path*", destination: "/app/kids/:path*", permanent: false },
      { source: "/settings", destination: "/app/settings", permanent: false },
      // Chat became the /app root itself the same day (founder ask:
      // default to chat over the dashboard); /app/chat existed only
      // briefly but the journal email's already-sent deep link
      // (/app/chat?draft=journal) still points there.
      { source: "/app/chat", destination: "/app", permanent: false },
      // The card dashboard lived at /app/home for a day, then
      // /app/dashboard for another, then retired for live Progress.
      // Both old names use the Progress resolver, whose feature flag
      // keeps the legacy report available during rollout.
      { source: "/app/home", destination: "/app/progress", permanent: false },
      { source: "/app/dashboard", destination: "/app/progress", permanent: false },
      // The recording door moved off the retired kid card onto Progress
      // (2026-07-20), so it left /app/kids too. A parent who kept the
      // old URL open through a lesson lands on the same recorder.
      {
        source: "/app/kids/:childId/lessons/record",
        destination: "/app/:childId/lessons/record",
        permanent: false,
      },
    ];
  },
};

export default withEve(nextConfig);
