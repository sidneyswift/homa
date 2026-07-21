import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { PlannerBoard } from "../../features/planner/planner-board";
import { usePlannerData } from "../../features/planner/use-planner-data";
import { effectiveTimeZone, weekSpanLabel } from "../../features/planner/week";
import { openWebOnboarding } from "../../lib/web-links";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

/**
 * Planner: the family's week, from the plans that actually exist. The
 * mobile twin of apps/web/app/app/planner/page.tsx, with the same
 * states: setup unfinished (offer the web onboarding, web redirects
 * instead), no month yet (the board's empty state), or the week board.
 * Auth is the tab layout's session guard; data access is enforced by
 * RLS regardless. Read-only board, see planner-board.tsx.
 */
export default function PlannerScreen() {
  const router = useRouter();
  const { data, loading, setupIncomplete, error, reload } = usePlannerData();
  // One clock per focus visit, so the board and the header agree on the
  // week and a render never straddles midnight.
  const [now, setNow] = useState(() => new Date());

  // Re-read on focus so a month built on the web (or a check-off made
  // there) shows up without an app restart, same as the Today tab.
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      void reload();
    }, [reload]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View style={{ gap: space.xs }}>
          {data ? (
            <Text
              style={{
                fontFamily: fontFamilies.bodyBold,
                fontSize: 11,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: colors.textSubtle,
              }}
            >
              This week {"·"} {weekSpanLabel(now, effectiveTimeZone(data.timeZone))}
            </Text>
          ) : null}
          <Text
            style={{
              fontFamily: fontFamilies.display,
              fontSize: fontSize.xxl,
              lineHeight: fontSize.xxl * 1.1,
              color: colors.textStrong,
            }}
          >
            Your week
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: space.xl }} />
        ) : error ? (
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.base,
              color: colors.textBody,
            }}
          >
            {
              "Your week is safe; it just didn't load this time. Switching tabs and back will retry."
            }
          </Text>
        ) : setupIncomplete || !data ? (
          <View style={{ gap: space.md }}>
            <Text
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                color: colors.textBody,
              }}
            >
              Your week fills in here once setup is done. Start with the web
              onboarding so Homa has your family basics and your kids.
            </Text>
            <Button label="Open onboarding" size="lg" onPress={() => void openWebOnboarding()} />
          </View>
        ) : (
          <View style={{ gap: space.lg }}>
            <PlannerBoard data={data} timeZone={effectiveTimeZone(data.timeZone)} now={now} />
            <Button
              label="Ask Homa to adjust the week"
              variant="secondary"
              onPress={() => router.push("/chat")}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
