import Link from "next/link";

import type { UpNextItem } from "../../lib/dashboard";
import { Logo } from "../brand/Logo";
import { AccountMenu } from "./account-menu";
import { ViewingRows } from "./context-switcher";
import { SidebarNav } from "./sidebar-nav";

/**
 * The app's left rail, ported from the design system's web-app template
 * (docs/homa-design/templates/web-app/WebApp.dc.html): floating white
 * card, nav, an "up next" box, the viewing rows (the kit's "kid
 * switcher"; founder ruling 2026-07-10 merged the old "My kids" link
 * list into it, two kid lists in one rail was one too many), and the
 * account footer (AccountMenu: the name row opens Settings and Sign
 * out). Rendered once by the /app layout, so it stays mounted while
 * pages change; nav links only to surfaces that exist (the library row
 * joins when that page lands). SidebarContent is the shared inside: the
 * desktop <aside> here and the phone drawer (mobile-nav.tsx) both render
 * it, so the two never drift apart.
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

const DOT_COLOR: Record<UpNextItem["dot"], string> = {
  sage: "var(--sage-500)",
  clay: "var(--clay-400)",
  stone: "var(--stone-300)",
};

export interface SidebarProps {
  parentName: string;
  familyName: string;
  avatarUrl: string | null;
  kids: SidebarKid[];
  upNext: UpNextItem[];
  /** Who the parent is viewing: "family" or one of the kids' ids
   * (validated by the layout against the family's own children). */
  viewContext: string;
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="sticky top-3.5 m-3.5 hidden h-[calc(100dvh-28px)] w-[248px] shrink-0 flex-col rounded-[var(--radius-xl)] border border-border-subtle bg-card p-3.5 shadow-[var(--shadow-md)] lg:flex print:hidden">
      <div className="px-2.5 pb-5 pt-1">
        {/* The wordmark is a home link everywhere (tester ask, memo 2). */}
        <Link href="/app" aria-label="Home" className="inline-flex rounded-md">
          <Logo size={26} />
        </Link>
      </div>

      <SidebarContent {...props} />
    </aside>
  );
}

/**
 * Everything inside the rail below the logo: nav, up next, kids, account.
 * A fragment on purpose, both hosts are flex columns and AccountMenu's
 * mt-auto needs to push against them directly.
 */
export function SidebarContent({
  parentName,
  familyName,
  avatarUrl,
  kids,
  upNext,
  viewContext,
}: SidebarProps) {
  return (
    <>
      <SidebarNav />

      <div className="mt-6 rounded-lg bg-page px-3.5 py-3.5">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-subtle">
          Up next
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {upNext.map((item) => {
            const row = (
              <>
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: DOT_COLOR[item.dot] }}
                />
                <span className="min-w-0">
                  <span className="block text-[0.82rem] font-medium leading-snug text-body">
                    {item.label}
                  </span>
                  {item.sub ? (
                    <span className="block text-[0.72rem] text-subtle">{item.sub}</span>
                  ) : null}
                </span>
              </>
            );
            return (
              <li key={item.key}>
                {item.href ? (
                  <Link href={item.href} className="flex gap-2.5 rounded-md py-0.5 hover:text-brand">
                    {row}
                  </Link>
                ) : (
                  <span className="flex gap-2.5 py-0.5">{row}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* The one kid list: switcher rows for multi-kid families, a plain
          kid-page link for single-kid ones (see ViewingRows). */}
      <ViewingRows kids={kids} selected={viewContext} />

      <AccountMenu parentName={parentName} familyName={familyName} avatarUrl={avatarUrl} />
    </>
  );
}
