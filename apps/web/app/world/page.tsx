import type { Metadata } from "next";
import { WorldClient } from "./world-client";

/**
 * /world: the scroll-world landing experiment (2026-07-21). One continuous
 * pre-rendered camera flight through a miniature clay Homa world, scrubbed by
 * scroll; a homeschool day from the morning table to the little home at
 * golden hour. Mobile-first: phones get a native 9:16 clip chain, desktop a
 * 16:9 one. This route exists to decide whether we love the format; the
 * static landing page at / stays canonical until a founder promotes this.
 * noindex + absent from sitemap.ts on purpose while it is an experiment.
 */

export const metadata: Metadata = {
  title: "A day with Homa",
  description:
    "Scroll through a homeschool day with Homa: the plan, the pages, the record, and the proof it's working.",
  robots: { index: false, follow: false },
};

export default function WorldPage() {
  return <WorldClient />;
}
