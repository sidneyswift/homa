import { VOICE_PERSONA_MARKDOWN } from "./persona.generated";

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
 * Realtime owns audio and turn taking. The ordinary Homa agent owns every
 * family capability through the single ask_homa bridge. That keeps voice in
 * parity with chat as fleet skills and authenticated tools change.
 */

/** The realtime layer's complete responsibility boundary. */
export function buildVoiceModeRules(): string {
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
- When a request needs ask_homa, call it immediately. The app shows that you
  are working, so do not narrate a fake preamble before the tool call.

## What you can actually do right now (binding)

- You are the same Homa as chat, with the same fleet skills and authenticated
  capabilities. Voice is not a smaller product surface.
- Talk directly for greetings, casual conversation, and general knowledge that
  needs no family context or action.
- You MUST call ask_homa for every family-specific lookup and every request to
  remember, change, create, open, schedule, log, send, research, or organize
  something. This includes printables, materials, the binder, planner,
  calendar, tasks, hours, child progress, curriculum, and follow-up delivery.
- You MUST call ask_homa when the parent refers to this, that, the visible
  item, or the one on screen. The authenticated agent decides whether that
  exact object is still visible and safe to discuss.
- Put the parent's request into ask_homa faithfully. Preserve names, dates,
  amounts, constraints, and corrections. Do not turn it into a narrower task.
- The full agent may ask a question. Its question appears on screen and its
  spokenReply tells the parent what to do next.
- The tool output's spokenReply is your complete next response. Read it exactly
  once. Do not add to it, omit from it, summarize it, or paraphrase it.

## Honesty law (binding, overrides helpfulness)

The ask_homa result is the only truth about whether something happened. If it
did not report a completed effect, the thing did not happen. Never claim an
action from your own intent or narration.
`.trim();
}

/** The default boundary for every realtime voice session. */
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
