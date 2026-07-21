import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Logo } from "../../components/brand/logo";
import { Button } from "../../components/ui/button";
import { useFamilyData } from "../../features/family/use-family-data";
import {
  ProgressPageScroll,
  ProgressView,
} from "../../features/progress/progress-view";
import { openWebOnboarding } from "../../lib/web-links";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

/**
 * The Progress tab, the mobile twin of apps/web/app/app/progress/page.tsx:
 * the stable route resolves to one child (the first, until a view
 * context exists on mobile) and the in-page switcher reaches the
 * others. Rendering itself lives in features/progress/progress-view.tsx.
 */
export default function ProgressTab() {
  const { children, loading, error, reload } = useFamilyData();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  // Progress is a per-visit read on the web (a fresh server render each
  // navigation); the focus tick gives the tab the same freshness.
  const [focusTick, setFocusTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void reload();
      setFocusTick((tick) => tick + 1);
    }, [reload]),
  );

  const child =
    children.find((entry) => entry.id === selectedChildId) ??
    children[0] ??
    null;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.page }}
      edges={["top"]}
    >
      <ProgressPageScroll>
        <Logo size={28} />
        {loading ? (
          <ActivityIndicator
            color={colors.brand}
            style={{ marginTop: space.xl }}
          />
        ) : error ? (
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.base,
              color: colors.textBody,
            }}
          >
            {
              "Your family's info is safe; it just didn't load this time. Switching tabs and back will retry."
            }
          </Text>
        ) : child === null ? (
          // Same never-set-up nudge as the Today tab: progress starts
          // with the family basics, and those live in web onboarding.
          <View style={{ gap: space.md }}>
            <Text
              style={{
                fontFamily: fontFamilies.display,
                fontSize: fontSize.xxl,
                lineHeight: fontSize.xxl * 1.1,
                color: colors.textStrong,
              }}
            >
              {"Progress lives here."}
            </Text>
            <Text
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                lineHeight: fontSize.base * 1.45,
                color: colors.textBody,
              }}
            >
              Once your family is set up, each child&apos;s progress appears
              on this tab. Start with the web onboarding so Homa has your
              family basics and your kids.
            </Text>
            <Button
              label="Open onboarding"
              size="lg"
              onPress={() => void openWebOnboarding()}
            />
          </View>
        ) : (
          <ProgressView
            key={`${child.id}:${focusTick}`}
            child={{
              id: child.id,
              name: child.name,
              // Historical column name; the value is the full birthday.
              birthDate: child.birth_month,
            }}
            kids={children.map((entry) => ({
              id: entry.id,
              name: entry.name,
            }))}
            onSelectChild={setSelectedChildId}
          />
        )}
      </ProgressPageScroll>
    </SafeAreaView>
  );
}
