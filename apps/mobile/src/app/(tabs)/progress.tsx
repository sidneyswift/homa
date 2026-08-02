import { useRouter } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useFamilyData } from "../../features/family/use-family-data";
import { KidSwitcher } from "../../features/progress/kid-switcher";
import {
  latestProgressObservedAt,
  progressUpdatedLine,
} from "../../features/progress/map-model";
import { SubjectCard } from "../../features/progress/subject-card";
import { useChildProgress } from "../../features/progress/use-child-progress";
import {
  progressErrorPresentation,
  type ProgressErrorAction,
} from "../../features/progress/progress-error-model";
import type { ChildProgressFailure } from "../../features/progress/child-progress-load";
import {
  formatProgressDate,
  progressAssessmentCta,
  progressAssessmentDraft,
} from "../../features/progress/view-copy";
import { supabase } from "../../lib/supabase";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";

/**
 * Progress reads the canonical server projection. Every visible state is
 * keyed to the selected child, so a superseded request can never place one
 * child's evidence under another child's selector.
 */
export default function ProgressScreen() {
  const router = useRouter();
  const {
    children,
    loading: familyLoading,
    reload: reloadFamily,
  } = useFamilyData();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const selectedChild =
    children.find((child) => child.id === selectedChildId) ?? children[0] ?? null;
  const effectiveChildId = selectedChild?.id ?? null;
  const {
    view,
    loading: progressLoading,
    error,
    reload,
  } = useChildProgress(effectiveChildId);
  const visibleView =
    view?.childId === effectiveChildId ? view : null;
  const loading = familyLoading || progressLoading;

  function openProgressChat(childId: string, childName: string): void {
    router.push({
      pathname: "/chat",
      params: {
        progressDraft: progressAssessmentDraft(childName),
        progressDraftId: `${childId}:${Date.now()}`,
        progressChildId: childId,
      },
    });
  }

  async function handleProgressErrorAction(
    action: ProgressErrorAction,
  ): Promise<void> {
    switch (action) {
      case "reauthenticate":
        await supabase.auth.signOut();
        router.replace("/signin");
        return;
      case "refresh-family":
        await reloadFamily();
        return;
      case "open-chat":
        router.push("/chat");
        return;
      case "retry":
        await reload();
    }
  }

  if (familyLoading && children.length === 0) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.page }}
        edges={["bottom"]}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: space.lg,
          }}
        >
          <Card style={{ gap: space.sm }}>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: fontFamilies.displaySemibold,
                fontSize: fontSize.lg,
                color: colors.textStrong,
              }}
            >
              Progress
            </Text>
            <Text
              accessibilityLiveRegion="polite"
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                color: colors.textBody,
              }}
            >
              Loading your family
            </Text>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  if (!familyLoading && children.length === 0) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.page }}
        edges={["bottom"]}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: space.lg,
          }}
        >
          <Card style={{ gap: space.md }}>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: fontFamilies.displaySemibold,
                fontSize: fontSize.lg,
                color: colors.textStrong,
              }}
            >
              Add your first child
            </Text>
            <Text
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                color: colors.textBody,
              }}
            >
              Add a child to start their progress page.
            </Text>
            <Button label="Add a child" onPress={() => router.push("/settings")} />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  const updatedLine = visibleView
    ? progressUpdatedLine(visibleView, new Date())
    : null;
  const latestObservedAt = visibleView
    ? latestProgressObservedAt(visibleView)
    : null;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.page }}
      edges={["bottom"]}
    >
      <ScrollView
        contentContainerStyle={{ padding: space.md, gap: space.md }}
        refreshControl={
          <RefreshControl
            refreshing={progressLoading}
            onRefresh={() => void reload()}
          />
        }
      >
        {effectiveChildId ? (
          <KidSwitcher
            kids={children}
            selectedChildId={effectiveChildId}
            onSelect={setSelectedChildId}
          />
        ) : null}

        {selectedChild ? (
          <View style={{ gap: 2 }}>
            {updatedLine ? (
              <Text
                maxFontSizeMultiplier={2}
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
              accessibilityRole="header"
              maxFontSizeMultiplier={2}
              style={{
                fontFamily: fontFamilies.display,
                fontSize: fontSize.xxl,
                lineHeight: fontSize.xxl * 1.1,
                color: colors.textStrong,
              }}
            >
              {selectedChild.name}&rsquo;s progress
            </Text>
          </View>
        ) : null}

        {loading && !visibleView && selectedChild ? (
          <ProgressSkeleton childName={selectedChild.name} />
        ) : null}

        {!loading && error && !visibleView && selectedChild ? (
          <ProgressError
            childName={selectedChild.name}
            failure={error}
            onAction={(action) => void handleProgressErrorAction(action)}
          />
        ) : null}

        {error && visibleView && selectedChild ? (
          <Card style={{ gap: space.sm }}>
            <Text
              accessibilityRole="alert"
              style={{
                fontFamily: fontFamilies.bodySemibold,
                fontSize: fontSize.sm,
                color: colors.textStrong,
              }}
            >
              {latestObservedAt
                ? `You’re seeing answers through ${formatProgressDate(
                    latestObservedAt,
                    visibleView.timeZone,
                  )}.`
                : "You’re seeing the last saved progress."}
            </Text>
            <Text
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.sm,
                color: colors.textBody,
              }}
            >
              We couldn’t check for anything newer.
            </Text>
            <Button
              label="Try again"
              variant="secondary"
              onPress={() => void reload()}
            />
          </Card>
        ) : null}

        {!loading && !error && visibleView && visibleView.subjects.length === 0 ? (
          <AssessmentCta
            childName={selectedChild?.name ?? visibleView.childName}
            onPress={() =>
              openProgressChat(
                selectedChild?.id ?? visibleView.childId,
                selectedChild?.name ?? visibleView.childName,
              )
            }
          />
        ) : null}

        {visibleView?.subjects.map((subject) => (
          <SubjectCard
            key={subject.subjectId}
            subject={subject}
            conflicts={visibleView.conflicts}
            timeZone={visibleView.timeZone}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProgressSkeleton({ childName }: { childName: string }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityLabel={`Loading ${childName}’s progress`}
      style={{ gap: space.md }}
    >
      <Text
        style={{
          fontFamily: fontFamilies.body,
          fontSize: fontSize.sm,
          color: colors.textMuted,
        }}
      >
        Loading {childName}’s progress
      </Text>
      {[0, 1].map((index) => (
        <Card key={index} style={{ gap: space.sm }}>
          <View
            style={{
              width: "36%",
              height: 18,
              borderRadius: radius.sm,
              backgroundColor: colors.surfaceSunken,
            }}
          />
          <View
            style={{
              width: "82%",
              height: 14,
              borderRadius: radius.sm,
              backgroundColor: colors.surfaceSunken,
            }}
          />
          <View
            style={{
              width: "58%",
              height: 14,
              borderRadius: radius.sm,
              backgroundColor: colors.surfaceSunken,
            }}
          />
        </Card>
      ))}
    </View>
  );
}

function ProgressError({
  childName,
  failure,
  onAction,
}: {
  childName: string;
  failure: ChildProgressFailure;
  onAction: (action: ProgressErrorAction) => void;
}) {
  const presentation = progressErrorPresentation(failure, childName);
  return (
    <Card style={{ gap: space.sm }}>
      <Text
        accessibilityRole="alert"
        style={{
          fontFamily: fontFamilies.displaySemibold,
          fontSize: fontSize.lg,
          color: colors.textStrong,
        }}
      >
        {presentation.title}
      </Text>
      <Text
        style={{
          fontFamily: fontFamilies.body,
          fontSize: fontSize.sm,
          color: colors.textBody,
        }}
      >
        {presentation.body}
      </Text>
      <Button
        label={presentation.actionLabel}
        variant="secondary"
        onPress={() => onAction(presentation.action)}
      />
    </Card>
  );
}

function AssessmentCta({
  childName,
  onPress,
}: {
  childName: string;
  onPress: () => void;
}) {
  const copy = progressAssessmentCta(childName);
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ gap: space.xs }}>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fontFamilies.display,
            fontSize: fontSize.lg,
            color: colors.textStrong,
          }}
        >
          {copy.heading}
        </Text>
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.sm,
            color: colors.textBody,
          }}
        >
          {copy.body}
        </Text>
      </View>
      <Button label="Tell Homa" onPress={onPress} />
    </Card>
  );
}
