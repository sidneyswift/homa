import { StyleSheet, Text, View } from "react-native";

import { Button } from "../../components/ui/button";
import { InlineError } from "../../components/ui/inline-error";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { fontFamilies } from "../../theme/fonts";
import { colors, darkColors, fontSize, radius, space } from "../../theme/tokens";
import {
  lessonReviewRecoveryCopy,
  type LessonReviewRecoveryAction,
  type TrackedLessonReviewStatus,
} from "./lesson-review-recovery-model";

function actionLabel(action: LessonReviewRecoveryAction, busy: boolean): string {
  if (action === "retry") return busy ? "Trying the review again…" : "Try the review again";
  if (action === "discuss") return "Talk with Homa";
  if (action === "dismiss") return "Remove reminder";
  return "Remind me later";
}

function actionHint(action: LessonReviewRecoveryAction): string {
  if (action === "retry") {
    return "Homa will review the saved lesson again. No new recording is needed.";
  }
  if (action === "discuss") {
    return "Continue in Voice with Homa about this lesson and what to try next.";
  }
  if (action === "dismiss") {
    return "Removes this reminder. It does not delete a saved lesson.";
  }
  return "Hides this reminder until you reopen Homa. It does not change the lesson.";
}

export function LessonReviewRecoveryCard({
  item,
  dark,
  busy,
  error,
  onAction,
}: {
  item: TrackedLessonReviewStatus;
  dark: boolean;
  busy: boolean;
  error: string | null;
  onAction: (action: LessonReviewRecoveryAction) => void;
}) {
  const copy = lessonReviewRecoveryCopy(item);
  const theme = dark ? darkColors : colors;

  useAccessibilityAnnouncement(`${copy.title}. ${copy.body}`);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.borderSubtle,
        },
      ]}
    >
      <Text
        style={[styles.eyebrow, { color: theme.textMuted }]}
      >
        {copy.eyebrow}
      </Text>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: theme.textStrong }]}
      >
        {copy.title}
      </Text>
      <Text
        style={[styles.body, { color: theme.textBody }]}
      >
        {copy.body}
      </Text>
      {error ? <InlineError message={error} tone={dark ? "dark" : "light"} /> : null}
      {copy.primary || copy.secondary ? (
        <View style={styles.actions}>
          {copy.primary ? (
            <Button
              label={actionLabel(copy.primary, busy)}
              accessibilityHint={actionHint(copy.primary)}
              busy={busy}
              onPress={() => onAction(copy.primary!)}
              tone={dark ? "dark" : "light"}
              style={styles.actionButton}
            />
          ) : null}
          {copy.secondary ? (
            <Button
              label={actionLabel(copy.secondary, false)}
              accessibilityHint={actionHint(copy.secondary)}
              variant="secondary"
              disabled={busy}
              onPress={() => onAction(copy.secondary!)}
              tone={dark ? "dark" : "light"}
              style={styles.actionButton}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
    marginHorizontal: space.md,
    marginBottom: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  eyebrow: {
    fontFamily: fontFamilies.body,
    fontSize: fontSize.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: fontFamilies.display,
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  body: {
    fontFamily: fontFamilies.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  actions: { gap: space.sm },
  actionButton: { alignSelf: "stretch" },
});
