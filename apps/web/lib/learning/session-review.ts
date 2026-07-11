import { mapDb, type DbJson } from "../map/db";
import { emitMapEvent } from "../map/events";
import {
  extractMemoriesFromText,
  MIN_TEXT_CHARS_FOR_EXTRACTION,
} from "./extract-memories";

/**
 * The post-turn review (agentic ladder item 8, M2-13, the Hermes
 * background-review pattern): once a session accumulates enough NEW
 * messages since its last review, one cheap background pass reads just
 * that window and saves what deserves remembering, through the same
 * guarded path as everything else. This is the ambient-learning
 * replacement for the Mac mini's 30-minute Slack sweep.
 *
 * Cadence is message-driven, not turn-driven: a window opens at
 * REVIEW_MIN_MESSAGES unreviewed rows (user + assistant), so short
 * pleasantries never spend a model call. The learning_reviews unique key
 * is the single-flight claim; the digest is the window's verbatim text
 * (bounded), which on our budget beats maintaining a summarizer.
 *
 * Threshold history: the round-4 live simulation (build-log 2026-07-09
 * midday) ran 12 daily sessions of 2 to 6 rows each and the review never
 * fired at the original threshold of 8; real chat sessions are short, so
 * 4 rows (two full exchanges) is the default, env-tunable for the
 * model-mix experiments.
 */

// Guarded parse: a non-numeric env would make Number(...) NaN, and
// `length < NaN` is always false, silently disabling the message-count gate
// so reviews fire on every tiny batch (2026-07-11 review, CR-65).
function reviewMinMessages(): number {
  const parsed = Number(process.env.HOMA_REVIEW_MIN_MESSAGES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4;
}

const REVIEW_MIN_MESSAGES = reviewMinMessages();
const REVIEW_WINDOW_MAX_MESSAGES = 60;

interface MessageRow {
  sequence: number;
  role: "user" | "assistant";
  content: string;
}

export async function runSessionReview(
  familyId: string,
  sessionId: string,
): Promise<void> {
  const sql = mapDb();

  const lastReviewed = await sql<{ upto_sequence: number }[]>`
    select coalesce(max(upto_sequence), -1) as upto_sequence
    from public.learning_reviews
    where session_id = ${sessionId} and family_id = ${familyId}
  `;
  const since = lastReviewed[0]?.upto_sequence ?? -1;

  const messages = await sql<MessageRow[]>`
    select sequence, role, content
    from public.conversation_messages
    where family_id = ${familyId}
      and session_id = ${sessionId}
      and sequence > ${since}
    order by sequence asc
    limit ${REVIEW_WINDOW_MAX_MESSAGES}
  `;
  if (messages.length < REVIEW_MIN_MESSAGES) return;

  const uptoSequence = messages[messages.length - 1].sequence;

  // The claim: winning this insert owns the window; a concurrent trigger
  // for the same window inserts nothing and stands down.
  const claimed = await sql<{ id: string }[]>`
    insert into public.learning_reviews (family_id, session_id, upto_sequence)
    values (${familyId}, ${sessionId}, ${uptoSequence})
    on conflict (session_id, upto_sequence) do nothing
    returning id
  `;
  const claim = claimed[0];
  if (!claim) return;

  const text = messages
    .map((message) => `${message.role === "user" ? "PARENT" : "HOMA"}: ${message.content}`)
    .join("\n");
  if (text.length < MIN_TEXT_CHARS_FOR_EXTRACTION) {
    await sql`
      update public.learning_reviews
      set result = ${sql.json({ saved: [], skipped: [], reason: "too-short" })}
      where id = ${claim.id}
    `;
    return;
  }

  try {
    const outcome = await extractMemoriesFromText({
      familyId,
      source: "review",
      text,
      conversationLabel: "recent chat messages with this family",
    });
    await sql`
      update public.learning_reviews
      set result = ${sql.json(outcome as unknown as DbJson)}
      where id = ${claim.id}
    `;
    await emitMapEvent("memory.review_extracted", {
      family_id: familyId,
      saved: outcome.saved.length,
      skipped: outcome.skipped.length,
      messages_reviewed: messages.length,
    });
  } catch (error) {
    // Release the window so a later turn retries it.
    await sql`delete from public.learning_reviews where id = ${claim.id}`;
    throw error;
  }
}
