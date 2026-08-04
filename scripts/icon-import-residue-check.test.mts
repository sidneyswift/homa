import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  collectDirectIconImports,
  collectDirectIconImportsFromText,
  readIconImportExceptions,
  readIconImportReview,
  validateIconImportExceptions,
} from "./icon-import-residue-check.mts";

const MIGRATED_SURFACES = [
  "apps/mobile/src/app/(tabs)/binder.tsx",
  "apps/mobile/src/app/(tabs)/hours.tsx",
  "apps/mobile/src/app/(tabs)/tasks.tsx",
  "apps/mobile/src/app/settings.tsx",
  "apps/mobile/src/components/nav/app-drawer.tsx",
  "apps/mobile/src/components/ui/inline-error.tsx",
  "apps/mobile/src/features/binder/material-detail-modal.tsx",
  "apps/mobile/src/features/chat/checklist-takeover.tsx",
  "apps/mobile/src/features/chat/onboarding-cards.tsx",
  "apps/mobile/src/features/chat/planner-card.tsx",
  "apps/mobile/src/features/hours/entry-editor.tsx",
  "apps/mobile/src/features/state-records/state-records-card.tsx",
  "apps/web/app/app/family-asset-source-card.tsx",
  "apps/web/app/app/progress-question-card.tsx",
  "apps/web/app/app/prompt-suggestion-rail.tsx",
  "apps/web/app/app/question-card.tsx",
  "apps/web/app/features/[slug]/page.tsx",
  "apps/web/components/marketing/CtaBand.tsx",
  "apps/web/components/marketing/Hero.tsx",
  "apps/web/components/marketing/SampleReportProof.tsx",
  "apps/web/components/marketing/SignupPopupModal.tsx",
  "apps/mobile/src/features/lessons/native-lesson-recorder.tsx",
  "apps/mobile/src/features/tasks/task-card.tsx",
  "apps/mobile/src/features/tasks/task-edit-sheet.tsx",
  "apps/mobile/src/features/tasks/task-history-row.tsx",
  "apps/mobile/src/features/voice/labs/voice-shell-547-lab.tsx",
  "apps/mobile/src/features/voice/voice-prompt-starters.tsx",
  "apps/web/app/admin/agent-prompt-button.tsx",
  "apps/web/app/admin/alert-ack-button.tsx",
  "apps/web/app/admin/families/[familyId]/build-report-button.tsx",
  "apps/web/app/admin/families/[familyId]/phone-lend-controls.tsx",
  "apps/web/app/admin/families/[familyId]/test-family-controls.tsx",
  "apps/web/app/app/attachment-message-parts.tsx",
  "apps/web/app/app/chat-attachments.tsx",
  "apps/web/app/app/curriculum-mapping-card.tsx",
  "apps/web/app/app/planner-canvas.tsx",
  "apps/web/app/app/planner/unified-planner-view.tsx",
  "apps/web/app/app/slash-composer.tsx",
  "apps/web/app/app/snap-card.tsx",
  "apps/web/app/app/worked-for.tsx",
  "apps/web/components/dashboard/context-switcher.tsx",
  "apps/web/components/dev/dev-toolbar.tsx",
  "apps/web/components/marketing/CapabilityProof.tsx",
  "apps/web/components/marketing/HeroProductDemo.tsx",
  "apps/web/components/marketing/PlatformStrip.tsx",
  "apps/web/components/marketing/QuietLanding.tsx",
] as const;

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
  assert.equal(report.migrationPendingImports, 0);
});

test("the pending wave has a complete ownership and support review", () => {
  const review = readIconImportReview();
  assert.equal(review.length, 25);
  assert.equal(new Set(review.map((entry) => entry.path)).size, review.length);
  assert.deepEqual(new Set(review.map((entry) => entry.surfaceClass)), new Set(["user-facing", "admin-founder", "dev-only"]));
  assert.ok(review.every((entry) => entry.glyphSupport === "supported" && entry.decision === "migrate"));
  assert.ok(review.every((entry) => entry.rationale.length >= 20));
});

test("completed icon migration surfaces stay on the semantic adapter", () => {
  const findings = collectDirectIconImports();
  const directImportPaths = new Set(findings.map((finding) => finding.path));

  for (const path of MIGRATED_SURFACES) {
    assert.equal(directImportPaths.has(path), false, `${path} reintroduced a direct Lucide import`);
    const source = readFileSync(resolve(process.cwd(), path), "utf8");
    assert.match(source, /import \{ Icon \} from ["'][^"']*(?:components\/)?design\/(?:Icon|icon)["']/u, `${path} does not import the semantic icon adapter`);
  }
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
