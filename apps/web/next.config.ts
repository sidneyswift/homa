import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  // Workspace packages ship raw TypeScript; Next compiles them in-place.
  transpilePackages: ["@homa/core"],
  // The worksheet studio's renderer (lib/materials/render-page.ts): the
  // Chromium binary and puppeteer must stay real node_modules, never
  // bundled, so the .br binaries survive to the deployed function.
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // AVIF first for the hero LCP image (roughly 20-30% smaller than webp),
  // webp as the fallback.
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // The report writer's system prompt is a markdown file read from disk at
  // runtime (founder-editable, versioned); every route that can generate a
  // narrative must ship it in its traced bundle.
  outputFileTracingIncludes: {
    "/api/map/score": ["./agent/report-writer.md"],
    "/api/map/narrative-status": ["./agent/report-writer.md"],
    "/onboarding/r/[token]/plan/[subjectId]": ["./agent/report-writer.md"],
    "/api/voice/curriculum/insights": ["./agent/curriculum-writer.md"],
    // The learning loops' extraction prompt: the cron route runs the
    // post-call memory turn, the review route runs the post-turn review.
    "/api/map/cron": ["./agent/memory-extractor.md"],
    "/api/learning/review": ["./agent/memory-extractor.md"],
    // The OG card and its vendored fonts render at build time, but trace
    // them anyway so any future dynamic render finds the files.
    "/opengraph-image": ["./assets/fonts/*.woff"],
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
      { source: "/home", destination: "/app/report", permanent: false },
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
      // /app/dashboard for another, then retired for the in-app report
      // (founder ask 2026-07-10: the report IS the home surface). Both
      // old names route to the report resolver for open tabs and
      // history.
      { source: "/app/home", destination: "/app/report", permanent: false },
      { source: "/app/dashboard", destination: "/app/report", permanent: false },
    ];
  },
};

export default withEve(nextConfig);
