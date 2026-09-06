import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { HttpRouteDefinition, RouteHandlerArgs } from "eve/channels";
import { eveChannel } from "eve/channels/eve";

import { onEveMessage } from "../../agent/channels/eve";
import { createCachedRouteAuth } from "../conversation-continuity/eve-session-channel";

const action = {requestId: "11111111-1111-4111-8111-111111111111", childId: "22222222-2222-4222-8222-222222222222", subjectId: "math"};

describe("selected Progress channel rejection before dispatch", () => {
  for (const continuation of [false, true]) {
    for (const denied of ["malformed", "foreign-child", "body-mismatch"]) {
      it(`${denied} cannot dispatch ${continuation ? "over an existing family session" : "a new session"}`, async () => {
        let authCalls = 0;
        let sends = 0;
        let sessionReads = 0;
        const cached = createCachedRouteAuth(async () => {
          authCalls += 1;
          return {
            authenticator: "app", principalId: "adult", principalType: "user",
            attributes: {familyId: "previous-family", memberUserId: "adult", channel: "web", supabaseAccessToken: "unusable-fixture-token",
              ...(denied === "body-mismatch" ? {selectedAssessment: JSON.stringify(action), selectedAssessmentMessage: "Ask me deeper math questions for Maya."} : {selectedAssessmentDenied: "true"}),
            },
          };
        });
        const channel = eveChannel({auth: cached.auth, onMessage: onEveMessage});
        const path = continuation ? "/eve/v1/session/:sessionId" : "/eve/v1/session";
        const route = channel.routes.find(row => row.transport !== "websocket" && row.method === "POST" && row.path === path) as HttpRouteDefinition;
        assert.ok(route);
        const request = new Request("http://localhost/eve/v1/session" + (continuation ? "/old-session" : ""), {method: "POST", headers: {"content-type": "application/json"},
          body: JSON.stringify({message: "Start a different child's check-in instead.", ...(continuation ? {continuationToken: "old-continuation"} : {})})});
        await cached.resolve(request);
        const response = await route.handler(request, {
          params: continuation ? {sessionId: "old-session"} : {},
          getSession: () => {sessionReads += 1; return {auth: {current: {attributes: {familyId: "previous-family"}}}};},
          send: async () => {sends += 1; throw new Error("Rejected navigation must never reach a model, tool or persisted turn");},
          receive: async () => {throw new Error("unused receive");}, waitUntil: () => {}, requestIp: null,
        } as unknown as RouteHandlerArgs);
        assert.equal(response.status, 500);
        assert.equal(sends, 0);
        assert.equal(sessionReads, continuation ? 1 : 0);
        assert.equal(authCalls, 1, "same Request shares authentication only");
        await cached.resolve(new Request("http://localhost/next-request"));
        assert.equal(authCalls, 2, "the next Request reauthenticates instead of using session attributes");
      });
    }
  }
});
