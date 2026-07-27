import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  childAId,
  childBId,
  createDisposableResearchBriefPostgresHarness,
  familyAId,
  familyBId,
} from "./research-brief-postgres-harness";
import { seedFamilyTaskSchedulesWithDatabase } from "./store";

/**
 * PMF-201 (plans/2026-07-21-chat-first-onboarding.md §6.3/§9): a chat-
 * onboarding family should seed her first morning brief without waiting
 * out the 20-hour floor that exists for text-signup families who have
 * not added a child yet. The eligibility rule lives in raw SQL inside
 * seedKindWithDatabase, so this exercises it against a disposable
 * Postgres instance rather than asserting on the query string.
 *
 * The shared harness's families/agent_schedules tables predate the
 * onboarding and scheduling columns this rule reads; the ALTER/CREATE
 * statements below extend this test's own isolated instance only.
 */
const harness = createDisposableResearchBriefPostgresHarness(
  "seed_onboarding_bypass",
);
const familyCId = "00000000-0000-4000-8000-000000000901";
const childCId = "00000000-0000-4000-8000-000000000911";

describe("seedFamilyTaskSchedules: PMF-201 onboarding bypass", () => {
  before(async () => {
    process.env.MORNING_BRIEF_ENABLED = "true";
    await harness.start();
    const sql = harness.database();
    await sql`alter table public.families add column email text`;
    await sql`alter table public.families add column time_zone text`;
    await sql`alter table public.families add column created_at timestamptz not null default now()`;
    await sql`alter table public.families add column context jsonb`;
    await sql`alter table public.families add column journal_opt_out_at timestamptz`;
    await sql`alter table public.family_members add column created_at timestamptz not null default now()`;
    await sql`alter table public.agent_schedules add column enabled boolean not null default true`;
    await sql`alter table public.agent_schedules add column delivery_pref text`;
    await sql`alter table public.agent_schedules add column created_by text`;
    await sql`alter table public.agent_schedules add column recipient_member_user_id uuid`;
    await sql`alter table public.agent_schedules add column paused_at timestamptz`;
    await sql`alter table public.agent_schedules alter column id set default gen_random_uuid()`;
    await sql`
      create table public.child_reports (
        id uuid primary key default gen_random_uuid(),
        child_id uuid not null references public.children (id) on delete cascade
      )
    `;
    await sql`insert into public.families (id) values (${familyCId})`;
    await sql`
      insert into public.children (id, family_id, name)
      values (${childCId}, ${familyCId}, 'Child C')
    `;
    await sql`
      insert into public.child_reports (child_id)
      values (${childAId}), (${childBId}), (${childCId})
    `;
    // familyA: no onboarding marker, inside the 20-hour floor -> must wait.
    await sql`
      update public.families
      set email = 'a@example.test', time_zone = 'America/New_York',
          created_at = now() - interval '1 hour', context = null
      where id = ${familyAId}
    `;
    // familyB: has run the chat-onboarding tools, inside the 20-hour
    // floor -> the bypass should still seed her.
    await sql`
      update public.families
      set email = 'b@example.test', time_zone = 'America/New_York',
          created_at = now() - interval '1 hour',
          context = ${sql.json({ onboarding: { state: "active" } })}
      where id = ${familyBId}
    `;
    // familyC: no onboarding marker, but past the 20-hour floor -> the
    // pre-existing behavior this rule must not regress.
    await sql`
      update public.families
      set email = 'c@example.test', time_zone = 'America/New_York',
          created_at = now() - interval '25 hours', context = null
      where id = ${familyCId}
    `;
    await seedFamilyTaskSchedulesWithDatabase(sql, new Date());
  });
  after(async () => {
    delete process.env.MORNING_BRIEF_ENABLED;
    await harness.stop();
  });

  it("waits out the 20h floor for a non-onboarding family still inside it", async () => {
    const sql = harness.database();
    const rows = await sql`
      select 1 from public.agent_schedules
      where family_id = ${familyAId} and kind = 'morning_brief'
    `;
    assert.equal(rows.length, 0);
  });

  it("bypasses the 20h floor for a family with a chat-onboarding record", async () => {
    const sql = harness.database();
    const rows = await sql`
      select 1 from public.agent_schedules
      where family_id = ${familyBId} and kind = 'morning_brief'
    `;
    assert.equal(rows.length, 1);
  });

  it("still seeds a non-onboarding family once the 20h floor has passed", async () => {
    const sql = harness.database();
    const rows = await sql`
      select 1 from public.agent_schedules
      where family_id = ${familyCId} and kind = 'morning_brief'
    `;
    assert.equal(rows.length, 1);
  });
});
