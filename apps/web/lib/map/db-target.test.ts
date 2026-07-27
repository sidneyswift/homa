import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EVAL_DATABASE_URL_VAR,
  EVAL_ISOLATION_FLAG,
} from "../eval-isolation";
import { resolveMapDbTarget } from "./db";

const SANDBOX_URL = "postgres://homa_eval@127.0.0.1:5599/homa_eval";

describe("resolveMapDbTarget", () => {
  it("resolves the production pooler from the project ref, as before", () => {
    const target = resolveMapDbTarget({
      NEXT_PUBLIC_SUPABASE_URL: "https://kzabcdefghijklmnopqrs.supabase.co",
      SUPABASE_DB_PASSWORD: "secret",
    });

    assert.deepEqual(target, {
      kind: "supabase-pooler",
      ref: "kzabcdefghijklmnopqrs",
      password: "secret",
    });
  });

  it("redirects to the sandbox URL off Vercel, even with prod credentials present", () => {
    const target = resolveMapDbTarget({
      NEXT_PUBLIC_SUPABASE_URL: "https://kzabcdefghijklmnopqrs.supabase.co",
      SUPABASE_DB_PASSWORD: "secret",
      [EVAL_DATABASE_URL_VAR]: SANDBOX_URL,
    });

    assert.deepEqual(target, { kind: "eval-sandbox", url: SANDBOX_URL });
  });

  it("ignores the sandbox URL on Vercel", () => {
    const target = resolveMapDbTarget({
      NEXT_PUBLIC_SUPABASE_URL: "https://kzabcdefghijklmnopqrs.supabase.co",
      SUPABASE_DB_PASSWORD: "secret",
      [EVAL_DATABASE_URL_VAR]: SANDBOX_URL,
      VERCEL: "1",
    });

    assert.equal(target.kind, "supabase-pooler");
  });

  it("refuses the pooler while eval isolation is active and no sandbox is set", () => {
    assert.throws(
      () =>
        resolveMapDbTarget({
          NEXT_PUBLIC_SUPABASE_URL: "https://kzabcdefghijklmnopqrs.supabase.co",
          SUPABASE_DB_PASSWORD: "leaked-anyway",
          [EVAL_ISOLATION_FLAG]: "1",
        }),
      /eval isolation is active/,
    );
  });

  it("still demands credentials when nothing eval-related is set", () => {
    assert.throws(() => resolveMapDbTarget({}), /must be set/);
  });
});
