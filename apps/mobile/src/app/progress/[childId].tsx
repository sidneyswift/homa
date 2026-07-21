import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useFamilyData } from "../../features/family/use-family-data";
import {
  ProgressPageScroll,
  ProgressView,
} from "../../features/progress/progress-view";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

/**
 * The per-child Progress stack route, the mobile twin of
 * apps/web/app/app/[childId]/progress/page.tsx: same body as the tab,
 * reached with an explicit child (deep links, taps from other screens),
 * with a back affordance instead of the tab frame. The childId is a
 * route param, but RLS decides what it can read: an id outside the
 * family reads nothing and lands on the not-found branch.
 */
export default function ChildProgressScreen() {
  const router = useRouter();
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const { children, loading, error } = useFamilyData();

  const child = children.find((entry) => entry.id === childId) ?? null;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.page }}
      edges={["top"]}
    >
      <ProgressPageScroll>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={{ minHeight: 40, justifyContent: "center" }}
        >
          <Text
            style={{
              fontFamily: fontFamilies.bodySemibold,
              fontSize: fontSize.base,
              color: colors.brand,
            }}
          >
            {"‹ Back"}
          </Text>
        </Pressable>

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
              "Your family's info is safe; it just didn't load this time. Going back and returning will retry."
            }
          </Text>
        ) : child === null ? (
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.base,
              color: colors.textBody,
            }}
          >
            This page could not find that child. Nothing was changed; the
            Progress tab has everyone.
          </Text>
        ) : (
          <ProgressView
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
            onSelectChild={(nextChildId) =>
              router.setParams({ childId: nextChildId })
            }
          />
        )}
      </ProgressPageScroll>
    </SafeAreaView>
  );
}
