import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("account deletion release route", () => {
  it("binds deletion to the authenticated server protocol", async () => {
    const source = await readFile(
      new URL("../app/api/account-deletion/route.ts", import.meta.url),
      "utf8",
    );

    assert.match(source, /createAccountDeletionPost/u);
    assert.match(source, /requireFamilyWithActorFromRequest/u);
    assert.match(source, /requestAccountDeletion/u);
    assert.match(source, /auth\.signOut\(\{ scope: "local" \}\)/u);
    assert.doesNotMatch(source, /status: 503/u);
  });
});
