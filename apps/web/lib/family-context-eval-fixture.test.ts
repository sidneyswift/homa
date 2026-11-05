import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";

import { resolveAgentAccess } from "./agent-db";
import { jobWorkerContext, refuseNonJobWorkerSession } from "./jobs/guard";
import {
  EVAL_BACKGROUND_MAKING_FIXTURE_CHILD_ID,
  EVAL_BACKGROUND_MAKING_FIXTURE_FAMILY_ID,
  EVAL_BACKGROUND_MAKING_FIXTURE_JOB_ID,
  EVAL_BACKGROUND_MAKING_MODE_HEADER_VALUE,
  EVAL_FIRST_MAKING_FIXTURE_CHILD_ID,
  EVAL_FIRST_MAKING_FIXTURE_FAMILY_ID,
  EVAL_FIRST_MAKING_MODE_HEADER_VALUE,
  EVAL_FIXTURE_FAMILY_ID,
  EVAL_FIXTURE_LIBRARY_ASSET_ID,
  EVAL_FIXTURE_LIBRARY_TITLE,
  EVAL_FIXTURE_MATERIAL_MIXED_ID,
  EVAL_FIXTURE_MATERIAL_PRINT_REVISION_ID,
  EVAL_FIXTURE_MATERIAL_PRINT_REVISION_TITLE,
  EVAL_FIXTURE_PRINT_REVISION_HTML,
  EVAL_FIXTURE_PRINT_REVISION_GENERATION,
  evalFixturePacketSeedSql,
  EVAL_FIXTURE_PARENT_USER_ID,
  EVAL_FIXTURE_PAST_EVENT_TITLE,
  EVAL_FIXTURE_PLAN_CHILD_ID,
  EVAL_FIXTURE_PLAN_SUBJECT,
  EVAL_FIXTURE_SCHEDULED_TODAY_ACTIVITY_INDEX,
  EVAL_FIXTURE_SCHEDULED_WEEK,
  EVAL_FIXTURE_SESSION_ATTRIBUTE,
  EVAL_ONBOARDING_FIXTURE_FAMILY_ID,
  EVAL_ONBOARDING_MODE_HEADER,
  EVAL_ONBOARDING_MODE_HEADER_VALUE,
  EVAL_ONBOARDING_SESSION_ATTRIBUTE,
  evalBackgroundMakingChild,
  evalFamilyFixtureAuth,
  evalFamilyFixtureRows,
  evalFamilyFixtureSeedSql,
  isEvalFamilyFixtureDbBacked,
} from "./family-context-eval-fixture";
import { mobileFirstMakingJob } from "./onboarding/mobile-first-making";

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
const ONBOARDING_REQUEST = new Request("http://localhost/eve/v1/session", {
  headers: {
    [EVAL_ONBOARDING_MODE_HEADER]: EVAL_ONBOARDING_MODE_HEADER_VALUE,
  },
});
const FIRST_MAKING_REQUEST = new Request("http://localhost/eve/v1/session", {
  headers: {
    [EVAL_ONBOARDING_MODE_HEADER]: EVAL_FIRST_MAKING_MODE_HEADER_VALUE,
  },
});
const BACKGROUND_MAKING_REQUEST = new Request("http://localhost/eve/v1/session", {
  headers: {
    [EVAL_ONBOARDING_MODE_HEADER]: EVAL_BACKGROUND_MAKING_MODE_HEADER_VALUE,
  },
});

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

    const access = await resolveAgentAccess(stamped?.attributes, {
      nowSeconds: () => Math.floor(Date.now() / 1_000),
      verifyFamilyMembership: async () => true,
      verifyFamilyArtifactAccess: async () => {},
    });
    assert.deepEqual(access, {
      mode: "pinned",
      familyId: EVAL_FIXTURE_FAMILY_ID,
    });
  });

  it("opts one request into the dedicated active onboarding family", async () => {
    const auth = evalFamilyFixtureAuth(() => localDevAuth(), SANDBOX_ENV);
    const stamped = await auth(ONBOARDING_REQUEST);

    assert.ok(stamped);
    assert.equal(
      stamped.attributes.familyId,
      EVAL_ONBOARDING_FIXTURE_FAMILY_ID,
    );
    assert.equal(stamped.attributes.channel, "materials-lab");
    assert.equal(stamped.attributes.memberName, "Sidney");
    assert.equal(stamped.attributes.onboardingActive, "true");
    assert.equal(
      stamped.attributes[EVAL_ONBOARDING_SESSION_ATTRIBUTE],
      "true",
    );
    assert.equal(stamped.attributes[EVAL_FIXTURE_SESSION_ATTRIBUTE], "true");
    assert.deepEqual(await resolveAgentAccess(stamped.attributes, {
      nowSeconds: () => Math.floor(Date.now() / 1_000),
      verifyFamilyMembership: async () => true,
      verifyFamilyArtifactAccess: async () => {},
    }), {
      mode: "pinned",
      familyId: EVAL_ONBOARDING_FIXTURE_FAMILY_ID,
    });
  });

  it("opts the first-making eval into an active family with one child", async () => {
    const auth = evalFamilyFixtureAuth(() => localDevAuth(), SANDBOX_ENV);
    const stamped = await auth(FIRST_MAKING_REQUEST);

    assert.ok(stamped);
    assert.equal(
      stamped.attributes.familyId,
      EVAL_FIRST_MAKING_FIXTURE_FAMILY_ID,
    );
    assert.equal(stamped.attributes.memberName, "Sidney");
    assert.equal(stamped.attributes.onboardingActive, "true");
    assert.equal(
      stamped.attributes[EVAL_ONBOARDING_SESSION_ATTRIBUTE],
      "true",
    );
  });

  it("stamps the background-making eval as the job runner's own build session", async () => {
    const auth = evalFamilyFixtureAuth(() => localDevAuth(), SANDBOX_ENV);
    const stamped = await auth(BACKGROUND_MAKING_REQUEST);

    assert.ok(stamped);
    assert.equal(stamped.attributes.channel, "agent-job");
    assert.equal(
      stamped.attributes.familyId,
      EVAL_BACKGROUND_MAKING_FIXTURE_FAMILY_ID,
    );
    // A runner-stamped build session carries no parent and no onboarding
    // flag (agent-jobs-cycle.ts); the eval must not add either.
    assert.equal(stamped.attributes.memberName, undefined);
    assert.equal(stamped.attributes.onboardingActive, undefined);
    assert.equal(stamped.attributes[EVAL_FIXTURE_SESSION_ATTRIBUTE], "true");
    assert.deepEqual(jobWorkerContext(stamped.attributes), {
      jobId: EVAL_BACKGROUND_MAKING_FIXTURE_JOB_ID,
      stageNumber: 1,
    });
    assert.equal(refuseNonJobWorkerSession(stamped.attributes), null);
    assert.deepEqual(await resolveAgentAccess(stamped.attributes, {
      nowSeconds: () => Math.floor(Date.now() / 1_000),
      verifyFamilyMembership: async () => true,
      verifyFamilyArtifactAccess: async () => {},
    }), {
      mode: "pinned",
      familyId: EVAL_BACKGROUND_MAKING_FIXTURE_FAMILY_ID,
    });
  });

  it("does not opt in for a truthy-looking header value", async () => {
    const auth = evalFamilyFixtureAuth(() => localDevAuth(), SANDBOX_ENV);
    const request = new Request("http://localhost/eve/v1/session", {
      headers: { [EVAL_ONBOARDING_MODE_HEADER]: "true" },
    });
    const stamped = await auth(request);

    assert.equal(stamped?.attributes.familyId, EVAL_FIXTURE_FAMILY_ID);
    assert.equal(
      stamped?.attributes[EVAL_ONBOARDING_SESSION_ATTRIBUTE],
      undefined,
    );
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

  it("gives the Walker family a real what-works memory for personalization evals", () => {
    const memories = evalFamilyFixtureRows().memories;
    assert.equal(memories.length, 1);
    assert.equal(memories[0]?.kind, "what_works");
    assert.match(memories[0]?.content ?? "", /train-conductor mission/u);
    assert.ok(sql.includes("public.family_memories"));
    assert.ok(sql.includes(memories[0]?.id ?? "missing-memory-id"));
    assert.ok(sql.includes(memories[0]?.content ?? "missing-memory-content"));
  });

  it("seeds a separate active, childless family for onboarding evals", () => {
    assert.ok(sql.includes(EVAL_ONBOARDING_FIXTURE_FAMILY_ID));
    assert.ok(sql.includes("'Onboarding fixture'"));
    assert.match(sql, /"onboarding":\s*\{"state":"active"\}/u);
  });

  it("seeds a separate active family at the first-making boundary", () => {
    assert.ok(sql.includes(EVAL_FIRST_MAKING_FIXTURE_FAMILY_ID));
    assert.ok(sql.includes(EVAL_FIRST_MAKING_FIXTURE_CHILD_ID));
    assert.ok(sql.includes("'First making fixture'"));
    assert.ok(sql.includes("'Story'"));
  });

  it("seeds a no-evidence child with a claimed first-making job mid-build", () => {
    const child = evalBackgroundMakingChild();
    assert.equal(child.id, EVAL_BACKGROUND_MAKING_FIXTURE_CHILD_ID);
    assert.equal(child.profile?.focus, "Reading");
    assert.ok(sql.includes(EVAL_BACKGROUND_MAKING_FIXTURE_FAMILY_ID));
    assert.ok(sql.includes("'Background making fixture'"));
    assert.ok(sql.includes(EVAL_BACKGROUND_MAKING_FIXTURE_JOB_ID));
    assert.ok(sql.includes(`'first-making:${child.id}'`));
    assert.match(sql, /'running', now\(\)\);/u);
    assert.match(sql, /1, 'in_progress'\);/u);
    // The plan is the mobile route's own builder output, not a copy.
    const request = mobileFirstMakingJob(child).plan.request;
    assert.ok(sql.includes(JSON.stringify(request).slice(1, -1).replace(/'/g, "''")));
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

  it("seeds a family-owned curriculum that only Library retrieval can reveal", () => {
    assert.ok(sql.includes("public.family_assets"));
    assert.ok(sql.includes(EVAL_FIXTURE_LIBRARY_ASSET_ID));
    assert.ok(sql.includes(EVAL_FIXTURE_LIBRARY_TITLE));
    assert.ok(sql.includes("public.family_asset_tags"));
    assert.ok(sql.includes("'seeds and plants'"));
  });

  // The planner seed (issue #257, arc PR B0): scheduling and reshuffle
  // evals ground in a real plan, real schedule rows, and real family
  // events, per the house rule that new eval-visible data goes in the
  // fixture and its seed together.
  it("seeds a four-week plan for Finn with schedule rows in the current week", () => {
    assert.ok(sql.includes("public.child_plans"));
    assert.ok(sql.includes(EVAL_FIXTURE_PLAN_CHILD_ID));
    assert.ok(sql.includes(`'${EVAL_FIXTURE_PLAN_SUBJECT}'`));
    // retest 18 days out puts the plan in week 2 today, so the
    // scheduled rows below sit in the CURRENT week and surface even on
    // a family-wide open_planner call.
    assert.ok(sql.includes("now() + interval '18 days'"));
    assert.ok(sql.includes("public.plan_activity_schedule"));
    assert.ok(sql.includes(`${EVAL_FIXTURE_SCHEDULED_WEEK}, 0, current_date + 1`));
    assert.ok(sql.includes(`${EVAL_FIXTURE_SCHEDULED_WEEK}, 1, current_date + 2`));
    // gh#1015: a same-day (not offset) candidate so the duplicate-guard
    // evals have a real generated-plan row to find without a seed of
    // their own. `current_date +` would also match a bare `current_date`
    // prefix check, so assert the exact unoffset close instead.
    assert.ok(sql.includes(`${EVAL_FIXTURE_SCHEDULED_TODAY_ACTIVITY_INDEX}, current_date);`));
    assert.ok(!sql.includes("current_date + 0"));
  });

  it("seeds family events including one in the past for look-back windows", () => {
    assert.ok(sql.includes("public.family_events"));
    assert.ok(sql.includes("'Dentist appointment'"));
    assert.ok(sql.includes("'Co-op day'"));
    assert.ok(sql.includes(`'${EVAL_FIXTURE_PAST_EVENT_TITLE}'`));
    assert.ok(sql.includes("current_date - 2"));
  });
});

describe("print-revision worksheet seed", () => {
  it("pins complete source and real geometry without inventing a review pass", () => {
    assert.equal(createHash("sha256").update(EVAL_FIXTURE_PRINT_REVISION_HTML).digest("hex"),
      EVAL_FIXTURE_PRINT_REVISION_GENERATION.fixture.htmlSha256);
    assert.ok(EVAL_FIXTURE_PRINT_REVISION_HTML.includes(`<h2>${EVAL_FIXTURE_MATERIAL_PRINT_REVISION_TITLE}</h2>`));
    assert.equal((EVAL_FIXTURE_PRINT_REVISION_HTML.match(/class="row"/g) ?? []).length, 4);
    assert.equal((EVAL_FIXTURE_PRINT_REVISION_HTML.match(/class="line"/g) ?? []).length, 4);
    assert.equal("review" in EVAL_FIXTURE_PRINT_REVISION_GENERATION, false);
    assert.equal(EVAL_FIXTURE_PRINT_REVISION_GENERATION.fixture.modelReviewOfFixture, "not-run");
    assert.deepEqual(EVAL_FIXTURE_PRINT_REVISION_GENERATION.pageRoles, ["child"]);
    assert.equal(EVAL_FIXTURE_PRINT_REVISION_GENERATION.pageGeometry[0].overflowIn, 0);
  });

  it("adds a separate parent-kept material and preserves the shared reaction fixture", () => {
    const sql = evalFixturePacketSeedSql();
    assert.notEqual(EVAL_FIXTURE_MATERIAL_PRINT_REVISION_ID, EVAL_FIXTURE_MATERIAL_MIXED_ID);
    assert.ok(sql.includes(EVAL_FIXTURE_MATERIAL_PRINT_REVISION_ID));
    assert.ok(sql.includes(EVAL_FIXTURE_MATERIAL_MIXED_ID));
    assert.ok(sql.includes('<p>Read these long directions before you begin the page.</p>'));
    assert.ok(sql.includes(EVAL_FIXTURE_PRINT_REVISION_HTML.replaceAll("'", "''")));
    assert.ok(sql.includes(JSON.stringify(EVAL_FIXTURE_PRINT_REVISION_GENERATION)));
  });
});
