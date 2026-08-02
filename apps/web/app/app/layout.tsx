import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ageInMonths } from "@homa/core";

import { getAppShellData } from "../../lib/app-data";
import { parentFirstName } from "../../lib/family";
import {
  parseViewContext,
  VIEW_CONTEXT_COOKIE,
  VIEW_CONTEXT_FAMILY,
} from "../../lib/view-context";
import { DashboardShell } from "../../components/dashboard/shell";
import { TimeZoneSync } from "../../components/dashboard/time-zone-sync";

/**
 * The signed-in app frame, wrapped around every page under /app (chat,
 * the dashboard, planner, kids, settings) by this segment's layout.
 * The shell (sidebar + phone top bar) renders
 * here ONCE and stays mounted while pages navigate inside it, so the
 * frame never re-mounts or jumps. Unfinished setup redirects to
 * /onboarding, the one setup flow (founder call 2026-07-08); pages keep
 * their own copy of that gate because Next renders layout and page in
 * parallel, so neither may assume the other ran first. Auth itself is
 * enforced by proxy.ts; data access by RLS regardless.
 */

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const data = await getAppShellData();
  if (!data) redirect("/onboarding");
  const { family, children: kids, memberDisplayName, memberAvatarUrl } = data;

  // The view-context cookie (who the parent is viewing) validates against
  // the family's own kids here, once, so everything below the shell only
  // ever sees "family" or a real child id.
  const cookieStore = await cookies();
  const viewContext = parseViewContext(
    cookieStore.get(VIEW_CONTEXT_COOKIE)?.value,
    kids.map((kid) => kid.id),
  );

  return (
    <DashboardShell
      parentName={memberDisplayName ?? parentFirstName(family)}
      familyName={family.name}
      // The signed-in adult's OWN photo (migration #74), never the
      // family-level one: a co-parent should not wear the uploader's face.
      avatarUrl={memberAvatarUrl}
      kids={kids.map((kid) => ({
        id: kid.id,
        name: kid.name,
        ageMonths: ageInMonths(kid.birth_month),
        avatarUrl: kid.avatar_url,
      }))}
      viewContext={viewContext.kind === "child" ? viewContext.childId : VIEW_CONTEXT_FAMILY}
    >
      {/* Captures the device time zone once, while the family row has
          none, from ANY first app visit (it used to live on the
          dashboard, which retired 2026-07-10; the planner's dates and
          the evening check-in's timing both read this). */}
      {family.time_zone ? null : <TimeZoneSync />}
      {children}
    </DashboardShell>
  );
}
