import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyEvalIsolation,
  describeEvalIsolation,
  DURABLE_WRITE_ENV_VARS,
  EVAL_ALLOW_PROD_WRITES_FLAG,
  EVAL_DATABASE_URL_VAR,
  EVAL_ISOLATION_FLAG,
  isEvalIsolationActive,
} from "./eval-isolation";

/** A local eval shell as eve leaves it: .env.local fully loaded. */
function prodLikeEnvironment(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: "https://kzabcdefghijklmnopqrs.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
    SUPABASE_DB_PASSWORD: "prod-password",
    SUPABASE_SECRET_KEY: "sb_secret_x",
    BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x",
    HOMA_FAMILY_READ_WRITE_TOKEN: "vercel_blob_family_rw_x",
    HOMA_LESSON_READ_WRITE_TOKEN: "vercel_blob_lesson_rw_x",
    RESEND_API_KEY: "re_x",
    TELNYX_API_KEY: "KEY_x",
    STRIPE_TEST_SECRET_KEY: "sk_test_x",
    STRIPE_LIVE_SECRET_KEY: "sk_live_x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    HANDWRYTTEN_API_KEY: "hw_x",
    AI_GATEWAY_API_KEY: "gateway-key",
    VERCEL_OIDC_TOKEN: "oidc-token",
    SERPAPI_API_KEY: "serp-key",
    FIRECRAWL_API_KEY: "fc-key",
  };
}

describe("applyEvalIsolation", () => {
  it("removes every durable-write credential and raises the isolation flag", () => {
    const env = prodLikeEnvironment();
    const result = applyEvalIsolation(env);

    assert.equal(result.mode, "scrubbed");
    assert.deepEqual([...result.scrubbed].sort(), [...DURABLE_WRITE_ENV_VARS].sort());
    for (const name of DURABLE_WRITE_ENV_VARS) {
      assert.equal(env[name], undefined, `${name} should be gone`);
    }
    assert.equal(env[EVAL_ISOLATION_FLAG], "1");
    assert.equal(isEvalIsolationActive(env), true);
  });

  it("leaves the model gateway and read-only research credentials alone", () => {
    const env = prodLikeEnvironment();
    applyEvalIsolation(env);

    assert.equal(env.AI_GATEWAY_API_KEY, "gateway-key");
    assert.equal(env.VERCEL_OIDC_TOKEN, "oidc-token");
    assert.equal(env.SERPAPI_API_KEY, "serp-key");
    assert.equal(env.FIRECRAWL_API_KEY, "fc-key");
    assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, "https://kzabcdefghijklmnopqrs.supabase.co");
  });

  it("reports the sandbox target when HOMA_EVAL_DATABASE_URL is set", () => {
    const env = prodLikeEnvironment();
    env[EVAL_DATABASE_URL_VAR] = "postgres://homa_eval@127.0.0.1:5599/homa_eval";
    const result = applyEvalIsolation(env);

    assert.equal(result.databaseTarget, "sandbox");
    assert.match(describeEvalIsolation(result), /sandbox Postgres/);
  });

  it("reports database writes as disabled without a sandbox", () => {
    const result = applyEvalIsolation(prodLikeEnvironment());

    assert.equal(result.databaseTarget, "none");
    assert.match(describeEvalIsolation(result), /pnpm eval:sandbox/);
  });

  it("never edits a Vercel runtime's environment, even with the flag leaked", () => {
    const env: Record<string, string | undefined> = {
      ...prodLikeEnvironment(),
      VERCEL: "1",
    };
    const result = applyEvalIsolation(env);

    assert.equal(result.mode, "left-alone-on-vercel");
    assert.equal(env.SUPABASE_DB_PASSWORD, "prod-password");
    assert.equal(env[EVAL_ISOLATION_FLAG], undefined);
  });

  it("honors the explicit prod-writes opt-out and says so loudly", () => {
    const env: Record<string, string | undefined> = {
      ...prodLikeEnvironment(),
      [EVAL_ALLOW_PROD_WRITES_FLAG]: "1",
    };
    const result = applyEvalIsolation(env);

    assert.equal(result.mode, "prod-writes-allowed");
    assert.equal(env.SUPABASE_DB_PASSWORD, "prod-password");
    assert.match(describeEvalIsolation(result), /WARNING/);
  });
});

describe("isEvalIsolationActive", () => {
  it("requires the flag, no Vercel, and no opt-out, all at once", () => {
    assert.equal(isEvalIsolationActive({ [EVAL_ISOLATION_FLAG]: "1" }), true);
    assert.equal(isEvalIsolationActive({}), false);
    assert.equal(isEvalIsolationActive({ [EVAL_ISOLATION_FLAG]: "1", VERCEL: "1" }), false);
    assert.equal(
      isEvalIsolationActive({
        [EVAL_ISOLATION_FLAG]: "1",
        [EVAL_ALLOW_PROD_WRITES_FLAG]: "1",
      }),
      false,
    );
  });
});
