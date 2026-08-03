"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "../../components/design/Icon";

/**
 * The founder console's nav (MJ-14; Chats and Sessions added by the
 * 2026-07-13 deep view build). Client component only for the active
 * state; deliberately NOT wired into the parent app's APP_NAV_ITEMS, the
 * console lives on its own /admin segment.
 */

const ITEMS = [
  { href: "/admin", label: "Overview", icon: "progress" },
  { href: "/admin/families", label: "Families", icon: "book" },
  { href: "/admin/chats", label: "Chats", icon: "chat" },
  { href: "/admin/sessions", label: "Sessions", icon: "tasks" },
  { href: "/admin/pulse", label: "Pulse", icon: "info" },
  { href: "/admin/funnels", label: "Funnels", icon: "next" },
  { href: "/admin/drip", label: "Drip", icon: "calendar" },
  { href: "/admin/makings", label: "Makings", icon: "add" },
  { href: "/admin/studio", label: "Studio", icon: "edit" },
  { href: "/admin/library", label: "Library", icon: "book" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Founder console" className="quiet-admin__nav flex gap-1 lg:flex-col">
      {ITEMS.map((item) => {
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "quiet-admin__nav-item quiet-admin__nav-item--active flex min-h-10 items-center gap-2.5 rounded-md px-3 py-2 text-[0.9rem] font-bold"
                : "quiet-admin__nav-item flex min-h-10 items-center gap-2.5 rounded-md px-3 py-2 text-[0.9rem] font-medium text-muted transition-colors"
            }
          >
            <Icon name={item.icon} className="quiet-admin__nav-icon" size={20} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
