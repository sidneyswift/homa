import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LessonReviewView } from "../../features/lessons/lesson-review-view";
import { useLessonData } from "../../features/lessons/use-lesson-data";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

/**
 * /lessons/[lessonId]: the lesson review, the mobile twin of
 * apps/web/app/app/lessons/[lessonId]/page.tsx. Read-only: the reads
 * are RLS-scoped selects (src/lib/lessons.ts) and every write (retry,
 * photos, delete) stays on the web's guarded server paths. A stack
 * route above the tabs, so it draws its own back affordance.
 */
export default function LessonReviewScreen() {
  const params = useLocalSearchParams<{ lessonId?: string }>();
  const lessonId = typeof params.lessonId === "string" ? params.lessonId : null;
  const { loading, error, lesson, childName, review, media, segments, reload } =
    useLessonData(lessonId);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.page }}
      edges={["top"]}
    >
      <View style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          onPress={() => {
            // A cold deep link has no history to pop; land on Today.
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/");
            }
          }}
          style={{ alignSelf: "flex-start" }}
        >
          <Text
            style={{
              fontFamily: fontFamilies.bodyMedium,
              fontSize: fontSize.sm,
              color: colors.textMuted,
            }}
          >
            {"←"} Back
          </Text>
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingBottom: space.xxl,
        }}
      >
        {loading ? (
          <ActivityIndicator
            color={colors.brand}
            style={{ marginTop: space.xl }}
          />
        ) : error ? (
          <View style={{ gap: space.md }}>
            <Text
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                color: colors.textBody,
              }}
            >
              The lesson is safe; this screen just didn&apos;t load it this
              time.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void reload()}
            >
              <Text
                style={{
                  fontFamily: fontFamilies.bodySemibold,
                  fontSize: fontSize.sm,
                  color: colors.brand,
                }}
              >
                Try again
              </Text>
            </Pressable>
          </View>
        ) : !lesson ? (
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.base,
              color: colors.textBody,
            }}
          >
            This lesson isn&apos;t here. It may have been removed, or the link
            may be old.
          </Text>
        ) : (
          <LessonReviewView
            lesson={lesson}
            childName={childName}
            review={review}
            media={media}
            segments={segments}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
