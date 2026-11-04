import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { DURABLE_WRITE_ENV_VARS } from "../apps/web/lib/eval-isolation";
import { resolveMapDbTarget } from "../apps/web/lib/map/db";
import { resolveEvalBlobStore } from "../apps/web/lib/materials/eval-blob-store";

import { isolationTargetMismatch } from "./isolation-target.mjs";
import {
  dotenvKeys,
  isSafeLocalWebKey,
  LOCAL_CRON_SECRET,
  LOCAL_STRIPE_SIGNING_KEY,
  localIsolationEnvironment,
  localJobsSweepRequest,
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

  it("replaces production's cron secret with a local one", () => {
    assert.equal(environment.CRON_SECRET, LOCAL_CRON_SECRET);
    assert.notEqual(LOCAL_CRON_SECRET, "");
  });

  it("turns on production's flags that are safe locally", () => {
    for (const key of [
      "HOMA_AGENT_JOBS_ENABLED",
      "HOMA_CHAT_ONBOARDING",
      "HOMA_LIVE_PROGRESS_ENABLED",
      "HOMA_SIGNUP_PAYWALL_ENABLED",
      "JOURNAL_PROMPT_ENABLED",
      "FLEET_RESEARCH_ENABLED",
    ]) {
      assert.equal(environment[key], "true", key);
    }
  });

  it("turns production's flags on even when an env file says otherwise", () => {
    const stale = localWebEnvironment(
      ["HOMA_LIVE_PROGRESS_ENABLED", "HOMA_WALL_ENABLED", "REPORT_NARRATIVE_ENABLED"],
      endpoints,
    );
    assert.equal(stale.HOMA_LIVE_PROGRESS_ENABLED, "true");
    assert.equal(stale.HOMA_WALL_ENABLED, "true");
    assert.equal(stale.REPORT_NARRATIVE_ENABLED, "true");
  });

  it("keeps flags that write outside this machine off, whatever the files or shell say", () => {
    for (const env of [environment, localWebEnvironment([], endpoints)]) {
      for (const key of ["TELNYX_SMS_ENABLED", "THANK_YOU_CARDS_ENABLED", "HOMA_FAMILY_DRIVES_ENABLED"]) {
        assert.equal(env[key], "", key);
      }
    }
    const fromFile = localWebEnvironment(["HOMA_FAMILY_DRIVES_ENABLED"], endpoints);
    assert.equal(fromFile.HOMA_FAMILY_DRIVES_ENABLED, "");
  });

  it("replaces production's Stripe test secret with a key Stripe rejects", () => {
    for (const env of [environment, localWebEnvironment([], endpoints)]) {
      assert.equal(env.STRIPE_TEST_SECRET_KEY, LOCAL_STRIPE_SIGNING_KEY);
    }
    assert.match(LOCAL_STRIPE_SIGNING_KEY, /not_a_real_key$/u);
  });

  it("blanks durable-write credentials even when no env file defines them", () => {
    const bare = localWebEnvironment([], endpoints);
    for (const key of DURABLE_WRITE_ENV_VARS) {
      if (key === "STRIPE_TEST_SECRET_KEY") continue;
      assert.equal(bare[key], "", key);
    }
  });

  it("blanks a key it has never heard of", () => {
    const next = localWebEnvironment(["SOME_NEW_PROVIDER_SECRET"], endpoints);
    assert.equal(next.SOME_NEW_PROVIDER_SECRET, "");
  });

  it("leaves the model gateway, local-only flags and test links to load from the files", () => {
    for (const key of [
      "VERCEL_OIDC_TOKEN",
      "OPENAI_API_KEY",
      "HOMA_DEV_TEST_SESSIONS",
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

describe("localJobsSweepRequest", () => {
  it("posts this machine's run-now route with the local secret", () => {
    const request = localJobsSweepRequest("http://localhost:3000/");
    assert.equal(request.url, "http://localhost:3000/eve/v1/agent-job/run-now");
    assert.deepEqual(request.init, {
      method: "POST",
      headers: { authorization: `Bearer ${LOCAL_CRON_SECRET}` },
    });
  });

  it("refuses an origin that is not on this machine", () => {
    assert.throws(() => localJobsSweepRequest("https://thankshoma.com"), /not on this machine/u);
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

describe("localIsolationEnvironment", () => {
  it("aims the guard's API and database at the local stack", () => {
    assert.deepEqual(localIsolationEnvironment(endpoints), {
      NEXT_PUBLIC_SUPABASE_URL: endpoints.apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-anon",
      HOMA_ISOLATION_DATABASE_URL: endpoints.dbUrl,
      SUPABASE_DB_PASSWORD: "",
    });
  });

  it("still wins after the guard loads a production .env.local", () => {
    const dir = mkdtempSync(join(tmpdir(), "homa-isolation-env-"));
    const file = join(dir, ".env.local");
    writeFileSync(
      file,
      [
        "NEXT_PUBLIC_SUPABASE_URL=https://prod-ref.supabase.co",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=prod-anon",
        "SUPABASE_DB_PASSWORD=prod-password",
      ].join("\n"),
    );
    try {
      // The guard's own first move, in a child so this process's env stays clean.
      const seen = JSON.parse(
        execFileSync(
          process.execPath,
          [
            "-e",
            `process.loadEnvFile(${JSON.stringify(file)});
             const e = process.env;
             console.log(JSON.stringify([e.NEXT_PUBLIC_SUPABASE_URL,
               e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, e.SUPABASE_DB_PASSWORD,
               e.HOMA_ISOLATION_DATABASE_URL]));`,
          ],
          { env: { PATH: process.env.PATH, ...localIsolationEnvironment(endpoints) }, encoding: "utf8" },
        ),
      ) as string[];
      assert.deepEqual(seen, [endpoints.apiUrl, "local-anon", "", endpoints.dbUrl]);
      assert.equal(isolationTargetMismatch(seen[0], seen[3]), null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses a hosted database", () => {
    assert.throws(
      () =>
        localIsolationEnvironment({
          ...endpoints,
          dbUrl: "postgresql://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
        }),
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
