import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const pageSource = readFileSync(
  new URL("./page.tsx", import.meta.url),
  "utf8",
);

test("the choice-card bench is server-gated out of production", () => {
  assert.match(pageSource, /process\.env\.NODE_ENV === "production"/u);
  assert.match(pageSource, /notFound\(\)/u);
  assert.doesNotMatch(pageSource, /^"use client";/u);
  assert.doesNotMatch(pageSource, /Choice card bench/u);
  assert.doesNotMatch(pageSource, /export const metadata/u);
});
