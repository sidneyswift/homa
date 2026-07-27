import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import {
  childAId,
  childBId,
  createDisposableResearchBriefPostgresHarness,
  familyAId,
  familyBId,
} from "../tasks/research-brief-postgres-harness";
import { findFamiliesDueForSitting1RecapWithDatabase } from "./sitting1-recap";

/**
 * H1 rep 2 (plans/2026-07-21-chat-first-onboarding.md §6.3): the day-1
 * evening recap must find a family only once its first-making artifact
 * is genuinely complete, only in her local evening, and never twice.
 * Real Postgres, not a query-string assertion, because the eligibility
 * rule is jsonb containment plus two joins across job/artifact/material
 * rows, exactly the kind of thing that is easy to get subtly wrong.
 *
 * The shared harness's agent_jobs/materials/family_phones shapes predate
 * this feature; the tables/columns added in before() are a minimal,
 * hand-rolled subset (no RLS, no full constraint set) scoped to this
 * test's own isolated instance, mirroring how the harness's own tables
 * already simplify prod schema rather than replaying full migrations.
 */
const harness = createDisposableResearchBriefPostgresHarness(
  "sitting1_recap",
);
const familyCId = "00000000-0000-4000-8000-000000000801";
const childCId = "00000000-0000-4000-8000-000000000811";
const familyDId = "00000000-0000-4000-8000-000000000802";
const childDId = "00000000-0000-4000-8000-000000000812";

/** 23:30 UTC: evening in UTC, mid-afternoon in America/Los_Angeles (PDT),
 * so the two zones disagree about whether it is evening yet. */
const NOW = new Date("2026-07-24T23:30:00.000Z");

async function insertCompletedFirstMaking(
  sql: ReturnType<typeof harness.database>,
  familyId: string,
  childId: string,
  title: string,
) {
  const [job] = await sql<{ id: string }[]>`
    insert into public.agent_jobs (family_id, child_id, skill, title, status, start_idempotency_key)
    values (${familyId}, ${childId}, 'materials-studio', ${title}, 'completed', ${`first-making:${childId}`})
    returning id
  `;
  const [material] = await sql<{ id: string }[]>`
    insert into public.materials (id, family_id, title, status, child_id)
    values (gen_random_uuid(), ${familyId}, ${title}, 'draft', ${childId})
    returning id
  `;
  await sql`
    insert into public.agent_job_stage_artifacts (job_id, family_id, kind, material_id)
    values (${job.id}, ${familyId}, 'material', ${material.id})
  `;
}

describe("findFamiliesDueForSitting1RecapWithDatabase", () => {
  before(async () => {
    await harness.start();
    const sql = harness.database();
    await sql`alter table public.families add column email text`;
    await sql`alter table public.families add column time_zone text`;
    await sql`alter table public.families add column created_at timestamptz not null default now()`;
    await sql`alter table public.families add column context jsonb`;
    await sql`alter table public.families add column first_name text`;
    await sql`alter table public.families add column parent_display_name text`;
    await sql`alter table public.family_members add column created_at timestamptz not null default now()`;
    await sql`alter table public.materials add column title text`;
    await sql`alter table public.materials add column status text not null default 'ready'`;
    await sql`alter table public.materials add column child_id uuid references public.children (id)`;
    await sql`
      create table public.agent_jobs (
        id uuid primary key default gen_random_uuid(),
        family_id uuid not null references public.families (id) on delete cascade,
        child_id uuid references public.children (id),
        skill text not null,
        title text not null,
        status text not null,
        start_idempotency_key text,
        created_at timestamptz not null default now()
      )
    `;
    await sql`
      create table public.agent_job_stage_artifacts (
        id uuid primary key default gen_random_uuid(),
        job_id uuid not null references public.agent_jobs (id) on delete cascade,
        family_id uuid not null references public.families (id) on delete cascade,
        kind text not null,
        material_id uuid references public.materials (id)
      )
    `;
    await sql`
      create table public.family_phones (
        family_id uuid not null references public.families (id) on delete cascade,
        phone_e164 text not null,
        created_at timestamptz not null default now()
      )
    `;
    await sql`insert into public.families (id) values (${familyCId}), (${familyDId})`;
    await sql`
      insert into public.children (id, family_id, name)
      values (${childCId}, ${familyCId}, 'Child C'), (${childDId}, ${familyDId}, 'Child D')
    `;

    // familyA: eligible in every way (evening zone, first_making done,
    // recap not yet sent, artifact genuinely complete).
    await sql`
      update public.families
      set email = 'a@example.test', time_zone = 'UTC',
          parent_display_name = 'Parent A',
          context = ${sql.json({ onboarding: { beatsDone: ["first_making"] } })}
      where id = ${familyAId}
    `;
    await insertCompletedFirstMaking(sql, familyAId, childAId, "Child A's dinosaur page");

    // familyB: first_making never fired (no beat at all) -> not eligible,
    // even though a job coincidentally exists (defensive fixture).
    await sql`
      update public.families
      set email = 'b@example.test', time_zone = 'UTC',
          context = ${sql.json({ onboarding: { beatsDone: [] } })}
      where id = ${familyBId}
    `;

    // familyC: already sent this recap -> must never fire twice.
    await sql`
      update public.families
      set email = 'c@example.test', time_zone = 'UTC',
          context = ${sql.json({
            onboarding: { beatsDone: ["first_making", "sitting1_recap"] },
          })}
      where id = ${familyCId}
    `;
    await insertCompletedFirstMaking(sql, familyCId, childCId, "Child C's page");

    // familyD: first_making fired but the job is still running -> the
    // artifact is not confirmed yet, so no promise should be invented.
    await sql`
      update public.families
      set email = 'd@example.test', time_zone = 'UTC',
          context = ${sql.json({ onboarding: { beatsDone: ["first_making"] } })}
      where id = ${familyDId}
    `;
    await sql`
      insert into public.agent_jobs (family_id, child_id, skill, title, status, start_idempotency_key)
      values (${familyDId}, ${childDId}, 'materials-studio', 'Building', 'running', ${`first-making:${childDId}`})
    `;
  });
  after(async () => {
    await harness.stop();
  });

  it("finds only the family whose artifact is complete, evening arrived, and never sent", async () => {
    const sql = harness.database();
    const due = await findFamiliesDueForSitting1RecapWithDatabase(sql, NOW);
    const familyIds = due.map((recap) => recap.familyId);
    assert.deepEqual(familyIds, [familyAId]);
    assert.equal(due[0].artifactTitle, "Child A's dinosaur page");
    assert.equal(due[0].childName, "Child A");
    assert.equal(due[0].parentFirstName, "Parent A");
  });

  it("waits for local evening even when the artifact is already complete", async () => {
    const sql = harness.database();
    // Give familyB the same evidence familyA has, but pin her to a zone
    // where NOW is still mid-afternoon.
    await sql`
      update public.families
      set time_zone = 'America/Los_Angeles',
          context = ${sql.json({ onboarding: { beatsDone: ["first_making"] } })}
      where id = ${familyBId}
    `;
    await insertCompletedFirstMaking(sql, familyBId, childBId, "Afternoon-zone page");
    const due = await findFamiliesDueForSitting1RecapWithDatabase(sql, NOW);
    assert.ok(!due.some((recap) => recap.familyId === familyBId));
  });
});
