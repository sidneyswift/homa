import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  authorizeFamilyAccountOwner,
  classifyFamilyAccountOwner,
  isFamilyAccountOwner,
} from "./owner";

const FAMILY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OWNER_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INVITED_USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("family account owner policy", () => {
  it("classifies owner, invited member, resume-only caller, and lookup failure", () => {
    assert.equal(
      classifyFamilyAccountOwner({
        memberUserId: OWNER_USER_ID,
        ownerUserId: OWNER_USER_ID,
        lookupFailed: false,
      }),
      "owner",
    );
    assert.equal(
      classifyFamilyAccountOwner({
        memberUserId: INVITED_USER_ID,
        ownerUserId: OWNER_USER_ID,
        lookupFailed: false,
      }),
      "non_owner",
    );
    assert.equal(
      classifyFamilyAccountOwner({
        memberUserId: null,
        ownerUserId: OWNER_USER_ID,
        lookupFailed: false,
      }),
      "no_actor",
    );
    assert.equal(
      classifyFamilyAccountOwner({
        memberUserId: null,
        ownerUserId: null,
        lookupFailed: true,
      }),
      "lookup_failed",
    );
  });

  it("scopes the first-member lookup to the authenticated family", async () => {
    let lookedUpFamilyId: string | null = null;
    const owner = await isFamilyAccountOwner(
      FAMILY_ID,
      OWNER_USER_ID,
      async (familyId) => {
        lookedUpFamilyId = familyId;
        return OWNER_USER_ID;
      },
    );
    const invited = await isFamilyAccountOwner(
      FAMILY_ID,
      INVITED_USER_ID,
      async () => OWNER_USER_ID,
    );

    assert.equal(lookedUpFamilyId, FAMILY_ID);
    assert.equal(owner, true);
    assert.equal(invited, false);
  });

  it("maps actor and owner lookup failures without treating them as anonymous", async () => {
    assert.deepEqual(
      await authorizeFamilyAccountOwner({
        requireFamilyWithActor: async () => {
          throw new Error("auth unavailable");
        },
        isFamilyAccountOwner: async () => true,
      }),
      { status: "lookup_failed" },
    );
    assert.deepEqual(
      await authorizeFamilyAccountOwner({
        requireFamilyWithActor: async () => ({
          family: { id: FAMILY_ID },
          memberUserId: OWNER_USER_ID,
        }),
        isFamilyAccountOwner: async () => {
          throw new Error("owner lookup unavailable");
        },
      }),
      { status: "lookup_failed" },
    );
  });
});
