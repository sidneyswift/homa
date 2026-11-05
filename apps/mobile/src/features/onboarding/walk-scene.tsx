import type { ReactNode } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, space } from "../../theme/app2";
import { HomaCharacter3D } from "../app2/homa-character-3d";
import { DEFAULT_CHARACTER_SIZE, useWalkCharacterCurrent } from "./walk-character";

/**
 * The onboarding walk's persistent stage. WalkStage is mounted ONCE in
 * the walk's layout, so Homa STAYS while screens change beneath her
 * (founder ruling 2026-08-21). Screens render inside WalkSheet, which
 * reserves the stage's height, so navigation changes only the sheet and
 * she never blinks out.
 *
 * App 2 look (founder ask 2026-11-03, gh#1236: the whole iOS app matches
 * App 2): a plain white stage with the 3D Homa, the same character the
 * sign-in door and chat show, standing just above each beat's heading.
 * The warm sky, the drawn horizon and the posed 2D character are gone;
 * `useWalkSky` and the character's posture still record what a beat
 * asked for, but the white stage no longer paints them.
 */

const FIELD_HEIGHT = 104;
const CURVE_HEIGHT = 56;

/** Kept from the sky era so every beat's layout stays where it was tuned:
 * the vivid entrance still reserves its extra headroom. */
const VIVID_SKY_EXTRA_HEIGHT = 130;

/** The 3D Homa reads smaller than the flat mark at the same box (her
 * ground shadow sits inside it), so the stage draws her a little larger
 * than the walk's nominal size. */
const STAGE_GROWTH = 20;

function fieldHeightFor(size: number, isVivid: boolean): number {
  return (
    FIELD_HEIGHT +
    Math.max(0, size - DEFAULT_CHARACTER_SIZE) +
    (isVivid ? VIVID_SKY_EXTRA_HEIGHT : 0)
  );
}

/** The stage height screens must reserve. */
export function useWalkStageHeight(): number {
  const insets = useSafeAreaInsets();
  const { size, sky } = useWalkCharacterCurrent();
  return insets.top + fieldHeightFor(size, sky === "vivid") + CURVE_HEIGHT;
}

/** Mounted once in the walk layout, floated ABOVE the navigator: a
 * native stack paints an opaque background over anything behind it, so
 * the persistent stage must sit on top. It is pointer-transparent and
 * only as tall as the stage, so screens stay fully interactive. Homa is
 * decorative here; each beat's heading carries the meaning. */
export function WalkStage() {
  const height = useWalkStageHeight();
  const { size } = useWalkCharacterCurrent();
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height,
        backgroundColor: colors.page,
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: space.xs,
      }}
    >
      <HomaCharacter3D size={size + STAGE_GROWTH} />
    </View>
  );
}

/** Homa's line on a beat. App 2 speaks without bubbles: plain text,
 * centered under her, the way the sign-in door greets a parent. */
export function WalkSpeech({ children }: { children: ReactNode }) {
  return <View style={{ gap: 12, paddingVertical: space.xs }}>{children}</View>;
}

export function WalkSheet({ children }: { children: ReactNode }) {
  const stageHeight = useWalkStageHeight();
  return (
    <View style={{ flex: 1, paddingTop: stageHeight, backgroundColor: "transparent" }}>
      {children}
    </View>
  );
}

export function WalkScene({ children }: { children: ReactNode; sky?: "clay" | "gold" }) {
  return <WalkSheet>{children}</WalkSheet>;
}
