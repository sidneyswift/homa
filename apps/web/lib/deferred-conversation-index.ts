import { updateConversationMessageEmbedding } from "./conversation-log";
import { embedText } from "./learning/embeddings";
import { mapDb } from "./map/db";
import { isHiddenDirective } from "./onboarding/directives";

type IndexScope = { familyId: string; sessionId: string };
type PendingMessage = { id: string; content: string };

/** Private preview switch, never selected by a model or browser argument. */
export function deferredConversationIndexEnabled(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return environment.VERCEL_ENV === "preview" &&
    environment.HOMA_PREVIEW_DEFER_USER_INDEX === "1";
}

export async function pendingConversationIndexes(scope: IndexScope): Promise<PendingMessage[]> {
  const sql = mapDb();
  return sql.begin(async (tx) => {
    await tx`set local statement_timeout = '2000ms'`;
    return tx<PendingMessage[]>`
      select id, content from public.conversation_messages
      where family_id = ${scope.familyId}
        and session_id = ${scope.sessionId}
        and channel = 'web' and role = 'user'
        and visibility = 'family' and embedding is null
        and char_length(trim(content)) >= 3
      order by created_at, id
      limit 8
    `;
  });
}

/** The canonical row is the retry source. No in-memory queue or unsupervised
 * promise owns recovery. A later completed turn retries missed indexing in
 * this authenticated session. Unindexed rows remain available to full-text
 * recall, including sessions that never receive another completed turn. */
export async function drainConversationIndexes(
  scope: IndexScope,
  dependencies = {
    pending: pendingConversationIndexes,
    embed: embedText,
    save: updateConversationMessageEmbedding,
  },
): Promise<void> {
  const pending = await dependencies.pending(scope);
  const signal = AbortSignal.timeout(8_000);
  // Sequential work bounds provider concurrency; the shared deadline bounds
  // model work across the batch rather than granting each row eight seconds.
  for (const message of pending) {
    if (signal.aborted) break;
    if (isHiddenDirective(message.content) || message.content.trim().length < 3) continue;
    try {
      const embedding = await dependencies.embed(message.content, {
        familyId: scope.familyId,
        signal,
      });
      if (!embedding) continue;
      await dependencies.save({
        familyId: scope.familyId,
        messageId: message.id,
        embedding,
        sourceContent: message.content,
        replaceExisting: false,
      });
    } catch (error) {
      console.error("deferred conversation index failed:",
        error instanceof Error ? error.message : "unknown");
    }
  }
}
