"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Calendar,
  CalendarDays,
  ChartLine,
  Clock,
  LibraryBig,
  ListChecks,
  Sparkles,
} from "lucide-react";

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
  { href: "/app", label: "Chat", icon: Sparkles },
  { href: "/app/progress", label: "Progress", icon: ChartLine },
  { href: "/app/planner", label: "Planner", icon: Calendar },
  { href: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/app/hours", label: "Hours", icon: Clock },
  { href: "/app/library", label: "Library", icon: LibraryBig },
  { href: "/app/binder", label: "Binder", icon: BookOpen },
  { href: "/app/tasks", label: "Tasks", icon: ListChecks },
] as const;

const KID_PROGRESS_PATH = /^\/app\/[^/]+\/progress$/;
const LEGACY_REPORT_PATH = /^\/app\/(?:[^/]+\/)?report$/;

export function isAppNavItemActive(
  href: string,
  pathname: string,
): boolean {
  if (href === "/app") return pathname === href;
  if (href === "/app/progress") {
    return (
      pathname === href ||
      KID_PROGRESS_PATH.test(pathname) ||
      LEGACY_REPORT_PATH.test(pathname)
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {APP_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isAppNavItemActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "flex min-h-11 items-center gap-3 rounded-md bg-brand-soft px-3 py-2.5 text-[0.95rem] font-bold text-[var(--clay-700)]"
                : "flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-[0.95rem] font-medium text-muted transition-colors duration-(--dur-fast) ease-out hover:bg-page hover:text-body"
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
