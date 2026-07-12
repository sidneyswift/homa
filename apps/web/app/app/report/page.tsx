import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAppData } from "../../../lib/app-data";
import { liveProgressEnabled } from "../../../lib/child-progress/flag";
import { progressRoutePolicy } from "../../../lib/child-progress/route-policy";
import { parseViewContext, VIEW_CONTEXT_COOKIE } from "../../../lib/view-context";

/**
 * The legacy in-app report resolver remains the rollback route while live
 * Progress is dark. Once enabled, its stable replacement owns child
 * selection and this route redirects there without loading report data.
 */

export default async function ReportIndexPage() {
  const policy = progressRoutePolicy(
    { surface: "report_index" },
    liveProgressEnabled(),
  );
  if (policy.kind === "redirect") {
    redirect(policy.href);
  }

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
