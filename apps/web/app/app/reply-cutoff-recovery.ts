export type ReplyCutoffRecoveryState =
  | "idle"
  | "recovering"
  | "available";

export type ReplyCutoffRecoveryEvent =
  | "detected"
  | "retry"
  | "recovered"
  | "failed"
  | "aborted"
  | "superseded";

export function nextReplyCutoffRecoveryState(
  state: ReplyCutoffRecoveryState,
  event: ReplyCutoffRecoveryEvent,
): ReplyCutoffRecoveryState {
  switch (event) {
    case "detected":
      return "recovering";
    case "retry":
      return state === "available" ? "recovering" : state;
    case "failed":
    case "aborted":
      return state === "idle" ? "idle" : "available";
    case "recovered":
    case "superseded":
      return "idle";
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}
