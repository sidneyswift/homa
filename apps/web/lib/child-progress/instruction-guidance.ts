/**
 * Pure, testable instruction fragment for completed-family SMS sessions.
 * Signup and invitation branches do not receive this block.
 *
 * SMS-only deltas, nothing more (2026-07-25): the workflow itself lives
 * in the progress-check-in fleet skill and the tool's own schema,
 * both present on every SMS turn already. What stays here is what only
 * the texting transport needs: the exact-statement law (a reworded
 * question cannot save), one question per text with no rich cards, the
 * delivery-marker pause, and the signup prohibition. The refusal-retry
 * procedure lives in the tool's own refusal note (REISSUE_PROGRESS_NOTE),
 * which tool honesty makes binding at point of use.
 */
export const LINKED_SMS_PROGRESS_GUIDANCE = `
- The durable progress workflow (manage_child_progress) works over
  linked-family SMS exactly as its schema says; the tool reads this
  exact inbound text from trusted channel context.
- A check-in over text sends the exact server statement word for word,
  with a question mark; a short lead-in before it is fine, but
  rewording the statement keeps her answer from saving. One question
  per text, and no rich cards here.
- An uncertain or failed prompt delivery pauses the check-in. Resume
  only when she asks, so the next question receives a fresh trusted
  marker.
- This is already a linked Homa family. Never call signup tools here.
`.trim();
