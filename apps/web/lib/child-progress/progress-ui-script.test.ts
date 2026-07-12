import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const REQUIRED_PROGRESS_UI_TESTS = [
  "apps/web/lib/child-progress/flag.test.ts",
  "apps/web/lib/child-progress/view-copy.test.ts",
  "apps/web/lib/child-progress/view-schema.test.ts",
  "apps/web/lib/child-progress/page-state.test.ts",
  "apps/web/lib/child-progress/kid-action.test.ts",
  "apps/web/lib/child-progress/route-policy.test.ts",
  "apps/web/lib/view-context.test.ts",
  "apps/web/components/dashboard/sidebar-nav.test.ts",
  "apps/web/components/dashboard/kid-view-progress.test.tsx",
  "apps/web/components/progress/progress-view.test.tsx",
  "apps/web/components/progress/progress-unavailable.test.tsx",
  "apps/web/components/progress/retry-progress-action.test.ts",
  "apps/web/app/app/progress-message-parts.test.ts",
  "apps/web/app/app/progress-chat-cards.test.tsx",
  "apps/web/app/app/message-parts-progress.test.tsx",
  "apps/web/app/app/chat-client-progress-wiring.test.ts",
  "apps/web/lib/child-progress/tool-result-contract.test.ts",
  "apps/web/app/app/progress-client-boundary.test.ts",
  "apps/web/app/app/progress-interaction-policy.test.ts",
  "apps/web/app/app/progress-action-lifecycle.test.ts",
  "apps/web/app/app/chat-send-policy.test.ts",
  "apps/web/app/onboarding/map-answer-attempt.test.ts",
  "apps/web/app/onboarding/receipt-correction-intent.test.ts",
] as const;

describe("check:progress-ui script", () => {
  it("runs every focused Progress policy test with the web tsconfig", () => {
    const packageJson = JSON.parse(
      readFileSync(
        new URL("../../../../package.json", import.meta.url),
        "utf8",
      ),
    ) as {
      scripts?: Record<string, string>;
    };
    const command =
      packageJson.scripts?.["check:progress-ui"] ?? "";

    assert.match(
      command,
      /^tsx --tsconfig apps\/web\/tsconfig\.json --test /u,
    );
    for (const testPath of REQUIRED_PROGRESS_UI_TESTS) {
      assert.match(command, new RegExp(testPath.replaceAll(".", "\\."), "u"));
    }
  });

  it("keeps focused guard ownership explicit", () => {
    const packageJson = JSON.parse(
      readFileSync(
        new URL("../../../../package.json", import.meta.url),
        "utf8",
      ),
    ) as {
      scripts?: Record<string, string>;
    };
    const childProgressCommand =
      packageJson.scripts?.["check:child-progress"] ?? "";
    const progressUiCommand =
      packageJson.scripts?.["check:progress-ui"] ?? "";
    const taxonomyCommand =
      packageJson.scripts?.["check:taxonomy"] ?? "";

    assert.match(
      childProgressCommand,
      /packages\/core\/src\/events\.test\.ts/u,
    );
    assert.match(
      childProgressCommand,
      /apps\/web\/lib\/child-progress\/\*\.test\.ts/u,
    );
    assert.match(
      childProgressCommand,
      /apps\/web\/lib\/map\/walk-answer-event\.test\.ts/u,
    );
    assert.match(
      childProgressCommand,
      /scripts\/reconcile-child-progress\.test\.ts/u,
    );
    assert.doesNotMatch(
      childProgressCommand,
      /message-parts-progress\.test\.tsx/u,
    );
    assert.match(
      progressUiCommand,
      /message-parts-progress\.test\.tsx/u,
    );
    assert.match(
      taxonomyCommand,
      /packages\/taxonomy\/src\/progress\.test\.ts/u,
    );
  });
});
