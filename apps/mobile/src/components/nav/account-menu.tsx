import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { LogOut, Settings } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { useAccessibilityFocusOnChange } from "../../lib/accessibility";
import { supabase } from "../../lib/supabase";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, shadows, space } from "../../theme/tokens";

/**
 * Ported from apps/web/components/dashboard/account-menu.tsx: the
 * sidebar's account footer, an avatar + name row that opens a small
 * menu (Settings, Sign out) above itself. No avatarUrl on mobile yet
 * (web's migration #75 photo field isn't selected here), so this
 * always shows the initial-letter circle, which is web's own fallback
 * too, not a mobile-specific gap.
 */
export function AccountMenu({
  parentName,
  familyName,
  onNavigate,
}: {
  parentName: string;
  familyName: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const firstActionRef = useRef<View>(null);
  useAccessibilityFocusOnChange(firstActionRef, open ? "account-menu-open" : null);

  async function handleSignOut() {
    setOpen(false);
    onNavigate?.();
    await supabase.auth.signOut();
    router.replace("/signin");
  }

  function handleSettings() {
    setOpen(false);
    onNavigate?.();
    router.push("/settings");
  }

  return (
    <View
      style={{
        position: "relative",
        paddingTop: space.sm,
        borderTopWidth: 1,
        borderTopColor: colors.borderSubtle,
      }}
    >
      {open ? (
        <View
          accessibilityRole="menu"
          accessibilityLabel="Account actions"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "100%",
            marginBottom: space.sm,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            backgroundColor: colors.card,
            padding: space.xs,
            ...shadows.md,
          }}
        >
          <Pressable
            ref={firstActionRef}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
            onPress={handleSettings}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: space.sm,
              borderRadius: radius.xs,
              minHeight: 44,
              paddingHorizontal: space.sm,
              paddingVertical: 10,
              backgroundColor: pressed ? colors.page : "transparent",
            })}
          >
            <Settings size={16} color={colors.textSubtle} />
            <Text
              style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.textBody }}
            >
              Settings
            </Text>
          </Pressable>
          <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginVertical: space.xs }} />
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel="Sign out of Homa"
            onPress={() => void handleSignOut()}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: space.sm,
              borderRadius: radius.xs,
              minHeight: 44,
              paddingHorizontal: space.sm,
              paddingVertical: 10,
              backgroundColor: pressed ? colors.page : "transparent",
            })}
          >
            <LogOut size={16} color={colors.textSubtle} />
            <Text
              style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.textBody }}
            >
              Sign out
            </Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        accessible
        accessibilityRole="button"
        accessibilityLabel={`Account menu for ${parentName}, ${familyName}`}
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? "Shows Settings and Sign out" : "Opens Settings and Sign out"}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          borderRadius: radius.sm,
          minHeight: 44,
          paddingHorizontal: space.xs,
          paddingVertical: space.xs,
          backgroundColor: pressed ? colors.page : "transparent",
        })}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: colors.success,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: fontSize.base, color: colors.onBrand }}>
            {parentName.charAt(0)}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}
          >
            {parentName}
          </Text>
          <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
            {familyName}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
