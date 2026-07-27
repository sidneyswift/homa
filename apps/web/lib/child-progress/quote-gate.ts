import { BANNED_WORDS, EM_DASH } from "@homa/core";

/**
 * The deterministic render gate every stored evidence quote passes
 * before a parent reads it.
 *
 * This is a security floor, not a capability, so it is allowed to be
 * deterministic under AGENTS.md's second exception to
 * models-judge-code-verifies (the same shape as scanMemoryContent in
 * lib/agent-memory.ts). Roster-name checking is exact string
 * verification over a known catalog, not interpretation of meaning, and
 * the failure mode is suppression, never misattribution.
 *
 * Why the gate exists at all: today a stored quote reaches a human only
 * in the founder console (apps/web/app/admin/families/[familyId]/progress/page.tsx),
 * and ProgressTopicView carries no quote, so the firsts page is the
 * first parent-facing render of a stored quote in the product's
 * history. The write path stores a whole inbound message as the quote
 * (manage_child_progress.ts) or a model-chosen span validated only for
 * provenance (claim-validation.ts), so nothing upstream has ever
 * screened a quote for another child's name or a banned word. The gate
 * is only as good as the roster and the word list, which is the point:
 * it is a floor, and there is no model in the render path.
 */

export interface QuoteGateContext {
  /** Display names of every OTHER child in this family, from the
   *  caller's own RLS-loaded roster. Never model-supplied. */
  otherChildNames: readonly string[];
}

export type QuoteGateVerdict =
  | { kind: "render"; quote: string }
  | {
      kind: "suppress";
      reason: "blank" | "other_child" | "banned_words" | "em_dash";
    };

/** Escapes the regex metacharacters so a child's name is matched as a
 *  literal, never as a pattern. */
function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/**
 * gateStoredQuote(quote, context): the verdict. First match wins, so
 * the reason names the first rule that fired. The reason is never shown
 * to a parent and exists only so a test can assert which rule caught a
 * quote: telling a mother her own sentence was filtered for a word she
 * used would be worse than saying nothing, so the renderer omits the
 * quote entirely rather than explaining.
 */
export function gateStoredQuote(
  quote: string | null,
  context: QuoteGateContext,
): QuoteGateVerdict {
  if (quote === null || quote.trim() === "") {
    return { kind: "suppress", reason: "blank" };
  }
  // EM_DASH and BANNED_WORDS carry no `g` flag (copy-laws.ts), so `.test`
  // is stateless and safe to reuse across calls without leaking state.
  if (EM_DASH.test(quote)) {
    return { kind: "suppress", reason: "em_dash" };
  }
  if (BANNED_WORDS.test(quote)) {
    return { kind: "suppress", reason: "banned_words" };
  }
  for (const name of context.otherChildNames) {
    const trimmed = name.trim();
    if (trimmed === "") continue;
    // Unicode property lookaround rather than \b, so a non-ASCII name
    // still matches on a real word boundary ("Zoë" inside "Zoë read
    // it") without firing inside a longer word ("Ana" inside "banana").
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeForRegExp(trimmed)}(?![\\p{L}\\p{N}])`,
      "iu",
    );
    if (pattern.test(quote)) {
      return { kind: "suppress", reason: "other_child" };
    }
  }
  return { kind: "render", quote };
}
