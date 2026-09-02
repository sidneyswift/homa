import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { CharacterAct, CharacterState } from "../voice/character-state";

/**
 * Homa's posture through the onboarding walk (founder ask 2026-08-21:
 * she is present the whole experience, not only while loading). The
 * provider holds one shared state; each screen declares what she is
 * doing via useWalkCharacterState, and the WalkScene (walk-scene.tsx)
 * renders her cresting the scene's curve from that state. State lives
 * here, ABOVE the screens, so her ambient loops never reset between
 * navigations.
 *
 * `act` is an optional prop she holds while in a state: "drawing" puts
 * the crayon in her hand on the making screen (the mobile port of the
 * web ThinkingMark's crayon act).
 *
 * Size defaults to DEFAULT_CHARACTER_SIZE everywhere ("one size on every
 * beat" so a scale jump never reads as a different creature). Founder
 * exception 2026-09-01: hello.tsx may request a larger size for its
 * one-time entrance, the stage height grows to match so she never clips
 * (see walk-scene.tsx). Every other screen stays at the default.
 */

export const DEFAULT_CHARACTER_SIZE = 96;

export type WalkSky = "clay" | "gold" | "vivid";

const WalkCharacterContext = createContext<{
  state: CharacterState;
  act: CharacterAct | null;
  sky: WalkSky;
  size: number;
  set: (state: CharacterState, act?: CharacterAct | null) => void;
  setSky: (sky: WalkSky) => void;
  setSize: (size: number) => void;
} | null>(null);

/** Declare what Homa is doing while this screen shows. Reverts to idle
 * when the screen unmounts, so a forgotten screen never strands her
 * mid-thought. */
export function useWalkCharacterState(
  state: CharacterState,
  act: CharacterAct | null = null,
): void {
  const context = useContext(WalkCharacterContext);
  const set = context?.set;
  useEffect(() => {
    if (!set) return;
    set(state, act);
    return () => set("idle", null);
  }, [set, state, act]);
}

/** What she is doing right now; the stage reads this to render her. */
export function useWalkCharacterCurrent(): {
  state: CharacterState;
  act: CharacterAct | null;
  sky: WalkSky;
  size: number;
} {
  const context = useContext(WalkCharacterContext);
  return {
    state: context?.state ?? "idle",
    act: context?.act ?? null,
    sky: context?.sky ?? "clay",
    size: context?.size ?? DEFAULT_CHARACTER_SIZE,
  };
}

/** Declare the stage's sky while this screen shows (gold = ceremony,
 * vivid = hello's one-time saturated entrance gradient). Reverts to
 * clay on unmount so no mood leaks into the next screen. */
export function useWalkSky(sky: WalkSky): void {
  const context = useContext(WalkCharacterContext);
  const setSky = context?.setSky;
  useEffect(() => {
    if (!setSky) return;
    setSky(sky);
    return () => setSky("clay");
  }, [setSky, sky]);
}

/** Declare a larger stage character while this screen shows. Reverts to
 * DEFAULT_CHARACTER_SIZE on unmount, the one-time exception never
 * leaks into the rest of the walk. */
export function useWalkCharacterSize(size: number): void {
  const context = useContext(WalkCharacterContext);
  const setSize = context?.setSize;
  useEffect(() => {
    if (!setSize) return;
    setSize(size);
    return () => setSize(DEFAULT_CHARACTER_SIZE);
  }, [setSize, size]);
}

export function WalkCharacterProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<{
    state: CharacterState;
    act: CharacterAct | null;
  }>({ state: "idle", act: null });
  const [sky, setSky] = useState<WalkSky>("clay");
  const [size, setSize] = useState<number>(DEFAULT_CHARACTER_SIZE);
  const value = useMemo(
    () => ({
      state: current.state,
      act: current.act,
      sky,
      size,
      set: (state: CharacterState, act: CharacterAct | null = null) =>
        setCurrent({ state, act }),
      setSky,
      setSize,
    }),
    [current, sky, size],
  );
  return (
    <WalkCharacterContext.Provider value={value}>
      {children}
    </WalkCharacterContext.Provider>
  );
}
