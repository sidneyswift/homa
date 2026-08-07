import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { EpisodeBinding } from "./continuity-service";
import {
  clientWebSessionBinding,
  webSessionThreadHash,
} from "./web-session-binding";

const repositorySource = readFileSync(
  new URL("./postgres-repository.ts", import.meta.url),
  "utf8",
);
const bindingSource = readFileSync(
  new URL("./web-session-binding.ts", import.meta.url),
  "utf8",
);
const ledgerSource = readFileSync(
  new URL("./ledger.ts", import.meta.url),
  "utf8",
);
const continuityServiceSource = readFileSync(
  new URL("./continuity-service.ts", import.meta.url),
  "utf8",
);

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
    assert.deepEqual(clientWebSessionBinding(
      binding(),
      "member-1",
      61,
      Date.parse("2026-08-01T16:00:00.100Z"),
    ), {
      runtimeSessionId: "session-1",
      lastSeenAtMs: Date.parse("2026-08-01T16:00:00.000Z"),
      latestSequence: 61,
      latestUserMessageAtMs: Date.parse("2026-08-01T16:00:00.100Z"),
    });
    assert.equal(
      clientWebSessionBinding(
        binding({ memberUserId: "member-2" }),
        "member-1",
        61,
        Date.parse("2026-08-01T16:00:00.100Z"),
      ),
      null,
    );
    assert.deepEqual(
      clientWebSessionBinding(
        binding({ memberUserId: null }),
        "member-1",
        61,
        Date.parse("2026-08-01T16:00:00.100Z"),
      ),
      {
        runtimeSessionId: "session-1",
        lastSeenAtMs: Date.parse("2026-08-01T16:00:00.000Z"),
        latestSequence: 61,
        latestUserMessageAtMs: Date.parse("2026-08-01T16:00:00.100Z"),
      },
    );
    assert.equal(
      clientWebSessionBinding(
        binding({ runtimeSessionId: null }),
        "member-1",
        61,
        Date.parse("2026-08-01T16:00:00.100Z"),
      ),
      null,
    );
    assert.equal(
      clientWebSessionBinding(
        binding({ channel: "sms" }),
        "member-1",
        61,
        Date.parse("2026-08-01T16:00:00.100Z"),
      ),
      null,
    );
  });

  it("normalizes only a legacy null-owner assistant timestamp to its latest durable user witness", () => {
    const assistantCompletedAt = new Date("2026-08-02T21:55:41.949Z");
    const latestUserAt = Date.parse("2026-08-02T21:55:36.228Z");
    assert.deepEqual(
      clientWebSessionBinding(
        binding({
          memberUserId: null,
          lastSeenAt: assistantCompletedAt,
          runtimeSessionId: "carolyn-session",
        }),
        "member-1",
        61,
        latestUserAt,
      ),
      {
        runtimeSessionId: "carolyn-session",
        lastSeenAtMs: latestUserAt,
        latestSequence: 61,
        latestUserMessageAtMs: latestUserAt,
      },
    );
    assert.deepEqual(
      clientWebSessionBinding(
        binding({
          memberUserId: "member-1",
          lastSeenAt: assistantCompletedAt,
          runtimeSessionId: "strict-session",
        }),
        "member-1",
        61,
        latestUserAt,
      ),
      {
        runtimeSessionId: "strict-session",
        lastSeenAtMs: assistantCompletedAt.getTime(),
        latestSequence: 61,
        latestUserMessageAtMs: latestUserAt,
      },
    );
  });

  it("preserves one coherent binding tuple across assistant writes only within one family", () => {
    assert.match(
      repositorySource,
      /when \$\{preserveExistingBinding\}\s+and public\.conversation_thread_bindings\.family_id = excluded\.family_id\s+then public\.conversation_thread_bindings\.member_user_id\s+else excluded\.member_user_id/u,
    );
    assert.match(
      repositorySource,
      /when \$\{preserveExistingBinding\}\s+and public\.conversation_thread_bindings\.family_id = excluded\.family_id\s+then public\.conversation_thread_bindings\.last_seen_at\s+else excluded\.last_seen_at/u,
    );
    assert.match(
      repositorySource,
      /when \$\{preserveExistingBinding\}\s+and public\.conversation_thread_bindings\.family_id = excluded\.family_id\s+then public\.conversation_thread_bindings\.runtime_session_id\s+else excluded\.runtime_session_id/u,
    );
    assert.match(
      repositorySource,
      /when \$\{preserveExistingBinding\}\s+and public\.conversation_thread_bindings\.family_id = excluded\.family_id\s+then public\.conversation_thread_bindings\.episode_id\s+else excluded\.episode_id/u,
    );
    assert.match(
      repositorySource,
      /when \$\{preserveExistingBinding\}\s+and public\.conversation_thread_bindings\.family_id = excluded\.family_id\s+then public\.conversation_thread_bindings\.pending_offer_delivery_id\s+else excluded\.pending_offer_delivery_id/u,
    );
    assert.doesNotMatch(
      repositorySource,
      /pending_offer_delivery_id = coalesce/u,
    );
    assert.match(repositorySource, /when \$\{useDatabaseClock\} then clock_timestamp\(\)/u);
    assert.match(
      ledgerSource,
      /input\.role === "assistant" \|\| typeof attrs\.episodeId === "string",\s+true,\s+\);/u,
    );
    assert.match(
      continuityServiceSource,
      /repository\.upsertBinding\([\s\S]*?\{ useDatabaseClock: true \},\s+\);/u,
    );
  });

  it("reads the binding and its latest user row from one database snapshot", () => {
    assert.match(bindingSource, /left join lateral \(/u);
    assert.doesNotMatch(bindingSource, /PostgresContinuityRepository/u);
    assert.equal(bindingSource.match(/const sql = mapDb\(\);/gu)?.length, 1);
  });
});
