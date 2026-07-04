import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  // Workspace packages ship raw TypeScript; Next compiles them in-place.
  transpilePackages: ["@homa/core"],
};

export default withEve(nextConfig);
