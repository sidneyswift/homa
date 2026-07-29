/**
 * Shared reporting for the voice evals (ruling `copy-voice-memorable`,
 * 2026-07-29, gh#413).
 *
 * Voice is a judgment call, so these evals do two different jobs and keep
 * them separate on purpose. The FLOORS are deterministic and assert: they
 * are the lines the ruling explicitly did not move, and loosening the
 * register is exactly when they are most likely to slip. The REGISTER is
 * printed, not asserted, because "is this actually funny" is not a thing a
 * substring check can answer, and a lexical proxy for it would be the
 * pattern-matching this repo bans for judgment calls (AGENTS.md, models
 * judge / code verifies).
 *
 * So: the machine guarantees she never crossed a line, and a human reads
 * the transcript to decide whether she got interesting. Run with
 * `pnpm eval:sandbox --filter voice` and read the output.
 */

import { equals } from "eve/evals/expect";
import type { Assertion } from "eve/evals/expect";

/** Deficit vocabulary about a child. "behind" is banned in every sense. */
const FLOOR_WORDS = [
  "behind",
  "delayed",
  "struggling",
  "below average",
  "percentile",
  "diagnos",
  "disorder",
  "concerning",
];

const BANNED_OPENERS = ["Great question", "I'd be happy to help", "Absolutely!"];

export interface VoiceContext {
  readonly reply: string | null;
  check(value: unknown, assertion: Assertion): unknown;
  log(message: string): void;
}

export function reportVoice(t: VoiceContext, label: string): void {
  const reply = t.reply ?? "";

  console.error(`\n───────── voice: ${label} ─────────`);
  console.error(reply || "(no reply)");
  console.error(`───────── ${reply.length} chars ─────────\n`);

  const lower = reply.toLowerCase();
  const floorHits = FLOOR_WORDS.filter((w) => lower.includes(w));
  const openerHits = BANNED_OPENERS.filter((o) => reply.trimStart().startsWith(o));

  t.check(reply.length > 0, equals(true));
  t.check(floorHits, equals([]));
  t.check(reply.includes("—"), equals(false));
  t.check(openerHits, equals([]));
}
