import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

import postgres from "postgres";

import { EVAL_FIXTURE_FAMILY_ID } from "../apps/web/lib/family-context-eval-fixture";
import { checkSkillsHealth } from "../apps/web/lib/observability/skills-health";

/**
 * The skills health check's own SQL against the real migrated schema
 * (gh#1237). The unit tests fake every query, which is how the first
 * version shipped reading cron_runs.created_at (the column is ran_at) and
 * matching email_sends.status = 'submitted' (the Resend webhook rewrites
 * it to delivered or bounced). In an outage the first threw, the
 * never-throw guard swallowed it, and nobody was emailed or redeployed;
 * the second would have emailed every hour. Only the email send and the
 * hook POST are faked here; every read and the redeploy record are real.
 */

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Run through `pnpm eval:sandbox --exec ...`.");
}

const sql = postgres(databaseUrl, { prepare: false, max: 1 });
const ENV = {
  HOMA_ADMIN_DIGEST_EMAIL: "founder@example.test",
  HOMA_SKILLS_REDEPLOY_HOOK_URL: "https://example.test/deploy-hook",
};
const notProvisioned = JSON.stringify(
  'Sandbox template "eve-sbx-tpl-vercel-guard" is not provisioned for backend "vercel". Run `eve build` or invoke `prewarmAppSandboxes()` before serving traffic.',
);
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

async function skillCall(input: { at: Date; failed: boolean }) {
  await sql`
    insert into public.agent_tool_calls
      (family_id, session_id, call_id, channel, tool, args, status, result, is_error, created_at)
    values
      (${EVAL_FIXTURE_FAMILY_ID}, ${`skills-health:${randomUUID()}`}, ${randomUUID()}, 'web',
       'load_skill', ${sql.json({ skill: "planner" })}, ${input.failed ? "failed" : "completed"},
       ${input.failed ? sql.json(JSON.parse(notProvisioned)) : sql.json("# The Planner")},
       ${input.failed ? true : null}, ${input.at})
  `;
}

function fakes() {
  const sent: string[][] = [];
  const posted: string[] = [];
  return {
    sent,
    posted,
    deps: {
      sendAlert: async (_to: string, _subject: string, lines: string[]) => {
        sent.push(lines);
        return true;
      },
      triggerRedeploy: async (url: string) => {
        posted.push(url);
        return true;
      },
      log: () => {},
    },
  };
}

try {
  await sql`delete from public.agent_tool_calls where tool = 'load_skill' and session_id like 'skills-health:%'`;
  await sql`delete from public.email_sends where kind = 'skills_outage_alert'`;
  await sql`delete from public.cron_runs where job = 'skills_self_heal'`;

  // Down, with an alert delivered and a redeploy triggered an hour ago:
  // both guards must read the real columns and hold back.
  await skillCall({ at: minutesAgo(40), failed: true });
  await skillCall({ at: minutesAgo(10), failed: true });
  await sql`
    insert into public.email_sends (kind, to_hash, status, created_at)
    values ('skills_outage_alert', ${createHash("sha256").update(ENV.HOMA_ADMIN_DIGEST_EMAIL).digest("hex")},
            'delivered', ${minutesAgo(60)})
  `;
  await sql`
    insert into public.cron_runs (job, ok, counts, ran_at)
    values ('skills_self_heal', true, ${sql.json({ redeploy: "triggered" })}, ${minutesAgo(60)})
  `;
  const held = fakes();
  const heldResult = await checkSkillsHealth({ env: ENV, deps: held.deps });
  assert.equal(heldResult.verdict, "down", "the real window query reads the outage");
  assert.equal(heldResult.failures, 2);
  assert.equal(heldResult.redeploy, "recently_triggered", "cron_runs.ran_at guard holds");
  assert.equal(heldResult.alerted, false, "a delivered alert counts as sent");
  assert.deepEqual(held.posted, []);
  assert.deepEqual(held.sent, []);

  // Same outage, guards expired: it redeploys, records it, and emails.
  await sql`update public.email_sends set created_at = ${minutesAgo(7 * 60)} where kind = 'skills_outage_alert'`;
  await sql`update public.cron_runs set ran_at = ${minutesAgo(4 * 60)} where job = 'skills_self_heal'`;
  const due = fakes();
  const dueResult = await checkSkillsHealth({ env: ENV, deps: due.deps });
  assert.equal(dueResult.redeploy, "triggered");
  assert.equal(dueResult.alerted, true);
  assert.deepEqual(due.posted, [ENV.HOMA_SKILLS_REDEPLOY_HOOK_URL]);
  const [recorded] = await sql<{ n: number }[]>`
    select count(*)::int as n from public.cron_runs
    where job = 'skills_self_heal' and counts->>'redeploy' = 'triggered'
      and ran_at > now() - interval '1 minute'
  `;
  assert.equal(recorded.n, 1, "the redeploy is recorded where the guard reads it");

  // A skill that loads after the last failure means it recovered.
  await skillCall({ at: minutesAgo(1), failed: false });
  const quiet = fakes();
  const quietResult = await checkSkillsHealth({ env: ENV, deps: quiet.deps });
  assert.equal(quietResult.verdict, "recovered");
  assert.deepEqual(quiet.posted, []);
  assert.deepEqual(quiet.sent, []);

  console.log("Skills health PostgreSQL contract passed.");
} finally {
  await sql`delete from public.agent_tool_calls where tool = 'load_skill' and session_id like 'skills-health:%'`;
  await sql`delete from public.email_sends where kind = 'skills_outage_alert'`;
  await sql`delete from public.cron_runs where job = 'skills_self_heal'`;
  await sql.end();
}
