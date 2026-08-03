export type VoiceDockStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "working"
  | "speaking"
  | "paused"
  | "failed";

export type VoiceDockPresentation = "hidden" | "compact" | "expanded";

/**
 * PR #552's COMBINE ruling as a pure model: routine conversation compresses
 * to Homa's puck, while any state that needs a parent's decision stays
 * labeled until she acts. Keeping this outside React makes every state
 * exhaustively testable without pretending a screenshot proves behavior.
 */
export function voiceDockPresentation(input: {
  pathname: string;
  status: VoiceDockStatus;
  muted: boolean;
  manuallyExpanded: boolean;
}): VoiceDockPresentation {
  if (input.pathname === "/voice" || input.status === "idle") return "hidden";
  if (
    input.manuallyExpanded ||
    input.muted ||
    input.status === "connecting" ||
    input.status === "paused" ||
    input.status === "failed"
  ) {
    return "expanded";
  }
  return "compact";
}

export function voiceDockStatusLabel(input: {
  status: VoiceDockStatus;
  muted: boolean;
  pauseReason: string | null;
}): string {
  if (input.status === "paused") return input.pauseReason ?? "Voice paused";
  if (input.status === "failed") return "Voice was interrupted";
  if (input.muted) return "Muted";
  if (input.status === "connecting") return "Getting Homa ready";
  if (input.status === "speaking") return "Homa is speaking";
  if (input.status === "working") return "Homa is working";
  return "Listening";
}

/**
 * One spoken sentence for every active Voice state. The full Voice route and
 * compact shell both use this so a status cannot be visible in one place and
 * silent in the other.
 */
export function voiceStatusAnnouncement(input: {
  status: VoiceDockStatus;
  muted: boolean;
  pauseReason: string | null;
  busyDetail?: string | null;
}): string | null {
  if (input.status === "idle") return null;
  if (input.status === "paused") return input.pauseReason ?? "Homa Voice is paused.";
  if (input.status === "failed") {
    return input.busyDetail
      ? `Voice was interrupted. ${input.busyDetail}`
      : "Voice was interrupted. Try again when you are ready.";
  }
  if (input.muted) return "Homa Voice is muted.";
  if (input.status === "connecting") return "Getting Homa ready.";
  if (input.status === "working") {
    return input.busyDetail
      ? `Homa is working. ${input.busyDetail}`
      : "Homa is working.";
  }
  if (input.status === "speaking") return "Homa is speaking.";
  return "Homa is listening.";
}
