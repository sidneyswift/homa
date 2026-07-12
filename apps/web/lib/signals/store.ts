import { adminDb } from "../admin/db";
import type { ClassifiedSignal } from "./classify";

/**
 * Layer 1: Signal storage and querying.
 * All reads use adminDb() with sequential queries, ::text casts, and
 * no Promise.all (the admin-db contract from db.ts).
 */

export interface SignalFilter {
  familyId?: string;
  signalType?: string;
  since?: Date;
  until?: Date;
  limit?: number;
}

export interface SignalRow {
  id: string;
  familyId: string;
  sessionId: string;
  messageId: string | null;
  signalType: string;
  confidence: number;
  evidence: string;
  createdAt: string;
}

export interface SignalPattern {
  signalType: string;
  familyCount: number;
  occurrenceCount: number;
  sampleEvidence: string[];
}

/**
 * Batch insert classified signals into conversation_signals.
 */
export async function writeSignals(
  familyId: string,
  sessionId: string,
  signals: ClassifiedSignal[],
): Promise<void> {
  if (signals.length === 0) return;
  const db = adminDb();

  for (const signal of signals) {
    await db`
      insert into public.conversation_signals
        (family_id, session_id, message_id, signal_type, confidence, evidence)
      values (
        ${familyId}::uuid,
        ${sessionId},
        ${signal.messageId ?? null}::uuid,
        ${signal.signalType},
        ${signal.confidence},
        ${signal.evidence}
      )
    `;
  }
}

/**
 * Query signals with optional filters.
 */
export async function querySignals(filters: SignalFilter): Promise<SignalRow[]> {
  const db = adminDb();
  const limit = filters.limit ?? 100;

  const rows = await db<
    {
      id: string;
      family_id: string;
      session_id: string;
      message_id: string | null;
      signal_type: string;
      confidence: number;
      evidence: string;
      created_at: string;
    }[]
  >`
    select
      id::text,
      family_id::text,
      session_id,
      message_id::text,
      signal_type,
      confidence,
      evidence,
      created_at::text
    from public.conversation_signals
    where true
      ${filters.familyId ? db`and family_id = ${filters.familyId}::uuid` : db``}
      ${filters.signalType ? db`and signal_type = ${filters.signalType}` : db``}
      ${filters.since ? db`and created_at >= ${filters.since.toISOString()}::timestamptz` : db``}
      ${filters.until ? db`and created_at <= ${filters.until.toISOString()}::timestamptz` : db``}
    order by created_at desc
    limit ${limit}
  `;

  return rows.map((r) => ({
    id: r.id,
    familyId: r.family_id,
    sessionId: r.session_id,
    messageId: r.message_id,
    signalType: r.signal_type,
    confidence: r.confidence,
    evidence: r.evidence,
    createdAt: r.created_at,
  }));
}

/**
 * Find signal patterns: signal types that occur 3+ times across
 * multiple families.
 */
export async function getSignalPatterns(opts?: {
  minOccurrences?: number;
  since?: Date;
}): Promise<SignalPattern[]> {
  const db = adminDb();
  const minOccurrences = opts?.minOccurrences ?? 3;
  const since = opts?.since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const rows = await db<
    {
      signal_type: string;
      family_count: number;
      occurrence_count: number;
      sample_evidence: string;
    }[]
  >`
    select
      signal_type,
      count(distinct family_id)::int as family_count,
      count(*)::int as occurrence_count,
      json_agg(evidence order by created_at desc)::text as sample_evidence
    from public.conversation_signals
    where created_at >= ${since.toISOString()}::timestamptz
    group by signal_type
    having count(*) >= ${minOccurrences}
    order by count(*) desc
  `;

  return rows.map((r) => ({
    signalType: r.signal_type,
    familyCount: r.family_count,
    occurrenceCount: r.occurrence_count,
    sampleEvidence: JSON.parse(r.sample_evidence).slice(0, 5),
  }));
}
