import { Redirect, Tabs } from "expo-router";

import {
  ChatTabIcon,
  MoreTabIcon,
  PlannerTabIcon,
  ProgressTabIcon,
  TodayTabIcon,
} from "../../components/ui/tab-icons";
import { useSession } from "../../features/auth/session-provider";
import { fontFamilies } from "../../theme/fonts";
import { colors } from "../../theme/tokens";

/**
 * The signed-in shell: Today, Chat, Planner, Progress, More. Family,
 * Tasks, Binder, and Settings live behind More; five slots is where an
 * iOS tab bar stops being scannable. The session guard here is the
 * mobile twin of proxy.ts route gating; RLS enforces data access no
 * matter what renders.
 */
export default function TabsLayout() {
  const { session } = useSession();
  if (!session) return <Redirect href="/signin" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.page },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.borderSubtle,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamilies.bodyMedium,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => (
            <TodayTabIcon color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color, size }) => (
            <ChatTabIcon color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="planner"
        options={{
          title: "Planner",
          tabBarIcon: ({ color, size }) => (
            <PlannerTabIcon color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: "Progress",
          tabBarIcon: ({ color, size }) => (
            <ProgressTabIcon color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => (
            <MoreTabIcon color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
