import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NextRequest } from "next/server";

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
