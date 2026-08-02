import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EpisodeBinding } from "./continuity-service";
import {
  clientWebSessionBinding,
  webSessionThreadHash,
} from "./web-session-binding";

function binding(overrides: Partial<EpisodeBinding> = {}): EpisodeBinding {
  return {
    familyId: "family-1",
    memberUserId: "member-1",
    channel: "web",
    threadKeyHash: webSessionThreadHash("member-1"),
    runtimeSessionId: "session-1",
    episodeId: "episode-1",
    lastSeenAt: new Date("2026-08-01T16:00:00.000Z"),
    ...overrides,
  };
}

describe("web session binding", () => {
  it("uses the same authenticated-principal key as the Eve web channel", () => {
    assert.equal(webSessionThreadHash("member-1").length, 64);
    assert.notEqual(
      webSessionThreadHash("member-1"),
      webSessionThreadHash("member-2"),
    );
  });

  it("returns only a resumable web binding owned by the authenticated adult", () => {
    assert.deepEqual(clientWebSessionBinding(binding(), "member-1"), {
      runtimeSessionId: "session-1",
      lastSeenAtMs: Date.parse("2026-08-01T16:00:00.000Z"),
    });
    assert.equal(
      clientWebSessionBinding(
        binding({ memberUserId: "member-2" }),
        "member-1",
      ),
      null,
    );
    assert.equal(
      clientWebSessionBinding(binding({ runtimeSessionId: null }), "member-1"),
      null,
    );
    assert.equal(
      clientWebSessionBinding(binding({ channel: "sms" }), "member-1"),
      null,
    );
  });
});
