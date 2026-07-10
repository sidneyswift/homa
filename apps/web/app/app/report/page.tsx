import { redirect } from "next/navigation";

import { getAppData } from "../../../lib/app-data";

/**
 * /app/report: the sidebar tab's stable address for "the progress
 * report". Reports are per kid (/app/[childId]/report), but the nav
 * renders once with no kid in hand, so this route resolves to the first
 * kid with a report. No report anywhere means the questions aren't done:
 * /onboarding is the one place they live (founder call 2026-07-08).
 */

export default async function ReportIndexPage() {
  const data = await getAppData();
  if (!data) redirect("/onboarding");

  const withReport = data.children.find((child) => data.reports.get(child.id)?.token);
  if (!withReport) redirect("/onboarding");
  redirect(`/app/${withReport.id}/report`);
}
