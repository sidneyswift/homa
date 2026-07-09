import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  // Workspace packages ship raw TypeScript; Next compiles them in-place.
  transpilePackages: ["@homa/core"],
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
    "/onboarding/r/[token]/plan/[domainId]": ["./agent/report-writer.md"],
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
    ];
  },
};

export default withEve(nextConfig);
