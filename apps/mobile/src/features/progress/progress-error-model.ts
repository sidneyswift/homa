import type { ChildProgressFailure } from "./child-progress-load";

export type ProgressErrorAction =
  | "retry"
  | "reauthenticate"
  | "refresh-family"
  | "open-chat";

export interface ProgressErrorPresentation {
  title: string;
  body: string;
  action: ProgressErrorAction;
  actionLabel: string;
}

/** Maps each exact read failure to one honest recovery path. */
export function progressErrorPresentation(
  failure: ChildProgressFailure,
  childName: string,
): ProgressErrorPresentation {
  if (failure.kind === "authentication") {
    return {
      title: "Sign in again",
      body: `Your session ended before Homa could load ${childName}’s progress.`,
      action: "reauthenticate",
      actionLabel: "Sign in again",
    };
  }

  if (failure.kind === "scope" && failure.reason === "disabled") {
    return {
      title: "Progress is taking a pause",
      body: "Progress isn’t available right now. Your family’s information is safe.",
      action: "open-chat",
      actionLabel: "Go to chat",
    };
  }

  if (failure.kind === "scope") {
    return {
      title: "Refresh your family",
      body: `Homa can’t open ${childName}’s progress from this family. Refresh to check the children connected to your account.`,
      action: "refresh-family",
      actionLabel: "Refresh family",
    };
  }

  if (failure.kind === "invalid") {
    return {
      title: "Progress needs a fresh check",
      body: `Homa couldn’t verify ${childName}’s progress, so nothing is shown.`,
      action: "retry",
      actionLabel: "Check again",
    };
  }

  return {
    title: "Nothing changed",
    body: `We couldn’t load ${childName}’s progress right now.`,
    action: "retry",
    actionLabel: "Try again",
  };
}
