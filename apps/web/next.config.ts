import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  // Workspace packages ship raw TypeScript; Next compiles them in-place.
  transpilePackages: ["@homa/core"],
  async redirects() {
    return [
      // The QR/share page was briefly /conference; keep old links working.
      { source: "/conference", destination: "/waitlist", permanent: true },
    ];
  },
};

export default withEve(nextConfig);
