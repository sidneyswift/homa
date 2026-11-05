import type { ChildProgressView } from "@homa/core";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AiConsentGate } from "../../components/ai-consent-gate";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { InlineError } from "../../components/ui/inline-error";
import { LoadingStatus } from "../../components/ui/loading-status";
import { useFamilyData } from "../../features/family/use-family-data";
import { KidSwitcher } from "../../features/progress/kid-switcher";
import {
  latestProgressObservedAt,
  progressUpdatedLine,
} from "../../features/progress/map-model";
import { SubjectCard } from "../../features/progress/subject-card";
import { ProgressNextMoveCard } from "../../features/progress/progress-next-move-card";
import { useProgressNextMove } from "../../features/progress/use-progress-next-move";
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
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { fontFamilies , colors, fontSize, radius, space } from "../../theme/app2";

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
  // A link can name the child to open on (the onboarding walk's "See
  // Max's progress report" door); otherwise the first child leads.
  const params = useLocalSearchParams<{ childId?: string | string[] }>();
  const linkedChildId = Array.isArray(params.childId) ? params.childId[0] : params.childId;
  const [selectedChildId, setSelectedChildId] = useState<string | null>(linkedChildId ?? null);
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

  function openProgressChat(input: {
    childId: string;
    draft: string;
    intent: "share_progress_evidence" | "review_progress_next_move";
    fingerprint?: string;
  }): void {
    router.push({
      pathname: "/chat",
      params: {
        progressDraft: input.draft,
        progressDraftId: `${input.childId}:${Date.now()}`,
        progressChildId: input.childId,
        progressIntent: input.intent,
        ...(input.fingerprint
          ? { progressNextMoveFingerprint: input.fingerprint }
          : {}),
      },
    });
  }

  async function refreshProgress(): Promise<void> {
    await reload();
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
            <LoadingStatus label="Loading your family" />
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
            // The pull spinner belongs to a page she can see; a first load
            // already shows the placeholder cards, and both at once read as
            // three loaders (2026-11-03 walk, gh#1236).
            refreshing={progressLoading && visibleView !== null}
            onRefresh={() => void refreshProgress()}
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
            <InlineError
              message={latestObservedAt
                ? `You’re seeing answers through ${formatProgressDate(
                    latestObservedAt,
                    visibleView.timeZone,
                  )}.`
                : "You’re seeing the last saved progress."}
            />
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

        {visibleView ? (
          <AiConsentGate purpose="progress" embedded>
            <ProgressNextMoveSection
              view={visibleView}
              onRefreshProgress={refreshProgress}
              onOpenChat={openProgressChat}
            />
          </AiConsentGate>
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

function ProgressNextMoveSection({
  view,
  onRefreshProgress,
  onOpenChat,
}: {
  view: ChildProgressView;
  onRefreshProgress: () => Promise<void>;
  onOpenChat: (input: {
    childId: string;
    draft: string;
    intent: "share_progress_evidence" | "review_progress_next_move";
    fingerprint?: string;
  }) => void;
}) {
  const nextMoveState = useProgressNextMove(view);

  if (
    nextMoveState.nextMove &&
    nextMoveState.nextMove.kind !== "none" &&
    nextMoveState.contextFingerprint
  ) {
    return (
      <ProgressNextMoveCard
        nextMove={nextMoveState.nextMove}
        dismissing={nextMoveState.dismissing}
        dismissError={nextMoveState.dismissError}
        onDismiss={() => void nextMoveState.dismiss()}
        onOpenChat={(draft) =>
          onOpenChat({
            childId: view.childId,
            draft,
            intent: "review_progress_next_move",
            fingerprint: nextMoveState.contextFingerprint ?? undefined,
          })
        }
      />
    );
  }

  if (nextMoveState.loading || nextMoveState.pending) {
    return (
      <NextMoveStatusCard
        title="Choosing one small next move"
        body="Your Progress page is ready while Homa checks the evidence."
      />
    );
  }

  if (nextMoveState.error) {
    return (
      <NextMoveStatusCard
        title="The next move is taking a break"
        body={nextMoveState.error.message}
        actionLabel={
          nextMoveState.error.reason === "projection-changed"
            ? "Refresh Progress"
            : "Try again"
        }
        onAction={() =>
          void (nextMoveState.error?.reason === "projection-changed"
            ? onRefreshProgress()
            : nextMoveState.retry())
        }
      />
    );
  }

  if (
    view.subjects.length === 0 &&
    (!nextMoveState.nextMove || nextMoveState.nextMove.kind === "none")
  ) {
    return (
      <AssessmentCta
        childName={view.childName}
        onPress={() =>
          onOpenChat({
            childId: view.childId,
            draft: progressAssessmentDraft(view.childName),
            intent: "share_progress_evidence",
          })
        }
      />
    );
  }

  return null;
}

function NextMoveStatusCard({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  useAccessibilityAnnouncement(`${title}. ${body}`);
  return (
    <Card style={{ gap: space.sm }}>
      <Text
        style={{
          fontFamily: fontFamilies.bodySemibold,
          fontSize: fontSize.sm,
          color: colors.textStrong,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontFamily: fontFamilies.body,
          fontSize: fontSize.sm,
          color: colors.textBody,
        }}
      >
        {body}
      </Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="secondary" onPress={onAction} />
      ) : null}
    </Card>
  );
}

/** One loading state: the placeholder cards, named for screen readers. */
function ProgressSkeleton({ childName }: { childName: string }) {
  const label = `Loading ${childName}’s progress`;
  useAccessibilityAnnouncement(label);
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} style={{ gap: space.md }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: space.md }}>
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
  useAccessibilityAnnouncement(`${presentation.title}. ${presentation.body}`);
  return (
    <Card style={{ gap: space.sm }}>
      <Text
        accessibilityRole="header"
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
