import { adminDb } from "../admin/db";

/**
 * Layer 4: Engagement Tracking.
 * Records and reports on response engagement signals (positive, negative,
 * neutral) to understand which responses and skills land well.
 */

export type EngagementType = "positive" | "negative" | "neutral";

export interface EngagementEntry {
  id: string;
  familyId: string;
  sessionId: string;
  messageId: string | null;
  engagementType: EngagementType;
  indicator: string;
  createdAt: string;
}

export interface EngagementSummary {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  positiveRate: number;
}

/**
 * Record an engagement signal for a response.
 */
export async function trackEngagement(
  familyId: string,
  sessionId: string,
  messageId: string | null,
  type: EngagementType,
  indicator: string,
): Promise<void> {
  const db = adminDb();

  await db`
    insert into public.response_engagement
      (family_id, session_id, message_id, engagement_type, indicator)
    values (
      ${familyId}::uuid,
      ${sessionId},
      ${messageId}::uuid,
      ${type},
      ${indicator}
    )
  `;
}

/**
 * Get engagement report, optionally filtered. Returns counts and rates
 * for each engagement type.
 */
export async function getEngagementReport(opts?: {
  since?: Date;
  familyId?: string;
}): Promise<EngagementSummary> {
  const db = adminDb();
  const since = opts?.since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rows = await db<
    { engagement_type: string; cnt: number }[]
  >`
    select
      engagement_type,
      count(*)::int as cnt
    from public.response_engagement
    where created_at >= ${since.toISOString()}::timestamptz
      ${opts?.familyId ? db`and family_id = ${opts.familyId}::uuid` : db``}
    group by engagement_type
  `;

  const counts: Record<string, number> = {};
  for (const r of rows) {
    counts[r.engagement_type] = r.cnt;
  }

  const positive = counts["positive"] ?? 0;
  const negative = counts["negative"] ?? 0;
  const neutral = counts["neutral"] ?? 0;
  const total = positive + negative + neutral;

  return {
    positive,
    negative,
    neutral,
    total,
    positiveRate: total > 0 ? positive / total : 0,
  };
}
