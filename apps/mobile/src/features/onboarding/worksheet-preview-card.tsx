import { View } from "react-native";
import Animated, { FadeIn, LinearTransition, useReducedMotion } from "react-native-reanimated";

import { NativeText } from "../../components/ui/semantic";
import { colors, radius, shadows, space } from "../../theme/app2";

/**
 * The worksheet taking shape while she answers the kid card (gauntlet
 * round 1, 2026-11-04). Four blind reviewers found the kid steps left a
 * third of the screen empty and gave her nothing back for each answer;
 * the visual reviewer's fix was a paper card that fills in as she types.
 *
 * Everything on it is what the real page is built from (name, age,
 * interests, the subject it practices), never a guessed title or a
 * preview of content that does not exist yet. Unknown fields show as
 * blank rule lines, the way an unfilled worksheet looks.
 */

/**
 * Display-only glyphs for the interest chips; the saved value stays the
 * word. Each has color of its own: a black glyph (paw prints, a music
 * note) vanished on a selected charcoal chip.
 */
export const INTEREST_GLYPHS: Readonly<Record<string, string>> = {
  dinosaurs: "🦕",
  animals: "🦊",
  trucks: "🚚",
  princesses: "👑",
  bugs: "🐞",
  drawing: "🖍️",
  music: "🎸",
  blocks: "🧱",
  "playing outside": "🌳",
  space: "🚀",
  sports: "⚽",
  "video games": "🎮",
  baking: "🧁",
  anime: "✨",
  art: "🎨",
  coding: "💻",
  "fantasy books": "🐉",
};

/** Sentence case on screen to match the subject chips; the saved value keeps her casing. */
export function interestWithGlyph(interest: string): string {
  const trimmed = interest.trim();
  const shown = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  const glyph = INTEREST_GLYPHS[trimmed.toLowerCase()];
  return glyph ? `${glyph} ${shown}` : shown;
}

export function WorksheetPreviewCard({
  name,
  age,
  interests,
  subjects,
}: {
  name: string;
  age: number | null;
  interests: string[];
  subjects: string[];
}) {
  const reduced = useReducedMotion();
  const trimmed = name.trim();
  const appear = reduced ? undefined : FadeIn.duration(240);
  const layout = reduced ? undefined : LinearTransition.duration(220);
  const tags = [
    ...interests.map(interestWithGlyph),
    ...subjects.filter((subject) => subject !== "I'm not sure yet"),
  ];

  return (
    <Animated.View
      layout={layout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        trimmed
          ? `${trimmed}'s worksheet so far${tags.length ? `: ${tags.join(", ")}` : ""}`
          : "A blank worksheet"
      }
      style={{
        transform: [{ rotate: "-1.5deg" }],
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        paddingHorizontal: space.md,
        paddingVertical: space.sm + 4,
        gap: space.xs + 2,
        ...shadows.md,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.sm }}>
        <NativeText role="caption" tone="muted">
          Name
        </NativeText>
        <View style={{ flex: 1, borderBottomWidth: 1, borderColor: colors.border, minHeight: 22 }}>
          {trimmed ? (
            <Animated.View key={trimmed.length > 0 ? "named" : "blank"} entering={appear}>
              <NativeText role="label" tone="strong" numberOfLines={1}>
                {trimmed}
              </NativeText>
            </Animated.View>
          ) : null}
        </View>
        {age !== null ? (
          <Animated.View
            entering={appear}
            style={{
              paddingHorizontal: space.sm,
              paddingVertical: 2,
              borderRadius: radius.pill,
              backgroundColor: colors.surfaceSunken,
            }}
          >
            <NativeText role="caption" tone="strong">
              {age >= 13 ? "Age 13+" : `Age ${age}`}
            </NativeText>
          </Animated.View>
        ) : null}
      </View>

      <NativeText role="body" tone={trimmed ? "strong" : "muted"} numberOfLines={1}>
        {trimmed ? `${trimmed}'s worksheet` : "Your kid's worksheet"}
      </NativeText>

      {tags.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
          {tags.map((tag) => (
            <Animated.View
              key={tag}
              entering={appear}
              layout={layout}
              style={{
                paddingHorizontal: space.sm,
                paddingVertical: 2,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
              }}
            >
              <NativeText role="caption" tone="strong">
                {tag}
              </NativeText>
            </Animated.View>
          ))}
        </View>
      ) : (
        // Blank rule lines until her answers arrive; then the answers are
        // the content, and the card stays short enough that the forward
        // button never drops below the fold on the interests step.
        <View style={{ gap: 6, paddingVertical: 2 }}>
          <View style={{ height: 6, width: "72%", borderRadius: 3, backgroundColor: colors.surfaceSunken }} />
          <View style={{ height: 6, width: "54%", borderRadius: 3, backgroundColor: colors.surfaceSunken }} />
        </View>
      )}
    </Animated.View>
  );
}
