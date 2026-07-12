import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { classifyFamilyActorAuthLookup } from "./family-actor-auth";

describe("family actor auth lookup", () => {
  it("distinguishes authenticated, confirmed anonymous, and failure", () => {
    assert.deepEqual(
      classifyFamilyActorAuthLookup({
        userId: "user-1",
        error: null,
      }),
      { status: "authenticated", userId: "user-1" },
    );
    assert.deepEqual(
      classifyFamilyActorAuthLookup({
        userId: null,
        error: null,
      }),
      { status: "anonymous" },
    );
    assert.deepEqual(
      classifyFamilyActorAuthLookup({
        userId: null,
        error: {
          name: "AuthSessionMissingError",
          message: "Auth session missing!",
        },
      }),
      { status: "anonymous" },
    );
    assert.deepEqual(
      classifyFamilyActorAuthLookup({
        userId: null,
        error: {
          name: "AuthApiError",
          message: "Auth service unavailable",
        },
      }),
      {
        status: "failure",
        message: "Auth service unavailable",
      },
    );
  });

  it("maps route auth lookup failures to explicit 502 responses", async () => {
    for (const routePath of [
      "../../app/api/map/answer/route.ts",
      "../../app/api/map/report/correct/route.ts",
      "../../app/api/map/walk/route.ts",
    ]) {
      const source = await readFile(
        new URL(routePath, import.meta.url),
        "utf8",
      );
      assert.match(source, /auth-lookup-failed/u);
      assert.match(source, /\{ status: 502 \}/u);
    }
  });

  it("passes the authenticated web channel into evidence writers", async () => {
    for (const routePath of [
      "../../app/api/map/answer/route.ts",
      "../../app/api/map/walk/route.ts",
    ]) {
      const source = await readFile(
        new URL(routePath, import.meta.url),
        "utf8",
      );
      assert.match(source, /channel: "web"/u);
    }
  });
});
