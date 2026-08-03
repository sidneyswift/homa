import type { ReactNode } from "react";

import { DesktopContextSwitcher } from "./context-switcher";
import { MobileNav } from "./mobile-nav";
import { Sidebar, type SidebarKid } from "./sidebar";

/**
 * The signed-in app frame: the template's floating sidebar beside a main
 * column on desktop (plus the kid switcher avatar floating at the top
 * right, founder ruling 2026-07-12), and on phones the MobileNav bar
 * (hamburger on the top left that opens the same sidebar as a drawer;
 * founder call 2026-07-09, one mobile nav on every signed-in page).
 * Rendered once by the /app layout so it persists across navigations;
 * pages bring their own inner geometry (PageColumn for scrolling
 * dashboards, a viewport-height column for chat). The phone bar's h-14
 * is load-bearing: chat's phone height is 100dvh minus exactly this bar.
 */

export function DashboardShell({
  parentName,
  familyName,
  avatarUrl,
  kids,
  viewContext,
  children,
}: {
  parentName: string;
  familyName: string;
  avatarUrl: string | null;
  kids: SidebarKid[];
  /** "family" or a kid id: who the context switcher shows as selected. */
  viewContext: string;
  children: ReactNode;
}) {
  return (
    <div className="quiet-shell">
      <Sidebar
        parentName={parentName}
        familyName={familyName}
        avatarUrl={avatarUrl}
        kids={kids}
        viewContext={viewContext}
      />

      <MobileNav
        parentName={parentName}
        familyName={familyName}
        avatarUrl={avatarUrl}
        kids={kids}
        viewContext={viewContext}
      />

      {/* Desktop's kid switcher: the same top-right avatar the phone bar
          carries, floating over the corner (multi-kid families, on pages
          the selection affects). */}
      <DesktopContextSwitcher kids={kids} selected={viewContext} />

      <main className="quiet-shell__main">{children}</main>
    </div>
  );
}
