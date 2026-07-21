import { Pressable, Text, View } from "react-native";

import { Card } from "../../components/ui/card";
import { HISTORY_RUN_LIMIT, type TaskRun } from "../../lib/tasks";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";
import { groupRunsByDay, statusNote, timeLabel } from "./task-format";
import { TaskKindIcon } from "./task-icons";

/**
 * The runs feed, ported from the web TaskHistory
 * (app/app/tasks/task-history.tsx): newest first, grouped under one
 * quiet day label so the feed scans as a week. Two write paths differ
 * from the web on purpose, because both run through server logic the
 * app cannot call: "Ask Homa about this" opens the chat tab instead of
 * the web chat page, and brief feedback shows the adult's saved answer
 * read-only instead of offering the Helpful buttons (saying it in chat
 * reaches Homa just the same). Failure copy stays calm by design law:
 * no red, no alarm.
 */

/** A finished run is a conversation the parent can pick back up; the
 * door lives on this screen, not in a hunt for the text thread. Same
 * rule as the web's showsAskHoma. */
function showsAskHoma(run: TaskRun): boolean {
  return run.status === "done";
}

/** The caller's own saved brief response, shown as a fact. Recording or
 * changing it happens in chat (the write is server-side). */
function feedbackNote(run: TaskRun): string | null {
  if (run.feedbackSignal === "helpful") return "You marked this helpful.";
  if (run.feedbackSignal === "not_for_us") return "You marked this not for us.";
  return null;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontFamily: fontFamilies.bodyBold,
        fontSize: fontSize.xs,
        letterSpacing: 1.6,
        textTransform: "uppercase",
        color: colors.textSubtle,
      }}
    >
      {children}
    </Text>
  );
}

function RunCard({
  run,
  timeZone,
  onAskHoma,
}: {
  run: TaskRun;
  timeZone: string;
  onAskHoma: () => void;
}) {
  const note = statusNote(run);
  const feedback = feedbackNote(run);
  return (
    <Card style={{ padding: space.md, gap: space.sm }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space.sm,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            flexShrink: 1,
          }}
        >
          <TaskKindIcon kind={run.kind} color={colors.brand} size={16} />
          <Text
            style={{
              flexShrink: 1,
              fontFamily: fontFamilies.bodySemibold,
              fontSize: fontSize.base,
              color: colors.textStrong,
            }}
          >
            {run.title}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: fontFamilies.bodySemibold,
            fontSize: fontSize.xs,
            color: colors.textSubtle,
          }}
        >
          {timeLabel(run.startedAt, timeZone)}
        </Text>
      </View>
      {run.summary ? (
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.sm,
            lineHeight: 21,
            color: colors.textBody,
          }}
        >
          {run.summary}
        </Text>
      ) : null}
      {note ? (
        <Text
          style={{
            fontFamily: fontFamilies.bodySemibold,
            fontSize: fontSize.xs,
            color: colors.textSubtle,
          }}
        >
          {note}
        </Text>
      ) : null}
      {feedback ? (
        <Text
          style={{
            fontFamily: fontFamilies.bodySemibold,
            fontSize: fontSize.xs,
            color: colors.textSubtle,
          }}
        >
          {feedback}
        </Text>
      ) : null}
      {showsAskHoma(run) ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAskHoma}
          hitSlop={8}
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: fontFamilies.bodySemibold,
              fontSize: fontSize.xs,
              color: colors.brand,
            }}
          >
            Ask Homa about this
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

export function TaskHistorySection({
  runs,
  timeZone,
  onAskHoma,
}: {
  runs: TaskRun[];
  timeZone: string;
  /** Opens the chat tab; the run's conversation continues there. */
  onAskHoma: () => void;
}) {
  return (
    <View style={{ gap: space.sm + space.xs }}>
      <SectionLabel>Task history</SectionLabel>
      {runs.length === 0 ? (
        <Card style={{ alignItems: "center", gap: space.xs }}>
          <Text
            style={{
              fontFamily: fontFamilies.displaySemibold,
              fontSize: fontSize.lg,
              color: colors.textStrong,
            }}
          >
            Nothing here yet.
          </Text>
          <Text
            style={{
              textAlign: "center",
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              color: colors.textMuted,
            }}
          >
            When Homa finishes one of your tasks, it shows up here.
          </Text>
        </Card>
      ) : (
        <View style={{ gap: space.md }}>
          {groupRunsByDay(runs, timeZone).map((group) => (
            <View key={group.key} style={{ gap: space.sm }}>
              <SectionLabel>{group.label}</SectionLabel>
              {group.runs.map((run) => (
                <RunCard
                  key={run.id}
                  run={run}
                  timeZone={timeZone}
                  onAskHoma={onAskHoma}
                />
              ))}
            </View>
          ))}
          {/* The feed ends on purpose; the capped line answers the real
              question plainly: kept, not thrown away (web reader gate
              2026-07-13). */}
          <Text
            style={{
              textAlign: "center",
              fontFamily: fontFamilies.bodySemibold,
              fontSize: fontSize.xs,
              color: colors.textSubtle,
            }}
          >
            {runs.length >= HISTORY_RUN_LIMIT
              ? "This page shows your newest 30 task updates. Older ones are kept, just not shown here."
              : "That's everything so far."}
          </Text>
        </View>
      )}
    </View>
  );
}
