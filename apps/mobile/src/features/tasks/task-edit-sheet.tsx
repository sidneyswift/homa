import { useRef, useState, type ReactNode, type RefObject } from "react";
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AccessibleModal } from "../../components/ui/accessible-modal";
import { Icon } from "../../components/design/icon";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { InlineError } from "../../components/ui/inline-error";
import {
  createTask,
  deleteTask,
  runTaskNow,
  updateTask,
  updateTaskSchedule,
  type TaskRowView,
} from "../../lib/tasks";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
import { DeliveryChoice, HourChips, WeekdayChips, type DeliveryPref } from "./task-form-fields";
import { BUILT_IN_COPY } from "./task-view";

/**
 * The task editor sheet, ported from apps/web/app/app/tasks/
 * task-edit-overlay.tsx + task-form.tsx. task = null means create a new
 * custom task. Built-in kinds (morning brief, evening check-in) keep
 * their fixed words and expose only the schedule; custom tasks get the
 * full form plus delete. Render with `key={task?.id ?? "create"}` (or
 * "closed" when hidden) so fields reset between different tasks, the
 * same invariant apps/mobile/src/features/hours/entry-editor.tsx
 * documents for its own form.
 */

const inputStyle = {
  fontFamily: fontFamilies.body,
  fontSize: fontSize.base,
  color: colors.textBody,
  backgroundColor: colors.card,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.sm,
  minHeight: 48,
  padding: space.sm,
} as const;

function TaskActionPair({ first, second }: { first: ReactNode; second: ReactNode }) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale >= 1.4;
  return (
    <View style={{ flexDirection: stacked ? "column" : "row", gap: space.sm }}>
      <View style={stacked ? undefined : { flex: 1 }}>{first}</View>
      <View style={stacked ? undefined : { flex: 1 }}>{second}</View>
    </View>
  );
}

function SheetHeader({ title, headingRef, onClose }: { title: string; headingRef: RefObject<View | null>; onClose: () => void }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: space.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      <View ref={headingRef} accessible accessibilityRole="header" accessibilityLabel={title} style={{ flex: 1 }}>
        <Text style={{ fontFamily: fontFamilies.display, fontSize: fontSize.lg, color: colors.textStrong }}>
          {title}
        </Text>
      </View>
      <IconButton label={`Close ${title.toLowerCase()}`} onPress={onClose}>
        <Icon name="close" size={24} color={colors.textSubtle} />
      </IconButton>
    </View>
  );
}

function RunNowSection({ taskId, onDone }: { taskId: string; onDone: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePress() {
    setPending(true);
    setError(null);
    const result = await runTaskNow(taskId);
    setPending(false);
    if (result.ok) {
      onDone();
    } else {
      setError("Homa couldn't start this run. Try again in a bit.");
    }
  }

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: space.sm, gap: space.xs }}>
      <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
        Homa runs this task right away, exactly as saved. The result shows up in Task history. The schedule
        stays the same.
      </Text>
      <Button
        label={pending ? "Starting…" : "Run now"}
        variant="secondary"
        icon={<Icon name="play" size={16} color={colors.textStrong} />}
        onPress={() => void handlePress()}
        disabled={pending}
      />
      {error ? <InlineError message={error} /> : null}
    </View>
  );
}

function DeleteTaskSection({ task, onDeleted }: { task: TaskRowView; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const name = task.label ?? "Your task";

  async function handleDelete() {
    setPending(true);
    const result = await deleteTask(task.id);
    setPending(false);
    if (result.ok) onDeleted();
  }

  if (!confirming) {
    return (
      <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: space.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete this task"
          onPress={() => setConfirming(true)}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textMuted }}>
            Delete this task
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: space.sm, gap: space.sm }}>
      <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textMuted }}>
        {`Delete "${name}"? This can't be undone.`}
      </Text>
      <TaskActionPair
        first={<Button label="Keep" variant="secondary" onPress={() => setConfirming(false)} />}
        second={<Button label={pending ? "Deleting…" : "Delete"} onPress={() => void handleDelete()} disabled={pending} />}
      />
    </View>
  );
}

function BuiltInScheduleSection({
  task,
  textingLinked,
  onDone,
  onChanged,
}: {
  task: TaskRowView;
  textingLinked: boolean;
  onDone: () => void;
  onChanged: () => void;
}) {
  const [weekdays, setWeekdays] = useState(() => new Set(task.weekdays));
  const [hour, setHour] = useState(task.localHour);
  const [delivery, setDelivery] = useState<DeliveryPref>(task.deliveryPref);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (weekdays.size === 0) {
      setError("Pick at least one day.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await updateTaskSchedule(task.id, {
      weekdays: [...weekdays],
      localHour: hour,
      deliveryPref: delivery,
    });
    setPending(false);
    if (result.ok) {
      onChanged();
      onDone();
    } else {
      setError("That didn't save. Try again.");
    }
  }

  return (
    <View style={{ gap: space.md }}>
      <WeekdayChips selected={weekdays} onChange={setWeekdays} />
      <HourChips hour={hour} onChange={setHour} />
      <DeliveryChoice value={delivery} onChange={setDelivery} textingLinked={textingLinked} />
      {error ? <InlineError message={error} /> : null}
      <TaskActionPair
        first={<Button label={pending ? "Saving…" : "Save changes"} onPress={() => void handleSave()} disabled={pending} />}
        second={<Button label="Cancel" variant="secondary" onPress={onDone} />}
      />
    </View>
  );
}

function CustomTaskFormSection({
  task,
  textingLinked,
  onDone,
  onChanged,
}: {
  task: TaskRowView | null;
  textingLinked: boolean;
  onDone: () => void;
  onChanged: () => void;
}) {
  const [label, setLabel] = useState(task?.label ?? "");
  const [prompt, setPrompt] = useState(task?.prompt ?? "");
  const [weekdays, setWeekdays] = useState(() => new Set(task?.weekdays ?? [1, 2, 3, 4, 5]));
  // 3pm, not 9am: the morning brief already texts at 9, so a new task
  // should not stack on it unless the parent picks that on purpose.
  const [hour, setHour] = useState(task?.localHour ?? 15);
  const [delivery, setDelivery] = useState<DeliveryPref>(task?.deliveryPref ?? "text");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmedLabel = label.trim();
    const trimmedPrompt = prompt.trim();
    if (trimmedLabel.length < 3) {
      setError("Give the task a short name (at least 3 characters).");
      return;
    }
    if (trimmedPrompt.length < 10) {
      setError("Tell Homa what to do in a sentence or two.");
      return;
    }
    if (weekdays.size === 0) {
      setError("Pick at least one day.");
      return;
    }
    setPending(true);
    setError(null);
    const input = {
      label: trimmedLabel,
      prompt: trimmedPrompt,
      weekdays: [...weekdays],
      localHour: hour,
      deliveryPref: delivery,
    };
    const result = task ? await updateTask(task.id, input) : await createTask(input);
    setPending(false);
    if (result.ok) {
      onChanged();
      onDone();
    } else {
      setError("That didn't save. Try again.");
    }
  }

  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: space.xs }}>
        <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
          What should it be called?
        </Text>
        <TextInput
          accessibilityLabel="Task name"
          value={label}
          onChangeText={setLabel}
          placeholder="Phonics game ideas"
          placeholderTextColor={colors.textMuted}
          maxLength={60}
          style={inputStyle}
        />
      </View>
      <View style={{ gap: space.xs }}>
        <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
          What should Homa do?
        </Text>
        <TextInput
          accessibilityLabel="Task instructions"
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Find one new phonics game and explain how to play it."
          placeholderTextColor={colors.textMuted}
          maxLength={1000}
          multiline
          numberOfLines={3}
          style={[inputStyle, { minHeight: 84, textAlignVertical: "top" }]}
        />
      </View>
      <WeekdayChips selected={weekdays} onChange={setWeekdays} />
      <HourChips hour={hour} onChange={setHour} />
      <DeliveryChoice value={delivery} onChange={setDelivery} textingLinked={textingLinked} />
      {error ? <InlineError message={error} /> : null}
      <TaskActionPair
        first={(
          <Button
            label={pending ? "Saving…" : task ? "Save changes" : "Add this task"}
            onPress={() => void handleSave()}
            disabled={pending}
          />
        )}
        second={<Button label="Cancel" variant="secondary" onPress={onDone} />}
      />
    </View>
  );
}

export function TaskEditSheet({
  visible,
  task,
  textingLinked,
  onClose,
  onChanged,
}: {
  visible: boolean;
  /** null while creating; the row being edited otherwise. */
  task: TaskRowView | null;
  textingLinked: boolean;
  onClose: () => void;
  /** Called after any successful write, so the screen can reload. */
  onChanged: () => void;
}) {
  const builtIn = task && task.kind !== "custom" ? BUILT_IN_COPY[task.kind] : null;
  const heading = builtIn ? builtIn.label : task ? "Edit task" : "Add a task";
  const headingRef = useRef<View>(null);

  function handleDeleted() {
    onChanged();
    onClose();
  }

  return (
    <AccessibleModal visible={visible} title={heading} initialFocusRef={headingRef} onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
        <SheetHeader title={heading} headingRef={headingRef} onClose={onClose} />
        <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
          {builtIn && task ? (
            <>
              <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}>
                {builtIn.description}
              </Text>
              <BuiltInScheduleSection task={task} textingLinked={textingLinked} onDone={onClose} onChanged={onChanged} />
              <RunNowSection taskId={task.id} onDone={onChanged} />
            </>
          ) : (
            <>
              <CustomTaskFormSection task={task} textingLinked={textingLinked} onDone={onClose} onChanged={onChanged} />
              {task ? <RunNowSection taskId={task.id} onDone={onChanged} /> : null}
              {task ? <DeleteTaskSection task={task} onDeleted={handleDeleted} /> : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </AccessibleModal>
  );
}
