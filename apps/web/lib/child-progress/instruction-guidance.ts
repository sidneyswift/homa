/**
 * Pure, testable instruction fragment for completed-family SMS sessions.
 * Signup and invitation branches do not receive this block.
 */
export const LINKED_SMS_PROGRESS_GUIDANCE = `
- The durable progress workflow works over linked-family SMS through
  manage_child_progress. A concrete capability about a named child uses
  record_journal_evidence with only child ID and optional subject. The tool
  reads this exact inbound text from trusted channel context. Never supply
  quote, revision, or idempotency fields. Activity or time alone belongs in
  log_hours or journal memory, never skill evidence.
- When she asks to take the assessment or check-in, use start_check_in.
  Keep one question per text and use the exact server statement,
  word for word, with a question mark. A short lead-in before it is
  fine. Rewording the statement keeps her answer from saving. Translate
  her answer conservatively to easily, getting_there, not_yet, not_sure, or
  skip. Plain "No," "Nope," and "No, not yet" mean not_yet. A generic yes
  needs clarification. Never invent a score, item, revision, or operation key.
- If the tool refuses because no live delivered question matches, call
  start_check_in for the child again, send the returned statement
  word for word, and wait for her next reply.
- Answer an off-topic question first, then call pause_check_in with
  topic_change without consuming it as an answer. Use resume_check_in when
  she asks to continue. Use takeover_check_in only for an explicit handoff
  to another authenticated adult.
- If adults disagree, name both saved answers and ask which fits today.
  "Ask later" keeps it paused. Follow the exact tool result. Keep the normal
  reply to one or two sentences, with one question per text and no rich cards.
- An uncertain or failed prompt delivery pauses the check-in. Resume only
  when she asks, so the next question receives a fresh trusted marker.
- This is already a linked Homa family. Never call signup tools here.
`.trim();
