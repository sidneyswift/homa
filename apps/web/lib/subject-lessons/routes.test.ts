import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { planSubjectLessonMaterialFinalization } from "../materials/library";
import * as subjectLessonRoutes from "./routes";
import {
  createSubjectLessonBuildHandler,
  createSubjectLessonKeepHandler,
  createSubjectLessonRetryHandler,
  createSubjectLessonStatusHandler,
  startSubjectLessonSession,
  type SubjectLessonBuildRouteDependencies,
  type SubjectLessonKeepRouteDependencies,
  type SubjectLessonOwnerAuthorization,
  type SubjectLessonRetryRouteDependencies,
  type SubjectLessonStatusRouteDependencies,
} from "./routes";

const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER_USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const LESSON_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const MATERIAL_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const TOKEN = "permanent-report-token";
const SUBJECT_ID = "literacy";

const OWNER_AUTHORIZATION: SubjectLessonOwnerAuthorization = {
  status: "owner",
  familyId: FAMILY_ID,
  memberUserId: OWNER_USER_ID,
};

function buildRequest(
  body: unknown = {
    childId: CHILD_ID,
    subjectId: SUBJECT_ID,
  }
): Request {
  return new Request("https://attacker.example/api/map/subject-lesson/build", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mutationRequest(): Request {
  return new Request("https://attacker.example/api/map/subject-lesson/retry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lessonId: LESSON_ID }),
  });
}

function keepRequest(body: unknown = { lessonId: LESSON_ID }): Request {
  return new Request("https://attacker.example/api/map/subject-lesson/keep", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function statusRequest(): Request {
  const url = new URL("https://homa.example/api/map/subject-lesson/status");
  url.searchParams.set("token", TOKEN);
  url.searchParams.set("subject", SUBJECT_ID);
  return new Request(url);
}

async function responseJson(
  response: Response
): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

function lessonRecord(buildStatus: "queued" | "running" | "ready" | "failed") {
  return {
    lesson: {
      id: LESSON_ID,
      childId: CHILD_ID,
      subjectId: SUBJECT_ID,
      buildStatus,
    },
    token: TOKEN,
  };
}

function buildDependencies(
  overrides: Partial<SubjectLessonBuildRouteDependencies> = {}
): SubjectLessonBuildRouteDependencies {
  return {
    subjectLessonsEnabled: () => true,
    isRateLimited: () => false,
    authorizeOwner: async () => OWNER_AUTHORIZATION,
    familyWallCheckout: async () => null,
    findReusableSubjectLesson: async () => null,
    claimOrReuseSubjectLesson: async () => ({
      ...lessonRecord("queued"),
      created: true,
    }),
    emitRequested: async () => {},
    startSession: async () => ({
      ok: true,
      started: true,
      attempt: 1,
    }),
    modelUsageSurface: "subject_lesson",
    ...overrides,
  };
}

function retryDependencies(
  overrides: Partial<SubjectLessonRetryRouteDependencies> = {}
): SubjectLessonRetryRouteDependencies {
  return {
    subjectLessonsEnabled: () => true,
    isRateLimited: () => false,
    authorizeOwner: async () => OWNER_AUTHORIZATION,
    familyWallCheckout: async () => null,
    getSubjectLessonForFamily: async () => lessonRecord("failed"),
    startSession: async () => ({
      ok: true,
      started: true,
      attempt: 2,
    }),
    emitRetried: async () => {},
    modelUsageSurface: "subject_lesson",
    ...overrides,
  };
}

function keepDependencies(
  overrides: Partial<SubjectLessonKeepRouteDependencies> = {}
): SubjectLessonKeepRouteDependencies {
  return {
    subjectLessonsEnabled: () => true,
    isRateLimited: () => false,
    authorizeOwner: async () => OWNER_AUTHORIZATION,
    keepSubjectLessonMaterial: async () => ({
      status: "kept",
      childId: CHILD_ID,
      subjectId: SUBJECT_ID,
      transitioned: true,
      versionsSuperseded: 0,
    }),
    emitSubjectLessonKept: async () => {},
    emitMaterialFinalized: async () => {},
    ...overrides,
  };
}

function statusDependencies(
  overrides: Partial<SubjectLessonStatusRouteDependencies> = {}
): SubjectLessonStatusRouteDependencies {
  return {
    subjectLessonsEnabled: () => true,
    isRateLimited: () => false,
    getReadySubjectLessonByToken: async () => null,
    authorizeOwner: async () => OWNER_AUTHORIZATION,
    getSubjectLessonStateByTokenForFamily: async () => ({
      buildStatus: "running",
      content: {
        title: "Short vowels",
        materials: [],
        steps: ["Name sounds", "Build words", "Read words"],
        practice: "Read two words tomorrow.",
      },
    }),
    ...overrides,
  };
}

describe("subject lesson route flag and owner policy", () => {
  it("returns before every dependency when the exact flag is off", async () => {
    let effects = 0;
    const unavailable = async () => {
      effects += 1;
      return OWNER_AUTHORIZATION;
    };
    const handlers = [
      {
        handler: createSubjectLessonBuildHandler(
          buildDependencies({
            subjectLessonsEnabled: () => false,
            authorizeOwner: unavailable,
            findReusableSubjectLesson: async () => {
              effects += 1;
              return null;
            },
          })
        ),
        request: buildRequest(),
      },
      {
        handler: createSubjectLessonRetryHandler(
          retryDependencies({
            subjectLessonsEnabled: () => false,
            authorizeOwner: unavailable,
            getSubjectLessonForFamily: async () => {
              effects += 1;
              return null;
            },
          })
        ),
        request: mutationRequest(),
      },
      {
        handler: createSubjectLessonKeepHandler(
          keepDependencies({
            subjectLessonsEnabled: () => false,
            authorizeOwner: unavailable,
            keepSubjectLessonMaterial: async () => {
              effects += 1;
              return null;
            },
          })
        ),
        request: keepRequest(),
      },
      {
        handler: createSubjectLessonStatusHandler(
          statusDependencies({
            subjectLessonsEnabled: () => false,
            authorizeOwner: unavailable,
            getReadySubjectLessonByToken: async () => {
              effects += 1;
              return null;
            },
            getSubjectLessonStateByTokenForFamily: async () => {
              effects += 1;
              return null;
            },
          })
        ),
        request: statusRequest(),
      },
    ];

    for (const { handler, request } of handlers) {
      assert.equal((await handler(request)).status, 404);
    }
    assert.equal(effects, 0);
  });

  it("returns 401 without an actor, 403 for a member, and 502 on lookup failure", async () => {
    const cases: Array<{
      authorization: SubjectLessonOwnerAuthorization;
      status: number;
    }> = [
      { authorization: { status: "no_actor" }, status: 401 },
      { authorization: { status: "non_owner" }, status: 403 },
      { authorization: { status: "lookup_failed" }, status: 502 },
    ];
    for (const current of cases) {
      const handlers = [
        createSubjectLessonBuildHandler(
          buildDependencies({
            authorizeOwner: async () => current.authorization,
          })
        ),
        createSubjectLessonRetryHandler(
          retryDependencies({
            authorizeOwner: async () => current.authorization,
          })
        ),
        createSubjectLessonKeepHandler(
          keepDependencies({
            authorizeOwner: async () => current.authorization,
          })
        ),
      ];
      const requests = [buildRequest(), mutationRequest(), keepRequest()];
      for (let index = 0; index < handlers.length; index += 1) {
        assert.equal(
          (await handlers[index](requests[index])).status,
          current.status
        );
      }
    }
  });

  it("does not expose a Complete route policy in Step 1", () => {
    assert.equal(
      "createSubjectLessonCompleteHandler" in subjectLessonRoutes,
      false
    );
  });
});

describe("subject lesson Keep policy", () => {
  it("finalizes directly once, emits both events once, and replays as already kept", async () => {
    let transitioned = true;
    const subjectLessonEvents: unknown[] = [];
    const materialEvents: unknown[] = [];
    const handler = createSubjectLessonKeepHandler(
      keepDependencies({
        keepSubjectLessonMaterial: async () => {
          const currentTransition = transitioned;
          transitioned = false;
          return {
            status: "kept",
            childId: CHILD_ID,
            subjectId: SUBJECT_ID,
            transitioned: currentTransition,
            versionsSuperseded: currentTransition ? 2 : 0,
          };
        },
        emitSubjectLessonKept: async (event) => {
          subjectLessonEvents.push(event);
        },
        emitMaterialFinalized: async (event) => {
          materialEvents.push(event);
        },
      })
    );

    const first = await handler(keepRequest());
    const second = await handler(keepRequest());

    assert.deepEqual(await responseJson(first), {
      ok: true,
      kept: true,
      alreadyKept: false,
    });
    assert.deepEqual(await responseJson(second), {
      ok: true,
      kept: true,
      alreadyKept: true,
    });
    assert.deepEqual(subjectLessonEvents, [
      {
        family_id: FAMILY_ID,
        child_id: CHILD_ID,
        subject: SUBJECT_ID,
      },
    ]);
    assert.deepEqual(materialEvents, [
      {
        family_id: FAMILY_ID,
        channel: "web",
        versions_superseded: 2,
      },
    ]);
  });

  it("returns the same 404 for unknown and wrong-family lessons", async () => {
    let events = 0;
    const handler = createSubjectLessonKeepHandler(
      keepDependencies({
        keepSubjectLessonMaterial: async () => null,
        emitSubjectLessonKept: async () => {
          events += 1;
        },
        emitMaterialFinalized: async () => {
          events += 1;
        },
      })
    );

    const response = await handler(keepRequest());

    assert.equal(response.status, 404);
    assert.equal(events, 0);
  });

  it("returns not kept without events or chain writes for an attached approved superseded material", async () => {
    const chain = [
      {
        id: MATERIAL_ID,
        status: "superseded" as const,
        revises: null,
        pdf_url: "https://example.com/approved.pdf",
        preview_url: "https://example.com/approved.jpg",
        title: "Previously approved worksheet",
        approved_at: "2026-07-14T12:00:00.000Z",
      },
    ];
    const before = structuredClone(chain);
    let chainWrites = 0;
    let events = 0;
    const handler = createSubjectLessonKeepHandler(
      keepDependencies({
        keepSubjectLessonMaterial: async () => {
          const plan = planSubjectLessonMaterialFinalization(
            chain,
            MATERIAL_ID,
            "superseded",
            LESSON_ID,
          );
          if (!plan) return null;
          chainWrites += 1;
          return {
            status: "kept",
            childId: CHILD_ID,
            subjectId: SUBJECT_ID,
            transitioned: plan.result.transitioned,
            versionsSuperseded: plan.result.versionsSuperseded,
          };
        },
        emitSubjectLessonKept: async () => {
          events += 1;
        },
        emitMaterialFinalized: async () => {
          events += 1;
        },
      })
    );

    const response = await handler(keepRequest());
    const body = await responseJson(response);

    assert.equal(response.status, 404);
    assert.equal("kept" in body, false);
    assert.equal(chainWrites, 0);
    assert.equal(events, 0);
    assert.deepEqual(chain, before);
  });

  it("never returns kept or emits when finalization fails", async () => {
    let events = 0;
    const handler = createSubjectLessonKeepHandler(
      keepDependencies({
        keepSubjectLessonMaterial: async () => ({
          status: "finalize-failed",
        }),
        emitSubjectLessonKept: async () => {
          events += 1;
        },
        emitMaterialFinalized: async () => {
          events += 1;
        },
      })
    );

    const response = await handler(keepRequest());
    const body = await responseJson(response);

    assert.equal(response.status, 502);
    assert.deepEqual(body, {
      ok: false,
      reason: "finalize-failed",
    });
    assert.equal("kept" in body, false);
    assert.equal(events, 0);
  });

  it("rejects client-selected material ids and malformed lesson ids", async () => {
    const handler = createSubjectLessonKeepHandler(keepDependencies());
    for (const body of [
      { lessonId: "not-a-uuid" },
      { lessonId: LESSON_ID, materialId: "client-chosen" },
    ]) {
      assert.equal((await handler(keepRequest(body))).status, 400);
    }
  });
});

describe("subject lesson build policy", () => {
  it("creates once, emits requested, and uses only trusted start input", async () => {
    const calls: string[] = [];
    let startInput: unknown;
    const handler = createSubjectLessonBuildHandler(
      buildDependencies({
        findReusableSubjectLesson: async () => {
          calls.push("reuse");
          return null;
        },
        familyWallCheckout: async () => {
          calls.push("wall");
          return null;
        },
        claimOrReuseSubjectLesson: async () => {
          calls.push("claim");
          return { ...lessonRecord("queued"), created: true };
        },
        emitRequested: async () => {
          calls.push("requested");
        },
        startSession: async (input) => {
          calls.push("start");
          startInput = input;
          return { ok: true, started: true, attempt: 1 };
        },
      })
    );

    const response = await handler(buildRequest());

    assert.equal(response.status, 200);
    assert.deepEqual(await responseJson(response), {
      ok: true,
      url: `/onboarding/r/${TOKEN}/lesson/${SUBJECT_ID}`,
      buildStatus: "queued",
    });
    assert.deepEqual(calls, ["reuse", "wall", "claim", "requested", "start"]);
    assert.deepEqual(startInput, {
      familyId: FAMILY_ID,
      lessonId: LESSON_ID,
      retry: false,
      modelUsageSurface: "subject_lesson",
    });
  });

  it("asks the protected starter to recover a queued row before the wall", async () => {
    let starts = 0;
    let wallChecks = 0;
    const handler = createSubjectLessonBuildHandler(
      buildDependencies({
        findReusableSubjectLesson: async () => ({
          ...lessonRecord("queued"),
          created: false,
        }),
        familyWallCheckout: async () => {
          wallChecks += 1;
          return {
            regular: { monthlyUrl: "https://stripe.example/monthly", annualUrl: "https://stripe.example/annual" },
            plus: null,
            elite: null,
          };
        },
        startSession: async () => {
          starts += 1;
          return { ok: true, started: false, attempt: null };
        },
      })
    );

    const response = await handler(buildRequest());

    assert.equal(response.status, 200);
    assert.equal(starts, 1);
    assert.equal(wallChecks, 0);
  });

  it("returns running, ready, and failed rows without another start", async () => {
    for (const status of ["running", "ready", "failed"] as const) {
      let starts = 0;
      const handler = createSubjectLessonBuildHandler(
        buildDependencies({
          findReusableSubjectLesson: async () => ({
            ...lessonRecord(status),
            created: false,
          }),
          startSession: async () => {
            starts += 1;
            return { ok: true, started: true, attempt: 1 };
          },
        })
      );

      assert.equal((await handler(buildRequest())).status, 200);
      assert.equal(starts, 0);
    }
  });

  it("restores a matching historical row before returning walled", async () => {
    let wallChecks = 0;
    let claims = 0;
    const handler = createSubjectLessonBuildHandler(
      buildDependencies({
        findReusableSubjectLesson: async () => ({
          ...lessonRecord("ready"),
          created: false,
        }),
        familyWallCheckout: async () => {
          wallChecks += 1;
          return {
            regular: { monthlyUrl: "https://stripe.example/monthly", annualUrl: "https://stripe.example/annual" },
            plus: null,
            elite: null,
          };
        },
        claimOrReuseSubjectLesson: async () => {
          claims += 1;
          return null;
        },
      })
    );

    assert.equal((await handler(buildRequest())).status, 200);
    assert.equal(wallChecks, 0);
    assert.equal(claims, 0);
  });

  it("checks the wall before a create-capable claim", async () => {
    let claims = 0;
    const handler = createSubjectLessonBuildHandler(
      buildDependencies({
        familyWallCheckout: async () => ({
          regular: { monthlyUrl: "https://stripe.example/monthly", annualUrl: "https://stripe.example/annual" },
          plus: null,
          elite: null,
        }),
        claimOrReuseSubjectLesson: async () => {
          claims += 1;
          return null;
        },
      })
    );

    assert.equal((await handler(buildRequest())).status, 403);
    assert.equal(claims, 0);
  });

  it("rejects a browser-supplied model usage surface", async () => {
    const handler = createSubjectLessonBuildHandler(buildDependencies());
    const response = await handler(
      buildRequest({
        childId: CHILD_ID,
        subjectId: SUBJECT_ID,
        modelUsageSurface: "materials_image",
      })
    );
    assert.equal(response.status, 400);
  });
});

describe("subject lesson retry policy", () => {
  it("retries only a failed row and emits the claimed attempt", async () => {
    let startInput: unknown;
    let retried: unknown;
    const handler = createSubjectLessonRetryHandler(
      retryDependencies({
        startSession: async (input) => {
          startInput = input;
          return { ok: true, started: true, attempt: 3 };
        },
        emitRetried: async (event) => {
          retried = event;
        },
      })
    );

    assert.equal((await handler(mutationRequest())).status, 200);
    assert.deepEqual(startInput, {
      familyId: FAMILY_ID,
      lessonId: LESSON_ID,
      retry: true,
      modelUsageSurface: "subject_lesson",
    });
    assert.deepEqual(retried, {
      family_id: FAMILY_ID,
      child_id: CHILD_ID,
      subject: SUBJECT_ID,
      attempt: 3,
    });
  });

  it("rejects queued, running, and ready retries", async () => {
    for (const status of ["queued", "running", "ready"] as const) {
      let starts = 0;
      const handler = createSubjectLessonRetryHandler(
        retryDependencies({
          getSubjectLessonForFamily: async () => lessonRecord(status),
          startSession: async () => {
            starts += 1;
            return { ok: true, started: true, attempt: 2 };
          },
        })
      );
      assert.equal((await handler(mutationRequest())).status, 409);
      assert.equal(starts, 0);
    }
  });

  it("does not emit when a duplicate retry finds an already-claimed attempt", async () => {
    let events = 0;
    const handler = createSubjectLessonRetryHandler(
      retryDependencies({
        startSession: async () => ({
          ok: true,
          started: false,
          attempt: null,
        }),
        emitRetried: async () => {
          events += 1;
        },
      })
    );

    assert.equal((await handler(mutationRequest())).status, 200);
    assert.equal(events, 0);
  });

  it("returns the same 404 for unknown and foreign lesson ids", async () => {
    const retry = createSubjectLessonRetryHandler(
      retryDependencies({
        getSubjectLessonForFamily: async () => null,
      })
    );
    assert.equal((await retry(mutationRequest())).status, 404);
  });
});

describe("subject lesson status policy", () => {
  it("allows a token-only caller to observe ready state only", async () => {
    let ownerLookups = 0;
    const handler = createSubjectLessonStatusHandler(
      statusDependencies({
        getReadySubjectLessonByToken: async () => ({ id: LESSON_ID }),
        authorizeOwner: async () => {
          ownerLookups += 1;
          return { status: "no_actor" };
        },
      })
    );

    const response = await handler(statusRequest());
    assert.deepEqual(await responseJson(response), {
      ok: true,
      buildStatus: "ready",
      hasContent: true,
    });
    assert.equal(ownerLookups, 0);
  });

  it("returns bounded pending state only to the owner", async () => {
    const owner = createSubjectLessonStatusHandler(statusDependencies());
    const body = await responseJson(await owner(statusRequest()));
    assert.deepEqual(body, {
      ok: true,
      buildStatus: "running",
      hasContent: true,
    });
    assert.equal("errorCode" in body, false);
    assert.equal("attemptCount" in body, false);
    assert.equal("runtimeSessionId" in body, false);

    for (const authorization of [
      { status: "no_actor" },
      { status: "non_owner" },
    ] as const) {
      let reads = 0;
      const hidden = createSubjectLessonStatusHandler(
        statusDependencies({
          authorizeOwner: async () => authorization,
          getSubjectLessonStateByTokenForFamily: async () => {
            reads += 1;
            return null;
          },
        })
      );
      assert.equal((await hidden(statusRequest())).status, 404);
      assert.equal(reads, 0);
    }
  });
});

describe("trusted subject lesson session starter", () => {
  it("sends only the registered surface to the configured internal origin", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    const result = await startSubjectLessonSession(
      {
        familyId: FAMILY_ID,
        lessonId: LESSON_ID,
        retry: true,
        modelUsageSurface: "subject_lesson",
      },
      {
        internalOrigin: "https://internal.example",
        nodeEnv: "production",
        secret: "cron-secret",
        fetch: async (input, init) => {
          capturedUrl = String(input);
          capturedInit = init;
          return Response.json({
            ok: true,
            started: true,
            attempt: 4,
          });
        },
      }
    );

    assert.deepEqual(result, {
      ok: true,
      started: true,
      attempt: 4,
    });
    assert.equal(
      capturedUrl,
      "https://internal.example/eve/v1/subject-lesson/start"
    );
    assert.equal(
      new Headers(capturedInit?.headers).get("authorization"),
      "Bearer cron-secret"
    );
    assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
      familyId: FAMILY_ID,
      lessonId: LESSON_ID,
      retry: true,
      modelUsageSurface: "subject_lesson",
    });
  });
});
