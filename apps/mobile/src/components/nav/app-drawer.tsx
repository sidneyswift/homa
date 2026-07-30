import { Link } from "expo-router";
import { useEffect, useMemo } from "react";
import { X } from "lucide-react-native";
import { Animated, Dimensions, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountMenu } from "./account-menu";
import { SidebarNav } from "./sidebar-nav";
import { Logo } from "../brand/logo";
import { colors, radius, shadows, space } from "../../theme/tokens";

const DRAWER_WIDTH = Math.min(300, Dimensions.get("window").width * 0.85);

/**
 * Ported from apps/web/components/dashboard/mobile-nav.tsx's drawer:
 * a backdrop scrim plus a panel sliding in from the left, holding the
 * exact same content as web's rail (SidebarNav, AccountMenu). Web's
 * per-kid ViewingRows/ContextSwitcher are deliberately not ported yet
 * (they need view-context session state this app doesn't have), so a
 * single-kid family's "My kids" row and a multi-kid family's switcher
 * are both a known gap, not a silent one.
 *
 * Deliberately NOT React Native's own `Modal`: rendering as a plain
 * absolutely-positioned overlay inside the app's own view hierarchy is
 * simpler and shares the same ambient safe-area context as the rest of
 * the app, with no need for a second, nested SafeAreaProvider.
 */
export function AppDrawer({
  open,
  onClose,
  parentName,
  familyName,
}: {
  open: boolean;
  onClose: () => void;
  parentName: string;
  familyName: string;
}) {
  // useMemo, not useRef: the new react-hooks/refs lint rule forbids
  // reading .current during render at all, including the ordinary RN
  // pattern of feeding an Animated.Value into a style prop. A memoized
  // value (not a ref) sidesteps that while staying stable across
  // re-renders the same way.
  const translateX = useMemo(() => new Animated.Value(-DRAWER_WIDTH), []);
  const backdropOpacity = useMemo(() => new Animated.Value(0), []);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: open ? 0 : -DRAWER_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start();
    Animated.timing(backdropOpacity, {
      toValue: open ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [open, translateX, backdropOpacity]);

  return (
    <View
      style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
      pointerEvents={open ? "auto" : "none"}
    >
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: "rgba(51,42,33,0.42)",
          opacity: backdropOpacity,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onPress={onClose}
          style={{ flex: 1 }}
        />
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: DRAWER_WIDTH,
          transform: [{ translateX }],
          backgroundColor: colors.card,
          borderTopRightRadius: radius.xl,
          borderBottomRightRadius: radius.xl,
          ...shadows.md,
        }}
      >
        <View
          style={{
            flex: 1,
            padding: space.md,
            paddingTop: insets.top + space.md,
            paddingBottom: insets.bottom + space.md,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: space.xs,
              paddingBottom: space.lg,
            }}
          >
            <Link href="/chat" onPress={onClose} asChild>
              <Pressable accessibilityRole="button" accessibilityLabel="Home">
                <Logo size={26} />
              </Pressable>
            </Link>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close menu"
              onPress={onClose}
              hitSlop={8}
              style={{ padding: space.xs }}
            >
              <X size={20} color={colors.textSubtle} />
            </Pressable>
          </View>

          <View style={{ flex: 1 }}>
            <SidebarNav onNavigate={onClose} />
          </View>

          <AccountMenu parentName={parentName} familyName={familyName} onNavigate={onClose} />
        </View>
      </Animated.View>
    </View>
  );
}
