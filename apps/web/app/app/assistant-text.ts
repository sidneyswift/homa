/**
 * Two things a model does when a tool call sits in the middle of its
 * turn, both of which reach the parent as visible text.
 *
 * It repeats itself. Text before the tool call, the card, then the same
 * paragraph again underneath, word for word. Seen live on the opening
 * turn of chat-first onboarding: one message, one sentence, rendered
 * twice with a form between the copies.
 *
 * And it narrates its own silence. Told to say nothing after a card, it
 * writes `*(waits silently while the card is on her screen)*` and
 * considers the instruction satisfied. That is a stage direction, and a
 * parent reading it sees Homa describing herself in the third person.
 * It does the same thing unwrapped ("I'll continue once she replies."),
 * which is worse: there is no punctuation to tip her off that she is
 * reading narration rather than being spoken to.
 *
 * Both are handled here rather than in a prompt, because a prompt is
 * probabilistic and this is the kind of thing a parent notices
 * immediately. The rules are narrow enough to be safe: no real reply
 * repeats a whole paragraph verbatim inside one turn, and no real reply
 * is nothing but a parenthetical about what Homa is doing.
 */

/** Wrapped in asterisks or parentheses, and nothing else. */
const STAGE_DIRECTION = /^[*_(\s]*[^*_()]*[*_)\s]*$/;

/**
 * isStageDirection(text): a whole message that is only a description of
 * what Homa is doing, rather than something said to the parent.
 *
 * Deliberately strict. It has to be wrapped AND read like narration, so
 * an ordinary aside in parentheses ("(it saves as you go)") survives:
 * that is Homa talking to her, which is allowed.
 */
export function isStageDirection(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  const wrapped =
    (trimmed.startsWith("*") && trimmed.endsWith("*")) ||
    (trimmed.startsWith("_") && trimmed.endsWith("_")) ||
    (trimmed.startsWith("(") && trimmed.endsWith(")"));
  if (!wrapped) return false;
  if (!STAGE_DIRECTION.test(trimmed)) return false;
  const inner = trimmed.replace(/^[*_(\s]+|[*_)\s]+$/g, "").toLowerCase();
  // Third-person narration about herself, which is the tell. A wrapped
  // aside addressed to the parent ("you can change this later") is not
  // one of these and stays.
  return /^(waits?|pauses?|says? nothing|stays? (quiet|silent)|silent|no (reply|response)|listening|thinking)\b/.test(
    inner,
  );
}

/**
 * The same narration without the asterisks.
 *
 * Seen live on the opening turn: "I'll continue once she replies."
 * Nothing wrapped it, so the rule above let it through, and it reached a
 * parent as Homa discussing her in the third person to nobody. Its
 * sibling, "I'll wait here while you fill that in", is addressed to her
 * but is still only a description of Homa doing nothing.
 *
 * Narrow by construction. It has to be the WHOLE part, one short
 * sentence, and it has to open by announcing that Homa is about to wait
 * or carry on. A real reply never consists solely of that: when Homa has
 * something to say she says it, and when she does not she should be
 * silent rather than announcing the silence.
 */
const NARRATED_PAUSE =
  /^i(?:'|\u2019)?(?:ll|m| will| am)?\s*(?:going to\s+)?(?:wait|continue|carry on|hold (?:on|off)|pause|stand by|stay (?:here|quiet|put)|be here|let her|leave (?:her|it))\b/;

export function isNarratedPause(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 140) return false;
  // One sentence. Two means she said something real alongside it.
  if (trimmed.split(/[.!?]\s+\S/).length > 1) return false;
  return NARRATED_PAUSE.test(trimmed.toLowerCase());
}

/**
 * visibleAssistantTexts(texts): the text parts of one assistant message
 * that should actually render, in order.
 *
 * Drops exact repeats of something already shown in the same message,
 * and drops stage directions outright.
 */
export function visibleAssistantTexts(texts: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const text of texts) {
    const trimmed = text.trim();
    if (trimmed.length === 0) continue;
    if (isStageDirection(trimmed)) continue;
    if (isNarratedPause(trimmed)) continue;
    const key = trimmed.replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}
