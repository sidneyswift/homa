import { mapDb, type DbJson } from "../map/db";
import { emitMapEvent } from "../map/events";
import {
  extractMemoriesFromText,
  MIN_TEXT_CHARS_FOR_EXTRACTION,
} from "./extract-memories";

/**
 * The post-call memory turn (agentic ladder item 3): once a call
 * transcript has settled in call_transcripts, one background model pass
 * reads the verbatim conversation and saves what matters through the
 * guarded extraction engine. This is what makes a phone call stop
 * evaporating: the fixed Insight schema still feeds curriculum
 * generation, but durable knowledge now flows into the same
 * family_memories the chat agent reads every turn.
 *
 * Once-only per call: the claim UPDATE stamps memory_extracted_at first
 * and only proceeds when it won the row, so concurrent cron passes never
 * double-extract. The full outcome (saved, skipped, tokens) lands in
 * memory_extraction for the audit trail and the /app undo surface.
 */

interface TranscriptRow {
  id: string;
  family_id: string | null;
  child_id: string | null;
  line: "general" | "curriculum";
  transcript_text: string;
}

export async function extractCallMemories(conversationId: string): Promise<boolean> {
  const sql = mapDb();

  // Claim: stamp first, extract after; a lost race returns zero rows.
  const claimed = await sql<TranscriptRow[]>`
    update public.call_transcripts
    set memory_extracted_at = now()
    where conversation_id = ${conversationId}
      and memory_extracted_at is null
      and family_id is not null
      and member_user_id is not null
    returning id, family_id, child_id, line, transcript_text
  `;
  const row = claimed[0];
  if (!row || !row.family_id) return false;

  if (row.transcript_text.length < MIN_TEXT_CHARS_FOR_EXTRACTION) {
    await sql`
      update public.call_transcripts
      set memory_extraction = ${sql.json({ saved: [], skipped: [], reason: "too-short" })}
      where id = ${row.id}
    `;
    return false;
  }

  try {
    const outcome = await extractMemoriesFromText({
      familyId: row.family_id,
      source: "call",
      text: row.transcript_text,
      conversationLabel: `a phone call on Homa's ${row.line} line`,
    });

    await sql`
      update public.call_transcripts
      set memory_extraction = ${sql.json(outcome as unknown as DbJson)}
      where id = ${row.id}
    `;
    await emitMapEvent("memory.call_extracted", {
      family_id: row.family_id,
      ...(row.child_id ? { child_id: row.child_id } : {}),
      saved: outcome.saved.length,
      skipped: outcome.skipped.length,
    });
    return true;
  } catch (error) {
    // Un-claim so the next pass retries; extraction must be at-least-once.
    await sql`
      update public.call_transcripts
      set memory_extracted_at = null
      where id = ${row.id}
    `;
    console.error(
      `call memory extraction failed for ${conversationId}:`,
      error instanceof Error ? error.message : "unknown",
    );
    return false;
  }
}
