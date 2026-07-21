import { formatHiddenDirective } from "../../lib/onboarding/directives";

/**
 * The chat surface's onboarding configuration
 * (plans/2026-07-21-chat-first-onboarding.md §2.8, §6.1, §6.2).
 *
 * Pure and separate from the component so the decisions in it can be
 * tested without a browser: which directive opens this visit, whether a
 * kickoff has already been spent, and what she reads while the first
 * model turn is still travelling.
 */

export interface OnboardingChatConfig {
  /** Stamped from the family row, never from the client. */
  familyId: string;
  /** First name if Homa has it, for the deterministic opener. */
  parentName: string | null;
  /** True when she has never had a turn in this family. */
  firstVisit: boolean;
  /** Milliseconds since her last message anywhere, or null if never. */
  gapMs: number | null;
}

/**
 * The gap past which a return is a return rather than a pause. Under it,
 * she gets silence and her place back; over it, Homa picks up out loud.
 * Thirty minutes is the spec's number and it matches the real shape of
 * the day: a nap, a lunch, a school run.
 */
export const RESUME_GAP_MS = 30 * 60 * 1000;

export type OnboardingKickoffKind = "kickoff" | "resume" | "none";

/**
 * kickoffKindFor(config): which machine message opens this visit.
 *
 * Silence is a real answer here. A parent who closed the tab for four
 * minutes and came back does not want to be greeted; she wants the
 * screen she left. Sending a resume directive for that gap would cost a
 * model turn and produce a greeting nobody asked for.
 */
export function kickoffKindFor(config: OnboardingChatConfig): OnboardingKickoffKind {
  if (config.firstVisit) return "kickoff";
  if (config.gapMs === null) return "kickoff";
  return config.gapMs >= RESUME_GAP_MS ? "resume" : "none";
}

/**
 * kickoffDirectiveFor(config): the exact message to send, or null when
 * this visit opens in silence.
 *
 * The time zone rides along with the opening message rather than being
 * asked for. Asking a parent what time zone she is in reads as a form;
 * announcing that Homa detected it reads as surveillance. Homa confirms
 * it lightly inside the basics card instead.
 */
export function kickoffDirectiveFor(
  config: OnboardingChatConfig,
  timeZone: string | null,
): string | null {
  const kind = kickoffKindFor(config);
  if (kind === "none") return null;
  return formatHiddenDirective(kind, { timeZone });
}

/**
 * browserTimeZone(): the zone this device is actually in, or null when
 * the browser will not say. Read at send time rather than held in
 * state: Intl does not exist during a server render, and gating the
 * whole conversation on a state round trip would put a blank frame
 * exactly where the welcome is supposed to be.
 */
export function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * The two lines that are on her screen before any model call returns.
 *
 * They exist because the first turn of a brand new family is the slowest
 * turn the product ever runs: a cold function, the auth walk, a blocking
 * persist, context assembly, and only then a first token. Three to eight
 * seconds of nothing, at the exact moment she is deciding whether this
 * is real. These are deterministic, copy-gated, and rendered client-side
 * at once, so the model's own opener arrives as the third line of a
 * conversation that already started.
 *
 * They say nothing that could be wrong. No claim about her family, and
 * no promise about timing: the reader gate caught an earlier line
 * ("give me a minute") contradicting the six minutes the very next card
 * quotes, so the product's first sentence was already wrong. The second
 * line names what actually happens next instead.
 */
export function welcomeLinesFor(config: OnboardingChatConfig): string[] {
  const greeting = config.parentName ? `Hi ${config.parentName}.` : "Hi.";
  return [
    `${greeting} I'm Homa.`,
    "A few answers about your kids and I can start helping you teach them.",
  ];
}
