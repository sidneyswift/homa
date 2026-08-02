export type VoicePromptStarterId =
  | "worksheet"
  | "lesson_plan"
  | "planner"
  | "lesson_log";

export type VoicePromptStarterAction =
  | { kind: "request"; text: string }
  | { kind: "route"; href: "/planner" };

export interface VoicePromptStarter {
  id: VoicePromptStarterId;
  label: string;
  action: VoicePromptStarterAction;
}

/** Common homeschooling tasks, ordered from making something to organizing it. */
export const VOICE_PROMPT_STARTERS: readonly VoicePromptStarter[] = [
  {
    id: "worksheet",
    label: "Create a worksheet",
    action: { kind: "request", text: "Create a worksheet for today." },
  },
  {
    id: "lesson_plan",
    label: "Make a lesson plan",
    action: { kind: "request", text: "Help me make a lesson plan." },
  },
  {
    id: "planner",
    label: "Open planner",
    action: { kind: "route", href: "/planner" },
  },
  {
    id: "lesson_log",
    label: "Log a lesson",
    action: { kind: "request", text: "Help me log a lesson we finished." },
  },
] as const;

export interface VoicePromptStartersInputs {
  status: string;
  turnActive: boolean;
  assistantHasReplied: boolean;
  userHasReplied: boolean;
  overlayOpen: boolean;
  retired: boolean;
}

/**
 * Starters arrive after Homa's greeting, then leave as soon as the parent
 * starts the conversation or another Voice surface needs their attention.
 */
export function voicePromptStartersVisible(
  inputs: VoicePromptStartersInputs,
): boolean {
  return (
    inputs.status === "listening"
    && !inputs.turnActive
    && inputs.assistantHasReplied
    && !inputs.userHasReplied
    && !inputs.overlayOpen
    && !inputs.retired
  );
}
