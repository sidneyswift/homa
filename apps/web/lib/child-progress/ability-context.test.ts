import assert from "node:assert/strict";
import test from "node:test";
import { NextResponse } from "next/server";

import {
  ABILITY_CONTEXT_COOKIE,
  encodeAbilityContext,
  readAbilityContextCookie,
} from "./ability-context";

const value = {
  childId: "11111111-1111-4111-8111-111111111111",
  abilityId: "math.fractions.equivalent",
};

test("ability context cookie round-trips through a request header", () => {
  const encoded = encodeAbilityContext(value);
  assert.deepEqual(
    readAbilityContextCookie(`${ABILITY_CONTEXT_COOKIE}=${encoded}`),
    value,
  );
});

test("ability context cookie drops malformed or oversized values", () => {
  assert.equal(readAbilityContextCookie(null), null);
  assert.equal(readAbilityContextCookie(`${ABILITY_CONTEXT_COOKIE}=%`), null);
  assert.equal(
    readAbilityContextCookie(
      `${ABILITY_CONTEXT_COOKIE}=${"x".repeat(600)}`,
    ),
    null,
  );
});

test("ability context survives the real Next response cookie serializer", () => {
  const response = NextResponse.next();
  response.cookies.set(ABILITY_CONTEXT_COOKIE, encodeAbilityContext(value), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 300,
  });
  const requestCookie = response.headers.get("set-cookie")?.split(";")[0] ?? null;
  assert.deepEqual(readAbilityContextCookie(requestCookie), value);
});
