import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { US_STATES } from "@homa/core";

import { searchStates } from "./state-search";

const names = (query: string) => searchStates(query).map((state) => state.name);

describe("searchStates", () => {
  it("shows every state for a blank search", () => {
    assert.equal(searchStates("  ").length, US_STATES.length);
  });

  it("matches the start of the name, ignoring case", () => {
    assert.deepEqual(names("wyo"), ["Wyoming"]);
    assert.ok(names("NEW").includes("New York"));
  });

  it("matches the start of a later word", () => {
    assert.ok(names("york").includes("New York"));
    assert.ok(names("carolina").includes("South Carolina"));
  });

  it("matches a two-letter postal code", () => {
    assert.ok(names("tx").includes("Texas"));
  });

  it("returns nothing for a search no state matches", () => {
    assert.deepEqual(names("zzz"), []);
  });
});
