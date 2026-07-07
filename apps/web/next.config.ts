import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  // Workspace packages ship raw TypeScript; Next compiles them in-place.
  transpilePackages: ["@homa/core"],
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
