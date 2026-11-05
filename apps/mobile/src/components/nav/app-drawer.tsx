import { Link } from "expo-router";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountMenu } from "./account-menu";
import { SidebarNav } from "./sidebar-nav";
import { Logo } from "../brand/logo";
import { Icon } from "../design/icon";
import { IconButton } from "../ui/icon-button";
import { sendAccessibilityFocus } from "../../lib/accessibility";
import { colors, radius, shadows, space } from "../../theme/app2";

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
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  parentName: string;
  familyName: string;
  returnFocusRef?: RefObject<View | null>;
}) {
  // useMemo, not useRef: the new react-hooks/refs lint rule forbids
  // reading .current during render at all, including the ordinary RN
  // pattern of feeding an Animated.Value into a style prop. A memoized
  // value (not a ref) sidesteps that while staying stable across
  // re-renders the same way.
  const translateX = useMemo(() => new Animated.Value(-DRAWER_WIDTH), []);
  const backdropOpacity = useMemo(() => new Animated.Value(0), []);
  const closeButtonRef = useRef<View>(null);
  const wasOpen = useRef(false);
  const restoreFocusOnClose = useRef(true);
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const previousOpen = wasOpen.current;
    wasOpen.current = open;
    if (open && !previousOpen) restoreFocusOnClose.current = true;
    const duration = reducedMotion ? 0 : 220;
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: open ? 0 : -DRAWER_WIDTH,
        duration,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: open ? 1 : 0,
        duration,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished || (!previousOpen && !open)) return;
      const target = open
        ? closeButtonRef.current
        : restoreFocusOnClose.current
          ? returnFocusRef?.current
          : null;
      sendAccessibilityFocus(target);
      if (!open) restoreFocusOnClose.current = true;
    });
  }, [backdropOpacity, open, reducedMotion, returnFocusRef, translateX]);

  function dismissDrawer() {
    restoreFocusOnClose.current = true;
    onClose();
  }

  function closeForNavigation() {
    restoreFocusOnClose.current = false;
    onClose();
  }

  return (
    <View
      style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
      pointerEvents={open ? "auto" : "none"}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? "yes" : "no-hide-descendants"}
    >
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: "rgba(51,42,33,0.42)",
          opacity: backdropOpacity,
        }}
      >
        <Pressable
          onPress={dismissDrawer}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flex: 1 }}
        />
      </Animated.View>

      <Animated.View
        accessibilityViewIsModal={open}
        onAccessibilityEscape={dismissDrawer}
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
            <Link href="/chat" onPress={closeForNavigation} asChild>
              <Pressable accessibilityRole="link" accessibilityLabel="Homa home" style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
                <Logo size={26} />
              </Pressable>
            </Link>
            <IconButton
              ref={closeButtonRef}
              label="Close menu"
              onPress={dismissDrawer}
            >
              <Icon name="close" size={20} color={colors.textSubtle} />
            </IconButton>
          </View>

          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ flex: 1 }}>
              <SidebarNav onNavigate={closeForNavigation} />
            </View>
            <AccountMenu parentName={parentName} familyName={familyName} onNavigate={closeForNavigation} />
          </ScrollView>
        </View>
      </Animated.View>
    </View>
  );
}
