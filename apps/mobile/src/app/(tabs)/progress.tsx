import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useFamilyData } from "../../features/family/use-family-data";
import { KidSwitcher } from "../../features/progress/kid-switcher";
import { SubjectCard } from "../../features/progress/subject-card";
import { useChildProgress } from "../../features/progress/use-child-progress";
import { progressAssessmentCta } from "../../features/progress/view-copy";
import { progressUpdatedLine } from "../../features/progress/map-model";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

/**
 * Progress: read-only v1, ported from apps/web/app/app/[childId]/
 * progress/page.tsx + components/progress/progress-view.tsx. Reads
 * the same pre-built child_progress_live projection web renders, so
 * subject wording, states, and badges match exactly (see
 * features/progress/view-copy.ts and map-model.ts).
 *
 * Scoped out of this v1, each a tracked gap rather than a silent one:
 * the trajectory chart, the abilities-sky visualization, the lessons
 * card, the firsts keepsake door, conflict resolution as a write
 * action (shown read-only here, since that needs a new authenticated
 * API route mobile doesn't have), and the deep-dive door (needs a
 * mobile onboarding-chat flow that doesn't exist yet).
 *
 * No report-lock/wall check: mobile's BillingGate and web's wall both
 * resolve through the same accountAccessDecision() (docs/homa-planning/
 * plans/2026-07-28-ios-app-store-launch.md, arc F), so a family that
 * reached this screen has already cleared the identical entitlement
 * check web's wall would apply. Nothing to bypass twice.
 */
export default function ProgressScreen() {
  const { children, loading: familyLoading } = useFamilyData();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const effectiveChildId = selectedChildId ?? children[0]?.id ?? null;

  const { view, loading: progressLoading, error, reload } = useChildProgress(effectiveChildId);
  const loading = familyLoading || progressLoading;

  if (!familyLoading && children.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["bottom"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.lg }}>
          <Text
            style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textMuted, textAlign: "center" }}
          >
            Add a child in Settings to see their progress here.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const updatedLine = view ? progressUpdatedLine(view, new Date()) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={{ padding: space.md, gap: space.md }}
        refreshControl={<RefreshControl refreshing={progressLoading} onRefresh={() => void reload()} />}
      >
        {effectiveChildId ? (
          <KidSwitcher kids={children} selectedChildId={effectiveChildId} onSelect={setSelectedChildId} />
        ) : null}

        {view ? (
          <View style={{ gap: 2 }}>
            {updatedLine ? (
              <Text
                style={{
                  fontFamily: fontFamilies.bodySemibold,
                  fontSize: fontSize.xs,
                  color: updatedLine.today ? colors.success : colors.textMuted,
                }}
              >
                {updatedLine.label}
              </Text>
            ) : null}
            <Text
              style={{ fontFamily: fontFamilies.display, fontSize: fontSize.xxl, color: colors.textStrong }}
            >
              {view.childName}&rsquo;s progress
            </Text>
          </View>
        ) : null}

        {loading && !view ? (
          <View style={{ paddingVertical: space.xl, alignItems: "center" }}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : null}

        {error ? (
          <Card>
            <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.danger }}>
              {"That didn't load. Pull down to try again."}
            </Text>
          </Card>
        ) : null}

        {!loading && !error && view && view.subjects.length === 0 ? (
          <AssessmentCta childName={view.childName} />
        ) : null}

        {view?.subjects.map((subject) => (
          <SubjectCard
            key={subject.subjectId}
            subject={subject}
            scores={view.scores}
            conflicts={view.conflicts}
            childName={view.childName}
            timeZone={view.timeZone}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function AssessmentCta({ childName }: { childName: string }) {
  const router = useRouter();
  const copy = progressAssessmentCta(childName);
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ gap: space.xs }}>
        <Text
          style={{ fontFamily: fontFamilies.display, fontSize: fontSize.lg, color: colors.textStrong }}
        >
          {copy.heading}
        </Text>
        <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}>
          {copy.body}
        </Text>
      </View>
      <Button label="Tell Homa about it" onPress={() => router.push("/chat")} />
    </Card>
  );
}
