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
 */

const WalkCharacterContext = createContext<{
  state: CharacterState;
  act: CharacterAct | null;
  sky: "clay" | "gold";
  set: (state: CharacterState, act?: CharacterAct | null) => void;
  setSky: (sky: "clay" | "gold") => void;
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
  sky: "clay" | "gold";
} {
  const context = useContext(WalkCharacterContext);
  return {
    state: context?.state ?? "idle",
    act: context?.act ?? null,
    sky: context?.sky ?? "clay",
  };
}

/** Declare the stage's sky while this screen shows (gold = ceremony).
 * Reverts to clay on unmount so the celebration never leaks. */
export function useWalkSky(sky: "clay" | "gold"): void {
  const context = useContext(WalkCharacterContext);
  const setSky = context?.setSky;
  useEffect(() => {
    if (!setSky) return;
    setSky(sky);
    return () => setSky("clay");
  }, [setSky, sky]);
}

export function WalkCharacterProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<{
    state: CharacterState;
    act: CharacterAct | null;
  }>({ state: "idle", act: null });
  const [sky, setSky] = useState<"clay" | "gold">("clay");
  const value = useMemo(
    () => ({
      state: current.state,
      act: current.act,
      sky,
      set: (state: CharacterState, act: CharacterAct | null = null) =>
        setCurrent({ state, act }),
      setSky,
    }),
    [current, sky],
  );
  return (
    <WalkCharacterContext.Provider value={value}>
      {children}
    </WalkCharacterContext.Provider>
  );
}
