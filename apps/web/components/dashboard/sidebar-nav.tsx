"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, House, Sparkles } from "lucide-react";

/**
 * The sidebar's nav list. Client-side on purpose: the app frame renders
 * once in the /app layout and stays mounted across navigations, so the
 * active highlight can't come from page props anymore; it reads the
 * current pathname instead.
 */

/**
 * The app's tabs, the single source of truth: the desktop sidebar renders
 * them below, and the marketing Nav's phone menu reuses them for
 * signed-in visitors (same tabs, same icons, no drift).
 */
export const APP_NAV_ITEMS = [
  { href: "/app", label: "Ask Homa", icon: Sparkles },
  { href: "/app/dashboard", label: "Home", icon: House },
  { href: "/app/planner", label: "Week planner", icon: Calendar },
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {APP_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        // /app (chat, the default landing) matches exactly, never by
        // prefix: every app page lives under /app/, so a prefix match
        // would light the Ask Homa row on all of them.
        const active =
          href === "/app"
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "flex items-center gap-3 rounded-md bg-brand-soft px-3 py-2.5 text-[0.95rem] font-bold text-[var(--clay-700)]"
                : "flex items-center gap-3 rounded-md px-3 py-2.5 text-[0.95rem] font-medium text-muted transition-colors duration-(--dur-fast) ease-out hover:bg-page hover:text-body"
            }
          >
            <span className={active ? "text-brand" : "text-subtle"}>
              <Icon size={20} />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
