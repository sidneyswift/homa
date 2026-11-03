import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { createDisposableResearchBriefPostgresHarness } from "../tasks/research-brief-postgres-harness";
import {
  attachAuthUser,
  getFamilyByAuthUser,
  getOrCreateMobileFamily,
  startAnonymousFamily,
} from "./store";

/**
 * The native bootstrap (POST /api/mobile/onboarding) must give one new
 * parent exactly one family even when two bootstrap calls land at once.
 * A remounted onboarding gate once fired two calls 1 ms apart; both saw
 * no family and each opened and attached its own. Real Postgres, because
 * the fix is a transaction-scoped advisory lock, which only a real
 * server can prove.
 *
 * A BEFORE INSERT trigger sleeps on every new family row, holding the
 * race window open so the outcome is deterministic: without the lock,
 * both callers read "no family" before either insert commits. The
 * control case proves that window is real, so the locked case passing
 * means something.
 *
 * The shared harness's families/family_members/children shapes predate
 * the account columns these helpers read and write; the ALTER statements
 * in before() extend this test's own isolated instance only.
 */
const harness = createDisposableResearchBriefPostgresHarness(
  "mobile_family_bootstrap",
);
const controlUserId = "00000000-0000-4000-8000-000000000a01";
const racedUserId = "00000000-0000-4000-8000-000000000a02";
const firstSiblingUserId = "00000000-0000-4000-8000-000000000a03";
const secondSiblingUserId = "00000000-0000-4000-8000-000000000a04";

async function familyRowCount(): Promise<number> {
  const sql = harness.database();
  const [row] = await sql<{ count: number }[]>`
    select count(*)::int as count from public.families
  `;
  return row.count;
}

async function membershipsFor(userId: string): Promise<string[]> {
  const sql = harness.database();
  const rows = await sql<{ family_id: string }[]>`
    select family_id from public.family_members where user_id = ${userId}
  `;
  return rows.map((row) => row.family_id);
}

/** The route's get-or-create as it stood before the lock: read, then
 * open and attach on a miss, each statement on its own. */
async function unserializedBootstrap(userId: string, email: string) {
  const sql = harness.database();
  const existing = await getFamilyByAuthUser(userId, sql);
  if (existing) return existing;
  const opened = await startAnonymousFamily({ source: "mobile", utm: {} }, sql);
  await attachAuthUser({ familyId: opened.familyId, authUserId: userId, email }, sql);
  return getFamilyByAuthUser(userId, sql);
}

describe("getOrCreateMobileFamily: one family per new parent under concurrency", () => {
  before(async () => {
    await harness.start();
    const sql = harness.database();
    await sql`alter table public.families alter column id set default gen_random_uuid()`;
    await sql`alter table public.families add column email text`;
    await sql`alter table public.families add column first_name text`;
    await sql`alter table public.families add column last_name text`;
    await sql`alter table public.families add column us_state text`;
    await sql`alter table public.families add column phone_e164 text`;
    await sql`alter table public.families add column parent_display_name text`;
    await sql`alter table public.families add column source text not null default 'web'`;
    await sql`alter table public.families add column utm jsonb not null default '{}'::jsonb`;
    await sql`alter table public.families add column resume_token_hash text`;
    await sql`alter table public.families add column sandbox boolean not null default false`;
    await sql`alter table public.families add column profile_completed_at timestamptz`;
    await sql`alter table public.families add column updated_at timestamptz not null default now()`;
    await sql`alter table public.family_members add column role text`;
    await sql`alter table public.family_members add column display_name text`;
    await sql`alter table public.children add column context jsonb`;
    await sql`
      insert into auth.users (id)
      values (${controlUserId}), (${racedUserId}),
             (${firstSiblingUserId}), (${secondSiblingUserId})
    `;
    await sql.unsafe(`
      create function public.hold_family_insert() returns trigger
      language plpgsql as $$
      begin
        perform pg_sleep(0.3);
        return new;
      end
      $$;
      create trigger hold_family_insert
        before insert on public.families
        for each row execute function public.hold_family_insert();
    `);
  });
  after(async () => {
    await harness.stop();
  });

  it("control: the unlocked steps really do race in this harness", async () => {
    const rowsBefore = await familyRowCount();
    await Promise.all([
      unserializedBootstrap(controlUserId, "control@example.test"),
      unserializedBootstrap(controlUserId, "control@example.test"),
    ]);
    // Both callers read "no family" and each opened one. Whether the
    // loser attached as a second parent or was left memberless depends
    // on interleaving, but two rows were written either way.
    assert.equal((await familyRowCount()) - rowsBefore, 2);
  });

  it("two simultaneous calls for one new parent make exactly one family", async () => {
    const rowsBefore = await familyRowCount();
    const sql = harness.database();
    const [first, second] = await Promise.all([
      getOrCreateMobileFamily({ authUserId: racedUserId, email: "Raced@Example.test" }, sql),
      getOrCreateMobileFamily({ authUserId: racedUserId, email: "Raced@Example.test" }, sql),
    ]);
    assert.ok(first && second);
    assert.equal(first.id, second.id);
    assert.equal((await familyRowCount()) - rowsBefore, 1);
    assert.deepEqual(await membershipsFor(racedUserId), [first.id]);
    assert.equal(first.source, "mobile");
    assert.equal(first.email, "raced@example.test");
    assert.equal(first.has_account, true);
  });

  it("a parent who already has a family gets it back without a new row", async () => {
    const sql = harness.database();
    const existing = await getFamilyByAuthUser(racedUserId, sql);
    assert.ok(existing);
    const rowsBefore = await familyRowCount();
    const again = await getOrCreateMobileFamily(
      { authUserId: racedUserId, email: "raced@example.test" },
      sql,
    );
    assert.equal(again?.id, existing.id);
    assert.equal(await familyRowCount(), rowsBefore);
  });

  it("two different new parents calling at once each get their own family", async () => {
    const sql = harness.database();
    const rowsBefore = await familyRowCount();
    const [first, second] = await Promise.all([
      getOrCreateMobileFamily({ authUserId: firstSiblingUserId, email: "first@example.test" }, sql),
      getOrCreateMobileFamily({ authUserId: secondSiblingUserId, email: "second@example.test" }, sql),
    ]);
    assert.ok(first && second);
    assert.notEqual(first.id, second.id);
    assert.equal((await familyRowCount()) - rowsBefore, 2);
    assert.deepEqual(await membershipsFor(firstSiblingUserId), [first.id]);
    assert.deepEqual(await membershipsFor(secondSiblingUserId), [second.id]);
  });
});
