import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import postgres from "postgres";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Run through pnpm eval:sandbox.");
}

const sql = postgres(databaseUrl, { prepare: false, max: 1 });
const userIds: string[] = [];
const familyIds: string[] = [];

async function createFamilyForEmail(
  email: string,
): Promise<{ familyId: string; sandbox: boolean }> {
  const userId = randomUUID();
  userIds.push(userId);
  await sql`
    insert into auth.users (id, email, email_confirmed_at)
    values (${userId}, ${email}, now())
  `;

  const rows = await sql.begin(async (transaction) => {
    await transaction`
      select set_config('request.jwt.claim.sub', ${userId}, true)
    `;
    await transaction`set local role authenticated`;
    return transaction<{ family_id: string }[]>`
      select *
      from public.create_my_family(
        'Fixture sandbox contract',
        'AZ',
        'Fixture parent'
      )
    `;
  });
  assert.equal(rows.length, 1);
  const familyId = rows[0].family_id;
  familyIds.push(familyId);

  const [created] = await sql<
    { sandbox: boolean; members: number; role: string | null }[]
  >`
    select
      family.sandbox,
      count(member.user_id)::integer as members,
      min(member.role) as role
    from public.families family
    left join public.family_members member
      on member.family_id = family.id
    where family.id = ${familyId}
    group by family.id, family.sandbox
  `;
  assert.deepEqual(
    { members: created.members, role: created.role },
    { members: 1, role: "parent" },
  );
  return { familyId, sandbox: created.sandbox };
}

try {
  const cases = [
    { email: "ordinary-parent@example.com", sandbox: false },
    { email: "parent+homatest-run@example.invalid", sandbox: true },
    { email: "isolation-contract@example.com", sandbox: true },
    { email: "continuity-contract@example.com", sandbox: true },
    { email: "parented-session-contract@example.com", sandbox: true },
  ];

  for (const testCase of cases) {
    const created = await createFamilyForEmail(testCase.email);
    assert.equal(
      created.sandbox,
      testCase.sandbox,
      `sandbox classification for ${testCase.email}`,
    );
  }

  const existingUserId = userIds[0];
  await assert.rejects(
    sql.begin(async (transaction) => {
      await transaction`
        select set_config('request.jwt.claim.sub', ${existingUserId}, true)
      `;
      await transaction`set local role authenticated`;
      await transaction`
        select *
        from public.create_my_family('Second family', 'AZ', 'Fixture parent')
      `;
    }),
    /already belong to a family/u,
  );

  console.log(
    "PASS  live fixture family creation classifies sandbox provenance atomically",
  );
} finally {
  if (familyIds.length > 0) {
    await sql`delete from public.families where id in ${sql(familyIds)}`;
  }
  if (userIds.length > 0) {
    await sql`delete from auth.users where id in ${sql(userIds)}`;
  }
  await sql.end({ timeout: 5 });
}
