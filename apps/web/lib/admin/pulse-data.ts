import { adminDb } from "./db";
import { adminTimeZone, dayKey, dayLabel } from "./format";

/**
 * The pulse feed (founder console MJ-14, direction 3 steal: the system
 * writes the diary). One merged, founder-local-day-grouped feed from the
 * tables that already record what happened: events, homa_task_runs,
 * conversation_deliveries, email_sends, and the families row itself for
 * signups. Failures never fold away; each day opens with a plain
 * sentence built from its own counts.
 */

export type PulseCategory = "signup" | "send" | "fail" | "usage" | "billing";

export interface PulseItem {
  at: string;
  category: PulseCategory;
  text: string;
  detail: string | null;
}

export interface PulseDay {
  key: string;
  label: string;
  digest: string;
  items: PulseItem[];
}

const EVENT_TEXT: Record<string, { category: PulseCategory; text: (family: string) => string }> = {
  "map.account_created": { category: "signup", text: (f) => `${f} created an account` },
  "map.family_setup": { category: "signup", text: (f) => `${f} finished family setup` },
  "map.report_generated": { category: "usage", text: (f) => `${f} generated a report` },
  "billing.trial_started": { category: "billing", text: (f) => `${f} started a trial` },
  "email.opt_out": { category: "billing", text: (f) => `${f} opted out of journal email` },
  "sms.family_linked": { category: "signup", text: (f) => `${f} linked a texting number` },
  "materials.finalized": { category: "usage", text: (f) => `${f} kept a printable (finalized)` },
  "map.plan_consented": { category: "usage", text: (f) => `${f} asked for a month plan` },
};

function runText(kind: string, status: string): string {
  const kindLabel = kind.replace(/_/g, " ");
  return `${kindLabel} run ${status.replace(/_/g, " ")}`;
}

export async function getPulseDays(days = 14): Promise<PulseDay[]> {
  const sql = adminDb();
  const interval = `${days} days`;
  const timeZone = adminTimeZone();

  // Sequential on purpose, never Promise.all: see lib/admin/db.ts.
  const events = await sql<{ name: string; created_at: string; family: string | null }[]>`
    select e.name, e.created_at::text as created_at, f.name as family
    from public.events e
    left join public.families f on f.id = e.family_id
    where e.created_at >= now() - ${interval}::interval
      and e.name in ('map.account_created', 'map.family_setup', 'map.report_generated',
                     'billing.trial_started', 'email.opt_out', 'sms.family_linked',
                     'materials.finalized', 'map.plan_consented')
    order by e.created_at desc
    limit 400
  `;
  const runs = await sql<{ kind: string; status: string; error: string | null; created_at: string; family: string | null }[]>`
    select r.kind, r.status, r.error, r.created_at::text as created_at, f.name as family
    from public.homa_task_runs r
    left join public.families f on f.id = r.family_id
    where r.created_at >= now() - ${interval}::interval
    order by r.created_at desc
    limit 400
  `;
  const deliveries = await sql<{ channel: string; status: string; error: string | null; updated_at: string; family: string }[]>`
    select d.channel, d.status, d.error, d.updated_at::text as updated_at, f.name as family
    from public.conversation_deliveries d
    join public.families f on f.id = d.family_id
    where d.status in ('failed', 'uncertain')
      and d.updated_at >= now() - ${interval}::interval
    order by d.updated_at desc
    limit 100
  `;
  const emails = await sql<{ kind: string; status: string; error: string | null; updated_at: string; family: string | null }[]>`
    select s.kind, s.status, s.error, s.updated_at::text as updated_at, f.name as family
    from public.email_sends s
    left join public.families f on f.id = s.family_id
    where s.status in ('rejected', 'bounced', 'complained')
      and s.updated_at >= now() - ${interval}::interval
    order by s.updated_at desc
    limit 100
  `;
  const signups = await sql<{ name: string; created_at: string }[]>`
    select f.name, f.created_at::text as created_at
    from public.families f
    where f.created_at >= now() - ${interval}::interval
      and coalesce(f.status, 'open') <> 'deleted'
      and exists (select 1 from public.family_members m where m.family_id = f.id)
    order by f.created_at desc
    limit 100
  `;

  const items: PulseItem[] = [];

  for (const row of signups) {
    items.push({
      at: row.created_at,
      category: "signup",
      text: `${row.name} signed up`,
      detail: null,
    });
  }
  for (const row of events) {
    // Account creation is already covered by the signup entries above.
    if (row.name === "map.account_created") continue;
    const mapping = EVENT_TEXT[row.name];
    if (!mapping) continue;
    items.push({
      at: row.created_at,
      category: mapping.category,
      text: mapping.text(row.family ?? "An anonymous family"),
      detail: `events row: ${row.name}`,
    });
  }
  for (const row of runs) {
    const bad = row.status === "failed" || row.status === "uncertain" || row.status === "partial_uncertain";
    if (row.status === "running") continue;
    items.push({
      at: row.created_at,
      category: bad ? "fail" : "send",
      text: `${row.family ?? "Fleet"}: ${runText(row.kind, row.status)}`,
      detail: row.error ? `homa_task_runs error: ${row.error}` : null,
    });
  }
  for (const row of deliveries) {
    items.push({
      at: row.updated_at,
      category: "fail",
      text: `${row.status === "failed" ? "Failed" : "Uncertain"} ${row.channel} delivery to ${row.family}`,
      detail: row.error ? `conversation_deliveries error: ${row.error}` : "no provider receipt",
    });
  }
  for (const row of emails) {
    items.push({
      at: row.updated_at,
      category: "fail",
      text: `${row.family ? `${row.family}: ` : ""}${row.kind.replace(/_/g, " ")} email ${row.status}`,
      detail: row.error ? `email_sends error: ${row.error}` : null,
    });
  }

  items.sort((a, b) => (a.at < b.at ? 1 : -1));

  const byDay = new Map<string, PulseItem[]>();
  for (const item of items) {
    const key = dayKey(item.at, timeZone);
    const list = byDay.get(key) ?? [];
    list.push(item);
    byDay.set(key, list);
  }

  return Array.from(byDay.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, dayItems]) => {
      const fails = dayItems.filter((item) => item.category === "fail").length;
      const daySignups = dayItems.filter((item) => item.category === "signup").length;
      const sends = dayItems.filter((item) => item.category === "send").length;
      const pieces: string[] = [];
      pieces.push(
        fails === 0 ? "nothing broke" : `${fails} ${fails === 1 ? "thing needs" : "things need"} a look`,
      );
      if (daySignups > 0) pieces.push(`${daySignups} signup ${daySignups === 1 ? "moment" : "moments"}`);
      if (sends > 0) pieces.push(`${sends} scheduled ${sends === 1 ? "run" : "runs"}`);
      const digest = `${pieces.join(", ")}.`;
      return {
        key,
        label: dayLabel(dayItems[0].at, timeZone),
        digest: digest.charAt(0).toUpperCase() + digest.slice(1),
        items: dayItems,
      };
    });
}
