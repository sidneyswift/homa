import Link from "next/link";

import { Logo } from "../brand/Logo";
import { QuietFrame } from "../design/QuietFrame";
import { AccountMenu } from "./account-menu";
import { ViewingRows } from "./context-switcher";
import { SidebarNav } from "./sidebar-nav";

/**
 * The app's left rail, ported from the former web-app template: floating
 * surface, nav, and the account footer (AccountMenu: the name row opens
 * Settings and Sign out). The kid rows left the desktop rail (founder
 * ruling 2026-07-12: the kid switcher is the top-right avatar,
 * DesktopContextSwitcher, same corner as the phone bar's) and the phone
 * drawer's switcher rows retired too (2026-07-18), since that avatar
 * already covers multi-kid switching; the drawer keeps only a single-kid
 * "My kids" link (see ViewingRows).
 * Rendered once by the /app layout, so it stays mounted while pages
 * change; nav links only to surfaces that exist (the library row joins
 * when that page lands). SidebarContent is the shared inside: the
 * desktop rail here and the phone drawer (mobile-nav.tsx) both render
 * it, and the withViewingRows switch is the one deliberate difference.
 * The desktop host is a div on purpose because browser content filters
 * can hide generic aside elements; its explicit role preserves the prior
 * landmark.
 */

export interface SidebarKid {
  id: string;
  name: string;
  ageMonths: number;
  /** The kid's profile photo (migration #75); null keeps the initial. */
  avatarUrl: string | null;
}

// The tone helper moved to kid-avatar.tsx with the photo work
// (migration #75); the re-export keeps this module the import point
// every surface already uses.
export { avatarTone } from "./kid-avatar";

export interface SidebarProps {
  parentName: string;
  familyName: string;
  avatarUrl: string | null;
  kids: SidebarKid[];
  /** Who the parent is viewing: "family" or one of the kids' ids
   * (validated by the layout against the family's own children). */
  viewContext: string;
}

export function Sidebar(props: SidebarProps) {
  return (
    <QuietFrame
      as="div"
      tone="paper"
      data-app-sidebar=""
      role="complementary"
      aria-label="App sidebar"
      className="app-sidebar quiet-shell__rail"
    >
      <div className="quiet-shell__rail-logo">
        {/* The wordmark is a home link everywhere (tester ask, memo 2). */}
        <Link href="/app" aria-label="Home" className="quiet-shell__logo">
          <Logo size={26} />
        </Link>
      </div>

      {/* The rail carries no kid rows: desktop's switcher is the
          top-right avatar (DesktopContextSwitcher, in the shell). */}
      <SidebarContent {...props} withViewingRows={false} />
    </QuietFrame>
  );
}

/**
 * Everything inside the rail below the logo: nav, the kid rows (drawer
 * only), account. A fragment on purpose, both hosts are flex columns
 * and AccountMenu's mt-auto needs to push against them directly.
 */
export function SidebarContent({
  parentName,
  familyName,
  avatarUrl,
  kids,
  withViewingRows,
}: SidebarProps & {
  /** True in the phone drawer (the drawer is the whole sidebar), false
   * in the desktop rail, whose switcher is the top-right avatar. */
  withViewingRows: boolean;
}) {
  return (
    <>
      <SidebarNav />

      {withViewingRows ? (
        // The drawer's "My kids" link, single-kid families only: multi-kid
        // families switch from the top-right avatar, so ViewingRows no
        // longer repeats a switcher here (see ViewingRows).
        <ViewingRows kids={kids} />
      ) : null}

      <AccountMenu parentName={parentName} familyName={familyName} avatarUrl={avatarUrl} />
    </>
  );
}
