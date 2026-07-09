"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, House, Sparkles } from "lucide-react";

/**
 * The sidebar's nav list. Client-side on purpose: the app frame renders
 * once in the (app) layout and stays mounted across navigations, so the
 * active highlight can't come from page props anymore; it reads the
 * current pathname instead.
 */

const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: House },
  { href: "/chat", label: "Ask Homa", icon: Sparkles },
  { href: "/planner", label: "Week planner", icon: Calendar },
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
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
