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
 * The welcome, pre-warmed (plans/2026-07-21-chat-first-onboarding.md
 * §6.1: "first bubble in <400ms"). The app renders this the instant the
 * page mounts, so arrival is never a blank screen with a thinking dot:
 * a live walk measured 11 to 17 seconds before the model's greeting
 * landed, and a persona read called surviving it "a coin flip." The
 * model knows this exact text is already on screen (onboarding-mode
 * carries it) and opens with the basics card instead of a second hello.
 *
 * One paragraph, founder-approved wording (2026-07-23). If this changes,
 * change the copy of it in agent/instructions/onboarding-mode.ts in the
 * same commit, or Homa will contradict the first thing she ever said.
 */
export const ONBOARDING_WELCOME =
  "Hey, I'm Homa. I'll be doing this school year with you! I keep track of where your kids are in each subject, and I make the worksheets and lesson plans they need. Let's start with a little about you, then your kids.";

/**
 * The welcome does not stream, and that is a decision rather than an
 * omission (founder walk, 2026-07-28).
 *
 * A word-by-word reveal shipped here first, at the founder's ask, and
 * came straight back out: "clunky and not premium". Two reasons, both
 * worth keeping written down. Token-by-token reveal is what a model does
 * when it CANNOT show you the whole answer yet, so imitating it on a
 * string constant is a costume, and it reads as one. And forty-two
 * independent fades across five wrapped lines is shimmer the eye tracks
 * involuntarily, so she ends up reading through the animation.
 *
 * What replaced it is one gesture: the welcome and the card ride the
 * same keyframe 140ms apart and the screen settles in 460ms
 * (globals.css, "The onboarding opening"). Fewer, larger, overlapping
 * moves. Nothing in this module needs to time any of it, which is the
 * tell that it is the right shape: the whole sequence is four lines of
 * CSS and no state.
 */

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
 * appOpensWithBasics(config): does the app ask for her name itself,
 * rather than spend a model turn being handed a card it could have
 * drawn from a constant?
 *
 * The kickoff turn had exactly one job: call ask_for_details with kind
 * family_basics, no words before or after it (onboarding-mode's "your
 * very first turn"). Every input to that call is fixed. The fields are a
 * static table (detail-card's FIELDS.family_basics), the card writes
 * through its own authenticated endpoint (/api/onboarding/basics) rather
 * than through the model, and the time zone rides on that same POST. So
 * the turn produced a constant and charged 2 to 6 seconds of "working on
 * it" for it, on the first screen after she paid, at the exact moment
 * the product most needs to look alive. The welcome above learned this
 * lesson already; this is the same wait one beat later.
 *
 * Only when her basics are genuinely unwritten. A parent who filled the
 * card and closed the tab comes back with a name, and re-asking for it
 * is worse than any wait.
 */
export function appOpensWithBasics(config: OnboardingChatConfig): boolean {
  return kickoffKindFor(config) === "kickoff" && config.parentName === null;
}

/**
 * kickoffDirectiveFor(config): the exact message to send, or null when
 * this visit opens in silence.
 *
 * Silence now covers the opening too, not just the short pause: when the
 * app draws the basics card itself there is nothing left for that turn to
 * do, and sending it anyway would buy a second copy of the card she is
 * already filling in. Homa's first turn becomes her first answer, which
 * is also the first turn that has ever had anything to react to.
 *
 * The time zone rides along with the opening message rather than being
 * asked for. Asking a parent what time zone she is in reads as a form;
 * announcing that Homa detected it reads as surveillance. Homa confirms
 * it lightly inside the basics card instead, which is also where it is
 * captured when this returns null.
 */
export function kickoffDirectiveFor(
  config: OnboardingChatConfig,
  timeZone: string | null,
): string | null {
  const kind = kickoffKindFor(config);
  if (kind === "none") return null;
  if (appOpensWithBasics(config)) return null;
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

export function kickoffStorageKey(familyId: string): string {
  return `homa-onboarding-kickoff-${familyId}`;
}

export function kickoffAlreadySent(familyId: string): boolean {
  try {
    return window.localStorage.getItem(kickoffStorageKey(familyId)) !== null;
  } catch {
    // Private mode, a full quota, a blocked store: fall back to the
    // in-memory locks rather than refusing to open the conversation.
    return false;
  }
}

export function markKickoffSent(familyId: string): void {
  try {
    window.localStorage.setItem(kickoffStorageKey(familyId), String(Date.now()));
  } catch {
    // Same posture: the worst case is one repeated hello, never a
    // conversation that never starts.
  }
}

export function clearKickoffSent(familyId: string): void {
  try {
    window.localStorage.removeItem(kickoffStorageKey(familyId));
  } catch {
    // Nothing to undo if the store was never writable.
  }
}

/**
 * kickoffLockIsStale: the flag says hello was sent, the conversation says
 * otherwise. Believe the conversation.
 *
 * The flag is written before the send, because a lock taken after the
 * fact is not a lock. The cost is that a kickoff which never lands, a
 * dropped connection, an expired token, a deploy mid-turn, leaves the
 * flag set over an empty conversation, and a brand new parent then opens
 * a permanently blank screen with no way back but clearing site data.
 * That is a far worse failure than the doubled hello the flag prevents.
 *
 * Emptiness here is checked against every record the client has: the
 * live session, and the archive that server history is folded into. If
 * all of them are empty then no hello was ever said, so saying one now
 * cannot repeat anything.
 */
export function kickoffLockIsStale(input: {
  liveMessageCount: number;
  archivedCount: number;
}): boolean {
  return input.liveMessageCount === 0 && input.archivedCount === 0;
}
