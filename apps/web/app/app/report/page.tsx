import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAppData } from "../../../lib/app-data";
import { parseViewContext, VIEW_CONTEXT_COOKIE } from "../../../lib/view-context";

/**
 * /app/report: the sidebar tab's stable address for "the progress
 * report". Reports are per kid (/app/[childId]/report), but the nav
 * renders once with no kid in hand, so this route resolves a kid: the
 * one selected in the context switcher first (their page handles the
 * no-report-yet case by routing to /onboarding, the standing law), then
 * the first kid with a report. No report anywhere means the questions
 * aren't done: /onboarding is the one place they live (founder call
 * 2026-07-08).
 */

export default async function ReportIndexPage() {
  const data = await getAppData();
  if (!data) redirect("/onboarding");

  const cookieStore = await cookies();
  const viewContext = parseViewContext(
    cookieStore.get(VIEW_CONTEXT_COOKIE)?.value,
    data.children.map((child) => child.id),
  );
  if (viewContext.kind === "child") redirect(`/app/${viewContext.childId}/report`);

  const withReport = data.children.find((child) => data.reports.get(child.id)?.token);
  if (!withReport) redirect("/onboarding");
  redirect(`/app/${withReport.id}/report`);
}
