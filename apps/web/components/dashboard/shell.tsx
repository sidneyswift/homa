import Link from "next/link";
import type { ReactNode } from "react";
import { Settings } from "lucide-react";

import type { UpNextItem } from "../../lib/dashboard";
import { Logo } from "../brand/Logo";
import { signOutAction } from "../../app/signin/actions";
import { AskHomaLink } from "./ask-homa-link";
import { Sidebar, type SidebarKid } from "./sidebar";

/**
 * The signed-in app frame: the template's floating sidebar beside a main
 * column on desktop, a slim sticky top bar on phones (the design kit is
 * desktop-only; BUILD.md says every surface must work on a phone).
 * Rendered once by the (app) layout so it persists across navigations;
 * pages bring their own inner geometry (PageColumn for scrolling
 * dashboards, a viewport-height column for chat). The top bar's h-14 is
 * load-bearing: chat's phone height is 100dvh minus exactly this bar.
 */

export function DashboardShell({
  parentName,
  familyName,
  avatarUrl,
  kids,
  upNext,
  children,
}: {
  parentName: string;
  familyName: string;
  avatarUrl: string | null;
  kids: SidebarKid[];
  upNext: UpNextItem[];
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
      />

      {/* Phone header: wordmark home link, settings, chat, sign out. The
          gear lives here because the sidebar (and its gear) is
          desktop-only; without it phones would have no path to /settings. */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border-subtle bg-page/95 px-5 backdrop-blur lg:hidden">
        <Link href="/home" aria-label="Home" className="inline-flex rounded-md">
          <Logo size={24} />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            aria-label="Settings"
            className="rounded-md p-1.5 text-subtle transition-colors duration-(--dur-fast) ease-out hover:bg-page hover:text-body"
          >
            <Settings size={20} />
          </Link>
          <AskHomaLink />
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-pill border border-border bg-card px-4 py-2 text-sm text-strong transition-colors hover:border-brand"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
