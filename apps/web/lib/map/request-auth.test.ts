import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveRequestFamilyAuth } from "./session";

describe("resolveRequestFamilyAuth", () => {
  it("uses bearer authentication when an authorization header is present", async () => {
    const calls: string[] = [];
    const result = await resolveRequestFamilyAuth(
      new Request("https://thankshoma.com/api/map/state", {
        headers: { authorization: "Bearer mobile-token" },
      }),
      {
        bearer: async () => {
          calls.push("bearer");
          return "mobile-family";
        },
        cookie: async () => {
          calls.push("cookie");
          return "browser-family";
        },
      },
    );

    assert.equal(result, "mobile-family");
    assert.deepEqual(calls, ["bearer"]);
  });

  it("does not fall through to cookies when bearer authentication fails", async () => {
    const calls: string[] = [];
    const result = await resolveRequestFamilyAuth(
      new Request("https://thankshoma.com/api/map/state", {
        headers: { authorization: "Bearer invalid-token" },
      }),
      {
        bearer: async () => {
          calls.push("bearer");
          return null;
        },
        cookie: async () => {
          calls.push("cookie");
          return "browser-family";
        },
      },
    );

    assert.equal(result, null);
    assert.deepEqual(calls, ["bearer"]);
  });

  it("uses browser authentication when no authorization header is present", async () => {
    const calls: string[] = [];
    const result = await resolveRequestFamilyAuth(
      new Request("https://thankshoma.com/api/map/state"),
      {
        bearer: async () => {
          calls.push("bearer");
          return "mobile-family";
        },
        cookie: async () => {
          calls.push("cookie");
          return "browser-family";
        },
      },
    );

    assert.equal(result, "browser-family");
    assert.deepEqual(calls, ["cookie"]);
  });
});
