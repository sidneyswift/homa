import { randomUUID } from "node:crypto";

import { requestTransaction } from "./conversation-requests";
import { embedText } from "./learning/embeddings";
import { isHiddenDirective } from "./onboarding/directives";

export interface ConversationIndexLease {
  messageId: string; familyId: string; memberUserId: string; revision: string;
  leaseToken: string; content: string;
}
export type ConversationIndexResult = "applied" | "retry" | "skipped" | "stale";

/** Discover a bounded repair batch without copying text into the job ledger.
 * Existing queued failures retain their backoff, including after a restart. */
export async function leaseConversationIndexJobs(limit = 4): Promise<ConversationIndexLease[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 16) throw new Error("Invalid indexing limit");
  return requestTransaction(async tx => {
    await tx`set local statement_timeout='5s'`;
    await tx`set local lock_timeout='2s'`;
    await tx`insert into public.conversation_index_jobs(message_id,family_id,member_user_id,revision)
      select m.id,m.family_id,m.member_user_id,m.search_revision from public.conversation_messages m
      join public.family_members fm on fm.family_id=m.family_id and fm.user_id=m.member_user_id
      join public.families f on f.id=m.family_id and f.status <> 'deleted'
      where m.embedding is null and m.member_user_id is not null and not exists
        (select 1 from public.conversation_index_jobs j where j.message_id=m.id)
      order by m.created_at,m.id limit 100 on conflict do nothing`;
    const rows = await tx<{ message_id: string; family_id: string; member_user_id: string;
      revision: string; content: string; embedding: string | null }[]>`select j.message_id,j.family_id,j.member_user_id,j.revision,m.content,m.embedding
      from public.conversation_index_jobs j
      join public.conversation_messages m on m.id=j.message_id and m.family_id=j.family_id
        and m.member_user_id=j.member_user_id and m.search_revision=j.revision
      join public.family_members fm on fm.family_id=j.family_id and fm.user_id=j.member_user_id
      join public.families f on f.id=j.family_id and f.status <> 'deleted'
      where j.state in ('pending','leased') and j.next_attempt_at <= clock_timestamp()
        and (j.lease_until is null or j.lease_until <= clock_timestamp())
      order by j.next_attempt_at,j.message_id limit ${limit} for update of j skip locked`;
    const leases: ConversationIndexLease[] = [];
    for (const row of rows) {
      if (row.embedding) {
        await tx`update public.conversation_index_jobs set state='done',lease_token=null,lease_until=null,
          updated_at=clock_timestamp() where message_id=${row.message_id} and revision=${row.revision}`;
        continue;
      }
      const leaseToken = randomUUID();
      await tx`update public.conversation_index_jobs set state='leased',lease_token=${leaseToken},
        lease_until=clock_timestamp()+interval '45 seconds',attempts=least(attempts+1,1000000),updated_at=clock_timestamp()
        where message_id=${row.message_id}`;
      leases.push({ messageId: row.message_id, familyId: row.family_id, memberUserId: row.member_user_id,
        revision: row.revision, leaseToken, content: row.content });
    }
    return leases;
  });
}

/** The provider runs outside transactions. Recheck owner, revision and lease
 * before attaching its result, including edit-away-and-back and revoke/rejoin. */
export async function finishConversationIndexJob(lease: ConversationIndexLease,
  result: { embedding: string | null; skipped: boolean }): Promise<ConversationIndexResult> {
  return requestTransaction(async tx => {
    await tx`set local statement_timeout='5s'`;
    await tx`set local lock_timeout='2s'`;
    const membership = await tx`select fm.user_id from public.family_members fm join public.families f on f.id=fm.family_id
      where fm.family_id=${lease.familyId} and fm.user_id=${lease.memberUserId} and f.status <> 'deleted' for key share of fm,f`;
    if (!membership.length) return "stale";
    // Match canonical-write lock order: message first, its job second.
    const [message] = await tx<{ embedding: string | null }[]>`select embedding from public.conversation_messages
      where id=${lease.messageId} and family_id=${lease.familyId} and member_user_id=${lease.memberUserId}
        and search_revision=${lease.revision} and content=${lease.content} for update`;
    if (!message) return "stale";
    const [job] = await tx`select message_id from public.conversation_index_jobs where message_id=${lease.messageId}
      and family_id=${lease.familyId} and member_user_id=${lease.memberUserId} and revision=${lease.revision}
      and state='leased' and lease_token=${lease.leaseToken} and lease_until > clock_timestamp() for update`;
    if (!job) return "stale";
    if (result.embedding && !result.skipped && !message.embedding) {
      await tx`update public.conversation_messages set embedding=${result.embedding} where id=${lease.messageId}
        and family_id=${lease.familyId} and member_user_id=${lease.memberUserId} and search_revision=${lease.revision}
        and content=${lease.content} and embedding is null`;
    }
    const outcome = result.skipped ? "skipped" : (result.embedding || message.embedding) ? "applied" : "retry";
    await tx`update public.conversation_index_jobs set state=${outcome === "retry" ? "pending" : outcome === "skipped" ? "skipped" : "done"},
      lease_token=null,lease_until=null,next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,30*power(2,least(attempts,7)))::double precision),
      updated_at=clock_timestamp() where message_id=${lease.messageId} and revision=${lease.revision} and lease_token=${lease.leaseToken}`;
    return outcome;
  });
}

export interface ConversationIndexDependencies {
  lease(): Promise<ConversationIndexLease[]>;
  embed(content: string, attribution: { familyId: string; signal: AbortSignal }): Promise<string | null>;
  finish(lease: ConversationIndexLease, result: { embedding: string | null; skipped: boolean }): Promise<ConversationIndexResult>;
  deadlineMs?: number;
}

export async function runConversationIndexing(dependencies: ConversationIndexDependencies = {
  lease: leaseConversationIndexJobs, embed: embedText, finish: finishConversationIndexJob,
}): Promise<ConversationIndexResult[]> {
  const leases = await dependencies.lease();
  return Promise.all(leases.map(async lease => {
    const skipped = lease.content.trim().length < 3 || isHiddenDirective(lease.content);
    let embedding: string | null = null;
    if (!skipped) {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        embedding = await Promise.race([
          Promise.resolve().then(() => dependencies.embed(lease.content, { familyId: lease.familyId, signal: controller.signal })),
          new Promise<null>(resolve => { timer = setTimeout(() => { controller.abort(); resolve(null); }, dependencies.deadlineMs ?? 20_000); }),
        ]);
      } catch { embedding = null; }
      finally { clearTimeout(timer); }
    }
    try { return await dependencies.finish(lease, { embedding, skipped }); }
    catch {
      // An uncertain write retains its lease until expiry. No guessed success
      // or destructive acknowledgement can lose the durable retry obligation.
      return "retry";
    }
  }));
}
