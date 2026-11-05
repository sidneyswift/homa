import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import { mapDb } from "./db";
import { ensureFamilyForAuthUser } from "./store";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
after(async () => { if (databaseUrl) await mapDb().end({ timeout: 5 }); });

const PARENTS = 12;
const FIRST_REQUESTS = 6;

test("a sign-in's concurrent first requests open exactly one family", { skip: !databaseUrl }, async () => {
  const sql = mapDb();
  // Open every pooled connection first. On a cold pool the first
  // transaction finishes before the second connection exists, and the
  // race this guards never gets a chance to happen.
  await Promise.all([sql`select pg_sleep(0.05)`, sql`select pg_sleep(0.05)`]);

  const parents = Array.from({ length: PARENTS }, () => {
    const userId = randomUUID();
    return { userId, email: `race-${userId.slice(0, 8)}+homatest@homa.test` };
  });
  for (const { userId, email } of parents) {
    await sql`insert into auth.users (id, email) values (${userId}, ${email})`;
  }

  // The app's first requests after sign-in arrive together; before the
  // lock, two of them each opened a family for one parent.
  const results = await Promise.all(
    parents.flatMap(({ userId, email }) =>
      Array.from({ length: FIRST_REQUESTS }, () =>
        ensureFamilyForAuthUser({ authUserId: userId, email, source: "mobile" }),
      ),
    ),
  );

  for (const [index, { userId, email }] of parents.entries()) {
    const families = results.slice(index * FIRST_REQUESTS, (index + 1) * FIRST_REQUESTS);
    const familyId = families[0]?.id;
    assert.ok(familyId, "the parent has a family");
    assert.deepEqual(new Set(families.map((family) => family?.id)), new Set([familyId]));

    const memberships = await sql`select family_id from public.family_members where user_id = ${userId}`;
    assert.deepEqual(memberships.map((row) => row.family_id), [familyId]);
    const opened = await sql`select source, status, sandbox from public.families where email = ${email}`;
    assert.equal(opened.length, 1, "no second family for one parent");
    assert.equal(opened[0].source, "mobile");
    assert.equal(opened[0].status, "claimed");
    assert.equal(opened[0].sandbox, true, "a +homatest signup stays a sandbox family");

    const again = await ensureFamilyForAuthUser({ authUserId: userId, email, source: "mobile" });
    assert.equal(again?.id, familyId, "a later request finds the same family");
  }
});
