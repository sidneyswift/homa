import { BANNED_WORDS } from "./map/copy-laws";

export type OutboundChildFramingChannel =
  | "web"
  | "mobile"
  | "sms"
  | "email"
  | "dispatch";

export const OUTBOUND_CHILD_FRAMING_FALLBACK = {
  web: "I want to answer that carefully, but I couldn't finish this reply. Please ask me again in a moment.",
  mobile:
    "I want to answer that carefully, but I couldn't finish this reply. Please ask me again in a moment.",
  sms: "I want to answer that carefully, but I couldn't finish this reply. Please ask me again in a moment.",
  email:
    "I want to answer that carefully, but I couldn't finish this reply. Please ask me again in a moment.",
  dispatch: "I couldn't finish today's note. Open Homa and ask me to try it again.",
} as const satisfies Record<OutboundChildFramingChannel, string>;

export interface OutboundChildFramingResult {
  text: string;
  outcome: "no_candidate" | "judged_safe" | "fallback";
  candidate: string | null;
}

export function findOutboundChildFramingCandidate(text: string): string | null {
  return BANNED_WORDS.exec(text)?.[0] ?? null;
}

/** Candidate text is visible only when this turn approved that exact text. */
export function protectOutboundChildFraming(input: {
  text: string;
  approvedText: string | null;
  channel: OutboundChildFramingChannel;
}): OutboundChildFramingResult {
  const candidate = findOutboundChildFramingCandidate(input.text);
  if (!candidate) {
    return { text: input.text, outcome: "no_candidate", candidate: null };
  }
  if (input.approvedText === input.text) {
    return { text: input.text, outcome: "judged_safe", candidate };
  }
  return {
    text: OUTBOUND_CHILD_FRAMING_FALLBACK[input.channel],
    outcome: "fallback",
    candidate,
  };
}

/** Hides an unresolved candidate while streaming, then fails closed. */
export function visibleOutboundChildFramingText(input: {
  text: string;
  approvedText: string | null;
  channel: "web" | "mobile";
  streaming: boolean;
}): string | null {
  const result = protectOutboundChildFraming(input);
  return input.streaming && result.outcome === "fallback" ? null : result.text;
}
