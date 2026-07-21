import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { ScreenHeader } from "../components/ui/screen-header";
import {
  ASK_HOMA_BUTTON_LABEL,
  BRIEF_PLACEHOLDER_NOTE,
  CHANGES_IN_CHAT_NOTE,
  JOURNAL_PLACEHOLDER_NOTE,
  SCREEN_INTRO,
} from "../features/tasks/task-copy";
import { PlaceholderKindCard, TaskCard } from "../features/tasks/task-card";
import { effectiveTimeZone } from "../features/tasks/task-format";
import { TaskHistorySection } from "../features/tasks/task-history";
import { useTasksData } from "../features/tasks/use-tasks-data";
import { openWebOnboarding } from "../lib/web-links";
import { fontFamilies } from "../theme/fonts";
import { colors, fontSize, space } from "../theme/tokens";

/**
 * Homa's tasks, the mobile twin of apps/web/app/app/tasks: what Homa
 * does on her own schedule and what those runs produced, clearly not
 * the kids' Week planner. Read-only by construction: the tasks tables
 * accept no Data API writes (migration #49), and the web page's writes
 * all run through server actions this app cannot call, so adding,
 * editing, pausing, and brief feedback route to chat, where Homa's own
 * tools do the same work. Pushed over the tabs from More.
 */
export default function TasksScreen() {
  const { family, tasks, runs, loading, error, reload } = useTasksData();
  const [refreshing, setRefreshing] = useState(false);

  // Refetch on focus so a task Homa just changed in chat is already
  // right when the parent swings back (same habit as the Family tab).
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  const timeZone = effectiveTimeZone(family?.time_zone);
  // One clock instant shared by every card in a render pass, so
  // siblings never disagree on what counts as upcoming (the web twin
  // passes its server render instant for the same reason).
  const now = new Date();

  const hasBrief = tasks.some((task) => task.kind === "morning_brief");
  const hasJournal = tasks.some((task) => task.kind === "journal_prompt");
  const setupReady = Boolean(family?.profile_completed_at);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["top"]}>
      <ScreenHeader title="Homa's tasks" />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, gap: space.lg }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.brand}
          />
        }
      >
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.sm,
            lineHeight: 21,
            color: colors.textMuted,
          }}
        >
          {SCREEN_INTRO}
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.brand} />
        ) : error ? (
          // Reassure before inform: her tasks are safe, only this load
          // stumbled.
          <Card style={{ gap: space.md }}>
            <Text
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                color: colors.textBody,
              }}
            >
              {"Your tasks are safe. This screen just couldn't load them right now."}
            </Text>
            <Button
              label="Try again"
              variant="secondary"
              onPress={() => void reload()}
            />
          </Card>
        ) : !setupReady ? (
          // Same door the Family tab offers before onboarding finishes;
          // tasks seed themselves once the family profile exists.
          <Card style={{ gap: space.md }}>
            <Text
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                color: colors.textBody,
              }}
            >
              {"Homa's tasks start after onboarding. Finish it on the web and this screen fills in on its own."}
            </Text>
            <Button
              label="Open onboarding"
              onPress={() => void openWebOnboarding()}
            />
          </Card>
        ) : (
          <>
            <View style={{ gap: space.sm + space.xs }}>
              <Text
                style={{
                  fontFamily: fontFamilies.bodyBold,
                  fontSize: fontSize.xs,
                  letterSpacing: 1.6,
                  textTransform: "uppercase",
                  color: colors.textSubtle,
                }}
              >
                Scheduled
              </Text>
              {!hasBrief ? (
                <PlaceholderKindCard
                  kind="morning_brief"
                  note={BRIEF_PLACEHOLDER_NOTE}
                />
              ) : null}
              {!hasJournal ? (
                <PlaceholderKindCard
                  kind="journal_prompt"
                  note={JOURNAL_PLACEHOLDER_NOTE}
                />
              ) : null}
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} timeZone={timeZone} now={now} />
              ))}
            </View>

            {/* The one change door on this screen: reads stay here,
                writes happen in conversation. */}
            <Card style={{ gap: space.md }}>
              <Text
                style={{
                  fontFamily: fontFamilies.body,
                  fontSize: fontSize.sm,
                  lineHeight: 21,
                  color: colors.textBody,
                }}
              >
                {CHANGES_IN_CHAT_NOTE}
              </Text>
              <Button
                label={ASK_HOMA_BUTTON_LABEL}
                variant="secondary"
                onPress={() => router.push("/chat")}
              />
            </Card>

            <TaskHistorySection
              runs={runs}
              timeZone={timeZone}
              onAskHoma={() => router.push("/chat")}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
