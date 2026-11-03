import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DURABLE_WRITE_ENV_VARS } from "../apps/web/lib/eval-isolation";
import { resolveMapDbTarget } from "../apps/web/lib/map/db";
import { resolveEvalBlobStore } from "../apps/web/lib/materials/eval-blob-store";

import {
  dotenvKeys,
  isSafeLocalWebKey,
  localMobileEnvironment,
  localWebEnvironment,
  type LocalStackEndpoints,
} from "./local-stack-env.mts";

const endpoints: LocalStackEndpoints = {
  apiUrl: "http://127.0.0.1:54321",
  publishableKey: "local-anon",
  dbUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  blobDir: "/tmp/homa-local-blob",
  blobUrl: "http://127.0.0.1:54330",
};

/** Key names from apps/web/.env.local and .env.development.local as of 2026-11-02. */
const ENV_FILE_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "RESEND_API_KEY",
  "VERCEL_OIDC_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "CRON_SECRET",
  "STRIPE_TEST_SECRET_KEY",
  "STRIPE_LIVE_RESTRICTED_KEY",
  "STRIPE_LIVE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_MONTHLY_URL",
  "NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_MONTHLY_URL",
  "HOMA_WALL_ENABLED",
  "HOMA_DEV_TEST_SESSIONS",
  "REPORT_NARRATIVE_ENABLED",
  "TELNYX_API_KEY",
  "TELNYX_SMS_ENABLED",
  "TELNYX_WEBHOOK_SECRET",
  "RESEND_INBOUND_SECRET",
  "BLOB_READ_WRITE_TOKEN",
  "THANK_YOU_CARDS_ENABLED",
  "HANDWRYTTEN_API_KEY",
  "OPENAI_API_KEY",
];

describe("localWebEnvironment", () => {
  const environment = localWebEnvironment(ENV_FILE_KEYS, endpoints);

  it("blanks every production credential and side-effect flag", () => {
    for (const key of [
      "SUPABASE_DB_PASSWORD",
      "RESEND_API_KEY",
      "CRON_SECRET",
      "STRIPE_TEST_SECRET_KEY",
      "STRIPE_LIVE_SECRET_KEY",
      "STRIPE_LIVE_RESTRICTED_KEY",
      "NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_STRIPE_LIVE_PAYMENT_LINK_MONTHLY_URL",
      "TELNYX_API_KEY",
      "TELNYX_SMS_ENABLED",
      "TELNYX_WEBHOOK_SECRET",
      "RESEND_INBOUND_SECRET",
      "BLOB_READ_WRITE_TOKEN",
      "THANK_YOU_CARDS_ENABLED",
      "HANDWRYTTEN_API_KEY",
    ]) {
      assert.equal(environment[key], "", `${key} must be blanked`);
    }
  });

  it("blanks durable-write credentials even when no env file defines them", () => {
    const bare = localWebEnvironment([], endpoints);
    for (const key of DURABLE_WRITE_ENV_VARS) assert.equal(bare[key], "", key);
  });

  it("blanks a key it has never heard of", () => {
    const next = localWebEnvironment(["SOME_NEW_PROVIDER_SECRET"], endpoints);
    assert.equal(next.SOME_NEW_PROVIDER_SECRET, "");
  });

  it("leaves the model gateway, flags and test links to load from the files", () => {
    for (const key of [
      "VERCEL_OIDC_TOKEN",
      "OPENAI_API_KEY",
      "HOMA_WALL_ENABLED",
      "HOMA_DEV_TEST_SESSIONS",
      "REPORT_NARRATIVE_ENABLED",
      "NEXT_PUBLIC_STRIPE_TEST_PAYMENT_LINK_MONTHLY_URL",
    ]) {
      assert.equal(key in environment, false, `${key} should load from the file`);
    }
  });

  it("points Supabase, the database and the artifact store at this machine", () => {
    assert.equal(environment.NEXT_PUBLIC_SUPABASE_URL, endpoints.apiUrl);
    assert.equal(environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "local-anon");
    assert.deepEqual(resolveMapDbTarget(environment), {
      kind: "eval-sandbox",
      url: endpoints.dbUrl,
    });
    assert.deepEqual(resolveEvalBlobStore(environment), {
      dir: endpoints.blobDir,
      baseUrl: endpoints.blobUrl,
    });
  });

  it("refuses endpoints that are not on this machine", () => {
    assert.throws(
      () =>
        localWebEnvironment([], {
          ...endpoints,
          apiUrl: "https://kzabcdefghijklmnopqrs.supabase.co",
        }),
      /not on this machine/u,
    );
    assert.throws(
      () =>
        localWebEnvironment([], {
          ...endpoints,
          dbUrl: "postgres://postgres.kzabc:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
        }),
      /not on this machine/u,
    );
  });
});

describe("isSafeLocalWebKey", () => {
  it("never treats a durable-write credential as safe", () => {
    for (const key of DURABLE_WRITE_ENV_VARS) assert.equal(isSafeLocalWebKey(key), false, key);
  });
});

describe("localMobileEnvironment", () => {
  it("points the app at the local stack and the local web origin", () => {
    assert.deepEqual(localMobileEnvironment(endpoints, "http://localhost:3000"), {
      EXPO_PUBLIC_SUPABASE_URL: endpoints.apiUrl,
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-anon",
      EXPO_PUBLIC_API_URL: "http://localhost:3000",
      EXPO_PUBLIC_SENTRY_DSN: "",
    });
  });

  it("refuses the production origin", () => {
    assert.throws(
      () => localMobileEnvironment(endpoints, "https://thankshoma.com"),
      /not on this machine/u,
    );
  });
});

describe("dotenvKeys", () => {
  it("reads names, skipping comments and blanks", () => {
    assert.deepEqual(
      dotenvKeys("# note\nA=1\n\nexport B=\"two\"\n  C = 3\nnot a line\n"),
      ["A", "B", "C"],
    );
  });
});
