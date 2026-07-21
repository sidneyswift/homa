import { Linking, Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { ageInMonths, isInScoredRange } from "@homa/core";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { env } from "../../lib/env";
import type { PlannerData } from "../../lib/planner";
import { openWebOnboarding } from "../../lib/web-links";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, palette, radius, space } from "../../theme/tokens";
import { buildWeekBoard, type BoardDay, type BoardItem, type FocusRow } from "./build-board";
import { KidAvatar } from "./kid-avatar";

/**
 * The week board as a Monday-to-Friday stack, ported from
 * apps/web/app/app/planner/planner-view.tsx and day-grid.tsx. One
 * column like the web's chat-canvas surface: five side-by-side columns
 * would crush on a phone. Read-only on purpose: web check-offs write
 * through the server's plan-progress route, and a raw client write here
 * would corrupt them (founder ruling, planner-canvas-chat), so this
 * board shows the synced check-offs and points changes at Homa in chat.
 */

/** Web path helper, same normalization as lib/web-links.ts. */
function openWebPath(path: string): void {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  void Linking.openURL(`${env.apiUrl.replace(/\/+$/, "")}${normalizedPath}`);
}

/** Read-only check-off state: sage-filled check when the synced plan row
 * says done, a quiet hollow circle otherwise. */
function CheckState({ done }: { done: boolean }) {
  const size = 18;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: done ? colors.sage : "transparent",
        borderWidth: done ? 0 : 1.5,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {done ? (
        <Svg width={10} height={10} viewBox="0 0 10 10">
          <Path
            d="M1.5 5.5 L4 8 L8.5 2.5"
            stroke={colors.onBrand}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      ) : null}
    </View>
  );
}

function FocusStripRow({ row }: { row: FocusRow }) {
  return (
    <View
      style={{
        backgroundColor: row.tone.bg,
        borderRadius: radius.sm,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        gap: space.xs,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: space.sm,
        }}
      >
        <KidAvatar
          name={row.kidName}
          index={row.kidIndex}
          avatarUrl={row.kidAvatarUrl}
          size={22}
        />
        <Text
          style={{
            fontFamily: fontFamilies.bodyBold,
            fontSize: 10,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            color: row.tone.ink,
          }}
        >
          {row.subjectLabel}
        </Text>
        <Text
          style={{
            fontFamily: fontFamilies.bodySemibold,
            fontSize: 10,
            color: row.tone.ink,
          }}
        >
          week {row.weekNumber} of 4
        </Text>
        {row.retestDue ? (
          <View
            style={{
              backgroundColor: colors.goldSoft,
              borderRadius: radius.pill,
              paddingHorizontal: space.sm,
              paddingVertical: 2,
            }}
          >
            {/* Same wording as web: goldInk on gold, never red/"behind". */}
            <Text
              style={{
                fontFamily: fontFamilies.bodyBold,
                fontSize: 9,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: palette.goldInk,
              }}
            >
              re-check ready
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        style={{
          fontFamily: fontFamilies.body,
          fontSize: 13,
          lineHeight: 18,
          color: colors.textBody,
        }}
      >
        <Text style={{ fontFamily: fontFamilies.bodySemibold }}>{row.focusPrefix}</Text>{" "}
        {row.focus}
      </Text>
      {/* "month", never "plan": one name per concept, and this surface's
          empty state defines the month (copy-editor gate 2026-07-11). */}
      <Pressable
        accessibilityRole="link"
        onPress={() => openWebPath(row.monthPath)}
        hitSlop={space.sm}
        style={{ alignSelf: "flex-start" }}
      >
        <Text
          style={{
            fontFamily: fontFamilies.bodySemibold,
            fontSize: fontSize.xs,
            color: colors.brand,
          }}
        >
          full month
        </Text>
      </Pressable>
    </View>
  );
}

function ActivityRow({ item }: { item: BoardItem }) {
  return (
    <View
      style={{
        backgroundColor: item.tone.bg,
        borderRadius: radius.sm,
        padding: 10,
        gap: 6,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space.sm,
        }}
      >
        <Text
          style={{
            fontFamily: fontFamilies.bodyBold,
            fontSize: 9,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            color: item.tone.ink,
          }}
        >
          {item.subjectLabel}
        </Text>
        <KidAvatar
          name={item.kidName}
          index={item.kidIndex}
          avatarUrl={item.kidAvatarUrl}
          size={18}
        />
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}>
        <CheckState done={item.done} />
        {/* Done = sage check + faded text, no strikethrough: these are
            multi-sentence activities, and a line through a paragraph
            made the week's anchor unreadable (reader gate 2026-07-11). */}
        <Text
          style={{
            flex: 1,
            fontFamily: fontFamilies.body,
            fontSize: 13,
            lineHeight: 18,
            color: item.done ? colors.textSubtle : colors.textBody,
          }}
        >
          {item.text}
        </Text>
      </View>
    </View>
  );
}

function DayCard({ day }: { day: BoardDay }) {
  return (
    <Card
      style={{
        padding: 10,
        gap: space.sm,
        borderColor: day.cell.isToday ? colors.brand : colors.borderSubtle,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            fontFamily: fontFamilies.bodyBold,
            fontSize: 11,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: day.cell.isToday ? colors.brand : colors.textSubtle,
          }}
        >
          {day.cell.label} {day.cell.dayOfMonth}
        </Text>
        {day.cell.isToday ? (
          <View
            style={{
              backgroundColor: colors.brand,
              borderRadius: radius.pill,
              paddingHorizontal: space.sm,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                fontFamily: fontFamilies.bodyBold,
                fontSize: 9,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: colors.onBrand,
              }}
            >
              today
            </Text>
          </View>
        ) : null}
      </View>
      {day.items.length > 0 ? (
        day.items.map((item) => <ActivityRow key={item.key} item={item} />)
      ) : (
        /* "Free", not "Open": on a page of verb-first buttons, "Open day"
           parses as an instruction to open something (copy-editor gate
           2026-07-11). */
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.xs,
            color: colors.textSubtle,
          }}
        >
          Free day
        </Text>
      )}
    </Card>
  );
}

/** The no-month empty state, ported from planner-view.tsx: define the
 * month first, then the mechanic; the buttons below are the door. The
 * checklist sentence joins only when a checklist button will render
 * below, so the word never arrives unexplained (copy-editor gate
 * 2026-07-11). */
function EmptyWeek({ data }: { data: PlannerData }) {
  const anyChecklist = data.children.some(
    (child) =>
      !data.reportTokens.get(child.id) && isInScoredRange(ageInMonths(child.birth_month)),
  );
  return (
    <Card style={{ alignItems: "center", gap: space.md }}>
      <Text
        style={{
          fontFamily: fontFamilies.displaySemibold,
          fontSize: fontSize.lg,
          color: colors.textStrong,
          textAlign: "center",
        }}
      >
        {"There's no month set up yet."}
      </Text>
      <Text
        style={{
          fontFamily: fontFamilies.body,
          fontSize: fontSize.sm,
          lineHeight: fontSize.sm * 1.45,
          color: colors.textMuted,
          textAlign: "center",
        }}
      >
        A month is four weeks of small activities. One tap in the progress report
        builds it, and this page fills in.
        {anyChecklist
          ? " The checklist is five minutes of questions that build the first progress report."
          : ""}
      </Text>
      <View style={{ gap: space.sm, alignSelf: "stretch" }}>
        {data.children.map((child) => {
          const token = data.reportTokens.get(child.id);
          if (token) {
            return (
              <Button
                key={child.id}
                label={`Open ${child.name}'s report`}
                size="sm"
                onPress={() => openWebPath(`/onboarding/r/${token}`)}
              />
            );
          }
          if (isInScoredRange(ageInMonths(child.birth_month))) {
            return (
              <Button
                key={child.id}
                label={`Start ${child.name}'s checklist`}
                size="sm"
                variant="secondary"
                onPress={() => void openWebOnboarding()}
              />
            );
          }
          return null;
        })}
      </View>
    </Card>
  );
}

export function PlannerBoard({
  data,
  timeZone,
  now,
}: {
  data: PlannerData;
  timeZone: string;
  now: Date;
}) {
  const board = buildWeekBoard(data, timeZone, now);

  if (board.focusRows.length === 0) {
    return <EmptyWeek data={data} />;
  }

  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: 6 }}>
        {board.focusRows.map((row) => (
          <FocusStripRow key={row.key} row={row} />
        ))}
      </View>

      <View style={{ gap: space.sm }}>
        {board.days.map((day) => (
          <DayCard key={day.cell.label} day={day} />
        ))}
      </View>

      {/* The web board's forgiveness line, plus the quiet affordance
          that stands in for its in-place checkboxes: check-offs write
          through the server, so from the app the door is chat. */}
      <Text
        style={{
          fontFamily: fontFamilies.body,
          fontSize: fontSize.xs,
          lineHeight: fontSize.xs * 1.5,
          color: colors.textMuted,
        }}
      >
        Any day counts: do the activities whenever they fit. To check something
        off or change the week, tell Homa in chat. Check-offs made on the month
        pages show up here too.
      </Text>
    </View>
  );
}
