import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { FirstsPage } from "../../../../components/progress/firsts-page";
import { ProgressUnavailable } from "../../../../components/progress/progress-unavailable";
import { getAppData } from "../../../../lib/app-data";
import { getChildProgressLedger } from "../../../../lib/child-progress";
import { firstsPageFromLedger } from "../../../../lib/child-progress/firsts-from-ledger";
import { liveProgressEnabled } from "../../../../lib/child-progress/flag";
import { progressRoutePolicy } from "../../../../lib/child-progress/route-policy";

/**
 * /app/[childId]/firsts: the page of firsts (celebration spec R3, the
 * receipt spine). Ordered strictly by date, oldest at the top, each row
 * led by the parent's own words. Reads the evidence ledger directly, so
 * it is dark wherever the ledger is dark.
 */

export const metadata: Metadata = {
  title: "Firsts",
  robots: { index: false },
};

export default async function ChildFirstsPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  const policy = progressRoutePolicy(
    { surface: "child_firsts", childId },
    liveProgressEnabled(),
  );
  if (policy.kind === "redirect") {
    redirect(policy.href);
  }

  const data = await getAppData();
  if (!data) redirect("/onboarding");

  // Tenancy re-scope: the childId from the URL is client input and never
  // reaches a query until it has been matched against the caller's own
  // RLS-loaded children.
  const child = data.children.find((entry) => entry.id === childId);
  if (!child) notFound();

  // The gate's roster: every OTHER child's name, from the authenticated
  // read, never from the model and never from the URL.
  const otherChildNames = data.children
    .filter((entry) => entry.id !== child.id)
    .map((entry) => entry.name);

  let ledger;
  try {
    ledger = await getChildProgressLedger(data.family.id, child.id);
  } catch (error) {
    // A celebration page that renders half a record is worse than one
    // that says it could not load.
    console.error("Firsts ledger could not load.", error);
    return <ProgressUnavailable childId={child.id} childName={child.name} />;
  }

  // A brand-new child with no ledger row is normal, not a missing page.
  if (ledger === null) {
    return (
      <FirstsPage page={{ childId: child.id, childName: child.name, rows: [] }} />
    );
  }

  return <FirstsPage page={firstsPageFromLedger({ ledger, otherChildNames })} />;
}
