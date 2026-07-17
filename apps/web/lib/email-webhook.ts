import { createHmac, timingSafeEqual } from "node:crypto";

import type { Sql } from "postgres";

/**
 * Resend webhook verification and classification (founder console, MJ-14).
 * Resend signs webhooks with svix: the signed content is
 * "{svix-id}.{svix-timestamp}.{raw body}", the key is the base64 part of
 * the whsec_ secret, and the svix-signature header holds space-separated
 * "v1,<base64 hmac>" candidates. Pure functions so the check is testable
 * without a server (pnpm check:admin).
 */

export interface SvixHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

/** Webhooks older or newer than this are replays or clock trouble. */
const TOLERANCE_SECONDS = 5 * 60;

export function verifySvixSignature(
  secret: string,
  headers: SvixHeaders,
  payload: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!headers.id || !headers.timestamp || !headers.signature) return false;

  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  if (key.length === 0) return false;

  const expected = createHmac("sha256", key)
    .update(`${headers.id}.${headers.timestamp}.${payload}`)
    .digest();

  return headers.signature.split(" ").some((candidate) => {
    const [version, signature] = candidate.split(",", 2);
    if (version !== "v1" || !signature) return false;
    const given = Buffer.from(signature, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** What one Resend event type means for the ledgers. ledgerStatus updates
 * email_sends; failsDelivery escalates a matching conversation_deliveries
 * row to failed (hard bounces only: a complaint was still delivered). */
export interface ResendWebhookAction {
  ledgerStatus: "delivered" | "bounced" | "complained" | null;
  failsDelivery: boolean;
}

export function classifyResendWebhook(type: string): ResendWebhookAction {
  switch (type) {
    case "email.delivered":
      return { ledgerStatus: "delivered", failsDelivery: false };
    case "email.bounced":
      return { ledgerStatus: "bounced", failsDelivery: true };
    case "email.complained":
      return { ledgerStatus: "complained", failsDelivery: false };
    default:
      // sent/opened/clicked/delivery_delayed: nothing durable to record.
      return { ledgerStatus: null, failsDelivery: false };
  }
}

export interface ResendWebhookReceiptResult {
  matched: boolean;
  matchedEmailSends: number;
  matchedDeliveries: number;
  recomputedTaskRuns: number;
}

export function resendWebhookReceiptHttpStatus(
  result: ResendWebhookReceiptResult,
): 200 | 503 {
  return result.matched ? 200 : 503;
}

export async function applyResendWebhookReceiptWithDatabase(
  database: Sql,
  input: {
    emailId: string;
    eventType: string;
    ledgerStatus: Exclude<ResendWebhookAction["ledgerStatus"], null>;
    failsDelivery: boolean;
  },
): Promise<ResendWebhookReceiptResult> {
  return await database.begin<ResendWebhookReceiptResult>(
    async (transaction) => {
      const emailSends = await transaction<{ id: string }[]>`
        update public.email_sends
        set status = ${input.ledgerStatus},
            error = ${input.ledgerStatus === "delivered"
              ? null
              : input.eventType},
            updated_at = now()
        where provider_message_id = ${input.emailId}
          and (${input.ledgerStatus !== "delivered"} or status = 'submitted')
        returning id
      `;
      const matchedEmailSends = emailSends.length > 0
        ? emailSends
        : await transaction<{ id: string }[]>`
            select id
            from public.email_sends
            where provider_message_id = ${input.emailId}
          `;
      const matchingDeliveries = await transaction<{
        id: string;
        task_run_id: string | null;
      }[]>`
        select id, task_run_id
        from public.conversation_deliveries
        where provider_submission_id = ${input.emailId}
      `;
      const taskRunIds = [
        ...new Set(
          matchingDeliveries.flatMap((delivery) =>
            delivery.task_run_id ? [delivery.task_run_id] : []
          ),
        ),
      ].sort();
      if (input.failsDelivery) {
        await transaction`
          update public.conversation_deliveries
          set status = 'failed',
              error = ${input.eventType},
              failed_at = now(),
              updated_at = now()
          where provider_submission_id = ${input.emailId}
            and task_run_id is null
            and status in ('pending', 'sent', 'uncertain', 'failed')
        `;
      }
      let recomputedTaskRuns = 0;
      for (const taskRunId of taskRunIds) {
        const [taskRun] = await transaction<{
          id: string;
          status: string;
        }[]>`
          select id, status
          from public.homa_task_runs
          where id = ${taskRunId}
          for update
        `;
        if (!taskRun) continue;
        if (input.failsDelivery) {
          await transaction`
            update public.conversation_deliveries
            set status = 'failed',
                error = ${input.eventType},
                failed_at = now(),
                updated_at = now()
            where provider_submission_id = ${input.emailId}
              and task_run_id = ${taskRunId}
              and status in ('pending', 'sent', 'uncertain', 'failed')
          `;
        }
        if (taskRun.status === "running") continue;
        const updated = await transaction<{ id: string }[]>`
          with recipient_outcomes as (
            select
              coalesce(
                'member:' || recipient_member_user_id::text,
                'delivery:' || id::text
              ) as recipient_key,
              bool_or(status = 'sent') as delivered,
              bool_or(status in ('pending', 'uncertain')) as uncertain
            from public.conversation_deliveries
            where task_run_id = ${taskRunId}
            group by recipient_key
          ),
          aggregate as (
            select
              count(*) filter (where delivered)::integer as delivered_count,
              count(*) filter (
                where not delivered and uncertain
              )::integer as uncertain_count,
              count(*) filter (
                where not delivered and not uncertain
              )::integer as failed_count
            from recipient_outcomes
          ),
          channel as (
            select d.channel
            from public.conversation_deliveries d
            where d.task_run_id = ${taskRunId}
              and d.status = 'sent'
            order by d.created_at, d.id
            limit 1
          ),
          resolved as (
            select
              case
                when a.delivered_count = 0 and a.uncertain_count > 0
                  then 'uncertain'
                when a.delivered_count = 0 then 'failed'
                when a.failed_count > 0 then 'partial'
                when a.uncertain_count > 0 then 'partial_uncertain'
                else 'done'
              end as status,
              (select channel from channel) as delivered_channel
            from aggregate a
          )
          update public.homa_task_runs r
          set status = resolved.status,
              delivered_channel = resolved.delivered_channel,
              error = case
                when resolved.status in ('failed', 'partial')
                  then ${input.eventType}
                else r.error
              end,
              finished_at = coalesce(r.finished_at, now())
          from resolved
          where r.id = ${taskRunId}
          returning r.id
        `;
        recomputedTaskRuns += updated.length;
      }
      return {
        matched:
          matchedEmailSends.length > 0 || matchingDeliveries.length > 0,
        matchedEmailSends: matchedEmailSends.length,
        matchedDeliveries: matchingDeliveries.length,
        recomputedTaskRuns,
      };
    },
  );
}
