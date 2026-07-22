import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readEnvValue, replaceEnvValue } from "./refresh-oidc-token.mjs";

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
