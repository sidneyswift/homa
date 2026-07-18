import { sendAdminDigestEmail } from "../map/email";
import { adminDb } from "./db";
import { formatSignupsLine } from "./digest-format";

/**
 * The founder's daily digest (founder console MJ-14, lab question 3):
 * one internal email each morning summarizing the last 24 hours of
 * signups, delivery failures, uncertain sends, and rejected emails,
 * plus the standing quiet-family count. Sent by the hourly cron when
 * the UTC hour matches HOMA_ADMIN_DIGEST_HOUR_UTC (default 11, which
 * is 7am Eastern in summer); the email_sends ledger is the once-per-day
 * guard, so a redeployed or double-fired cron never double-sends.
 * DARK until HOMA_ADMIN_DIGEST_EMAIL is set.
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
    order by d.updated_at desc limit 20
  `;
  const uncertains = await sql<{ name: string; channel: string }[]>`
    select f.name, d.channel
    from public.conversation_deliveries d
    join public.families f on f.id = d.family_id
    where d.status = 'uncertain' and d.updated_at >= now() - interval '24 hours'
    order by d.updated_at desc limit 20
  `;
  const rejected = await sql<{ kind: string; status: string }[]>`
    select kind, status from public.email_sends
    where status in ('rejected', 'bounced', 'complained')
      and updated_at >= now() - interval '24 hours'
    order by updated_at desc limit 20
  `;
  const taskTrouble = await sql<{ kind: string; status: string; error: string | null }[]>`
    select kind, status, error from public.homa_task_runs
    where status in ('failed', 'uncertain', 'partial_uncertain')
      and created_at >= now() - interval '24 hours'
    order by created_at desc limit 20
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
  lines.push(
    trouble === 0
      ? "Nothing broke in the last 24 hours."
      : `${trouble} delivery ${trouble === 1 ? "problem needs" : "problems need"} a look.`,
  );
  for (const f of failures) {
    lines.push(`Failed ${f.channel} send, ${f.name}: ${f.error ?? "no error recorded"}.`);
  }
  for (const u of uncertains) {
    lines.push(`Uncertain ${u.channel} send, ${u.name}: no provider receipt.`);
  }
  for (const r of rejected) {
    lines.push(`Email ${r.status}: ${r.kind.replace(/_/g, " ")}.`);
  }
  for (const t of taskTrouble) {
    lines.push(`Task run ${t.status}: ${t.kind.replace(/_/g, " ")}${t.error ? ` (${t.error})` : ""}.`);
  }
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
