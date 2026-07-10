import type { ReactNode } from "react";

import type { UpNextItem } from "../../lib/dashboard";
import { MobileNav } from "./mobile-nav";
import { Sidebar, type SidebarKid } from "./sidebar";

/**
 * The signed-in app frame: the template's floating sidebar beside a main
 * column on desktop, and on phones the MobileNav bar (hamburger on the
 * top left that opens the same sidebar as a drawer; founder call
 * 2026-07-09, one mobile nav on every signed-in page). Rendered once by
 * the /app layout so it persists across navigations; pages bring their
 * own inner geometry (PageColumn for scrolling dashboards, a
 * viewport-height column for chat). The phone bar's h-14 is load-bearing:
 * chat's phone height is 100dvh minus exactly this bar.
 */

export function DashboardShell({
  parentName,
  familyName,
  avatarUrl,
  kids,
  upNext,
  viewContext,
  children,
}: {
  parentName: string;
  familyName: string;
  avatarUrl: string | null;
  kids: SidebarKid[];
  upNext: UpNextItem[];
  /** "family" or a kid id: who the context switcher shows as selected. */
  viewContext: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-page lg:flex">
      <Sidebar
        parentName={parentName}
        familyName={familyName}
        avatarUrl={avatarUrl}
        kids={kids}
        upNext={upNext}
        viewContext={viewContext}
      />

      <MobileNav
        parentName={parentName}
        familyName={familyName}
        avatarUrl={avatarUrl}
        kids={kids}
        upNext={upNext}
        viewContext={viewContext}
      />

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
