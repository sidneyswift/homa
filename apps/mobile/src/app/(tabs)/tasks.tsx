import { Plus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BuiltInPlaceholderCard, TaskCard } from "../../features/tasks/task-card";
import { InlineError } from "../../components/ui/inline-error";
import { LoadingStatus } from "../../components/ui/loading-status";
import { TaskEditSheet } from "../../features/tasks/task-edit-sheet";
import { TaskHistoryRow } from "../../features/tasks/task-history-row";
import { groupRunsByDay, HISTORY_RUN_LIMIT } from "../../features/tasks/task-view";
import { useTasksData } from "../../features/tasks/use-tasks-data";
import { recordTaskFeedback, setTaskPaused, type ResearchBriefFeedbackSignal } from "../../lib/tasks";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

/**
 * Tasks: Homa's own schedule, ported from apps/web/app/app/tasks/
 * {page.tsx,tasks-view.tsx,task-history.tsx}. Full read/write (founder
 * direction, see docs/handoffs/HANDOFF-mobile-nav-parity.md): create,
 * edit, delete, pause, run now, and brief feedback all write through
 * apps/web/app/api/tasks/* (agent_schedules and homa_task_runs have no
 * client write policies, so this cannot go straight through RLS the
 * way Hours or Planner can).
 *
 * Scoped out of this v1, a tracked gap, not a silent one: the agent-job
 * "in progress" build cards. Web's own approve UI for those isn't live
 * yet either, so there is nothing stable to port (gh#40 tracker).
 */
export default function TasksScreen() {
  const { data, loading, error, reload } = useTasksData();
  const [creating, setCreating] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [pausingTaskId, setPausingTaskId] = useState<string | null>(null);
  const [nowMs] = useState(() => Date.now());
  const now = new Date(nowMs);

  const tasks = data?.tasks ?? [];
  const runs = data?.runs ?? [];
  const timeZone = data?.timeZone ?? "America/Chicago";
  const textingLinked = data?.textingLinked ?? false;
  const briefFlagOn = data?.briefFlagOn ?? false;
  const hasBrief = tasks.some((task) => task.kind === "morning_brief");
  const hasJournal = tasks.some((task) => task.kind === "journal_prompt");

  const editingTask = editingTaskId ? (tasks.find((task) => task.id === editingTaskId) ?? null) : null;
  const sheetVisible = creating || editingTaskId !== null;

  async function handleTogglePaused(taskId: string, nextPaused: boolean) {
    setPausingTaskId(taskId);
    await setTaskPaused(taskId, nextPaused);
    setPausingTaskId(null);
    void reload();
  }

  async function handleFeedback(taskRunId: string, signal: ResearchBriefFeedbackSignal): Promise<boolean> {
    const result = await recordTaskFeedback(taskRunId, signal);
    if (result.ok) void reload();
    return result.ok;
  }

  function closeSheet() {
    setCreating(false);
    setEditingTaskId(null);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={{ padding: space.md, gap: space.lg }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} />}
      >
        <View style={{ gap: 2 }}>
          <Text
            style={{
              fontFamily: fontFamilies.bodyBold,
              fontSize: 11,
              letterSpacing: 0.4,
              color: colors.textMuted,
              textTransform: "uppercase",
            }}
          >
            On her own schedule
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
            <Text accessibilityRole="header" style={{ fontFamily: fontFamilies.display, fontSize: fontSize.xxl, color: colors.textStrong }}>
              Homa&apos;s tasks
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a task"
              onPress={() => setCreating(true)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                minHeight: 44,
                backgroundColor: colors.brandHover,
                borderRadius: 999,
                paddingHorizontal: space.md,
                paddingVertical: space.xs,
              }}
            >
              <Plus size={16} color={colors.onBrand} />
              <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.onBrand }}>
                Add
              </Text>
            </Pressable>
          </View>
          <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}>
            Homa works on these by herself: morning briefs about your kids, evening check-ins, and any tasks
            you give her. Your kids&apos; week stays in the Planner tab.
          </Text>
        </View>

        {loading && !data ? (
          <View style={{ paddingVertical: space.xl, alignItems: "center" }}>
            <LoadingStatus label="Loading Homa's tasks" />
          </View>
        ) : null}

        {error ? <InlineError message={error} /> : null}

        {data ? (
          <View style={{ gap: space.sm }}>
            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: fontSize.xs, letterSpacing: 0.4, color: colors.textMuted, textTransform: "uppercase" }}>
              Scheduled
            </Text>
            {!hasBrief ? (
              <BuiltInPlaceholderCard
                kind="morning_brief"
                note={
                  briefFlagOn
                    ? "Starts on its own within a day. Nothing to set up."
                    : "Almost ready. It starts on its own, nothing to set up."
                }
              />
            ) : null}
            {!hasJournal ? (
              <BuiltInPlaceholderCard
                kind="journal_prompt"
                note="Off until you turn it on. The switch shows up here within a day."
              />
            ) : null}
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                timeZone={timeZone}
                now={now}
                pausePending={pausingTaskId === task.id}
                onPress={() => setEditingTaskId(task.id)}
                onTogglePaused={() => void handleTogglePaused(task.id, !task.paused)}
              />
            ))}
          </View>
        ) : null}

        {data ? (
          <View style={{ gap: space.sm }}>
            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: fontSize.xs, letterSpacing: 0.4, color: colors.textMuted, textTransform: "uppercase" }}>
              Task history
            </Text>
            {runs.length === 0 ? (
              <View style={{ paddingVertical: space.lg, alignItems: "center", gap: space.xs }}>
                <Text style={{ fontFamily: fontFamilies.display, fontSize: fontSize.lg, color: colors.textStrong }}>
                  Nothing here yet.
                </Text>
                <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center" }}>
                  When Homa finishes one of your tasks, it shows up here.
                </Text>
              </View>
            ) : (
              <View style={{ gap: space.md }}>
                {groupRunsByDay(runs, timeZone, now).map((group) => (
                  <View key={group.key} style={{ gap: space.xs }}>
                    <Text
                      style={{
                        fontFamily: fontFamilies.bodyBold,
                        fontSize: 11,
                        letterSpacing: 0.4,
                        color: colors.textMuted,
                        textTransform: "uppercase",
                      }}
                    >
                      {group.label}
                    </Text>
                    <View style={{ gap: space.xs }}>
                      {group.runs.map((run) => (
                        <TaskHistoryRow
                          key={run.id}
                          run={run}
                          timeZone={timeZone}
                          onFeedback={(signal) => handleFeedback(run.id, signal)}
                        />
                      ))}
                    </View>
                  </View>
                ))}
                <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textMuted, textAlign: "center" }}>
                  {runs.length >= HISTORY_RUN_LIMIT
                    ? "This page shows your newest 30 task updates. Older ones are kept, just not shown here."
                    : "That's everything so far."}
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <TaskEditSheet
        key={creating ? "create" : (editingTaskId ?? "closed")}
        visible={sheetVisible}
        task={creating ? null : editingTask}
        textingLinked={textingLinked}
        onClose={closeSheet}
        onChanged={() => void reload()}
      />
    </SafeAreaView>
  );
}
