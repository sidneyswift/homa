import type { SemanticIconName } from "@homa/design/contract";

/**
 * The app's nav destinations. Ported from web's APP_NAV_ITEMS
 * (apps/web/components/dashboard/sidebar-nav.tsx). Planner now owns
 * Day, Week, Month, and Hours on both platforms, so there is no second
 * Calendar or Hours destination. Routes are absolute Expo Router paths;
 * route groups do not appear in the URL.
 */
export interface AppNavItem {
  href: string;
  label: string;
  icon: SemanticIconName;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: "/chat", label: "Chat", icon: "chat" },
  { href: "/progress", label: "Progress", icon: "progress" },
  { href: "/planner", label: "Planner", icon: "calendar" },
  { href: "/binder", label: "Binder", icon: "book" },
  { href: "/tasks", label: "Tasks", icon: "tasks" },
];
