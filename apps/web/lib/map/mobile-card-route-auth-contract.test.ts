import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "../../../..");

const routes = [
  "apps/web/app/api/map/answer/route.ts",
  "apps/web/app/api/map/children/route.ts",
  "apps/web/app/api/map/score/route.ts",
  "apps/web/app/api/map/state/route.ts",
  "apps/web/app/api/onboarding/basics/route.ts",
  "apps/web/app/api/onboarding/homeschool-profile/route.ts",
] as const;

describe("mobile onboarding card route authentication", () => {
  for (const routePath of routes) {
    it(`${routePath} resolves the family from the request`, () => {
      const source = readFileSync(path.join(repoRoot, routePath), "utf8");
      assert.match(source, /requireFamily(?:WithActor)?FromRequest\(request\)/u);
    });
  }
});
