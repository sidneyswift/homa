import type { Sql } from "postgres";

import {
  RESEARCH_BRIEF_FEEDBACK_KIND,
  RESEARCH_BRIEF_FEEDBACK_OUTCOME_KEYS,
} from "./research-brief-feedback-contract";

export const RESEARCH_BRIEF_FEEDBACK_SIGNALS = ["helpful", "not_for_us"] as const;

export type ResearchBriefFeedbackSignal = (typeof RESEARCH_BRIEF_FEEDBACK_SIGNALS)[number];

export interface ResearchBriefFeedbackResult {
  accepted: boolean;
  wrote: boolean;
  signal: ResearchBriefFeedbackSignal | null;
}

type ResearchBriefFeedbackEvent = (input: {
  familyId: string;
  taskRunId: string;
  signal: ResearchBriefFeedbackSignal;
}) => Promise<void>;

/**
 * Checks untrusted feedback input before a server action can persist it.
 * The accepted strings intentionally mirror the database constraint.
 */
export function isResearchBriefFeedbackSignal(value: unknown): value is ResearchBriefFeedbackSignal {
  return typeof value === "string" && RESEARCH_BRIEF_FEEDBACK_SIGNALS.includes(value as ResearchBriefFeedbackSignal);
}

/**
 * Writes one adult's explicit signal for a brief they can actually see.
 * The database query scopes both run and adult to the caller's family, then
 * applies the same typed outcome contract as the Tasks history controls.
 */
export async function recordResearchBriefFeedbackWithDatabase(
  database: Sql,
  input: {
    familyId: string;
    taskRunId: string;
    memberUserId: string;
    signal: ResearchBriefFeedbackSignal;
    emit: ResearchBriefFeedbackEvent;
  },
): Promise<ResearchBriefFeedbackResult> {
  const rows = await database<{ accepted: boolean; wrote: boolean }[]>`
    with eligible as (
      select r.id
      from public.homa_task_runs r
      where r.id = ${input.taskRunId}
        and r.family_id = ${input.familyId}
        and r.kind = ${RESEARCH_BRIEF_FEEDBACK_KIND}
        and r.delivery_version = 'research_brief_v2'
        and concat(r.status, ':', r.delivered_channel) = any(
          ${database.array([...RESEARCH_BRIEF_FEEDBACK_OUTCOME_KEYS])}::text[]
        )
        and exists (
          select 1
          from public.family_members m
          where m.family_id = ${input.familyId}
            and m.user_id = ${input.memberUserId}
        )
    ),
    written as (
      insert into public.research_brief_feedback (
        family_id, task_run_id, member_user_id, signal, created_at, updated_at
      )
      select
        ${input.familyId}, id, ${input.memberUserId}, ${input.signal}, now(), now()
      from eligible
      on conflict (task_run_id, member_user_id) do update
      set signal = excluded.signal,
          updated_at = excluded.updated_at
      where public.research_brief_feedback.signal is distinct from excluded.signal
      returning id
    )
    select
      exists (select 1 from eligible) as accepted,
      exists (select 1 from written) as wrote
  `;
  const result = rows[0] ?? { accepted: false, wrote: false };
  if (result.wrote) {
    try {
      await input.emit({
        familyId: input.familyId,
        taskRunId: input.taskRunId,
        signal: input.signal,
      });
    } catch {
      console.error("research brief feedback analytics emission failed");
    }
  }
  return {
    accepted: result.accepted,
    wrote: result.wrote,
    signal: result.accepted ? input.signal : null,
  };
}

