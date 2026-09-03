import { useState } from "react";
import { Image, View } from "react-native";
import Animated, { FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";

import { Button } from "../../components/ui/button";
import { NativeText } from "../../components/ui/semantic";
import { colors, radius, space } from "../../theme/tokens";

/**
 * The making-wait's opening beat: before the checklist or the easel
 * takes over, every parent sees a short real tour of what else Homa
 * does. Real usage data (2026-09-01 investigation) showed families are
 * only ever shown worksheets; this uses time the wait already spends
 * rather than adding new screens to the funnel. Parent-paced, not a
 * timer (2026-09-01 direction): a tap is real interaction, an
 * auto-advancing timer is still just a fancier passive wait. Copy is
 * trimmed from the approved marketing capability items
 * (landing-content.ts), never invented fresh. The real job always wins:
 * making.tsx skips this the moment the page is ready, it never delays
 * the reveal, even mid-stack.
 */

const CARDS: readonly {
  key: string;
  image: number;
  title: string;
  body: string;
}[] = [
  {
    key: "plan",
    image: require("../../../assets/onboarding/making-feature-cards/plan.png"),
    title: "The weekly plan",
    body: "Tell Homa what each child studies and when. She builds the week.",
  },
  {
    key: "practice",
    image: require("../../../assets/onboarding/making-feature-cards/practice-pages.png"),
    title: "Practice pages",
    body: "This is what's happening right now.",
  },
  {
    key: "progress",
    image: require("../../../assets/onboarding/making-feature-cards/progress.png"),
    title: "Progress reports",
    body: "See what's going well and what to try next.",
  },
  {
    key: "hours",
    image: require("../../../assets/onboarding/making-feature-cards/hours.png"),
    title: "Teaching hours",
    body: "Report the time you taught. Homa records it by child and subject.",
  },
  {
    key: "chat",
    image: require("../../../assets/onboarding/making-feature-cards/chat.png"),
    title: "Just ask",
    body: "Ask for a change, a new page, or help with today's lesson, anytime.",
  },
];

export function MakingFeatureCards({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const isLast = index === CARDS.length - 1;
  const card = CARDS[index];

  function advance() {
    if (isLast) {
      onDone();
      return;
    }
    setIndex((current) => current + 1);
  }

  return (
    <View style={{ flex: 1, gap: space.md }}>
      <Animated.View
        key={card.key}
        entering={reduced ? undefined : FadeIn.duration(220)}
        exiting={reduced ? undefined : FadeOut.duration(160)}
        style={{ alignItems: "center", gap: space.sm }}
      >
        <View
          style={{
            width: 176,
            height: 176,
            borderRadius: radius.xl,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <Image
            source={card.image}
            style={{ width: 176, height: 176 }}
            resizeMode="contain"
            accessibilityLabel={card.title}
          />
        </View>
        <NativeText role="body" tone="strong" style={{ textAlign: "center" }}>
          {card.title}
        </NativeText>
        <NativeText role="bodySmall" tone="body" style={{ textAlign: "center" }}>
          {card.body}
        </NativeText>
      </Animated.View>

      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${index + 1} of ${CARDS.length}`}
        style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}
      >
        {CARDS.map((item, dotIndex) => (
          <View
            key={item.key}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: dotIndex === index ? colors.brand : colors.borderSubtle,
            }}
          />
        ))}
      </View>

      {/* marginTop:"auto" pins the button to the same bottom band as
          every other onboarding screen (hello/intent/kids/you), instead
          of it sitting wherever the card content's natural height
          happened to end (founder catch 2026-09-02, gh#304). */}
      <View style={{ marginTop: "auto" }}>
        <Button
          label={isLast ? "Continue" : "Next"}
          size="lg"
          testID="making.featureCards.continue"
          onPress={advance}
        />
      </View>
    </View>
  );
}
