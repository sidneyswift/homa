import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ageInMonths, ageLabel } from "@homa/core";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useSession } from "../../features/auth/session-provider";
import { AddChildForm } from "../../features/family/add-child-form";
import { useFamilyData } from "../../features/family/use-family-data";
import { supabase } from "../../lib/supabase";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

/** Family: who Homa knows, plus account actions. */
export default function FamilyScreen() {
  const { session } = useSession();
  const { family, children, loading, reload } = useFamilyData();

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
              {family.parent_display_name ? (
                <Text
                  style={{
                    fontFamily: fontFamilies.body,
                    fontSize: fontSize.sm,
                    color: colors.textBody,
                  }}
                >
                  Parent: {family.parent_display_name}
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
          </View>
        ) : (
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.base,
              color: colors.textBody,
            }}
          >
            Set up your family on the Today tab first; everything here
            fills in from there.
          </Text>
        )}

        <View style={{ gap: space.sm }}>
          {session?.user.email ? (
            <Text
              style={{
                textAlign: "center",
                fontFamily: fontFamilies.body,
                fontSize: fontSize.sm,
                color: colors.textMuted,
              }}
            >
              Signed in as {session.user.email}
            </Text>
          ) : null}
          <Button
            label="Sign out"
            variant="secondary"
            onPress={() => void supabase.auth.signOut()}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
