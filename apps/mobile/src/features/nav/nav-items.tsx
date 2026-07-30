import {
  BookOpen,
  Calendar,
  CalendarDays,
  ChartLine,
  Clock,
  ListChecks,
  Sparkles,
  type LucideIcon,
} from "lucide-react-native";

/**
 * The app's nav destinations, ported from web's APP_NAV_ITEMS
 * (apps/web/components/dashboard/sidebar-nav.tsx), same order, same
 * icons (lucide, the RN port of the exact set web uses), same single
 * source of truth. Routes are absolute Expo Router paths; route
 * groups do not appear in the URL, so these stay stable regardless of
 * which folder actually holds each screen.
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
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/hours", label: "Hours", icon: Clock },
  { href: "/binder", label: "Binder", icon: BookOpen },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
];
