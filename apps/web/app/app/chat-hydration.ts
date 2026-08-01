import { useSyncExternalStore } from "react";
import type { EveMessage } from "eve/client";

import type { ArchivedMessage } from "./chat-storage";

const subscribeToNothing = () => () => {};
const clientHydratedSnapshot = () => true;
const serverHydratedSnapshot = () => false;

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    clientHydratedSnapshot,
    serverHydratedSnapshot,
  );
}

export function hydrationSafeTranscriptSources(input: {
  hydrated: boolean;
  serverArchived: readonly ArchivedMessage[];
  clientArchived: readonly ArchivedMessage[];
  clientLive: readonly EveMessage[];
  clientLiveTimes: Record<string, number>;
  clientSpoken: readonly ArchivedMessage[];
}): {
  archived: readonly ArchivedMessage[];
  live: readonly EveMessage[];
  liveTimes: Record<string, number>;
  spoken: readonly ArchivedMessage[];
} {
  if (!input.hydrated) {
    return {
      archived: input.serverArchived,
      live: [],
      liveTimes: {},
      spoken: [],
    };
  }
  return {
    archived: input.clientArchived,
    live: input.clientLive,
    liveTimes: input.clientLiveTimes,
    spoken: input.clientSpoken,
  };
}
