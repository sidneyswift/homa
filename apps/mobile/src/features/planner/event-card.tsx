import { Pressable, Text, View } from "react-native";

import type { FamilyEventRecord } from "../../lib/family-events";
import { fontFamilies , colors, fontSize, palette, radius, space } from "../../theme/app2";
import { kidTone } from "./kid-tone";

function formatTime(time: string | null): string | null {
  if (!time) return null;
  const [hourString, minute] = time.split(":");
  const hour = Number(hourString);
  const period = hour >= 12 ? "pm" : "am";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return minute === "00" ? `${twelveHour}${period}` : `${twelveHour}:${minute}${period}`;
}

/**
 * One family_event, ported in spirit from apps/web/app/app/calendar/
 * calendar-view.tsx: whole-family events (child_id null) get the woven
 * kid-tone stripe, a single kid's event gets that kid's tone.
 */
export function EventCard({
  event,
  childIndex,
  audienceLabel,
  onPress,
}: {
  event: FamilyEventRecord;
  childIndex: number | null;
  audienceLabel: string;
  onPress?: () => void;
}) {
  const [background, textColor] =
    childIndex === null ? [palette.stone100, colors.textBody] : kidTone(childIndex);
  const startTime = formatTime(event.start_time);
  const endTime = formatTime(event.end_time);
  const timeLabel =
    startTime && endTime ? `${startTime}–${endTime}` : startTime ? startTime : "All day";

  const content = (
    <>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: textColor }}>
          {event.title}
        </Text>
        <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: textColor }}>
          {timeLabel} · {audienceLabel}
        </Text>
      </View>
    </>
  );
  const style = {
    minHeight: 44,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space.sm,
    backgroundColor: background,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  };

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={`${event.title}. ${audienceLabel}. ${timeLabel}`} style={style}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${event.title}. ${audienceLabel}. ${timeLabel}`}
      onPress={onPress}
      style={style}
    >
      {content}
    </Pressable>
  );
}
