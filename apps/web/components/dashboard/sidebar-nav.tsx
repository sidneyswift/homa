"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon, type SemanticIconName } from "../design/Icon";

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
  { href: "/app", label: "Chat", icon: "chat", group: "primary" },
  { href: "/app/progress", label: "Progress", icon: "progress", group: "primary" },
  { href: "/app/planner", label: "Planner", icon: "calendar", group: "primary" },
  { href: "/app/tasks", label: "Tasks", icon: "tasks", group: "primary" },
  { href: "/app/library", label: "Library", icon: "book", group: "work" },
  { href: "/app/binder", label: "Binder", icon: "book", group: "work" },
  { href: "/app/hours", label: "Hours", icon: "time", group: "work" },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  icon: SemanticIconName;
  group: "primary" | "work";
}>;

export type AppNavItem = (typeof APP_NAV_ITEMS)[number];

export const APP_NAV_GROUPS = [
  { id: "primary", label: null, items: APP_NAV_ITEMS.filter((item) => item.group === "primary") },
  { id: "work", label: "Your work", items: APP_NAV_ITEMS.filter((item) => item.group === "work") },
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
    <nav className="quiet-shell__nav" aria-label="Homa workspace">
      {APP_NAV_GROUPS.map(({ id, label, items }) => (
        <div key={id} className={`quiet-shell__nav-group quiet-shell__nav-group--${id}`}>
          {label ? <p className="quiet-shell__nav-group-label">{label}</p> : null}
          <div className="quiet-shell__nav-group-items">
            {items.map(({ href, label: itemLabel, icon }) => {
              const active = isAppNavItemActive(href, pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`quiet-shell__nav-item${active ? " quiet-shell__nav-item--active" : ""}`}
                >
                  <span className="quiet-shell__nav-icon">
                    <Icon name={icon} size={20} />
                  </span>
                  {itemLabel}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
