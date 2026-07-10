import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ageInMonths, ageLabel } from "@homa/core";

import { Logo } from "../../components/brand/logo";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { AddChildForm } from "../../features/family/add-child-form";
import { CreateFamilyForm } from "../../features/family/create-family-form";
import { useFamilyData } from "../../features/family/use-family-data";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

/**
 * Today: the signed-in landing, mirroring apps/web/app/app/page.tsx's
 * three states: no family yet, family with no kids, or ready (kids
 * listed, chat one tap away).
 */
export default function TodayScreen() {
  const router = useRouter();
  const { family, children, loading, error, reload } = useFamilyData();

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
        <Logo size={28} />

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
        ) : !family ? (
          <View style={{ gap: space.md }}>
            <Text
              style={{
                fontFamily: fontFamilies.display,
                fontSize: fontSize.xxl,
                lineHeight: fontSize.xxl * 1.1,
                color: colors.textStrong,
              }}
            >
              {"Welcome. Let's set up your family."}
            </Text>
            <Text
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                color: colors.textBody,
              }}
            >
              One quick step, then you can tell Homa about your kids.
            </Text>
            <CreateFamilyForm onCreated={() => void reload()} />
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
              {family.parent_display_name
                ? `Hi ${family.parent_display_name}.`
                : family.name}
            </Text>

            {children.length > 0 ? (
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
            ) : (
              <View style={{ gap: space.md }}>
                <Text
                  style={{
                    fontFamily: fontFamilies.body,
                    fontSize: fontSize.base,
                    color: colors.textBody,
                  }}
                >
                  Tell Homa about a child to get your first personalized
                  worksheet.
                </Text>
                <AddChildForm familyId={family.id} onAdded={() => void reload()} />
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
