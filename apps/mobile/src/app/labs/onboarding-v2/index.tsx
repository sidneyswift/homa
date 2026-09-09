import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { NativeText } from "../../../components/ui/semantic";
import { useAccessibilityAnnouncement } from "../../../lib/accessibility";
import { IntroductionArt, type IntroductionBenefit } from "../../../features/onboarding-v2/IntroductionArt";
import { PrimaryButton } from "../../../features/onboarding-v2/controls";
import { v2Colors, v2Radii, v2Space, v2Type } from "../../../features/onboarding-v2/theme";

/**
 * Founder-approved feature carousel replaces the lab's welcome.
 * Its intended place is after signup; the lab remains independently
 * previewable until v2 is connected to real account setup.
 */
const BENEFITS: { id: IntroductionBenefit; title: string; description: string }[] = [
  { id: "lessons", title: "Lessons made for your kids.", description: "Custom printable lessons, ready to use." },
  { id: "progress", title: "See what they're learning.", description: "A clear picture of your child's progress." },
  { id: "hours", title: "Your homeschool hours, organized.", description: "Keep your hours together in one place." },
];

export default function IntroductionScreen() {
  const router = useRouter();
  const { width, height, fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const pager = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeights, setContentHeights] = useState<Record<string, number>>({});
  const compact = height < 760 || fontScale > 1.2;
  useAccessibilityAnnouncement(`Page ${page + 1} of ${BENEFITS.length}. ${BENEFITS[page].title}`, page);

  // Re-align after rotation and button/dot navigation. The index belongs
  // to this mounted route, so Back from About you keeps the final slide.
  useEffect(() => {
    pager.current?.scrollTo({ x: page * width, animated: !reducedMotion });
  }, [page, width, reducedMotion]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (page === 0) return false;
      setPage(page - 1);
      return true;
    });
    return () => subscription.remove();
  }, [page]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: v2Colors.page }}>
      <View style={{ minHeight: 44, paddingHorizontal: v2Space.lg, alignItems: "flex-start" }}>
        {page > 0 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => setPage(page - 1)}
            style={{ minHeight: 44, minWidth: 44, justifyContent: "center" }}>
            <NativeText style={[v2Type.control, { color: v2Colors.coral }]}>Back</NativeText>
          </Pressable>
        ) : null}
      </View>

      <ScrollView ref={pager} horizontal pagingEnabled directionalLockEnabled showsHorizontalScrollIndicator={false}
        bounces={false} style={{ flex: 1 }}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        onMomentumScrollEnd={(event) => {
          const next = Math.round(event.nativeEvent.contentOffset.x / width);
          setPage(Math.max(0, Math.min(BENEFITS.length - 1, next)));
        }}>
        {BENEFITS.map((benefit, index) => (
          <ScrollView key={benefit.id} style={{ width }} directionalLockEnabled showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1 }}
            bounces={false}
            scrollEnabled={(contentHeights[benefit.id] ?? 0) > viewportHeight + 1}
            onContentSizeChange={(_width, contentHeight) => {
              setContentHeights((previous) => previous[benefit.id] === contentHeight
                ? previous : { ...previous, [benefit.id]: contentHeight });
            }}
            accessibilityElementsHidden={page !== index}
            importantForAccessibility={page === index ? "auto" : "no-hide-descendants"}>
            <View style={{ paddingHorizontal: v2Space.lg, paddingTop: compact ? v2Space.sm : v2Space.xl }}>
              <NativeText accessibilityRole="header"
                style={[v2Type.hero, { color: v2Colors.ink, maxWidth: 290, minHeight: v2Type.hero.lineHeight * 2 }]}>
                {benefit.title}
              </NativeText>
              <NativeText style={[v2Type.chip, { color: v2Colors.inkMuted, maxWidth: 310, marginTop: v2Space.md, minHeight: v2Type.chip.lineHeight * 2 }]}>
                {benefit.description}
              </NativeText>
              <View style={{ flexDirection: "row", justifyContent: "center", marginTop: v2Space.md }}>
                {BENEFITS.map((destination, dot) => (
                  <Pressable key={destination.id} accessibilityRole="button"
                    accessibilityLabel={`Page ${dot + 1} of ${BENEFITS.length}: ${destination.title}`}
                    accessibilityState={{ selected: dot === index }} onPress={() => setPage(dot)}
                    style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                    <View style={{ width: dot === index ? 10 : 6, height: dot === index ? 10 : 6,
                      borderRadius: v2Radii.pill, backgroundColor: dot === index ? v2Colors.midnight : v2Colors.inkMuted,
                      opacity: dot === index ? 1 : 0.4 }} />
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={{ flex: 1, justifyContent: "flex-end", paddingTop: v2Space.md }}>
              <IntroductionArt benefit={benefit.id} width={Math.min(width, 480)} />
            </View>
          </ScrollView>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: v2Space.lg, paddingTop: v2Space.md, paddingBottom: v2Space.md }}>
        <PrimaryButton label={page === BENEFITS.length - 1 ? "Let's get started" : "Continue"}
          onPress={() => {
            if (page < BENEFITS.length - 1) setPage(page + 1);
            else router.push("/labs/onboarding-v2/about-you");
          }} />
      </View>
    </SafeAreaView>
  );
}
