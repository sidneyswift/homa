import {
  BookOpen,
  Calendar,
  ChartLine,
  Clock,
  ListChecks,
  Sparkles,
  type LucideIcon,
} from "lucide-react-native";

/**
 * The app's nav destinations. Ported from web's APP_NAV_ITEMS
 * (apps/web/components/dashboard/sidebar-nav.tsx) with one deliberate
 * difference: web still lists Planner and Calendar separately (its own
 * consolidation arc hasn't shipped, per docs/homa-planning/plans/
 * 2026-07-27-planner-calendar-ecosystem.md), but founder direction
 * 2026-07-29 merged them into one mobile Planner tab with day/week/
 * month views, so there is no separate Calendar entry here. Routes are
 * absolute Expo Router paths; route groups do not appear in the URL, so
 * these stay stable regardless of which folder actually holds each
 * screen.
 */
export interface AppNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: "/chat", label: "Chat", icon: Sparkles },
  { href: "/progress", label: "Progress", icon: ChartLine },
  { href: "/planner", label: "Planner", icon: Calendar },
  { href: "/hours", label: "Hours", icon: Clock },
  { href: "/binder", label: "Binder", icon: BookOpen },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
];
