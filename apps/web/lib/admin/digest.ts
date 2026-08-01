import { sendAdminDigestEmail } from "../map/email";
import { adminDb } from "./db";
import { STOP_ERROR_PATTERNS } from "./delivery-errors";
import { formatHandledLine, formatSignupsLine, formatTroubleHeadline } from "./digest-format";
import { familyDisplayName } from "./format";

/**
 * The founder's daily digest (founder console MJ-14, lab question 3):
 * one internal email each morning summarizing the last 24 hours of
 * signups, delivery failures, uncertain sends, and rejected emails,
 * plus the standing quiet-family count. Sent by the hourly cron when
 * the UTC hour matches HOMA_ADMIN_DIGEST_HOUR_UTC (default 11, which
 * is 7am Eastern in summer); the email_sends ledger is the once-per-day
 * guard, so a redeployed or double-fired cron never double-sends.
 * DARK until HOMA_ADMIN_DIGEST_EMAIL is set.
 *
 * Alerts the founder marked handled in the console drop out of the
 * trouble rows and the "need a look" count here, and are reported as
 * one handled line instead. The hide rules mirror the console's
 * (lib/admin/alert-acks.ts): a task-run ack is forever because runs
 * are terminal, while delivery and email acks only hide the row while
 * the ack is newer than it, so a re-failure resurfaces in the digest.
 */

export interface DigestOutcome {
  skipped: boolean;
  sent: boolean;
}

function digestHourUtc(): number {
  const parsed = Number(process.env.HOMA_ADMIN_DIGEST_HOUR_UTC ?? "11");
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : 11;
}

export async function maybeSendAdminDigest(now: Date = new Date()): Promise<DigestOutcome> {
  const to = process.env.HOMA_ADMIN_DIGEST_EMAIL;
  if (!to || now.getUTCHours() !== digestHourUtc()) return { skipped: true, sent: false };

  const sql = adminDb();
  const [stopPattern40300, stopPatternText, stopPatternInbound] = STOP_ERROR_PATTERNS;
  const already = await sql<{ n: string }[]>`
    select count(*)::text as n from public.email_sends
    where kind = 'admin_digest' and created_at >= date_trunc('day', now())
  `;
  if (Number(already[0].n) > 0) return { skipped: true, sent: false };

  // Sequential on purpose, never Promise.all: see lib/admin/db.ts.
  const signups = await sql<{ name: string; created_at: string }[]>`
    select name, created_at::text as created_at from public.families
    where created_at >= now() - interval '24 hours'
      and coalesce(status, 'open') <> 'deleted'
      and not sandbox
    order by created_at desc limit 20
  `;
  const failures = await sql<{ name: string; channel: string; error: string | null }[]>`
    select f.name, d.channel, d.error
    from public.conversation_deliveries d
    join public.families f on f.id = d.family_id
    where d.status = 'failed' and d.updated_at >= now() - interval '24 hours'
      and not (
        coalesce(d.error, '') ilike ${stopPattern40300}
        or coalesce(d.error, '') ilike ${stopPatternText}
        or coalesce(d.error, '') ilike ${stopPatternInbound}
      )
      and not exists (
        select 1 from public.admin_alert_acknowledgments a
        where a.source = 'delivery' and a.source_id = d.id
          and a.created_at >= d.updated_at
      )
    order by d.updated_at desc limit 20
  `;
  const uncertains = await sql<{ name: string; channel: string }[]>`
    select f.name, d.channel
    from public.conversation_deliveries d
    join public.families f on f.id = d.family_id
    where d.status = 'uncertain' and d.updated_at >= now() - interval '24 hours'
      and not exists (
        select 1 from public.admin_alert_acknowledgments a
        where a.source = 'delivery' and a.source_id = d.id
          and a.created_at >= d.updated_at
      )
    order by d.updated_at desc limit 20
  `;
  const rejected = await sql<{ kind: string; status: string }[]>`
    select e.kind, e.status from public.email_sends e
    where e.status in ('rejected', 'bounced', 'complained')
      and e.updated_at >= now() - interval '24 hours'
      and not exists (
        select 1 from public.admin_alert_acknowledgments a
        where a.source = 'email_send' and a.source_id = e.id
          and a.created_at >= e.updated_at
      )
    order by e.updated_at desc limit 20
  `;
  const taskTrouble = await sql<{ kind: string; status: string; error: string | null }[]>`
    select r.kind, r.status, r.error from public.homa_task_runs r
    where r.status in ('failed', 'uncertain', 'partial_uncertain')
      and r.created_at >= now() - interval '24 hours'
      and not (
        r.error = 'delivery failed for every intended recipient'
        and exists (
          select 1 from public.conversation_deliveries d
          where d.task_run_id = r.id
        )
        and not exists (
          select 1 from public.conversation_deliveries d
          where d.task_run_id = r.id
            and not (
              coalesce(d.error, '') ilike ${stopPattern40300}
              or coalesce(d.error, '') ilike ${stopPatternText}
              or coalesce(d.error, '') ilike ${stopPatternInbound}
            )
        )
      )
      and not exists (
        select 1 from public.admin_alert_acknowledgments a
        where a.source = 'task_run' and a.source_id = r.id
      )
    order by r.created_at desc limit 20
  `;
  // The same three windows with the ack filter flipped, so the handled
  // line counts exactly the alerts the queries above left out.
  const handled = await sql<{ n: string }[]>`
    select (
      (
        select count(*) from public.conversation_deliveries d
        where d.status in ('failed', 'uncertain')
          and d.updated_at >= now() - interval '24 hours'
          and not (
            coalesce(d.error, '') ilike ${stopPattern40300}
            or coalesce(d.error, '') ilike ${stopPatternText}
            or coalesce(d.error, '') ilike ${stopPatternInbound}
          )
          and exists (
            select 1 from public.admin_alert_acknowledgments a
            where a.source = 'delivery' and a.source_id = d.id
              and a.created_at >= d.updated_at
          )
      ) + (
        select count(*) from public.email_sends e
        where e.status in ('rejected', 'bounced', 'complained')
          and e.updated_at >= now() - interval '24 hours'
          and exists (
            select 1 from public.admin_alert_acknowledgments a
            where a.source = 'email_send' and a.source_id = e.id
              and a.created_at >= e.updated_at
          )
      ) + (
        select count(*) from public.homa_task_runs r
        where r.status in ('failed', 'uncertain', 'partial_uncertain')
          and r.created_at >= now() - interval '24 hours'
          and exists (
            select 1 from public.admin_alert_acknowledgments a
            where a.source = 'task_run' and a.source_id = r.id
          )
      )
    )::text as n
  `;
  const quiet = await sql<{ n: string }[]>`
    select count(*)::text as n from public.families f
    where coalesce(f.status, 'open') <> 'deleted'
      and not f.sandbox
      and f.profile_completed_at is not null
      and f.created_at < now() - interval '14 days'
      and exists (select 1 from public.children c where c.family_id = f.id)
      and not exists (
        select 1 from public.conversation_messages m
        where m.family_id = f.id and m.role = 'user'
          and m.created_at >= now() - interval '14 days'
      )
  `;

  const lines: string[] = [];
  const trouble = failures.length + rejected.length + taskTrouble.length;
  const handledCount = Number(handled[0].n);
  lines.push(formatTroubleHeadline(trouble, handledCount));
  for (const f of failures) {
    lines.push(`Failed ${f.channel} send, ${familyDisplayName(f.name)}: ${f.error ?? "no error recorded"}.`);
  }
  for (const u of uncertains) {
    lines.push(`Uncertain ${u.channel} send, ${familyDisplayName(u.name)}: no provider receipt.`);
  }
  for (const r of rejected) {
    lines.push(`Email ${r.status}: ${r.kind.replace(/_/g, " ")}.`);
  }
  for (const t of taskTrouble) {
    lines.push(`Task run ${t.status}: ${t.kind.replace(/_/g, " ")}${t.error ? ` (${t.error})` : ""}.`);
  }
  const handledLine = formatHandledLine(handledCount);
  if (handledLine) lines.push(handledLine);
  lines.push(formatSignupsLine(signups.map((s) => s.name)));
  const quietCount = Number(quiet[0].n);
  if (quietCount > 0) {
    lines.push(`${quietCount} ${quietCount === 1 ? "family is" : "families are"} 14+ days quiet. The console has the call list.`);
  }

  const subject =
    trouble === 0 ? "Homa daily digest: all clear" : `Homa daily digest: ${trouble} to look at`;
  const sent = await sendAdminDigestEmail(to, subject, lines);
  return { skipped: false, sent };
}
