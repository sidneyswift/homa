import Link from "next/link";

import { Logo } from "../brand/Logo";
import { AccountMenu } from "./account-menu";
import { ViewingRows } from "./context-switcher";
import { SidebarNav } from "./sidebar-nav";

/**
 * The app's left rail, ported from the design system's web-app template
 * (docs/homa-design/templates/web-app/WebApp.dc.html): floating white
 * card, nav, the viewing rows (the kit's "kid switcher"; founder ruling
 * 2026-07-10 merged the old "My kids" link list into it, two kid lists
 * in one rail was one too many), and the account footer (AccountMenu:
 * the name row opens Settings and Sign out). Rendered once by the /app
 * layout, so it stays mounted while pages change; nav links only to
 * surfaces that exist (the library row joins when that page lands).
 * SidebarContent is the shared inside: the desktop rail here and the phone
 * drawer (mobile-nav.tsx) both render it, so the two never drift apart. The
 * desktop host is a div on purpose because browser content filters can hide
 * generic aside elements; its explicit role preserves the prior landmark.
 */

export interface SidebarKid {
  id: string;
  name: string;
  ageMonths: number;
}

const AVATAR_TONES: ReadonlyArray<readonly [string, string]> = [
  ["var(--clay-100)", "var(--clay-700)"],
  ["var(--sky-100)", "var(--sky-600)"],
  ["var(--sage-100)", "var(--sage-700)"],
  ["var(--gold-100)", "var(--gold-ink)"],
];

/** Deterministic avatar tone per list position, shared with KidCard. */
export function avatarTone(index: number): readonly [string, string] {
  return AVATAR_TONES[index % AVATAR_TONES.length];
}

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
    <div
      data-app-sidebar=""
      role="complementary"
      aria-label="App sidebar"
      className="app-sidebar sticky top-3.5 m-3.5 h-[calc(100dvh-28px)] w-[248px] shrink-0 flex-col rounded-[var(--radius-xl)] border border-border-subtle bg-card p-3.5 shadow-[var(--shadow-md)]"
    >
      <div className="px-2.5 pb-5 pt-1">
        {/* The wordmark is a home link everywhere (tester ask, memo 2). */}
        <Link href="/app" aria-label="Home" className="inline-flex rounded-md">
          <Logo size={26} />
        </Link>
      </div>

      <SidebarContent {...props} />
    </div>
  );
}

/**
 * Everything inside the rail below the logo: nav, kids, account.
 * A fragment on purpose, both hosts are flex columns and AccountMenu's
 * mt-auto needs to push against them directly.
 */
export function SidebarContent({
  parentName,
  familyName,
  avatarUrl,
  kids,
  viewContext,
}: SidebarProps) {
  return (
    <>
      <SidebarNav />

      {/* The one kid list: switcher rows for multi-kid families, a plain
          kid-page link for single-kid ones (see ViewingRows). */}
      <ViewingRows kids={kids} selected={viewContext} />

      <AccountMenu parentName={parentName} familyName={familyName} avatarUrl={avatarUrl} />
    </>
  );
}
