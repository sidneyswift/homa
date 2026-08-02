export type PromptSuggestionLifecycleEvent =
  | {
      type: "turn_finished";
      hasError: boolean;
      autoStopped: boolean;
      hasQueuedFollowup: boolean;
    }
  | { type: "recovery_started" }
  | {
      type: "recovery_finished";
      outcome: "recovered" | "failed" | "aborted";
    };

export type PromptSuggestionLifecycleAction =
  | "none"
  | "clear"
  | "request_messages"
  | "start_recovery";

export interface PromptSuggestionLifecycleHandlers<Message> {
  clear: () => void;
  requestMessages: (messages: readonly Message[]) => void;
  startRecovery: () => void;
}

/**
 * Selects the one suggestion action allowed at each finish or recovery edge.
 * Queued parent messages keep priority over recovery and generation.
 */
export function promptSuggestionActionForLifecycleEvent(
  event: PromptSuggestionLifecycleEvent,
): PromptSuggestionLifecycleAction {
  switch (event.type) {
    case "turn_finished":
      if (event.hasError) return "none";
      if (event.autoStopped) return "start_recovery";
      return event.hasQueuedFollowup ? "clear" : "request_messages";
    case "recovery_started":
      return "clear";
    case "recovery_finished":
      return event.outcome === "recovered" ? "request_messages" : "none";
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

/**
 * Applies a lifecycle action through one exhaustive production seam.
 */
export function executePromptSuggestionLifecycleAction<Message>(
  action: PromptSuggestionLifecycleAction,
  messages: readonly Message[] | null,
  handlers: PromptSuggestionLifecycleHandlers<Message>,
): void {
  switch (action) {
    case "none":
      return;
    case "clear":
      handlers.clear();
      return;
    case "request_messages":
      if (messages === null) {
        throw new TypeError("Prompt suggestion messages are required");
      }
      handlers.requestMessages(messages);
      return;
    case "start_recovery":
      handlers.startRecovery();
      return;
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
