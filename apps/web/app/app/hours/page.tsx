import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getAppData } from "../../../lib/app-data";
import { getHoursLogForFamily } from "../../../lib/hours";
import { scopedToViewContext, toHoursEntries } from "../../../lib/hours-view";
import { effectiveTimeZone } from "../../../lib/time-zone";
import { parseViewContext, VIEW_CONTEXT_COOKIE } from "../../../lib/view-context";
import { PageColumn } from "../../../components/dashboard/page-column";
import { HoursView } from "./hours-view";

/**
 * /app/hours (CG-02, issue #174): the parent-facing home for hours_log
 * (migration #37), which had chat and voice writers but zero readers
 * until this page. Same setup gates as the rest of /app (one onboarding
 * for every door), and the same view-context scoping as the Binder and
 * Planner: the whole family by default, or one kid's own blocks plus
 * anything family-wide when the context switcher narrows to them. Auth
 * is enforced by proxy.ts; data access is enforced by RLS regardless.
 */

export const metadata: Metadata = {
  title: "Hours",
  robots: { index: false },
};

export default async function HoursPage() {
  const data = await getAppData();
  if (!data) redirect("/onboarding");
  const { family, children } = data;

  const cookieStore = await cookies();
  const viewContext = parseViewContext(
    cookieStore.get(VIEW_CONTEXT_COOKIE)?.value,
    children.map((child) => child.id),
  );

  const rows = await getHoursLogForFamily(family.id);
  const entries = scopedToViewContext(toHoursEntries(rows, children), viewContext);

  return (
    <PageColumn>
      <HoursView
        kids={children.map((child) => ({
          id: child.id,
          name: child.name,
          avatar_url: child.avatar_url,
        }))}
        entries={entries}
        focusChildId={viewContext.kind === "child" ? viewContext.childId : null}
        timeZone={effectiveTimeZone(family.time_zone)}
        now={new Date()}
      />
    </PageColumn>
  );
}
