import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  callerTokenIsExpired,
  decodeTokenExpirySeconds,
  MissingFamilyContextError,
  resolveAgentAccess,
  type ResolveAgentAccessDependencies,
} from "./agent-db";

/**
 * The JWT-expired mid-session regression (the Llanes incident,
 * 2026-07-17 02:28 UTC): a web turn outlived its browser token, Postgres
 * refused every RLS read with "JWT expired", and find_materials failed
 * in front of a real family. These tests pin the boundary: a live token
 * keeps the caller path, an expired token degrades to family-pinned only
 * behind a live membership re-check, and everything else still refuses.
 */

const NOW_SECONDS = 1_800_000_000;

/** An unsigned JWT-shaped token whose payload carries the given exp. */
function tokenWithExpiry(expirySeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  );
  const payload = Buffer.from(
    JSON.stringify({ sub: "user-1", exp: expirySeconds }),
  ).toString("base64url");
  return `${header}.${payload}.fake-signature`;
}

function dependencies(overrides: {
  membershipResult?: boolean;
  onVerify?: (familyId: string, memberUserId: string) => void;
  onArtifactVerify?: (familyId: string) => void;
  artifactError?: Error;
}): ResolveAgentAccessDependencies {
  return {
    nowSeconds: () => NOW_SECONDS,
    verifyFamilyArtifactAccess: async (familyId) => {
      overrides.onArtifactVerify?.(familyId);
      if (overrides.artifactError) throw overrides.artifactError;
    },
    verifyFamilyMembership: async (familyId, memberUserId) => {
      overrides.onVerify?.(familyId, memberUserId);
      return overrides.membershipResult ?? true;
    },
  };
}

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_USER_ID = "22222222-2222-4222-8222-222222222222";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "test-publishable-key";

describe("decodeTokenExpirySeconds", () => {
  it("reads exp from a well-formed token payload", () => {
    assert.equal(
      decodeTokenExpirySeconds(tokenWithExpiry(NOW_SECONDS + 600)),
      NOW_SECONDS + 600,
    );
  });

  it("returns null for garbage", () => {
    assert.equal(decodeTokenExpirySeconds("not-a-jwt"), null);
    assert.equal(decodeTokenExpirySeconds("a.%%%%.c"), null);
  });
});

describe("callerTokenIsExpired", () => {
  it("is false with comfortable life left", () => {
    assert.equal(
      callerTokenIsExpired(tokenWithExpiry(NOW_SECONDS + 600), NOW_SECONDS),
      false,
    );
  });

  it("is true past expiry and inside the grace margin", () => {
    assert.equal(
      callerTokenIsExpired(tokenWithExpiry(NOW_SECONDS - 1), NOW_SECONDS),
      true,
    );
    assert.equal(
      callerTokenIsExpired(tokenWithExpiry(NOW_SECONDS + 5), NOW_SECONDS),
      true,
    );
  });

  it("treats an undecodable token as not expired (today's caller path)", () => {
    assert.equal(callerTokenIsExpired("opaque-token", NOW_SECONDS), false);
  });
});

describe("resolveAgentAccess", () => {
  it("keeps the caller path while the token is live", async () => {
    const access = await resolveAgentAccess(
      {
        channel: "web",
        familyId: FAMILY_ID,
        memberUserId: MEMBER_USER_ID,
        supabaseAccessToken: tokenWithExpiry(NOW_SECONDS + 600),
      },
      dependencies({
        onVerify: () => {
          throw new Error("membership must not be re-checked on the live path");
        },
      }),
    );
    assert.equal(access.mode, "caller");
    assert.equal(access.familyId, FAMILY_ID);
  });

  it("degrades an expired web token to family-pinned behind a membership re-check", async () => {
    const verified: string[] = [];
    const access = await resolveAgentAccess(
      {
        channel: "web",
        familyId: FAMILY_ID,
        memberUserId: MEMBER_USER_ID,
        supabaseAccessToken: tokenWithExpiry(NOW_SECONDS - 120),
      },
      dependencies({
        membershipResult: true,
        onVerify: (familyId, memberUserId) => {
          verified.push(`${familyId}:${memberUserId}`);
        },
      }),
    );
    assert.equal(access.mode, "pinned");
    assert.equal(access.familyId, FAMILY_ID);
    assert.deepEqual(verified, [`${FAMILY_ID}:${MEMBER_USER_ID}`]);
  });

  it("refuses an expired token when the member no longer belongs to the family", async () => {
    await assert.rejects(
      resolveAgentAccess(
        {
          channel: "web",
          familyId: FAMILY_ID,
          memberUserId: MEMBER_USER_ID,
          supabaseAccessToken: tokenWithExpiry(NOW_SECONDS - 120),
        },
        dependencies({ membershipResult: false }),
      ),
      MissingFamilyContextError,
    );
  });

  it("refuses an expired token with no authenticated member id to re-check", async () => {
    await assert.rejects(
      resolveAgentAccess(
        {
          channel: "web",
          familyId: FAMILY_ID,
          supabaseAccessToken: tokenWithExpiry(NOW_SECONDS - 120),
        },
        dependencies({ membershipResult: true }),
      ),
      MissingFamilyContextError,
    );
  });

  it("keeps the pinned channels exactly as they were", async () => {
    const access = await resolveAgentAccess(
      { channel: "sms", familyId: FAMILY_ID },
      dependencies({
        onVerify: () => {
          throw new Error("pinned channels never consult membership here");
        },
      }),
    );
    assert.equal(access.mode, "pinned");
    assert.equal(access.familyId, FAMILY_ID);
  });

  it("checks the deletion fence on caller, expired, and pinned access", async () => {
    const checked: string[] = [];
    const guarded = dependencies({
      onArtifactVerify: (familyId) => checked.push(familyId),
    });

    await resolveAgentAccess({
      channel: "web",
      familyId: FAMILY_ID,
      memberUserId: MEMBER_USER_ID,
      supabaseAccessToken: tokenWithExpiry(NOW_SECONDS + 600),
    }, guarded);
    await resolveAgentAccess({
      channel: "web",
      familyId: FAMILY_ID,
      memberUserId: MEMBER_USER_ID,
      supabaseAccessToken: tokenWithExpiry(NOW_SECONDS - 120),
    }, guarded);
    await resolveAgentAccess({ channel: "sms", familyId: FAMILY_ID }, guarded);

    assert.deepEqual(checked, [FAMILY_ID, FAMILY_ID, FAMILY_ID]);
  });

  it("propagates deletion-fence refusal before granting access", async () => {
    await assert.rejects(
      resolveAgentAccess(
        { channel: "sms", familyId: FAMILY_ID },
        dependencies({ artifactError: new Error("family deletion active") }),
      ),
      /family deletion active/u,
    );
  });

  it("still refuses a session with no usable identity", async () => {
    await assert.rejects(
      resolveAgentAccess({}, dependencies({})),
      MissingFamilyContextError,
    );
    await assert.rejects(
      resolveAgentAccess({ channel: "web", familyId: FAMILY_ID }, dependencies({})),
      MissingFamilyContextError,
    );
  });
});
