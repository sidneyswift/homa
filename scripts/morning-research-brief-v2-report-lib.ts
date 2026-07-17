import type { Sql, TransactionSql } from "postgres";

import { smsSegmentCount } from "../apps/web/lib/sms-segments";

export const MORNING_RESEARCH_BRIEF_WORKFLOW_THRESHOLD_SECONDS = 800;

export interface MorningResearchBriefReportWindow {
  since: Date;
  until?: Date;
}

export interface MorningResearchBriefReportRows {
  runs: Array<{
    status: string;
    deliveredChannel: string | null;
    hasNamedSource: boolean;
    sourceRepeated: boolean;
    rowRepeated: boolean;
    runLatencyMs: number | null;
  }>;
  sms: {
    attempted: number;
    sent: number;
    confirmedSmsToEmailFallback: number;
    unattributedEmailDeliveries: number;
  };
  formats: Array<{
    withinCharacterLimit: boolean;
    withinSegmentLimit: boolean;
  }>;
  usage: Array<{
    inputTokens: number | null;
  }>;
  workflowIndicators: {
    durationAtOrAboveThreshold: number;
    runningOlderThanThreshold: number;
    terminalFailures: number;
  };
  outcomes: {
    accepted: number;
    declined: number;
    answered: number;
  };
  possibleInterest: number;
  feedback: {
    helpful: number;
    notForUs: number;
  };
}

export interface MorningResearchBriefV2Report {
  runCount: number;
  runStatus: Record<string, number>;
  deliveryChannel: Record<string, number>;
  sms: {
    attempted: number;
    sent: number;
    confirmedSmsToEmailFallback: number;
    unattributedEmailDeliveries: number;
  };
  formatCompliance: {
    characterLimitCompliant: number;
    segmentLimitCompliant: number;
    fullyCompliant: number;
  };
  sourceQuality: {
    namedSourceRate: number | null;
    repeatedSourceRate: number | null;
    repeatedKnowledgeRowRate: number | null;
  };
  modelUsage: {
    composeSteps: number;
    inputTokens: number;
  };
  runLatency: {
    observedRuns: number;
    p50Ms: number | null;
    p90Ms: number | null;
  };
  workflowRiskIndicators: {
    thresholdSeconds: number;
    durationAtOrAboveThreshold: number;
    runningOlderThanThreshold: number;
    terminalFailures: number;
  };
  outcomes: {
    accepted: number;
    declined: number;
    answered: number;
  };
  possibleInterestWithinFourHours: number;
  explicitFeedback: {
    helpful: number;
    notForUs: number;
  };
}

export interface MorningResearchBriefRolloutReportRows {
  legacy: MorningResearchBriefReportRows;
  research_brief_v2: MorningResearchBriefReportRows;
}

export interface MorningResearchBriefRolloutReport {
  comparison: {
    baselineDeliveryVersion: "legacy";
    treatmentDeliveryVersion: "research_brief_v2";
  };
  cohorts: {
    legacy: MorningResearchBriefV2Report;
    research_brief_v2: MorningResearchBriefV2Report;
  };
}

function argumentValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);
  const value = index === -1 ? null : args[index + 1];
  return !value || value.startsWith("--") ? null : value;
}

function reportBoundary(value: string, flag: string): Date {
  const boundary = new Date(value);
  if (!Number.isFinite(boundary.getTime())) {
    throw new Error(`${flag} must be an ISO timestamp.`);
  }
  return boundary;
}

export function parseMorningResearchBriefReportWindow(
  args: readonly string[],
): MorningResearchBriefReportWindow {
  const sinceValue = argumentValue(args, "--since");
  if (!sinceValue) throw new Error("Missing required --since.");
  const since = reportBoundary(sinceValue, "--since");
  const untilValue = argumentValue(args, "--until");
  const until = untilValue
    ? reportBoundary(untilValue, "--until")
    : undefined;
  if (until && until <= since) {
    throw new Error("--until must be after --since.");
  }
  return { since, ...(until ? { until } : {}) };
}

function countBy<T>(values: readonly T[], toKey: (value: T) => string): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    const key = toKey(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

export function percentile(values: readonly number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const position = (sorted.length - 1) * fraction;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sorted[lowerIndex];
  const upper = sorted[upperIndex];
  return lower + (upper - lower) * (position - lowerIndex);
}

/**
 * Builds aggregate-only rollout measurements. Input rows must already exclude
 * identifiers, content, and transport destinations.
 */
export function buildMorningResearchBriefV2Report(
  rows: MorningResearchBriefReportRows,
): MorningResearchBriefV2Report {
  const latencies = rows.runs.flatMap((run) =>
    run.runLatencyMs === null ? [] : [run.runLatencyMs],
  );
  const totalRuns = rows.runs.length;
  return {
    runCount: totalRuns,
    runStatus: countBy(rows.runs, (run) => run.status),
    deliveryChannel: countBy(
      rows.runs,
      (run) => run.deliveredChannel ?? "undelivered",
    ),
    sms: rows.sms,
    formatCompliance: {
      characterLimitCompliant: rows.formats.filter((row) => row.withinCharacterLimit)
        .length,
      segmentLimitCompliant: rows.formats.filter((row) => row.withinSegmentLimit)
        .length,
      fullyCompliant: rows.formats.filter(
        (row) => row.withinCharacterLimit && row.withinSegmentLimit,
      ).length,
    },
    sourceQuality: {
      namedSourceRate: ratio(
        rows.runs.filter((run) => run.hasNamedSource).length,
        totalRuns,
      ),
      repeatedSourceRate: ratio(
        rows.runs.filter((run) => run.sourceRepeated).length,
        totalRuns,
      ),
      repeatedKnowledgeRowRate: ratio(
        rows.runs.filter((run) => run.rowRepeated).length,
        totalRuns,
      ),
    },
    modelUsage: {
      composeSteps: rows.usage.length,
      inputTokens: rows.usage.reduce(
        (total, usage) => total + (usage.inputTokens ?? 0),
        0,
      ),
    },
    runLatency: {
      observedRuns: latencies.length,
      p50Ms: percentile(latencies, 0.5),
      p90Ms: percentile(latencies, 0.9),
    },
    workflowRiskIndicators: {
      thresholdSeconds: MORNING_RESEARCH_BRIEF_WORKFLOW_THRESHOLD_SECONDS,
      ...rows.workflowIndicators,
    },
    outcomes: rows.outcomes,
    possibleInterestWithinFourHours: rows.possibleInterest,
    explicitFeedback: rows.feedback,
  };
}

export function buildMorningResearchBriefRolloutReport(
  rows: MorningResearchBriefRolloutReportRows,
): MorningResearchBriefRolloutReport {
  return {
    comparison: {
      baselineDeliveryVersion: "legacy",
      treatmentDeliveryVersion: "research_brief_v2",
    },
    cohorts: {
      legacy: buildMorningResearchBriefV2Report(rows.legacy),
      research_brief_v2: buildMorningResearchBriefV2Report(
        rows.research_brief_v2,
      ),
    },
  };
}

/**
 * Runs every report read on one connection after PostgreSQL has made the
 * transaction read-only. PostgreSQL then rejects writes even if a future
 * report query accidentally contains one.
 */
export async function runReadOnlyMorningResearchBriefReport<T>(
  database: Sql,
  operation: (transaction: TransactionSql) => Promise<T>,
): Promise<T> {
  return (await database.begin(async (transaction) => {
    await transaction`set transaction read only`;
    return await operation(transaction);
  })) as T;
}

/**
 * Loads only the aggregate inputs required by the rollout report. The caller
 * must supply a transaction created by runReadOnlyMorningResearchBriefReport.
 */
type MorningResearchBriefDeliveryCohort = "legacy" | "research_brief_v2";

async function loadMorningResearchBriefCohortRows(
  database: TransactionSql,
  window: MorningResearchBriefReportWindow,
  deliveryVersion: MorningResearchBriefDeliveryCohort,
): Promise<MorningResearchBriefReportRows> {
  const since = window.since.toISOString();
  const until = window.until?.toISOString() ?? null;
  const runs = await database<MorningResearchBriefReportRows["runs"]>`
    select
      r.status,
      r.delivered_channel as "deliveredChannel",
      case
        when r.finished_at is null then null
        else (
          extract(epoch from (r.finished_at - r.started_at)) * 1000
        )::double precision
      end as "runLatencyMs",
      coalesce(jsonb_array_length(p.source_snapshot->'sourceNames'), 0) > 0
        as "hasNamedSource",
      exists (
        select 1
        from public.research_brief_preparations prior
        join public.homa_task_runs prior_run
          on prior_run.id = prior.task_run_id
          and prior_run.family_id = prior.family_id
        where prior.family_id = p.family_id
          and prior_run.delivery_version = ${deliveryVersion}
          and prior.delivered_at is not null
          and p.delivered_at is not null
          and prior.delivered_at < p.delivered_at
          and prior.delivered_at >= p.delivered_at - interval '14 days'
          and exists (
            select 1
            from jsonb_array_elements_text(
              coalesce(prior.source_snapshot->'sourceNames', '[]'::jsonb)
            ) prior_source(name)
            join jsonb_array_elements_text(
              coalesce(p.source_snapshot->'sourceNames', '[]'::jsonb)
            ) current_source(name)
              on current_source.name = prior_source.name
          )
      ) as "sourceRepeated",
      exists (
        select 1
        from public.family_knowledge_use prior_use
        where prior_use.family_id = p.family_id
          and prior_use.knowledge_bank_id = p.knowledge_bank_id
          and prior_use.task_run_id <> p.task_run_id
          and prior_use.used_at < p.delivered_at
          and prior_use.used_at >= p.delivered_at - interval '14 days'
      ) as "rowRepeated"
    from public.homa_task_runs r
    left join public.research_brief_preparations p
      on p.task_run_id = r.id and p.family_id = r.family_id
    where r.kind = 'morning_brief'
      and r.delivery_version = ${deliveryVersion}
      and r.started_at >= ${since}::timestamptz
      and (${until}::timestamptz is null or r.started_at < ${until})
  `;
  const formats = await database<Array<{ draft: string }>>`
    select p.draft
    from public.research_brief_preparations p
    join public.homa_task_runs r
      on r.id = p.task_run_id and r.family_id = p.family_id
    where r.kind = 'morning_brief'
      and r.delivery_version = ${deliveryVersion}
      and r.started_at >= ${since}::timestamptz
      and (${until}::timestamptz is null or r.started_at < ${until})
  `;
  /*
   * A confirmed fallback needs recipient attribution on both attempts.
   * Legacy null-recipient rows remain unknown and are counted separately,
   * which intentionally undercounts fallback rather than guessing.
   */
  const [sms] = await database<MorningResearchBriefReportRows["sms"][]>`
    with morning_deliveries as (
      select
        d.id,
        d.family_id,
        d.task_run_id,
        d.recipient_member_user_id,
        d.channel,
        d.status
      from public.conversation_deliveries d
      join public.homa_task_runs r
        on r.id = d.task_run_id and r.family_id = d.family_id
      where r.kind = 'morning_brief'
        and r.delivery_version = ${deliveryVersion}
        and r.started_at >= ${since}::timestamptz
        and (${until}::timestamptz is null or r.started_at < ${until})
    ),
    confirmed_fallbacks as (
      select distinct
        email_delivery.family_id,
        email_delivery.task_run_id,
        email_delivery.recipient_member_user_id
      from morning_deliveries email_delivery
      where email_delivery.channel = 'email'
        and email_delivery.status = 'sent'
        and email_delivery.recipient_member_user_id is not null
        and exists (
          select 1
          from morning_deliveries sms_delivery
          where sms_delivery.family_id = email_delivery.family_id
            and sms_delivery.task_run_id = email_delivery.task_run_id
            and sms_delivery.recipient_member_user_id
              = email_delivery.recipient_member_user_id
            and sms_delivery.channel = 'sms'
            and sms_delivery.status = 'failed'
        )
    )
    select
      count(distinct (family_id, task_run_id))
        filter (where channel = 'sms')::int as attempted,
      count(distinct (family_id, task_run_id))
        filter (where channel = 'sms' and status = 'sent')::int as sent,
      (
        select count(*)::int from confirmed_fallbacks
      ) as "confirmedSmsToEmailFallback",
      count(*) filter (
        where channel = 'email'
          and status = 'sent'
          and recipient_member_user_id is null
      )::int as "unattributedEmailDeliveries"
    from morning_deliveries
  `;
  const usage = await database<MorningResearchBriefReportRows["usage"]>`
    select
      u.input_tokens as "inputTokens"
    from public.model_usage u
    join public.homa_task_runs r on r.session_id = u.session_id
    where u.channel = 'dispatch'
      and r.kind = 'morning_brief'
      and r.delivery_version = ${deliveryVersion}
      and r.started_at >= ${since}::timestamptz
      and (${until}::timestamptz is null or r.started_at < ${until})
  `;
  const [workflowIndicators] = await database<
    MorningResearchBriefReportRows["workflowIndicators"][]
  >`
    select
      count(*) filter (
        where r.finished_at is not null
          and extract(epoch from (r.finished_at - r.started_at))
            >= ${MORNING_RESEARCH_BRIEF_WORKFLOW_THRESHOLD_SECONDS}
      )::int as "durationAtOrAboveThreshold",
      count(*) filter (
        where r.status = 'running'
          and r.started_at
            <= now() - ${MORNING_RESEARCH_BRIEF_WORKFLOW_THRESHOLD_SECONDS}
              * interval '1 second'
      )::int as "runningOlderThanThreshold",
      count(*) filter (
        where r.status = 'failed'
      )::int as "terminalFailures"
    from public.homa_task_runs r
    where r.kind = 'morning_brief'
      and r.delivery_version = ${deliveryVersion}
      and r.started_at >= ${since}::timestamptz
      and (${until}::timestamptz is null or r.started_at < ${until})
  `;
  const [outcomes] = await database<
    MorningResearchBriefReportRows["outcomes"][]
  >`
    select
      count(*) filter (where l.resolved_outcome = 'accepted')::int as accepted,
      count(*) filter (where l.resolved_outcome = 'declined')::int as declined,
      count(*) filter (where l.resolved_outcome = 'answered')::int as answered
    from public.conversation_open_loops l
    join public.conversation_deliveries d
      on d.id = l.delivery_id and d.family_id = l.family_id
    join public.homa_task_runs r
      on r.id = d.task_run_id and r.family_id = d.family_id
    where r.kind = 'morning_brief'
      and r.delivery_version = ${deliveryVersion}
      and r.started_at >= ${since}::timestamptz
      and (${until}::timestamptz is null or r.started_at < ${until})
  `;
  const [possibleInterest] = await database<Array<{ count: number }>>`
    select count(*)::int as count
    from public.conversation_messages m
    join lateral (
      select d.id
      from public.conversation_deliveries d
      join public.homa_task_runs r
        on r.id = d.task_run_id and r.family_id = d.family_id
      where d.family_id = m.family_id
        and d.episode_id = m.episode_id
        and d.status = 'sent'
        and r.kind = 'morning_brief'
        and r.delivery_version = ${deliveryVersion}
        and r.started_at >= ${since}::timestamptz
        and (${until}::timestamptz is null or r.started_at < ${until})
        and d.sent_at <= m.created_at
        and m.created_at <= d.sent_at + interval '4 hours'
      order by d.sent_at desc
      limit 1
    ) nearest_morning_brief on true
    where m.role = 'user'
      and m.replied_delivery_id is null
  `;
  const [feedback] = await database<
    Array<{ helpful: number; notForUs: number }>
  >`
    select
      count(*) filter (where signal = 'helpful')::int as helpful,
      count(*) filter (where signal = 'not_for_us')::int as "notForUs"
    from public.research_brief_feedback f
    join public.homa_task_runs r
      on r.id = f.task_run_id and r.family_id = f.family_id
    where r.delivery_version = ${deliveryVersion}
      and r.started_at >= ${since}::timestamptz
      and (${until}::timestamptz is null or r.started_at < ${until})
  `;

  return {
    runs,
    sms: sms ?? {
      attempted: 0,
      sent: 0,
      confirmedSmsToEmailFallback: 0,
      unattributedEmailDeliveries: 0,
    },
    formats: formats.map(({ draft }) => ({
      withinCharacterLimit: [...draft].length <= 900,
      withinSegmentLimit: smsSegmentCount(draft) <= 10,
    })),
    usage,
    workflowIndicators: workflowIndicators ?? {
      durationAtOrAboveThreshold: 0,
      runningOlderThanThreshold: 0,
      terminalFailures: 0,
    },
    outcomes: outcomes ?? { accepted: 0, declined: 0, answered: 0 },
    possibleInterest: possibleInterest?.count ?? 0,
    feedback: feedback ?? { helpful: 0, notForUs: 0 },
  };
}

export async function loadMorningResearchBriefRolloutReportRows(
  database: TransactionSql,
  window: MorningResearchBriefReportWindow,
): Promise<MorningResearchBriefRolloutReportRows> {
  const legacy = await loadMorningResearchBriefCohortRows(
    database,
    window,
    "legacy",
  );
  const researchBriefV2 = await loadMorningResearchBriefCohortRows(
    database,
    window,
    "research_brief_v2",
  );
  return {
    legacy,
    research_brief_v2: researchBriefV2,
  };
}

const PII_FIELD_PATTERN =
  /^(?:content|name|phone|email|family_?id|child_?id|message(?:_?text)?|citation(?:_?urls?)?|url)$/i;

/**
 * Guards the report's public shape so a future query cannot silently add PII.
 */
export function assertMorningResearchBriefReportIsPiiFree(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  for (const [key, nestedValue] of Object.entries(value)) {
    if (PII_FIELD_PATTERN.test(key)) {
      throw new Error(`Morning research brief report must remain PII-safe: ${key}`);
    }
    assertMorningResearchBriefReportIsPiiFree(nestedValue);
  }
}
