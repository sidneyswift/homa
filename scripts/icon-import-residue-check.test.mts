import assert from "node:assert/strict";
import test from "node:test";
import {
  collectDirectIconImportsFromText,
  readIconImportExceptions,
  validateIconImportExceptions,
} from "./icon-import-residue-check.mts";

test("collects only direct Lucide package imports with source locations", () => {
  assert.deepEqual(
    collectDirectIconImportsFromText("apps/web/example.tsx", `import { ArrowRight } from "lucide-react";\nimport type { LucideProps } from "lucide-react";`),
    [
      { path: "apps/web/example.tsx", package: "lucide-react", line: 1 },
      { path: "apps/web/example.tsx", package: "lucide-react", line: 2 },
    ],
  );
  assert.deepEqual(collectDirectIconImportsFromText("apps/mobile/example.tsx", `import { X } from "lucide-react-native";`), [
    { path: "apps/mobile/example.tsx", package: "lucide-react-native", line: 1 },
  ]);
  assert.deepEqual(collectDirectIconImportsFromText("apps/web/example.tsx", `const source = 'from "lucide-react"';`), []);
});

test("the checked-in exception manifest exactly covers current direct imports", () => {
  const exceptions = readIconImportExceptions();
  assert.ok(exceptions.length > 0);
  const report = validateIconImportExceptions(
    exceptions.map((exception) => ({ ...exception, line: 1 })),
    exceptions,
  );
  assert.equal(report.directImports, exceptions.length);
  assert.equal(report.adapterImports, 3);
  assert.ok(report.migrationPendingImports > 0);
});

test("new direct imports fail closed until explicitly reviewed", () => {
  const finding = { path: "apps/web/new-surface.tsx", package: "lucide-react" as const, line: 4 };
  assert.throws(() => validateIconImportExceptions([finding], []), /unlisted direct icon import/);
  assert.throws(
    () => validateIconImportExceptions(
      [{ path: "apps/web/components/design/Icon.tsx", package: "lucide-react" as const, line: 1 }],
      [{ path: "apps/web/components/design/Icon.tsx", package: "lucide-react" as const, kind: "migration-pending" }],
    ),
    /adapter path must use adapter kind/,
  );
  assert.throws(
    () => validateIconImportExceptions(
      [{ path: "apps/web/new-surface.tsx", package: "lucide-react" as const, line: 1 }],
      [{ path: "apps/web/new-surface.tsx", package: "lucide-react" as const, kind: "adapter" }],
    ),
    /only adapter paths may use adapter kind/,
  );
});
