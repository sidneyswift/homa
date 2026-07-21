import { Text, View } from "react-native";

import { Card } from "../../components/ui/card";
import type { TaskRow } from "../../lib/tasks";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, palette, radius, space } from "../../theme/tokens";
import { BUILT_IN_COPY } from "./task-copy";
import {
  deliveryLabel,
  hourLabel,
  nextRunLabel,
  weekdaysLabel,
} from "./task-format";
import { TaskKindIcon } from "./task-icons";

/**
 * One scheduled task, ported from the web TaskCard
 * (app/app/tasks/tasks-view.tsx) minus its writes: the web card opens
 * an editor dialog and carries the pause switch, both of which run
 * through server actions the app cannot call, so here the card just
 * tells the truth (the screen's chat note is the one change door). The
 * icon disc and the Next/Off chip still wear the on/off state, so it
 * reads from across the room.
 */

const MID_DOT = "·";

export function TaskCard({
  task,
  timeZone,
  now,
}: {
  task: TaskRow;
  timeZone: string;
  /** One clock instant for the whole render, so sibling cards never
   * disagree about what counts as upcoming (web parity: the server's
   * render instant). */
  now: Date;
}) {
  const on = !task.paused;
  const copy =
    task.kind === "custom"
      ? { label: task.label ?? "Your task", description: task.prompt ?? "" }
      : BUILT_IN_COPY[task.kind];
  // next_run_at lags the scheduler on purpose (it advances after a run
  // finishes, and a failed run keeps it until the retry). A timestamp
  // already in the past would contradict History right below, so those
  // windows say "soon" instead (web parity).
  const upcoming =
    on && task.nextRunAt !== null && new Date(task.nextRunAt).getTime() > now.getTime();
  const next =
    upcoming && task.nextRunAt !== null ? nextRunLabel(task.nextRunAt, timeZone) : null;

  return (
    <Card style={{ padding: space.md, gap: space.sm + space.xs }}>
      <View style={{ flexDirection: "row", gap: space.sm + space.xs }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: on ? colors.brandSoft : colors.surfaceSunken,
          }}
        >
          <TaskKindIcon
            kind={task.kind}
            color={on ? colors.brand : colors.textSubtle}
            size={18}
          />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontFamily: fontFamilies.bodySemibold,
              fontSize: fontSize.base,
              color: colors.textStrong,
            }}
          >
            {copy.label}
          </Text>
          {copy.description ? (
            <Text
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.sm,
                color: on ? colors.textMuted : colors.textSubtle,
              }}
            >
              {copy.description}
            </Text>
          ) : null}
          <Text
            style={{
              marginTop: space.xs,
              fontFamily: fontFamilies.bodySemibold,
              fontSize: fontSize.xs,
              color: colors.textSubtle,
            }}
          >
            {weekdaysLabel(task.weekdays)} {MID_DOT} {hourLabel(task.localHour)}{" "}
            {MID_DOT} {deliveryLabel(task.deliveryPref)}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row" }}>
        {on ? (
          // "soon" instead of a stale timestamp when next_run_at is in
          // the past; nothing at all when the row has never scheduled.
          next || task.nextRunAt !== null ? (
            <StateChip
              label={`Next ${MID_DOT} ${next ?? "soon"}`}
              tone="on"
            />
          ) : null
        ) : (
          <StateChip label="Off" tone="off" />
        )}
      </View>
    </Card>
  );
}

function StateChip({ label, tone }: { label: string; tone: "on" | "off" }) {
  return (
    <View
      style={{
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: space.xs,
        backgroundColor: tone === "on" ? colors.brandSoft : colors.surfaceSunken,
      }}
    >
      <Text
        style={{
          fontFamily: fontFamilies.bodyBold,
          fontSize: fontSize.xs,
          // Clay ink on the soft clay chip, the same raw-token pairing
          // the web's Next chip uses (text-[var(--clay-700)] on
          // bg-brand-soft); no semantic alias covers it yet.
          color: tone === "on" ? palette.clay700 : colors.textMuted,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/**
 * Placeholder for a built-in kind whose row has not been seeded yet,
 * ported from the web's DarkKindCard: dashed border, muted disc, one
 * plain note about when it arrives.
 */
export function PlaceholderKindCard({
  kind,
  note,
}: {
  kind: "morning_brief" | "journal_prompt";
  note: string;
}) {
  const copy = BUILT_IN_COPY[kind];
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: colors.borderSubtle,
        padding: space.md,
      }}
    >
      <View style={{ flexDirection: "row", gap: space.sm + space.xs }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surfaceSunken,
          }}
        >
          <TaskKindIcon kind={kind} color={colors.textSubtle} size={18} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontFamily: fontFamilies.bodySemibold,
              fontSize: fontSize.base,
              color: colors.textStrong,
            }}
          >
            {copy.label}
          </Text>
          <Text
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              color: colors.textMuted,
            }}
          >
            {copy.description}
          </Text>
          <Text
            style={{
              marginTop: space.xs,
              fontFamily: fontFamilies.bodySemibold,
              fontSize: fontSize.xs,
              color: colors.textSubtle,
            }}
          >
            {note}
          </Text>
        </View>
      </View>
    </View>
  );
}
