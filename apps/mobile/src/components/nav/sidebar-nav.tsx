import { Link, usePathname } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { APP_NAV_ITEMS, type AppNavItem } from "../../features/nav/nav-items";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, palette, radius, space } from "../../theme/tokens";

/** Ported from apps/web/components/dashboard/sidebar-nav.tsx's
 *  isAppNavItemActive: exact-match or any sub-path counts as active. */
function isNavItemActive(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * A function-form `style` prop on the child of `Link asChild` gets silently
 * dropped: expo-router renders that child through its `Slot`, which merges
 * props via Radix's react-slot, and spreading a function into an object
 * (`{...slotStyle, ...childStyle}`) copies none of its own properties. The
 * Pressable was left with no style at all, so it fell back to RN's default
 * column flex, stacking the icon above the label instead of beside it
 * (caught live: every drawer row rendered icon-over-text). A plain style
 * object, with press feedback tracked as local state instead of via the
 * function-style callback, survives the merge intact.
 */
function NavRow({
  item,
  active,
  onNavigate,
}: {
  item: AppNavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const Icon = item.icon;

  return (
    <Link href={item.href} onPress={onNavigate} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: active }}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          minHeight: 44,
          borderRadius: radius.sm,
          paddingHorizontal: space.md,
          paddingVertical: 10,
          backgroundColor: active
            ? colors.brandSoft
            : pressed
              ? colors.surfaceSunken
              : "transparent",
        }}
      >
        <Icon size={20} color={active ? colors.brand : colors.textSubtle} />
        <Text
          style={{
            fontFamily: active ? fontFamilies.bodyBold : fontFamilies.bodyMedium,
            fontSize: fontSize.base,
            color: active ? palette.clay700 : colors.textMuted,
          }}
        >
          {item.label}
        </Text>
      </Pressable>
    </Link>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <View style={{ gap: 2 }}>
      {APP_NAV_ITEMS.map((item) => (
        <NavRow
          key={item.href}
          item={item}
          active={isNavItemActive(item.href, pathname)}
          onNavigate={onNavigate}
        />
      ))}
    </View>
  );
}
