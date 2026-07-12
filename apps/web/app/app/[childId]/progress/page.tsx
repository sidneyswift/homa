import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ProgressUnavailable } from "../../../../components/progress/progress-unavailable";
import { ProgressView } from "../../../../components/progress/progress-view";
import { getAppData } from "../../../../lib/app-data";
import { getChildProgressView } from "../../../../lib/child-progress";
import { liveProgressEnabled } from "../../../../lib/child-progress/flag";
import { loadChildProgressPageState } from "../../../../lib/child-progress/page-state";
import { progressRoutePolicy } from "../../../../lib/child-progress/route-policy";
import { effectiveTimeZone } from "../../../../lib/time-zone";

export const metadata: Metadata = {
  title: "Progress",
  robots: { index: false },
};

export default async function ChildProgressPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const policy = progressRoutePolicy(
    { surface: "child_progress", childId },
    liveProgressEnabled(),
  );
  if (policy.kind === "redirect") {
    redirect(policy.href);
  }

  const data = await getAppData();
  if (!data) redirect("/onboarding");

  const child = data.children.find((entry) => entry.id === childId);
  if (!child) notFound();

  const pageState = await loadChildProgressPageState(
    {
      familyId: data.family.id,
      child: {
        id: child.id,
        name: child.name,
        birthDate: child.birth_month,
      },
      timeZone: effectiveTimeZone(data.family.time_zone),
    },
    { loadView: getChildProgressView },
  );
  if (pageState.status === "unavailable") {
    console.error(
      "Live Progress could not load.",
      pageState.error,
    );
    return (
      <ProgressUnavailable
        childId={child.id}
        childName={child.name}
      />
    );
  }

  // The permanent token report stays reachable from live Progress
  // (agent-led-live-progress ruling: token and share reports remain).
  const reportToken = data.reports.get(child.id)?.token;

  return (
    <ProgressView
      view={pageState.view}
      reportHref={reportToken ? `/onboarding/r/${reportToken}` : null}
    />
  );
}
