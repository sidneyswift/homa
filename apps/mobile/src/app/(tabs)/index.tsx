import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ageInMonths, ageLabel } from "@homa/core";

import { Logo } from "../../components/brand/logo";
import { SettingsGlyph } from "../../components/ui/tab-icons";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useFamilyData } from "../../features/family/use-family-data";
import { openWebOnboarding } from "../../lib/web-links";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

/**
 * Today: the signed-in landing, mirroring apps/web/app/app/page.tsx's
 * three states: no family yet, family with no kids, or ready (kids
 * listed, chat one tap away).
 */
export default function TodayScreen() {
  const router = useRouter();
  const { family, children, memberDisplayName, loading, error, reload } = useFamilyData();
  const readyFamily = family?.profile_completed_at && children.length > 0 ? family : null;

  // Re-read on focus so changes made in the Family tab (or on the web)
  // show up without an app restart.
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Logo size={28} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push("/settings")}
            hitSlop={12}
          >
            <SettingsGlyph color={colors.textMuted} size={24} />
          </Pressable>
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
              "Your family's info is safe; it just didn't load this time. Switching tabs and back will retry."
            }
          </Text>
        ) : !readyFamily ? (
          <View style={{ gap: space.md }}>
            <Text
              style={{
                fontFamily: fontFamilies.display,
                fontSize: fontSize.xxl,
                lineHeight: fontSize.xxl * 1.1,
                color: colors.textStrong,
              }}
            >
              {"Welcome. Let's finish your setup."}
            </Text>
            <Text
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                color: colors.textBody,
              }}
            >
              Start with the web onboarding so Homa has your family basics and your kids
              before you use the app.
            </Text>
            <Button
              label="Open onboarding"
              size="lg"
              onPress={() => void openWebOnboarding()}
            />
          </View>
        ) : (
          <View style={{ gap: space.md }}>
            <Text
              style={{
                fontFamily: fontFamilies.display,
                fontSize: fontSize.xxl,
                lineHeight: fontSize.xxl * 1.1,
                color: colors.textStrong,
              }}
            >
              {memberDisplayName ?? readyFamily.parent_display_name
                ? `Hi ${memberDisplayName ?? readyFamily.parent_display_name}.`
                : readyFamily.name}
            </Text>

            <View style={{ gap: space.md }}>
              {children.map((child) => (
                <Card key={child.id} style={{ gap: 4 }}>
                  <Text
                    style={{
                      fontFamily: fontFamilies.displaySemibold,
                      fontSize: fontSize.lg,
                      color: colors.textStrong,
                    }}
                  >
                    {child.name}
                    <Text
                      style={{
                        fontFamily: fontFamilies.body,
                        fontSize: fontSize.sm,
                        color: colors.textMuted,
                      }}
                    >
                      {"  "}
                      {ageLabel(ageInMonths(child.birth_month))}
                    </Text>
                  </Text>
                  {child.profile.interests?.length ? (
                    <Text
                      style={{
                        fontFamily: fontFamilies.body,
                        fontSize: fontSize.sm,
                        color: colors.textBody,
                      }}
                    >
                      Into: {child.profile.interests.join(", ")}
                    </Text>
                  ) : null}
                  {child.profile.focus ? (
                    <Text
                      style={{
                        fontFamily: fontFamilies.body,
                        fontSize: fontSize.sm,
                        color: colors.textBody,
                      }}
                    >
                      Working on: {child.profile.focus}
                    </Text>
                  ) : null}
                </Card>
              ))}
              <Button
                label="Talk to Homa"
                size="lg"
                onPress={() => router.push("/chat")}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
