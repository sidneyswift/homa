import type { ReactNode } from "react";
import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

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
 * screens reads as a different creature.
 */

const FIELD_HEIGHT = 104;
const CURVE_HEIGHT = 56;

/** How much a taller stage the vivid sky wants, independent of the
 * character-size growth below (2026-09-01: the panel measured Homa's
 * hero zone at 32% of screen height versus Headspace's 46% on the same
 * "sky plus mascot" region; a flat gold100 fill can be short and still
 * read fine, a real gradient wants room to actually show its stops). */
const VIVID_SKY_EXTRA_HEIGHT = 130;

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

/** The sky-plus-horizon height screens must reserve. */
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
  const fieldColor = sky === "gold" ? palette.gold100 : palette.clay50;
  const fieldHeight = fieldHeightFor(size, isVivid);
  const stageHeight = insets.top + fieldHeight + CURVE_HEIGHT;

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
      <View
        style={{
          height: stageHeight,
          backgroundColor: isVivid ? undefined : fieldColor,
          // The sky keeps its own weather: without the clip, her aura
          // bleeds past the horizon as a faint smudge on the sheet.
          overflow: "hidden",
        }}
      >
        {isVivid ? (
          // hello's one-time saturated entrance (2026-09-01, five
          // independent blind design reviews measured the flat gold100
          // fill's lightness span at 6.7pt versus Headspace's 50pt
          // span on the same region): a real multi-stop gradient using
          // react-native-svg, already a dependency here, rather than
          // pulling in a new native gradient library for one screen.
          <Svg
            pointerEvents="none"
            width={width}
            height={stageHeight}
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            <Defs>
              <LinearGradient id="helloSky" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#F2703A" />
                <Stop offset="0.46" stopColor="#F7BE6E" />
                <Stop offset="0.78" stopColor="#FBE8DF" />
                <Stop offset="1" stopColor={colors.page} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={width} height={stageHeight} fill="url(#helloSky)" />
          </Svg>
        ) : null}
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
            (founder call 2026-08-21: on top of the round). */}
        <View
          style={{
            position: "absolute",
            bottom: CURVE_HEIGHT - size * 0.06,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <HomaCharacter state={state} size={size} act={act} />
        </View>
      </View>
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
