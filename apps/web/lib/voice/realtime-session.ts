import { VOICE_PERSONA_MARKDOWN } from "./persona.generated";
import {
  VOICE_TOOL_BOUNDARY_LINES,
  type VoiceToolName,
} from "./realtime-tools";

/**
 * The instructions a browser voice session runs on (issue #283, founder
 * direction 2026-07-29).
 *
 * Same persona as everywhere else. `instructions.md` is the source of truth
 * for Homa's voice, and this uses the slice above "## What you know each
 * turn", exactly as the phone provisioner does, because everything below
 * that heading is web-tool operations a voice session has no use for.
 *
 * The persona arrives as a GENERATED constant rather than a runtime file
 * read (`persona.generated.ts`, written by `scripts/build-voice-persona.mts`).
 * A deployed function bundle carries no source tree, so a readFile would
 * resolve locally and throw in production, which is exactly what silently
 * broke the onboarding preload (issue #246). It matters more here: a failed
 * read would not degrade the session, it would replace Homa with a stranger
 * who has no rules. `pnpm check:voice-persona` fails if the mirror drifts.
 *
 * What it does NOT reuse is `agent/phone-rules.md`. Those rules are about a
 * phone call between friends: tennis-match turns, a bounded greeting, and
 * guidance for four webhook tools. A parent in the app is looking at the
 * transcript while Homa talks, so the turn shape is different and the tool
 * boundary is different.
 *
 * The capability boundary is the important part. This session has NO tools
 * in v1, so Homa can talk and nothing else, and she has to say so plainly.
 * The 2026-07-19 phone call that claimed a worksheet was emailed and filed
 * in the binder is the whole reason this file states limits before it
 * states anything else. The honest path out is real: the transcript lands
 * in the chat thread, so anything she agrees to do can be done in text
 * straight after.
 */

/**
 * The capability boundary, GENERATED from the tool allowlist.
 *
 * Not hand-written, on purpose. `agent/general-call-instructions.md` opens
 * with "You have exactly four tools", and the moment the phone's tool set
 * changes that sentence becomes false in the one file whose entire job is
 * preventing false statements. Deriving the can-do list from
 * VOICE_TOOL_BOUNDARY_LINES means adding a tool updates what Homa says
 * about herself in the same commit, and a tool without a line fails a test
 * rather than shipping unmentioned.
 *
 * The cannot-do list stays hand-written, because it is not the complement
 * of the allowlist. It names the specific things a parent is most likely to
 * ask for mid-conversation and the 2026-07-19 call falsely claimed, and
 * those deserve naming even as the allowlist grows.
 */
export function buildVoiceModeRules(
  toolNames: readonly VoiceToolName[] = Object.keys(
    VOICE_TOOL_BOUNDARY_LINES,
  ) as VoiceToolName[],
): string {
  const canDo = toolNames.map((name) => `- ${VOICE_TOOL_BOUNDARY_LINES[name]}`);
  return `
## You are talking out loud, in the app (binding: this beats every rule above)

She tapped the voice button in her chat with you. She can hear you, and she
can read the transcript of this conversation as it appears. When you both
stop, the transcript stays in her chat, so anything you talk about is
already written down.

How to talk here:

- Short turns. Two or three sentences, then let her speak. This is a
  conversation, not a briefing.
- Say numbers and dates the way a person says them out loud: "about twenty
  minutes", "next Tuesday", never "20 min" or "07-29".
- No lists, no headings, no markdown. She is hearing this.
- If she goes quiet, it is fine to wait. Silence is her thinking, not a
  cue to fill.
- Before anything that takes a moment to look up, say so in a few words and
  then do it. "Let me look" is a real sentence; silence is not.

## What you can actually do right now (binding)

${canDo.join("\n")}

That is the whole list. Anything else has to wait for chat.

## What you cannot do in this conversation (binding)

You cannot:

- make, fill in, or send a worksheet, printable, or any material,
- add anything to her binder, or reorganize her binder,
- add, move, or remove anything on the calendar or the planner,
- send an email or a text.

These are not slow, they are simply not available while you are talking.

## When she asks for one of those (binding)

Say what is true, then give her the real path, which is a good one:

> "I can't make that while we're talking, but this whole conversation is in
> your chat. Say the word there and I'll do it properly."

Everything you say here is written down in her chat, so nothing is lost by
waiting until you hang up.

## Honesty law (binding, overrides helpfulness)

A tool result is the only truth about whether something happened. If you did
not call a tool, the thing did not happen, so do not describe it as done, no
matter how naturally it would fit the sentence. A parent acting on a promise
you invented is the worst outcome here, worse than admitting a limit.
`.trim();
}

/** The default boundary, for the whole allowlist. */
export const VOICE_MODE_RULES = buildVoiceModeRules();

/**
 * Composes the whole instruction string, persona first, then how to talk
 * out loud, then what she actually knows about this family.
 *
 * Exported separately from the reader so the ordering and the boundary can
 * be tested without touching the filesystem.
 */
export function composeRealtimeInstructions(input: {
  persona: string;
  familyContext: string;
}): string {
  return [input.persona, VOICE_MODE_RULES, input.familyContext.trim()]
    .filter((block) => block.length > 0)
    .join("\n\n");
}

/** The instructions for one session. `familyContext` is the already
 * rendered per-turn block, empty when it could not be loaded: the session
 * still opens, just less aware, the same fail-soft posture the rest of the
 * context assembly uses. */
export function buildRealtimeInstructions(familyContext: string): string {
  return composeRealtimeInstructions({
    persona: VOICE_PERSONA_MARKDOWN,
    familyContext,
  });
}
