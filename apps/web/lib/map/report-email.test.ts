import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { HomaEmailSubmission } from "./email";
import { sendReportEmailOnce } from "./report-email";

/** An in-memory stand-in for the emailed_at claim with the same atomic
 * contract the SQL update gives: exactly one concurrent caller wins. */
function fakeClaimStore(): {
  claim: (familyId: string, childId: string) => Promise<boolean>;
  release: (familyId: string, childId: string) => Promise<void>;
  claimed: Set<string>;
} {
  const claimed = new Set<string>();
  return {
    claimed,
    async claim(familyId, childId) {
      const key = `${familyId}:${childId}`;
      if (claimed.has(key)) return false;
      claimed.add(key);
      return true;
    },
    async release(familyId, childId) {
      claimed.delete(`${familyId}:${childId}`);
    },
  };
}

function submissionOf(status: HomaEmailSubmission["status"]): HomaEmailSubmission {
  if (status === "submitted") {
    return {
      status,
      providerSubmissionId: "resend-once-1",
      retrieveProviderMessageId: async () => null,
    };
  }
  return { status };
}

describe("sendReportEmailOnce", () => {
  it("sends exactly one email for two concurrent scorings of one child", async () => {
    const store = fakeClaimStore();
    let submits = 0;
    const submit = async (): Promise<HomaEmailSubmission> => {
      submits += 1;
      return submissionOf("submitted");
    };

    await Promise.all([
      sendReportEmailOnce("family-1", "child-1", "parent@example.com", "Story", "token-1", {
        claim: store.claim,
        release: store.release,
        submit,
      }),
      sendReportEmailOnce("family-1", "child-1", "parent@example.com", "Story", "token-1", {
        claim: store.claim,
        release: store.release,
        submit,
      }),
    ]);

    assert.equal(submits, 1);
    assert.equal(store.claimed.has("family-1:child-1"), true);
  });

  it("does not send on a rescore whose claim is already taken", async () => {
    const store = fakeClaimStore();
    store.claimed.add("family-1:child-1");
    let submits = 0;

    await sendReportEmailOnce("family-1", "child-1", "parent@example.com", "Story", "token-1", {
      claim: store.claim,
      release: store.release,
      submit: async () => {
        submits += 1;
        return submissionOf("submitted");
      },
    });

    assert.equal(submits, 0);
  });

  it("releases the claim when Resend definitively rejects, so a later scoring retries", async () => {
    const store = fakeClaimStore();

    await sendReportEmailOnce("family-1", "child-1", "parent@example.com", "Story", "token-1", {
      claim: store.claim,
      release: store.release,
      submit: async () => submissionOf("rejected"),
    });

    assert.equal(store.claimed.has("family-1:child-1"), false);
  });

  it("releases the claim on an unknown outcome, preserving the old retry behavior", async () => {
    const store = fakeClaimStore();

    await sendReportEmailOnce("family-1", "child-1", "parent@example.com", "Story", "token-1", {
      claim: store.claim,
      release: store.release,
      submit: async () => submissionOf("unknown"),
    });

    assert.equal(store.claimed.has("family-1:child-1"), false);
  });

  it("releases the claim when the submit itself throws", async () => {
    const store = fakeClaimStore();

    await assert.rejects(
      sendReportEmailOnce("family-1", "child-1", "parent@example.com", "Story", "token-1", {
        claim: store.claim,
        release: store.release,
        submit: async () => {
          throw new Error("network down");
        },
      }),
      /network down/u,
    );

    assert.equal(store.claimed.has("family-1:child-1"), false);
  });

  it("keeps the claim after a submitted send, so nothing ever re-sends", async () => {
    const store = fakeClaimStore();
    let releases = 0;

    await sendReportEmailOnce("family-1", "child-1", "parent@example.com", "Story", "token-1", {
      claim: store.claim,
      release: async (familyId, childId) => {
        releases += 1;
        await store.release(familyId, childId);
      },
      submit: async () => submissionOf("submitted"),
    });

    assert.equal(releases, 0);
    assert.equal(store.claimed.has("family-1:child-1"), true);
  });
});
