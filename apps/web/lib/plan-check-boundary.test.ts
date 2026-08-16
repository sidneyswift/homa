import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { mapPlanProgressSchema } from "@homa/core";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED_SOURCE_DIRECTORIES = new Set([".eve", ".next", "node_modules"]);

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return GENERATED_SOURCE_DIRECTORIES.has(entry.name) ? [] : sourceFiles(path);
    }
    return /\.(?:ts|tsx)$/u.test(entry.name) ? [path] : [];
  });
}

function filesContaining(pattern: RegExp): string[] {
  return sourceFiles(WEB_ROOT)
    .filter((path) => !path.endsWith("plan-check-boundary.test.ts"))
    .filter((path) => pattern.test(readFileSync(path, "utf8")))
    .map((path) => relative(WEB_ROOT, path))
    .sort();
}

describe("Planner check-off client boundary", () => {
  it("requires an opaque report token instead of a caller-selected child id", () => {
    const valid = {
      reportToken: "report-token-with-entropy",
      subjectId: "math",
      checks: { "1.0": true },
    };
    assert.equal(mapPlanProgressSchema.safeParse(valid).success, true);
    assert.equal(
      mapPlanProgressSchema.safeParse({
        childId: "00000000-0000-4000-8000-000000000001",
        subjectId: "math",
        checks: { "1.0": true },
      }).success,
      false,
    );
  });

  it("keeps the full-map legacy hook exclusive to the token plan page", () => {
    assert.deepEqual(
      filesContaining(/from\s+["'][^"']*use-legacy-token-plan-checks["']/u),
      ["app/onboarding/r/[token]/plan/[subjectId]/plan-weeks.tsx"],
    );
    assert.deepEqual(filesContaining(/["']\/api\/map\/plan\/progress["']/u), [
      "lib/use-legacy-token-plan-checks.ts",
    ]);
  });

  it("keeps authenticated app surfaces off localStorage and the legacy endpoint", () => {
    const authenticated = readFileSync(
      join(WEB_ROOT, "lib/use-authenticated-plan-checks.ts"),
      "utf8",
    );
    assert.doesNotMatch(authenticated, /localStorage/u);

    for (const path of sourceFiles(join(WEB_ROOT, "app/app"))) {
      const source = readFileSync(path, "utf8");
      assert.doesNotMatch(source, /use-legacy-token-plan-checks/u, relative(WEB_ROOT, path));
      assert.doesNotMatch(source, /\/api\/map\/plan\/progress/u, relative(WEB_ROOT, path));
    }
  });

  it("does not resurrect the deleted generic whole-map hook", () => {
    assert.equal(
      sourceFiles(join(WEB_ROOT, "lib")).some((path) =>
        path.endsWith("/use-plan-checks.ts"),
      ),
      false,
    );
  });

  it("makes the legacy route select bearer or cookie auth before family lookup", () => {
    const route = readFileSync(
      join(WEB_ROOT, "app/api/map/plan/progress/route.ts"),
      "utf8",
    );
    assert.match(route, /requireFamilyFromRequest\(request\)/u);
    assert.doesNotMatch(route, /await requireFamily\(\)/u);
  });
});
