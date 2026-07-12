import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAppData } from "../../../lib/app-data";
import { liveProgressEnabled } from "../../../lib/child-progress/flag";
import { progressRoutePolicy } from "../../../lib/child-progress/route-policy";
import {
  parseViewContext,
  resolveProgressChildId,
  VIEW_CONTEXT_COOKIE,
} from "../../../lib/view-context";

export const metadata: Metadata = {
  title: "Progress",
  robots: { index: false },
};

/**
 * Resolves the stable sidebar route to the focused child, then the first
 * family child. A legacy report is not required for a live view.
 */
export default async function ProgressIndexPage() {
  const policy = progressRoutePolicy(
    { surface: "progress_index" },
    liveProgressEnabled(),
  );
  if (policy.kind === "redirect") {
    redirect(policy.href);
  }

  const data = await getAppData();
  if (!data) redirect("/onboarding");

  const cookieStore = await cookies();
  const childIds = data.children.map((child) => child.id);
  const viewContext = parseViewContext(
    cookieStore.get(VIEW_CONTEXT_COOKIE)?.value,
    childIds,
  );
  const childId = resolveProgressChildId(viewContext, childIds);
  if (childId === null) redirect("/onboarding");

  redirect(`/app/${childId}/progress`);
}
