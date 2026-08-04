import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import postgres from "postgres";

import { claimStripeTrialCard } from "./duplicate-trial";
import { mapDb } from "../map/db";

const FAMILY_A = "00000000-0000-4000-8000-000000000901";
const FAMILY_B = "00000000-0000-4000-8000-000000000902";
const FAMILY_C = "00000000-0000-4000-8000-000000000903";
const FAMILY_D = "00000000-0000-4000-8000-000000000904";

describe("Stripe trial card claims against the migrated database", () => {
  const sql = mapDb();
  const anonymous = postgres(process.env.HOMA_EVAL_DATABASE_URL ?? "", { max: 1 });

  before(async () => {
    await anonymous`set role anon`;
    await sql`
      insert into public.families (id, stripe_subscription_status)
      values
        (${FAMILY_A}, 'trialing'),
        (${FAMILY_B}, 'trialing'),
        (${FAMILY_C}, 'trialing'),
        (${FAMILY_D}, 'trialing')
    `;
  });

  after(async () => {
    await sql`delete from public.families where id in (${FAMILY_A}, ${FAMILY_B}, ${FAMILY_C}, ${FAMILY_D})`;
    await anonymous.end({ timeout: 1 });
  });

  it("blocks a second active family, then allows a new claim only after the first trial lapses", async () => {
    assert.equal(await claimStripeTrialCard(FAMILY_A, "fp_same_card"), "claimed");
    assert.equal(await claimStripeTrialCard(FAMILY_B, "fp_same_card"), "duplicate");

    await sql`
      update public.families
      set stripe_subscription_status = 'canceled'
      where id = ${FAMILY_A}
    `;
    assert.equal(await claimStripeTrialCard(FAMILY_B, "fp_same_card"), "claimed");

    const owner = await sql<{ family_id: string }[]>`
      select family_id
      from public.stripe_trial_card_claims
      where card_fingerprint = 'fp_same_card'
    `;
    assert.equal(owner[0]?.family_id, FAMILY_B);
  });

  it("serializes simultaneous card claims so exactly one active family owns the card", async () => {
    const results = await Promise.all([
      claimStripeTrialCard(FAMILY_C, "fp_racing_card"),
      claimStripeTrialCard(FAMILY_D, "fp_racing_card"),
    ]);

    assert.deepEqual([...results].sort(), ["claimed", "duplicate"]);
    const owners = await sql<{ family_id: string }[]>`
      select family_id
      from public.stripe_trial_card_claims
      where card_fingerprint = 'fp_racing_card'
    `;
    assert.equal(owners.length, 1);
    assert.ok([FAMILY_C, FAMILY_D].includes(owners[0]?.family_id ?? ""));
  });

  it("never lets an anonymous request test whether a card is already claimed", async () => {
    await assert.rejects(
      anonymous`select card_fingerprint from public.stripe_trial_card_claims limit 1`,
      /permission denied|must be owner/u,
    );
  });
});
