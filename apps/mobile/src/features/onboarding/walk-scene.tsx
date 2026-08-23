import type { ReactNode } from "react";
import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { colors, palette } from "../../theme/tokens";
import { HomaCharacter } from "../voice/homa-character";
import { useWalkCharacterCurrent } from "./walk-character";

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
const CHARACTER_SIZE = 96;

/** The sky-plus-horizon height screens must reserve. */
export function useWalkStageHeight(): number {
  const insets = useSafeAreaInsets();
  return insets.top + FIELD_HEIGHT + CURVE_HEIGHT;
}

/** Mounted once in the walk layout, floated ABOVE the navigator: a
 * native stack paints an opaque background over anything behind it, so
 * the persistent stage must sit on top. It is pointer-transparent and
 * only as tall as the sky, so screens stay fully interactive. */
export function WalkStage() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { state, act, sky } = useWalkCharacterCurrent();
  const fieldColor = sky === "gold" ? palette.gold100 : palette.clay50;

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
          height: insets.top + FIELD_HEIGHT + CURVE_HEIGHT,
          backgroundColor: fieldColor,
          // The sky keeps its own weather: without the clip, her aura
          // bleeds past the horizon as a faint smudge on the sheet.
          overflow: "hidden",
        }}
      >
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
            bottom: CURVE_HEIGHT - CHARACTER_SIZE * 0.06,
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <HomaCharacter state={state} size={CHARACTER_SIZE} act={act} />
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
