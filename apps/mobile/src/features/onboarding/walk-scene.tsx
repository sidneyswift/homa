import type { ReactNode } from "react";
import { useEffect } from "react";
import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors, palette } from "../../theme/tokens";
import { HomaCharacter } from "../voice/homa-character";
import { DEFAULT_CHARACTER_SIZE, useWalkCharacterCurrent } from "./walk-character";

/**
 * The onboarding walk's persistent stage (founder direction 2026-08-21,
 * after a Headspace study, then the follow-up ruling: Homa STAYS while
 * screens change beneath her). WalkStage is mounted ONCE in the walk's
 * layout: warm sky, drawn horizon, and Homa standing on the crest, her
 * posture, prop, and sky color read from the walk context. Screens
 * render transparent content inside WalkSheet, which reserves the
 * stage's height, so navigation changes only the sheet and she never
 * blinks out or restarts her breath.
 *
 * Colors come only from the projected palette (design contract law):
 * clay50 sky (gold100 for the reveal's ceremony), page cream sheet,
 * the brand-clay mark. One size on every beat: a scale jump between
 * screens reads as a different creature, which is also why a change
 * eases rather than pops (see the "founder catch" comment below).
 */

const FIELD_HEIGHT = 104;
const CURVE_HEIGHT = 56;

/** How much a taller stage the vivid sky wants, independent of the
 * character-size growth below (2026-09-01: the panel measured Homa's
 * hero zone at 32% of screen height versus Headspace's 46% on the same
 * "sky plus mascot" region; a flat gold100 fill can be short and still
 * read fine, a real gradient wants room to actually show its stops). */
const VIVID_SKY_EXTRA_HEIGHT = 130;

/**
 * The state-change settle: same bezier feel as HomaCharacter's own
 * SETTLE curve (homa-character.tsx), duplicated locally since that file
 * doesn't export it and this is a different rig (the stage's size and
 * sky, not the character's internal posture). 350ms: close enough to
 * the screen's own ~350ms default fade (_layout.tsx's animation:"fade")
 * that the two read as one continuous motion, not a race.
 *
 * Founder catch 2026-09-02: hello -> intent used to pop the character
 * from 176px/vivid to 96px/clay the instant the new screen mounted,
 * underneath a fade that only touched the text. This eases both instead.
 */
const SETTLE = Easing.bezier(0.22, 0.8, 0.28, 1);
const SETTLE_MS = 350;

/** How much extra sky headroom a larger character needs so she never
 * clips against the stage's overflow:hidden top edge. Zero at the
 * default size, so every screen that never opts into a bigger size
 * gets the exact same field height as before this existed. */
function fieldHeightFor(size: number, isVivid: boolean): number {
  return (
    FIELD_HEIGHT +
    Math.max(0, size - DEFAULT_CHARACTER_SIZE) +
    (isVivid ? VIVID_SKY_EXTRA_HEIGHT : 0)
  );
}

/** The sky-plus-horizon height screens must reserve. Deliberately NOT
 * animated: the content below reflows once, immediately, to its final
 * resting position while the floating stage above it (see WalkStage)
 * eases into that same size, the visual motion the parent is actually
 * watching during a transition. */
export function useWalkStageHeight(): number {
  const insets = useSafeAreaInsets();
  const { size, sky } = useWalkCharacterCurrent();
  return insets.top + fieldHeightFor(size, sky === "vivid") + CURVE_HEIGHT;
}

/** Mounted once in the walk layout, floated ABOVE the navigator: a
 * native stack paints an opaque background over anything behind it, so
 * the persistent stage must sit on top. It is pointer-transparent and
 * only as tall as the sky, so screens stay fully interactive. */
export function WalkStage() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { state, act, sky, size } = useWalkCharacterCurrent();
  const isVivid = sky === "vivid";
  const reducedMotion = useReducedMotion();

  // The character's own `size` prop stays pinned at the current target,
  // never a moving value: HomaCharacter bakes size directly into its SVG
  // rig (unit = size/48, its own transformOrigin math), tuned per-size,
  // so animating that prop mid-transition would fight its own breathing
  // and blink timings. Instead an outer transform scale (below) creates
  // the visual shrink/grow, and this shared value eases toward whatever
  // `size` currently is; when it arrives, scale settles back to exactly 1.
  const animatedSize = useSharedValue(size);
  useEffect(() => {
    animatedSize.value = reducedMotion
      ? size
      : withTiming(size, { duration: SETTLE_MS, easing: SETTLE });
  }, [size, reducedMotion, animatedSize]);

  // Sky: a flat clay<->gold blend for the non-vivid states, plus a
  // separate vivid-gradient layer cross-faded on top, so all three sky
  // values ease into each other instead of popping. The flat blend only
  // retargets on a real clay/gold change; while vivid it holds its last
  // value (irrelevant, since it's fully faded out underneath).
  const flatProgress = useSharedValue(sky === "gold" ? 1 : 0);
  useEffect(() => {
    if (sky === "vivid") return;
    const target = sky === "gold" ? 1 : 0;
    flatProgress.value = reducedMotion
      ? target
      : withTiming(target, { duration: SETTLE_MS, easing: SETTLE });
  }, [sky, reducedMotion, flatProgress]);

  const vividProgress = useSharedValue(isVivid ? 1 : 0);
  useEffect(() => {
    vividProgress.value = reducedMotion
      ? (isVivid ? 1 : 0)
      : withTiming(isVivid ? 1 : 0, { duration: SETTLE_MS, easing: SETTLE });
  }, [isVivid, reducedMotion, vividProgress]);

  // The clip box (below) tracks the animated size and vividness, never
  // smaller than whatever is actually rendering inside it at that
  // instant, so a growing or shrinking character is never cut off by an
  // overflow:hidden edge that already jumped to its final size.
  const stageHeight = useDerivedValue(() => {
    const field =
      FIELD_HEIGHT +
      Math.max(0, animatedSize.value - DEFAULT_CHARACTER_SIZE) +
      vividProgress.value * VIVID_SKY_EXTRA_HEIGHT;
    return insets.top + field + CURVE_HEIGHT;
  });

  const stageAnimatedStyle = useAnimatedStyle(() => ({
    height: stageHeight.value,
  }));

  const flatSkyStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      flatProgress.value,
      [0, 1],
      [palette.clay50, palette.gold100],
    ),
    opacity: 1 - vividProgress.value,
  }));

  const vividSkyStyle = useAnimatedStyle(() => ({
    opacity: vividProgress.value,
  }));

  const characterScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: size > 0 ? animatedSize.value / size : 1 }],
  }));

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
      }}
    >
      <Animated.View
        style={[
          // The sky keeps its own weather: without the clip, her aura
          // bleeds past the horizon as a faint smudge on the sheet.
          { overflow: "hidden" },
          stageAnimatedStyle,
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
            flatSkyStyle,
          ]}
        />
        {/* hello's one-time saturated entrance (2026-09-01, five
            independent blind design reviews measured the flat gold100
            fill's lightness span at 6.7pt versus Headspace's 50pt
            span on the same region): a real multi-stop gradient using
            react-native-svg, already a dependency here, rather than
            pulling in a new native gradient library for one screen. */}
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
            vividSkyStyle,
          ]}
        >
          <Svg pointerEvents="none" width="100%" height="100%">
            <Defs>
              <LinearGradient id="helloSky" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#F2703A" />
                <Stop offset="0.46" stopColor="#F7BE6E" />
                <Stop offset="0.78" stopColor="#FBE8DF" />
                <Stop offset="1" stopColor={colors.page} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width="100%" height="100%" fill="url(#helloSky)" />
          </Svg>
        </Animated.View>
        <Svg
          pointerEvents="none"
          width={width}
          height={CURVE_HEIGHT}
          viewBox={`0 0 ${width} ${CURVE_HEIGHT}`}
          style={{ position: "absolute", bottom: -1, left: 0 }}
        >
          <Path
            d={`M0 ${CURVE_HEIGHT} L0 ${CURVE_HEIGHT * 0.72} Q ${width / 2} ${-CURVE_HEIGHT * 0.55} ${width} ${CURVE_HEIGHT * 0.72} L${width} ${CURVE_HEIGHT} Z`}
            fill={colors.page}
          />
        </Svg>
        {/* She stands ON the sheet's crest, in front of the horizon
            (founder call 2026-08-21: on top of the round). Positioned
            at the character's real (unanimated) size so her layout
            footprint always matches HomaCharacter's own box; the scale
            wrapper below is purely visual. */}
        <View
          style={{
            position: "absolute",
            bottom: CURVE_HEIGHT - size * 0.06,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <Animated.View
            style={[
              { width: size, height: size, transformOrigin: [size / 2, size, 0] },
              characterScaleStyle,
            ]}
          >
            <HomaCharacter state={state} size={size} act={act} />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

/**
 * Her reply bubble: the walk's conversational grammar (founder question
 * 2026-08-21, then the ruling). When Homa REPLIES to something the
 * parent just did, her words sit in this bubble, tail kissing the
 * horizon she stands on. When she PROMPTS (greets, asks a question),
 * the sheet itself is her voice: serif heading, no bubble.
 */
export function WalkSpeech({ children }: { children: ReactNode }) {
  return (
    <View>
      <View
        style={{
          alignSelf: "center",
          width: 0,
          height: 0,
          borderLeftWidth: 10,
          borderRightWidth: 10,
          borderBottomWidth: 12,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: colors.card,
        }}
      />
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          padding: 20,
          gap: 12,
        }}
      >
        {children}
      </View>
    </View>
  );
}

/** Per-screen content wrapper: transparent, sitting below the stage. */
export function WalkSheet({ children }: { children: ReactNode }) {
  const stageHeight = useWalkStageHeight();
  return (
    <View style={{ flex: 1, paddingTop: stageHeight, backgroundColor: "transparent" }}>
      {children}
    </View>
  );
}

/**
 * Back-compatibility alias through the refactor: earlier screens
 * wrapped themselves in WalkScene; with the persistent stage they only
 * need the sheet. The sky choice moved to useWalkSky (walk-character).
 */
export function WalkScene({ children }: { children: ReactNode; sky?: "clay" | "gold" }) {
  return <WalkSheet>{children}</WalkSheet>;
}
