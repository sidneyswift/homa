/**
 * The hidden-directive contract
 * (plans/2026-07-21-chat-first-onboarding.md §2.4).
 *
 * Chat-first onboarding needs the client to say things to Homa that the
 * parent did not type: the opening kickoff, the resume kickoff when she
 * comes back on Thursday, the handoff when a checklist takeover
 * finishes. Sent naively, each of those renders as HER chat bubble, and
 * the send queue string-joins it onto whatever she was typing, so a
 * machine sentence arrives wearing her voice in the middle of her
 * sentence.
 *
 * One marker grammar fixes all of it:
 *
 *   [[homa:onboarding kickoff]]
 *   [[homa:onboarding checklist_complete childId=abc answered=41 skipped=3]]
 *
 * Four rules ride on this module, and they only hold together:
 *   1. Rendering    a matching message renders no bubble, in both the
 *                   onboarding surface and the /app transcript.
 *   2. Persistence  a matching web user row is stored
 *                   visibility='internal', so scrollback, recall, and
 *                   the founder console stay clean. The row still
 *                   exists: turn recovery matches against it.
 *   3. Send lane    directives never string-join with her words. They
 *                   wait for an idle line and go alone.
 *   4. Authority    a directive carries hints, never facts. Anything
 *                   load-bearing is re-derived server-side. A parent can
 *                   type this string herself, so nothing downstream may
 *                   trust a parameter as truth.
 *
 * This module is deliberately dependency-free so both the client
 * surfaces and the server persistence path can import the same
 * definition. Two copies of a regex is how rule 1 and rule 2 drift
 * apart.
 */

/** Every directive lives under one namespace, so the grammar can grow
 *  past onboarding without a second marker shape to keep in sync. */
export const DIRECTIVE_NAMESPACE = "homa:onboarding";

export type DirectiveName =
  /** First message of the very first sitting. */
  | "kickoff"
  /** She left and came back: pick up from family state, do not re-greet. */
  | "resume"
  /** A checklist takeover finished or was exited. */
  | "checklist_complete"
  /** A panel was opened from a card and the conversation should react. */
  | "panel_opened";

export interface HiddenDirective {
  name: string;
  /** Advisory hints only. Never trusted as fact server-side (rule 4). */
  params: Record<string, string>;
  /** The exact source text, for logging and turn-recovery matching. */
  raw: string;
}

/**
 * The whole trimmed message must be the marker. A marker embedded in a
 * longer message stays a normal parent message: hiding half of what she
 * wrote would be worse than showing a bracket.
 */
const DIRECTIVE_PATTERN = new RegExp(
  `^\\[\\[${DIRECTIVE_NAMESPACE.replace(":", "\\:")}\\s+([a-z_]+)((?:\\s+[a-zA-Z0-9_]+=[^\\s\\]]*)*)\\s*\\]\\]$`,
);

/**
 * isHiddenDirective(text): does this message render as nothing and
 * persist as internal? The single predicate both surfaces and the
 * persistence path call.
 */
export function isHiddenDirective(text: string): boolean {
  return DIRECTIVE_PATTERN.test(text.trim());
}

/**
 * parseHiddenDirective(text): the directive's name and hints, or null
 * when this is an ordinary message.
 */
export function parseHiddenDirective(text: string): HiddenDirective | null {
  const raw = text.trim();
  const match = DIRECTIVE_PATTERN.exec(raw);
  if (!match) return null;
  const params: Record<string, string> = {};
  const tail = match[2] ?? "";
  for (const pair of tail.trim().split(/\s+/)) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    params[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return { name: match[1], params, raw };
}

/**
 * formatHiddenDirective(name, params): the one place a directive string
 * is built. Values are sanitized to the characters the grammar admits,
 * so a name with a space or a bracket can never produce a marker that
 * fails its own parser and lands in the transcript as visible garbage.
 */
export function formatHiddenDirective(
  name: DirectiveName,
  params: Record<string, string | number | null | undefined> = {},
): string {
  const parts = [DIRECTIVE_NAMESPACE, name];
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const safeKey = key.replace(/[^a-zA-Z0-9_]/g, "");
    // The slash is in the set because every IANA time zone has one
    // ("America/Chicago"), and stripping it silently produced a zone
    // name that parses as nothing and would have been saved as one.
    // Neither the slash nor anything else here can terminate a marker:
    // only "]]" and whitespace do, and both stay out of the set.
    const safeValue = String(value).replace(/[^a-zA-Z0-9_./:-]/g, "");
    if (safeKey.length === 0 || safeValue.length === 0) continue;
    parts.push(`${safeKey}=${safeValue}`);
  }
  return `[[${parts.join(" ")}]]`;
}

/**
 * hasVisibleText(text): true when a message has anything the parent
 * should see. Used by transcript builders, which must not render an
 * empty bubble where a directive was.
 */
export function hasVisibleText(text: string): boolean {
  return text.trim().length > 0 && !isHiddenDirective(text);
}
