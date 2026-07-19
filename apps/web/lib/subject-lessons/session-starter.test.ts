import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  resolveSubjectLessonInternalOrigin,
  startSubjectLessonSession,
} from "./session-starter";

const startInput = {
  familyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  lessonId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  retry: false,
  modelUsageSurface: "subject_lesson",
} as const;

describe("subject lesson internal origin", () => {
  it("accepts HTTPS in every environment", () => {
    assert.equal(
      resolveSubjectLessonInternalOrigin({
        value: "https://internal.example:8443/",
        nodeEnv: "production",
      }),
      "https://internal.example:8443",
    );
  });

  it("accepts HTTP localhost and 127.0.0.1 only outside production", () => {
    assert.equal(
      resolveSubjectLessonInternalOrigin({
        value: "http://localhost:3000",
        nodeEnv: "development",
      }),
      "http://localhost:3000",
    );
    assert.equal(
      resolveSubjectLessonInternalOrigin({
        value: "http://127.0.0.1:3000",
        nodeEnv: "test",
      }),
      "http://127.0.0.1:3000",
    );
  });

  it("rejects missing, malformed, credentialed, path, and unsafe HTTP values", () => {
    for (const [value, nodeEnv] of [
      [undefined, "production"],
      ["", "production"],
      ["not-a-url", "production"],
      ["ftp://internal.example", "production"],
      ["http://internal.example", "development"],
      ["http://localhost:3000", "production"],
      ["https://user:pass@internal.example", "production"],
      ["https://internal.example/eve", "production"],
      ["https://internal.example?next=elsewhere", "production"],
      ["https://internal.example#fragment", "production"],
    ] as const) {
      assert.equal(
        resolveSubjectLessonInternalOrigin({ value, nodeEnv }),
        null,
      );
    }
  });

  it("documents a safe local server-only placeholder", async () => {
    const envExample = await readFile(
      new URL("../../.env.example", import.meta.url),
      "utf8",
    );
    assert.match(
      envExample,
      /^HOMA_INTERNAL_ORIGIN=http:\/\/localhost:3000$/mu,
    );
    assert.doesNotMatch(envExample, /NEXT_PUBLIC_HOMA_INTERNAL_ORIGIN/u);
  });
});

describe("trusted subject lesson session starter", () => {
  it("returns before a secret-bearing fetch when origin is invalid", async () => {
    let fetches = 0;
    const result = await startSubjectLessonSession(startInput, {
      internalOrigin: "http://attacker.example",
      nodeEnv: "development",
      secret: "cron-secret",
      fetch: async () => {
        fetches += 1;
        return Response.json({ ok: true, started: true, attempt: 1 });
      },
    });

    assert.deepEqual(result, {
      ok: false,
      note: "Subject lesson session did not start.",
    });
    assert.equal(fetches, 0);
  });
});
