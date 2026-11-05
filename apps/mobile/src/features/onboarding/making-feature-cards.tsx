import { useState } from "react";
import { Image, View } from "react-native";
import Animated, { FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";

import { Button } from "../../components/ui/button";
import { NativeText } from "../../components/ui/semantic";
import { colors, radius, space } from "../../theme/app2";

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

interface FeatureCard {
  key: string;
  image: number;
  title: string;
  body: string;
}

/**
 * The tour teaches the whole app on her child's terms (founder direction
 * 2026-11-04: "the app is way more than a worksheet... progress reports
 * ... lesson logging: I want onboarding to teach all of that"). Each
 * card stays close to its approved capability line in landing-content.ts
 * and names her child, so it reads as what Homa will do for Lena, not an
 * ad (gauntlet round 0: five generic cards "felt like an ad"). The three
 * things she will use most lead: the page, the report, the log.
 */
function featureCards(
  childName: string | null,
  interest: string | null,
  stateName: string | null,
): FeatureCard[] {
  const kid = childName ?? "your kid";
  const kids = childName ? `${childName}'s` : "Your kid's";
  // Round 3 reviewers (2026-11-04) could not say what the log was FOR;
  // the state she picked a screen earlier is the reason it exists.
  const records = stateName ? `your ${stateName} homeschool records` : "your homeschool records";
  return [
    {
      key: "practice",
      image: require("../../../assets/onboarding/making-feature-cards/practice-pages.png"),
      title: `${kids} pages`,
      body: interest
        ? `Like the ${interest.toLowerCase()} page I'm making right now. A new one whenever you ask.`
        : "Like the one I'm making right now. A new one whenever you ask.",
    },
    {
      key: "progress",
      image: require("../../../assets/onboarding/making-feature-cards/progress.png"),
      title: `${kids} progress report`,
      body: `Answer what you can, and I'll show you where ${kid} is in each subject and what to try next.`,
    },
    {
      key: "hours",
      image: require("../../../assets/onboarding/making-feature-cards/hours.png"),
      title: "Your lesson log",
      body: `Tell me what you taught, by text or voice. I log it by child and subject, so ${records} are ready when you need them.`,
    },
    {
      key: "plan",
      image: require("../../../assets/onboarding/making-feature-cards/plan.png"),
      title: "The weekly plan",
      body: `Tell me what ${kid} studies and when. I'll build the week.`,
    },
    {
      key: "chat",
      image: require("../../../assets/onboarding/making-feature-cards/chat.png"),
      title: "Just ask",
      body: "Ask for a change, a new page, or help with today's lesson, anytime.",
    },
  ];
}

export function MakingFeatureCards({
  onDone,
  childName = null,
  interest = null,
  stateName = null,
}: {
  onDone: () => void;
  childName?: string | null;
  interest?: string | null;
  stateName?: string | null;
}) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const CARDS = featureCards(childName, interest, stateName);
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
        {/* Full width, not a thumbnail: at 176pt the art took 43% of
            the width and left a quarter of the screen empty (gauntlet
            round 1, 2026-11-04). */}
        <View
          style={{
            width: 248,
            height: 248,
            borderRadius: radius.xl,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <Image
            source={card.image}
            style={{ width: 248, height: 248 }}
            resizeMode="contain"
            accessibilityLabel={card.title}
          />
        </View>
        <NativeText role="bodyLarge" tone="strong" style={{ textAlign: "center" }}>
          {card.title}
        </NativeText>
        <NativeText role="body" tone="muted" style={{ textAlign: "center" }}>
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
