import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveAgentAccess } from "./agent-db";
import {
  EVAL_FIXTURE_FAMILY_ID,
  EVAL_FIXTURE_PARENT_USER_ID,
  EVAL_FIXTURE_SESSION_ATTRIBUTE,
  evalFamilyFixtureAuth,
  evalFamilyFixtureRows,
  evalFamilyFixtureSeedSql,
  isEvalFamilyFixtureDbBacked,
} from "./family-context-eval-fixture";

const SANDBOX_ENV = {
  HOMA_EVAL_FAMILY_FIXTURE: "1",
  HOMA_EVAL_DATABASE_URL: "postgres://homa_eval@127.0.0.1:5599/homa_eval",
};

/** The shape localDev() actually returns: a frozen, attribute-less
 *  module constant shared across requests. Freezing it here makes an
 *  accidental in-place mutation of that constant fail the test. */
function localDevAuth() {
  return Object.freeze({
    attributes: Object.freeze({}),
    authenticator: "local-dev",
    principalId: "local-dev",
    principalType: "local-dev",
  });
}

const REQUEST = new Request("http://localhost/eve/v1/session");

describe("isEvalFamilyFixtureDbBacked", () => {
  it("is off without the fixture flag, even with a sandbox database", () => {
    assert.equal(
      isEvalFamilyFixtureDbBacked({
        HOMA_EVAL_DATABASE_URL: SANDBOX_ENV.HOMA_EVAL_DATABASE_URL,
      }),
      false,
    );
  });

  it("is off for plain `eve eval` runs with no sandbox database", () => {
    assert.equal(
      isEvalFamilyFixtureDbBacked({ HOMA_EVAL_FAMILY_FIXTURE: "1" }),
      false,
    );
    assert.equal(
      isEvalFamilyFixtureDbBacked({
        HOMA_EVAL_FAMILY_FIXTURE: "1",
        HOMA_EVAL_DATABASE_URL: "",
      }),
      false,
    );
  });

  it("never activates on Vercel", () => {
    assert.equal(
      isEvalFamilyFixtureDbBacked({ ...SANDBOX_ENV, VERCEL: "1" }),
      false,
    );
  });

  it("stays off when the run opted back into production writes", () => {
    assert.equal(
      isEvalFamilyFixtureDbBacked({
        ...SANDBOX_ENV,
        HOMA_EVAL_ALLOW_PROD_WRITES: "1",
      }),
      false,
    );
  });

  it("is on for a sandboxed eval run", () => {
    assert.equal(isEvalFamilyFixtureDbBacked(SANDBOX_ENV), true);
  });
});

describe("evalFamilyFixtureAuth", () => {
  it("passes a skipped walk entry through untouched", async () => {
    const auth = evalFamilyFixtureAuth(() => null, SANDBOX_ENV);
    assert.equal(await auth(REQUEST), null);
  });

  it("leaves the inner result alone when the run is not db-backed", async () => {
    const inner = localDevAuth();
    const auth = evalFamilyFixtureAuth(() => inner, {
      HOMA_EVAL_FAMILY_FIXTURE: "1",
    });
    assert.equal(await auth(REQUEST), inner);
  });

  it("stamps a sandboxed eval session family-pinned on the fixture family", async () => {
    const inner = localDevAuth();
    const auth = evalFamilyFixtureAuth(() => inner, SANDBOX_ENV);
    const stamped = await auth(REQUEST);

    assert.ok(stamped);
    assert.equal(stamped.principalId, "local-dev");
    assert.equal(stamped.authenticator, "local-dev");
    assert.equal(stamped.attributes.familyId, EVAL_FIXTURE_FAMILY_ID);
    assert.equal(stamped.attributes.channel, "materials-lab");
    assert.equal(stamped.attributes.memberName, "Rachel");
    assert.equal(stamped.attributes[EVAL_FIXTURE_SESSION_ATTRIBUTE], "true");
    // localDev() hands out a shared module constant; the stamp must be
    // a copy, never an in-place edit of that constant.
    assert.deepEqual(inner.attributes, {});
  });

  it("reads the environment per request, so an eval can unset the flag mid-run", async () => {
    const environment: Record<string, string | undefined> = { ...SANDBOX_ENV };
    const auth = evalFamilyFixtureAuth(() => localDevAuth(), environment);

    const first = await auth(REQUEST);
    assert.equal(first?.attributes.familyId, EVAL_FIXTURE_FAMILY_ID);

    delete environment.HOMA_EVAL_FAMILY_FIXTURE;
    const second = await auth(REQUEST);
    assert.equal(second?.attributes.familyId, undefined);
  });

  it("stamps attributes that resolveAgentAccess accepts as pinned access", async () => {
    const auth = evalFamilyFixtureAuth(() => localDevAuth(), SANDBOX_ENV);
    const stamped = await auth(REQUEST);

    const access = await resolveAgentAccess(stamped?.attributes);
    assert.deepEqual(access, {
      mode: "pinned",
      familyId: EVAL_FIXTURE_FAMILY_ID,
    });
  });
});

describe("evalFamilyFixtureSeedSql", () => {
  const sql = evalFamilyFixtureSeedSql();

  it("seeds the family, membership, and every fixture child", () => {
    assert.ok(sql.includes(EVAL_FIXTURE_FAMILY_ID));
    assert.ok(sql.includes(EVAL_FIXTURE_PARENT_USER_ID));
    for (const child of evalFamilyFixtureRows().children) {
      assert.ok(sql.includes(child.id), `missing child ${child.name}`);
      assert.ok(sql.includes(child.name), `missing name ${child.name}`);
    }
  });

  it("seeds a live, set-up, sandboxed household", () => {
    assert.ok(sql.includes("'claimed'"));
    assert.ok(sql.includes("true"));
    assert.match(sql, /"onboarding":\s*\{"state":"done"\}/u);
    assert.ok(sql.includes("profile_completed_at"));
  });

  it("staggers child created_at so pinned load order is deterministic", () => {
    assert.ok(sql.includes("interval '0 minutes'"));
    assert.ok(sql.includes("interval '1 minutes'"));
    assert.ok(sql.includes("interval '2 minutes'"));
  });

  it("widens YYYY-MM birth months to real dates", () => {
    assert.ok(sql.includes("'2022-03-01'::date"));
    assert.ok(!sql.includes("'2022-03'::date"));
  });
});
