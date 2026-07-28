import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ageInMonths, ageLabel } from "@homa/core";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { AddChildForm } from "../../features/family/add-child-form";
import { useFamilyData } from "../../features/family/use-family-data";
import { openWebOnboarding } from "../../lib/web-links";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

/** Family: who Homa knows. Account actions live in Settings. */
export default function FamilyScreen() {
  const router = useRouter();
  const { family, children, memberDisplayName, loading, reload } = useFamilyData();
  const setupReady = Boolean(family?.profile_completed_at && children.length > 0);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <Text
          style={{
            fontFamily: fontFamilies.display,
            fontSize: fontSize.xxl,
            color: colors.textStrong,
          }}
        >
          Family
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.brand} />
        ) : family ? (
          <View style={{ gap: space.lg }}>
            <Card style={{ gap: 4 }}>
              <Text
                style={{
                  fontFamily: fontFamilies.displaySemibold,
                  fontSize: fontSize.lg,
                  color: colors.textStrong,
                }}
              >
                {family.name}
              </Text>
              {memberDisplayName ?? family.parent_display_name ? (
                <Text
                  style={{
                    fontFamily: fontFamilies.body,
                    fontSize: fontSize.sm,
                    color: colors.textBody,
                  }}
                >
                  Parent: {memberDisplayName ?? family.parent_display_name}
                </Text>
              ) : null}
              {family.us_state ? (
                <Text
                  style={{
                    fontFamily: fontFamilies.body,
                    fontSize: fontSize.sm,
                    color: colors.textBody,
                  }}
                >
                  State: {family.us_state}
                </Text>
              ) : null}
            </Card>

            {!setupReady ? (
              <Card style={{ gap: space.md }}>
                <Text
                  style={{
                    fontFamily: fontFamilies.body,
                    fontSize: fontSize.base,
                    color: colors.textBody,
                  }}
                >
                  Finish onboarding on the web so Homa can keep the app in sync
                  with your family setup.
                </Text>
                <Button
                  label="Open onboarding"
                  onPress={() => void openWebOnboarding()}
                />
              </Card>
            ) : (
              <>
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
                  </Card>
                ))}

                <AddChildForm familyId={family.id} onAdded={() => void reload()} />
              </>
            )}
          </View>
        ) : (
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.base,
              color: colors.textBody,
            }}
          >
            Start with the web onboarding; everything here fills in from there.
          </Text>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/settings")}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, alignItems: "center" })}
        >
          <Text
            style={{
              fontFamily: fontFamilies.bodyMedium,
              fontSize: fontSize.base,
              color: colors.brand,
            }}
          >
            Settings
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
