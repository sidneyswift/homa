import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ResetClient } from "./reset-client";

/**
 * /dev/reset: the testing loop's one bookmark.
 *
 * Gated at the page, not just at the API, so the route genuinely does
 * not exist rather than rendering a button that would 404. Same two
 * conditions as everything else under /dev.
 */

export const metadata: Metadata = {
  title: "Reset onboarding",
  robots: { index: false },
};

function devTestSessionsEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const value = (process.env.HOMA_DEV_TEST_SESSIONS ?? "").trim().toLowerCase();
  return value === "1" || value === "true";
}

export default function DevResetPage() {
  if (!devTestSessionsEnabled()) notFound();
  return <ResetClient />;
}
