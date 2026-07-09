import Link from "next/link";
import type { ReactNode } from "react";

import type { UpNextItem } from "../../lib/dashboard";
import { Logo } from "../brand/Logo";
import { signOutAction } from "../../app/signin/actions";
import { Sidebar, type ActiveNav, type SidebarKid } from "./sidebar";

/**
 * The /home app frame: the template's floating sidebar beside a scrolling
 * main column on desktop, a slim sticky top bar on phones (the design kit
 * is desktop-only; BUILD.md says every surface must work on a phone).
 */

export function DashboardShell({
  parentName,
  familyName,
  avatarUrl,
  kids,
  upNext,
  active = "home",
  children,
}: {
  parentName: string;
  familyName: string;
  avatarUrl: string | null;
  kids: SidebarKid[];
  upNext: UpNextItem[];
  active?: ActiveNav;
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
        active={active}
      />

      {/* Phone header: wordmark home link, chat, sign out. */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border-subtle bg-page/95 px-5 py-3 backdrop-blur lg:hidden">
        <Link href="/home" aria-label="Home" className="inline-flex rounded-md">
          <Logo size={24} />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/chat"
            className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover"
          >
            Ask Homa
          </Link>
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

      <main className="min-w-0 flex-1 px-5 py-7 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-[1040px]">{children}</div>
      </main>
    </div>
  );
}
