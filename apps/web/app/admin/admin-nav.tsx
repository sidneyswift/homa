"use client";

import {
  Activity,
  ChartNoAxesColumn,
  Filter,
  ListTree,
  Mail,
  MessagesSquare,
  Palette,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The founder console's nav (MJ-14; Chats and Sessions added by the
 * 2026-07-13 deep view build). Client component only for the active
 * state; deliberately NOT wired into the parent app's APP_NAV_ITEMS, the
 * console lives on its own /admin segment.
 */

const ITEMS = [
  { href: "/admin", label: "Overview", icon: ChartNoAxesColumn },
  { href: "/admin/families", label: "Families", icon: Users },
  { href: "/admin/chats", label: "Chats", icon: MessagesSquare },
  { href: "/admin/sessions", label: "Sessions", icon: Activity },
  { href: "/admin/pulse", label: "Pulse", icon: ListTree },
  { href: "/admin/funnels", label: "Funnels", icon: Filter },
  { href: "/admin/drip", label: "Drip", icon: Mail },
  { href: "/admin/studio", label: "Studio", icon: Palette },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Founder console" className="flex gap-1 lg:flex-col">
      {ITEMS.map((item) => {
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "flex min-h-10 items-center gap-2.5 rounded-md bg-brand-soft px-3 py-2 text-[0.9rem] font-bold text-[var(--clay-700)]"
                : "flex min-h-10 items-center gap-2.5 rounded-md px-3 py-2 text-[0.9rem] font-medium text-muted transition-colors hover:bg-page hover:text-body"
            }
          >
            <Icon size={16} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
