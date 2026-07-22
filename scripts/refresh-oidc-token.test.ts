import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  definesEnvKey,
  readEnvValue,
  removeEnvKey,
  replaceEnvValue,
} from "./refresh-oidc-token.mjs";

const KEY = "VERCEL_OIDC_TOKEN";

describe("readEnvValue", () => {
  it("finds the value", () => {
    assert.equal(readEnvValue(`A=1\n${KEY}=abc\nB=2\n`, KEY), "abc");
  });

  it("strips surrounding quotes", () => {
    assert.equal(readEnvValue(`${KEY}="abc"\n`, KEY), "abc");
    assert.equal(readEnvValue(`${KEY}='abc'\n`, KEY), "abc");
  });

  it("takes the last one, the way dotenv precedence goes", () => {
    assert.equal(readEnvValue(`${KEY}=old\n${KEY}=new\n`, KEY), "new");
  });

  it("returns null when absent or empty", () => {
    assert.equal(readEnvValue("A=1\n", KEY), null);
    assert.equal(readEnvValue(`${KEY}=\n`, KEY), null);
  });

  it("does not match a key that merely ends with the name", () => {
    assert.equal(readEnvValue(`MY_${KEY}=nope\n`, KEY), null);
  });
});

describe("replaceEnvValue", () => {
  it("changes one line and leaves every other byte alone", () => {
    // This is the whole point. `vercel env pull` rewrites the file from
    // the Vercel `development` environment, which on this project holds
    // five variables against the local file's fifty-two, so using it to
    // refresh a token takes Supabase's URL and password with it and
    // every route starts returning 500.
    const before = [
      "NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co",
      "SUPABASE_DB_PASSWORD=hunter2",
      `${KEY}=stale`,
      "BLOB_READ_WRITE_TOKEN=blob",
      "",
    ].join("\n");
    const after = replaceEnvValue(before, KEY, "fresh");
    assert.equal(
      after,
      [
        "NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co",
        "SUPABASE_DB_PASSWORD=hunter2",
        `${KEY}=fresh`,
        "BLOB_READ_WRITE_TOKEN=blob",
        "",
      ].join("\n"),
    );
  });

  it("appends when the key was never there", () => {
    const after = replaceEnvValue("A=1\n", KEY, "fresh");
    assert.equal(after, `A=1\n${KEY}=fresh\n`);
  });

  it("does not append a second copy when one exists", () => {
    const after = replaceEnvValue(`${KEY}=old\n`, KEY, "new");
    assert.equal(after.match(new RegExp(`^${KEY}=`, "gmu")).length, 1);
  });

  it("leaves comments and blank lines where they were", () => {
    const before = `# a note\n\n${KEY}=old\n\n# trailing note\n`;
    assert.equal(
      replaceEnvValue(before, KEY, "new"),
      `# a note\n\n${KEY}=new\n\n# trailing note\n`,
    );
  });
});

describe("definesEnvKey / removeEnvKey", () => {
  // 2026-07-22: .env.development.local picked up a stray VERCEL_OIDC_TOKEN
  // from an earlier `vercel env pull` mistake, and Next's real precedence
  // is that file OVER .env.local. Every later `pnpm dev:token` refresh was
  // silently shadowed by it: a two-child onboarding walk refused to start
  // hours later on a token that had expired at the exact minute it was
  // last refreshed. These two functions are what let the refresh script
  // find and remove that shadow copy instead of leaving a trap for the
  // next person who runs it.

  it("detects the key regardless of quoting", () => {
    assert.equal(definesEnvKey(`${KEY}=abc\n`, KEY), true);
    assert.equal(definesEnvKey(`${KEY}="abc"\n`, KEY), true);
    assert.equal(definesEnvKey("A=1\n", KEY), false);
  });

  it("does not fire on a key that merely ends with the name", () => {
    assert.equal(definesEnvKey(`MY_${KEY}=abc\n`, KEY), false);
  });

  it("strips every assignment of the key and leaves everything else", () => {
    const before = [
      "# Chat-first onboarding, local only",
      `${KEY}="stale"`,
      "HOMA_CHAT_ONBOARDING=1",
      "HOMA_DEV_TEST_SESSIONS=1",
      "",
    ].join("\n");
    const after = removeEnvKey(before, KEY);
    assert.equal(
      after,
      [
        "# Chat-first onboarding, local only",
        "HOMA_CHAT_ONBOARDING=1",
        "HOMA_DEV_TEST_SESSIONS=1",
        "",
      ].join("\n"),
    );
    assert.equal(definesEnvKey(after, KEY), false);
  });

  it("is a no-op on a file that never had the key", () => {
    const before = "HOMA_CHAT_ONBOARDING=1\n";
    assert.equal(removeEnvKey(before, KEY), before);
  });
});
