import {
  BookOpen,
  Calendar,
  ChartLine,
  ListChecks,
  Sparkles,
  type LucideIcon,
} from "lucide-react-native";

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
  icon: LucideIcon;
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: "/chat", label: "Chat", icon: Sparkles },
  { href: "/progress", label: "Progress", icon: ChartLine },
  { href: "/planner", label: "Planner", icon: Calendar },
  { href: "/binder", label: "Binder", icon: BookOpen },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
];
