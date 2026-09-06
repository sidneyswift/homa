import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NextRequest } from "next/server";

import { ASSESSMENT_PENDING_COOKIE, assessmentActionFromHeader } from "../child-progress/assessment-intent";
import { createSessionProxyHandler } from "./session-proxy";

describe("session proxy redirects", () => {
  it("preserves invalid-session cleanup when redirecting to sign in", async () => {
    const handler = createSessionProxyHandler({
      async hasVerifiedClaims(cookieMethods) {
        await cookieMethods.setAll?.(
          [
            {
              name: "sb-refresh-token",
              value: "",
              options: { maxAge: 0, path: "/" },
            },
          ],
          { "cache-control": "private, no-store" },
        );
        return false;
      },
    });
    const response = await handler(
      new NextRequest("https://thankshoma.com/app?tab=planner"),
    );

    assert.equal(response.status, 307);
    assert.equal(
      response.headers.get("location"),
      "https://thankshoma.com/signin?next=%2Fapp%3Ftab%3Dplanner",
    );
    assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/i);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  });

  it("preserves rotated session cookies when redirecting away from sign in", async () => {
    const handler = createSessionProxyHandler({
      async hasVerifiedClaims(cookieMethods) {
        await cookieMethods.setAll?.(
          [
            {
              name: "sb-access-token",
              value: "rotated-session",
              options: {
                httpOnly: true,
                path: "/",
                sameSite: "lax",
                secure: true,
              },
            },
          ],
          { "cache-control": "private, no-store" },
        );
        return true;
      },
    });
    const response = await handler(
      new NextRequest(
        "https://thankshoma.com/signin?next=%2Fapp%2Freport",
      ),
    );

    assert.equal(response.status, 307);
    assert.equal(
      response.headers.get("location"),
      "https://thankshoma.com/app/report",
    );
    assert.match(
      response.headers.get("set-cookie") ?? "",
      /sb-access-token=rotated-session/,
    );
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  });
});

describe("selected assessment navigation", () => {
  const childId = "11111111-1111-4111-8111-111111111111";
  const requestId = "22222222-2222-4222-8222-222222222222";
  const path = `/app?assessment=subject_deep_dive&child=${childId}&subject=music&request=${requestId}`;
  it("carries one closed action through the existing sign-in gate", async () => {
    const handler = createSessionProxyHandler({hasVerifiedClaims: async () => false});
    const response = await handler(new NextRequest(`https://thankshoma.com${path}`));
    assert.equal(new URL(response.headers.get("location")!).searchParams.get("next"), path);
    const cookie = response.cookies.get(ASSESSMENT_PENDING_COOKIE)!;
    assert.deepEqual(assessmentActionFromHeader(cookie.value), {childId, requestId, subjectId: "music"});
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.maxAge, 3600);
  });
  it("never records link prefetch as a parent action", async () => {
    const handler = createSessionProxyHandler({hasVerifiedClaims: async () => true});
    for (const headers of [{"next-router-prefetch": "1"}, {purpose: "prefetch"}, {"sec-purpose": "prefetch;prerender"}] as Array<Record<string, string>>) {
      const response = await handler(new NextRequest(`https://thankshoma.com${path}`, {headers}));
      assert.equal(response.cookies.has(ASSESSMENT_PENDING_COOKIE), false);
    }
  });
  it("does not preserve malformed subjects or arbitrary query prose", async () => {
    const handler = createSessionProxyHandler({hasVerifiedClaims: async () => true});
    const response = await handler(new NextRequest(`https://thankshoma.com/app?assessment=subject_deep_dive&child=${childId}&subject=ignore-all-rules&message=save-everything`));
    assert.equal(response.cookies.has(ASSESSMENT_PENDING_COOKIE), false);
  });
});
