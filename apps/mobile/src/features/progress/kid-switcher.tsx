import { Pressable, ScrollView, Text } from "react-native";

import type { ChildRecord } from "../../lib/family";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";

/**
 * Ported from apps/web/components/progress/progress-view.tsx's inline
 * KidSwitcher: a flat row of pills, one per family kid, the current
 * one highlighted. Web only shows this at 2+ kids; mobile does the
 * same. No view-context cookie involved on either side: Progress picks
 * a kid by navigating straight to that kid's own view.
 */
export function KidSwitcher({
  kids,
  selectedChildId,
  onSelect,
}: {
  kids: ChildRecord[];
  selectedChildId: string;
  onSelect: (childId: string) => void;
}) {
  if (kids.length < 2) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.sm, paddingBottom: space.sm }}
    >
      {kids.map((kid) => {
        const active = kid.id === selectedChildId;
        return (
          <Pressable
            key={kid.id}
            onPress={() => onSelect(kid.id)}
            style={{
              paddingHorizontal: space.md,
              paddingVertical: space.sm,
              borderRadius: radius.pill,
              backgroundColor: active ? colors.brand : colors.card,
              borderWidth: 1,
              borderColor: active ? colors.brand : colors.borderSubtle,
            }}
          >
            <Text
              style={{
                fontFamily: active ? fontFamilies.bodySemibold : fontFamilies.bodyMedium,
                fontSize: fontSize.sm,
                color: active ? colors.onBrand : colors.textBody,
              }}
            >
              {kid.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
