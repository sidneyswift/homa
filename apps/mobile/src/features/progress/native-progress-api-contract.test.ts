import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import type { ChildProgressView } from "../../lib/child-progress";
import {
  classifyChildProgressReadFailure,
  shouldRetainStaleChildProgress,
  ChildProgressReadError,
} from "../../lib/child-progress-error";
import { createNativeProgressReadHandler } from "../../../../web/lib/child-progress/native-read-handler";

const routeSource = readFileSync(
  new URL("../../../../web/app/api/progress/[childId]/route.ts", import.meta.url),
  "utf8",
);
const clientSource = readFileSync(
  new URL("../../lib/child-progress.ts", import.meta.url),
  "utf8",
);
const otaWorkflowSource = readFileSync(
  new URL("../../../../../.github/workflows/mobile-ota-update.yml", import.meta.url),
  "utf8",
);
const CHILD_ID = "11111111-1111-4111-8111-111111111111";

function view(childId = CHILD_ID): ChildProgressView {
  return {
    childId,
    childName: "Maya",
    birthDate: "2020-01-02",
    timeZone: "America/New_York",
    projectedAt: "2026-08-02T12:00:00.000Z",
    scores: {
      subjects: [],
      strengthOrder: [],
      mappedCount: 0,
      totalSubjects: 0,
      observationCount: 0,
    },
    subjects: [],
    conflicts: [],
  };
}

function request(childId = CHILD_ID) {
  return {
    request: new Request(`https://thankshoma.com/api/progress/${childId}`),
    context: { params: Promise.resolve({ childId }) },
  };
}

describe("canonical native Progress read boundary", () => {
  it("wires the production endpoint to bearer auth only", () => {
    assert.match(routeSource, /requireFamilyFromBearer\(request\)/u);
    assert.doesNotMatch(routeSource, /requireFamilyWithActorFromRequest/u);
    assert.match(routeSource, /loadView: getChildProgressView/u);
  });

  it("executes family re-scoping and validates the canonical projection", async () => {
    const calls: [string, string][] = [];
    const handler = createNativeProgressReadHandler({
      enabled: () => true,
      rateLimited: () => false,
      authenticate: async () => ({ familyId: "family-from-token" }),
      loadView: async (familyId, childId) => {
        calls.push([familyId, childId]);
        return view(childId);
      },
      logError: () => undefined,
    });
    const input = request();
    const response = await handler(input.request, input.context);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(calls, [["family-from-token", CHILD_ID]]);
    assert.deepEqual(await response.json(), { ok: true, view: view() });
  });

  it("fails closed for no bearer identity, unknown children, and a disabled feature", async () => {
    let authenticateCalls = 0;
    const base = {
      rateLimited: () => false,
      logError: () => undefined,
    };
    const noSession = createNativeProgressReadHandler({
      ...base,
      enabled: () => true,
      authenticate: async () => {
        authenticateCalls += 1;
        return null;
      },
      loadView: async () => view(),
    });
    const noSessionInput = request();
    assert.equal(
      (await noSession(noSessionInput.request, noSessionInput.context)).status,
      401,
    );

    const unknown = createNativeProgressReadHandler({
      ...base,
      enabled: () => true,
      authenticate: async () => ({ familyId: "family-from-token" }),
      loadView: async () => null,
    });
    const unknownInput = request();
    assert.equal(
      (await unknown(unknownInput.request, unknownInput.context)).status,
      404,
    );

    const disabled = createNativeProgressReadHandler({
      ...base,
      enabled: () => false,
      authenticate: async () => {
        authenticateCalls += 1;
        return { familyId: "should-not-run" };
      },
      loadView: async () => view(),
    });
    const disabledInput = request();
    assert.equal(
      (await disabled(disabledInput.request, disabledInput.context)).status,
      404,
    );
    assert.equal(authenticateCalls, 1);
  });

  it("rejects invalid child ids and mismatched projections", async () => {
    let loadCalls = 0;
    const handler = createNativeProgressReadHandler({
      enabled: () => true,
      rateLimited: () => false,
      authenticate: async () => ({ familyId: "family-from-token" }),
      loadView: async () => {
        loadCalls += 1;
        return view("22222222-2222-4222-8222-222222222222");
      },
      logError: () => undefined,
    });
    const invalidInput = request("not-a-uuid");
    assert.equal(
      (await handler(invalidInput.request, invalidInput.context)).status,
      400,
    );
    assert.equal(loadCalls, 0);

    const mismatchInput = request();
    const mismatch = await handler(mismatchInput.request, mismatchInput.context);
    assert.equal(mismatch.status, 502);
    assert.deepEqual(await mismatch.json(), {
      ok: false,
      reason: "invalid-projection",
    });
  });

  it("retains stale data for outages but clears it for permanent failures", () => {
    assert.equal(classifyChildProgressReadFailure(429, "rate-limited"), "transient");
    assert.equal(classifyChildProgressReadFailure(502, "unavailable"), "transient");
    assert.equal(classifyChildProgressReadFailure(401, "no-session"), "authentication");
    assert.equal(classifyChildProgressReadFailure(404, "unknown-child"), "scope");
    assert.equal(classifyChildProgressReadFailure(502, "invalid-projection"), "invalid");
    assert.equal(
      shouldRetainStaleChildProgress(
        new ChildProgressReadError("transient", "offline", 502),
      ),
      true,
    );
    assert.equal(
      shouldRetainStaleChildProgress(
        new ChildProgressReadError("scope", "wrong child", 404),
      ),
      false,
    );
  });

  it("uses bearer auth and schema validation on mobile", () => {
    assert.match(clientSource, /Authorization: `Bearer \$\{token\}`/u);
    assert.match(clientSource, /parseChildProgressView\(candidate\.view\)/u);
    assert.match(clientSource, /view\.childId !== childId/u);
    assert.doesNotMatch(clientSource, /from\("child_progress_live"\)/u);
  });

  it("waits for the same commit's web deployment before publishing an OTA", () => {
    const waitIndex = otaWorkflowSource.indexOf(
      "Wait for the production web deployment",
    );
    const publishIndex = otaWorkflowSource.indexOf(
      "Publish EAS Update to the production channel",
    );
    assert.notEqual(waitIndex, -1);
    assert.ok(publishIndex > waitIndex);
    assert.match(otaWorkflowSource, /select\(\.name == "Vercel"\)/u);
    assert.match(otaWorkflowSource, /checks: read/u);
  });
});
