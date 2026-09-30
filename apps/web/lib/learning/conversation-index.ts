import { mapDb } from "../map/db";
import { isHiddenDirective } from "../onboarding/directives";
import { embedText } from "./embeddings";

type PendingMessage = { id: string; family_id: string; content: string; embedding: string | null };
export interface ConversationIndexDependencies {
  claim(): Promise<PendingMessage[]>;
  embed: typeof embedText;
  finish(message: PendingMessage, embedding: string | null): Promise<void>;
}

/** Claims are committed before network work. A crash leaves a five-minute retry
 * lease; failed items move behind other due work rather than starving the queue. */
export const conversationIndexDependencies: ConversationIndexDependencies = {
  async claim() {
    const sql = mapDb();
    return await sql<PendingMessage[]>`
      with due as (
        select m.id, m.family_id from public.conversation_messages m
        join public.families f on f.id = m.family_id
        where m.embedding_retry_at <= now() and m.role = 'user'
          and f.status <> 'deleted'
        order by m.embedding_retry_at, m.id
        limit 10 for update of m skip locked
      )
      update public.conversation_messages m
      set embedding_retry_at = now() + interval '5 minutes'
      from due where m.id = due.id and m.family_id = due.family_id
      returning m.id, m.family_id, m.content, m.embedding::text
    `;
  },
  embed: embedText,
  async finish(message, embedding) {
    const sql = mapDb();
    await sql`
      update public.conversation_messages m
      set embedding = coalesce(m.embedding, ${embedding}::extensions.vector),
          embedding_retry_at = null
      where m.id = ${message.id} and m.family_id = ${message.family_id}
        and m.content = ${message.content} and m.role = 'user'
        and exists (select 1 from public.families f
                    where f.id = m.family_id and f.status <> 'deleted')
    `;
  },
};

export async function sweepConversationIndex(
  deps: ConversationIndexDependencies = conversationIndexDependencies,
): Promise<{ claimed: number; completed: number; retry: number }> {
  const messages = await deps.claim();
  let completed = 0;
  // Two concurrent provider calls; each has a 20-second deadline. Bounded batch.
  for (let i = 0; i < messages.length; i += 2) {
    await Promise.all(messages.slice(i, i + 2).map(async message => {
      try {
        if (message.embedding || message.content.trim().length < 3 || isHiddenDirective(message.content)) {
          await deps.finish(message, null);
          completed++;
          return;
        }
        const embedding = await deps.embed(message.content, {
          familyId: message.family_id, signal: AbortSignal.timeout(20_000),
        });
        if (!embedding) return; // Durable lease expires and permits a retry.
        await deps.finish(message, embedding);
        completed++;
      } catch {
        // Do not log message text or provider errors. The durable row retains work.
      }
    }));
  }
  return { claimed: messages.length, completed, retry: messages.length - completed };
}
