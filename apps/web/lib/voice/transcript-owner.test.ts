import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  callOwnerConversationMetadata,
  readImmutableCallOwner,
} from "./transcript-owner";

const familyId = "11111111-1111-4111-8111-111111111111";
const memberUserId = "22222222-2222-4222-8222-222222222222";

describe("immutable Telnyx call ownership", () => {
  it("round-trips the server-derived owner pair", () => {
    const metadata = callOwnerConversationMetadata({ familyId, memberUserId });
    assert.deepEqual(readImmutableCallOwner(metadata), { familyId, memberUserId });
  });

  it("fails closed for an incomplete or malformed external metadata map", () => {
    assert.equal(readImmutableCallOwner({ homa_family_id: familyId }), null);
    assert.equal(
      readImmutableCallOwner({
        homa_family_id: familyId,
        homa_member_user_id: "not-a-user-id",
      }),
      null,
    );
  });
});
