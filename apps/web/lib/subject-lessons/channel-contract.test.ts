import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import subjectLessonChannel, {
  subjectLessonRouteAuthorizationFailure,
  subjectLessonStartHttpResponse,
  subjectLessonStartRequestSchema,
} from "../../agent/channels/subject-lesson";

const LESSON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FAMILY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const channelSourcePromise = readFile(
  new URL("../../agent/channels/subject-lesson.ts", import.meta.url),
  "utf8",
);
const webDeliverySourcePromise = readFile(
  new URL("../../agent/hooks/continuity-web-delivery.ts", import.meta.url),
  "utf8",
);

describe("subject lesson channel routes", () => {
  it("declares only the protected health and start routes", () => {
    assert.deepEqual(
      subjectLessonChannel.routes.map((route) => ({
        method: route.method,
        path: route.path,
      })),
      [
        { method: "GET", path: "/eve/v1/subject-lesson/health" },
        { method: "POST", path: "/eve/v1/subject-lesson/start" },
      ],
    );
  });

  it("fails closed when CRON_SECRET is absent or does not match", () => {
    const request = new Request(
      "https://homa.example/eve/v1/subject-lesson/health",
    );
    const missing = subjectLessonRouteAuthorizationFailure(request, undefined);
    assert.ok(missing);
    assert.equal(missing.status, 503);

    const unauthorized = subjectLessonRouteAuthorizationFailure(
      request,
      "secret",
    );
    assert.ok(unauthorized);
    assert.equal(unauthorized.status, 401);

    const authorized = new Request(
      "https://homa.example/eve/v1/subject-lesson/health",
      { headers: { authorization: "Bearer secret" } },
    );
    assert.equal(
      subjectLessonRouteAuthorizationFailure(authorized, "secret"),
      null,
    );
  });

  it("accepts only UUID identity, retry, and the registered usage surface", () => {
    assert.deepEqual(
      subjectLessonStartRequestSchema.parse({
        familyId: FAMILY_ID,
        lessonId: LESSON_ID,
        retry: true,
        modelUsageSurface: "subject_lesson",
      }),
      {
        familyId: FAMILY_ID,
        lessonId: LESSON_ID,
        retry: true,
        modelUsageSurface: "subject_lesson",
      },
    );
    for (const invalid of [
      { familyId: "not-a-uuid", lessonId: LESSON_ID },
      { familyId: FAMILY_ID, lessonId: "not-a-uuid" },
      { familyId: FAMILY_ID, lessonId: LESSON_ID, retry: "true" },
      { familyId: FAMILY_ID, lessonId: LESSON_ID, childId: LESSON_ID },
      { familyId: FAMILY_ID, lessonId: LESSON_ID, retry: false },
      {
        familyId: FAMILY_ID,
        lessonId: LESSON_ID,
        retry: false,
        modelUsageSurface: "materials_image",
      },
    ]) {
      assert.equal(
        subjectLessonStartRequestSchema.safeParse(invalid).success,
        false,
      );
    }
  });

  it("returns the claimed attempt when session startup fails", async () => {
    const response = subjectLessonStartHttpResponse({
      status: "failed",
      attempt: 3,
      errorCode: "session_start_failed",
    });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      ok: false,
      started: false,
      attempt: 3,
      errorCode: "session_start_failed",
    });
  });
});

describe("subject lesson terminal channel contract", () => {
  it("handles every terminal finish and failed turn or session", async () => {
    const source = await channelSourcePromise;
    const eventsStart = source.indexOf("events:");
    const routesStart = source.indexOf("routes:", eventsStart);
    assert.ok(eventsStart >= 0);
    assert.ok(routesStart > eventsStart);
    const eventSource = source.slice(eventsStart, routesStart);

    assert.match(eventSource, /finishReason === "tool-calls"/u);
    assert.match(eventSource, /finishSubjectLessonAttempt/u);
    assert.match(eventSource, /"turn\.failed"/u);
    assert.match(eventSource, /"session\.failed"/u);
    assert.equal(
      (eventSource.match(/finalizeSubjectLessonFailure/gu) ?? []).length >= 3,
      true,
    );
    assert.doesNotMatch(eventSource, /\.message\b/u);
    assert.doesNotMatch(eventSource, /persist/u);
    assert.doesNotMatch(eventSource, /deliver/u);
  });

  it("stands down before the global web delivery ledger", async () => {
    const source = await webDeliverySourcePromise;
    const channelGuard = source.indexOf("if (attributes.channel ||");
    const persistence = source.indexOf("persistCanonicalMessage({");
    assert.ok(channelGuard >= 0);
    assert.ok(persistence > channelGuard);
  });
});
