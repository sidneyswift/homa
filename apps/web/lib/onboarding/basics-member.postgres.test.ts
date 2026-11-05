import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import { mapDb } from "../map/db";
import { saveFamilyBasics } from "./store";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
after(async () => { if (databaseUrl) await mapDb().end({ timeout: 5 }); });

test("the walk's name lands on her own member row, which the iPhone greets her from", { skip: !databaseUrl }, async () => {
  const sql = mapDb();
  const familyId = randomUUID();
  const parent = randomUUID();
  const partner = randomUUID();
  await sql`insert into auth.users (id, email) values (${parent}, ${`walk-${parent.slice(0, 8)}+homatest@homa.test`}), (${partner}, ${`walk-${partner.slice(0, 8)}+homatest@homa.test`})`;
  await sql`insert into public.families (id, sandbox) values (${familyId}, true)`;
  await sql`
    insert into public.family_members (family_id, user_id, role, display_name)
    values (${familyId}, ${parent}, 'parent', null), (${familyId}, ${partner}, 'partner', 'Sam')
  `;

  await saveFamilyBasics(familyId, { callMeName: "Rosa", usState: "co" }, parent);
  const members = async () => Object.fromEntries(
    (await sql<{ user_id: string; display_name: string | null }[]>`
      select user_id, display_name from public.family_members where family_id = ${familyId}
    `).map((row) => [row.user_id, row.display_name]),
  );
  assert.equal((await members())[parent], "Rosa");
  assert.equal((await members())[partner], "Sam", "another adult's name is untouched");

  await saveFamilyBasics(familyId, { usState: "CO" }, parent);
  assert.equal((await members())[parent], "Rosa", "a save without a name keeps hers");

  const [family] = await sql<{ parent_display_name: string | null; us_state: string | null }[]>`
    select parent_display_name, us_state from public.families where id = ${familyId}
  `;
  assert.deepEqual(family, { parent_display_name: "Rosa", us_state: "CO" });
});
