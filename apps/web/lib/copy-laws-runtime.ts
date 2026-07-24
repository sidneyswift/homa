/**
 * The em-dash law, enforced at render rather than asked for in a prompt.
 *
 * "Never use an em dash" is a hard law in agent/instructions.md and in
 * the copy rulebook, and every other generated surface already has a
 * deterministic check behind the ask: materials
 * (lib/materials/page-shell.ts), the morning brief
 * (lib/tasks/research-brief-format.ts), the suggestion rail
 * (lib/chat-suggestions/contract.ts), report email
 * (lib/map/email.ts), SMS (lib/sms-segments.ts). Chat was the one
 * parent-facing surface with only the prompt.
 *
 * It leaks, because a prompt is probabilistic. Measured in prod on
 * 2026-07-21: 2 of 208 family-visible assistant chat messages carry one,
 * across 2 real families, and the very first turn of the first
 * chat-onboarding walk produced one too.
 *
 * Replacement follows the rulebook's own instruction ("use a comma,
 * period, colon, or mid-dot instead"): a comma in the ordinary
 * mid-sentence case, and nothing added where a comma would double up on
 * punctuation that is already there.
 */

const EM_DASH = "—";
/** An en dash between two numbers is a range and stays a range. */
const NUMERIC_EN_DASH_RANGE = /(\d)\s*–\s*(\d)/g;
const EN_DASH = "–";

/**
 * enforceCopyLaws(text): the same words with the banned dashes resolved.
 *
 * Pure and idempotent, so it is safe to run on every render of every
 * message, live or archived, without tracking whether it ran before.
 */
export function enforceCopyLaws(text: string): string {
  if (!text.includes(EM_DASH) && !text.includes(EN_DASH)) return text;
  return (
    text
      // Ranges first, so "ages 4-6" survives the pass below.
      .replace(NUMERIC_EN_DASH_RANGE, "$1-$2")
      .replace(
        // Capture what sits either side so the replacement can avoid
        // stacking a comma onto punctuation that is already doing the job.
        new RegExp(`([\\s\\S]?)\\s*[${EM_DASH}${EN_DASH}]\\s*([\\s\\S]?)`, "g"),
        (match, before: string, after: string) => {
          // Start or end of the string: the dash was decoration.
          if (before === "" || after === "") return `${before}${after}`.trim();
          // Already punctuated on the left ("wait, — actually"): one
          // space is all that belongs there.
          if (/[,.;:!?]/.test(before)) return `${before} ${after}`;
          return `${before}, ${after}`;
        },
      )
  );
}
