import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  // Workspace packages ship raw TypeScript; Next compiles them in-place.
  transpilePackages: ["@homa/core"],
  async redirects() {
    return [
      // The child's-map flow replaced the bare waitlist (lead magnet v2);
      // every link ever shared keeps working.
      { source: "/conference", destination: "/map", permanent: true },
      { source: "/waitlist", destination: "/map", permanent: true },
    ];
  },
};

export default withEve(nextConfig);
