import type { Metadata } from "next";
import { WorldRealClient } from "./world-real-client";

/**
 * /world-real: the "real-world companion" sibling of /world (2026-07-22).
 * Every environment is genuinely photoreal; the one exception in any frame
 * is Homa, a small solid warm house character with no arms or legs. Same
 * beat sheet and copy as /world's v2, so the two routes are a controlled
 * art-direction comparison. noindex + absent from sitemap.ts while this is
 * an experiment.
 */

export const metadata: Metadata = {
  title: "A day with Homa",
  description:
    "Scroll through a homeschool day with Homa: the plan, the pages, the record, and the proof it's working.",
  robots: { index: false, follow: false },
};

export default function WorldRealPage() {
  return <WorldRealClient />;
}
