import assert from "node:assert/strict";
import test from "node:test";

import {
  extractPathRefs,
  extractPnpmScriptRefs,
  validateDocReferences,
} from "./docs-reference-check.mjs";

const ROOT_SCRIPTS = new Set(["check:isolation", "check:fleet-skills"]);
const WEB_SCRIPTS = new Set(["eval:local"]);

function run(text: string, pathExists: (p: string) => boolean = () => true) {
  const errors: string[] = [];
  validateDocReferences(
    {
      docs: [{ path: "AGENTS.md", text }],
      rootScripts: ROOT_SCRIPTS,
      webScripts: WEB_SCRIPTS,
      pathExists,
    },
    errors,
  );
  return errors;
}

test("a live pnpm script passes", () => {
  assert.deepEqual(run("Run `pnpm check:isolation` first."), []);
});

test("a seeded dead pnpm command fires", () => {
  const errors = run("Run `pnpm check:retired-guard` first.");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /check:retired-guard/);
});

test("a --filter web script resolves against the web manifest", () => {
  assert.deepEqual(run("Run `pnpm --filter web eval:local`."), []);
  const errors = run("Run `pnpm --filter web check:isolation`.");
  assert.match(errors[0], /apps\/web\/package\.json has no such script/);
});

test("colon-free pnpm invocations are out of scope", () => {
  assert.deepEqual(run("Run `pnpm install` then `pnpm dev`."), []);
  assert.deepEqual(extractPnpmScriptRefs("pnpm --filter web exec eve build"), []);
});

test("a seeded dead backticked path fires", () => {
  const errors = run("See `docs/gone/nowhere.md` for details.", () => false);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /docs\/gone\/nowhere\.md/);
});

test("prohibited directories and forward references never fire", () => {
  const text =
    "Never read `homa-macmini/` or `homa-template/`; `packages/design` lands under M1-17; read `node_modules/next/dist/docs/` first.";
  assert.deepEqual(run(text, () => false), []);
});

test("globs, placeholders, and URLs are not treated as paths", () => {
  const refs = extractPathRefs(
    "Use `apps/web/agent/skills/<name>/SKILL.md`, `**/*.key`, and `https://a.b/c`.",
  );
  assert.deepEqual(refs, []);
});

test("anchors and line suffixes are stripped before resolution", () => {
  const seen: string[] = [];
  run(
    "See `docs/homa-planning/13-mr-prd.md#8-open-items` and `apps/web/agent/agent.ts:42`.",
    (p) => {
      seen.push(p);
      return true;
    },
  );
  assert.deepEqual(seen.sort(), [
    "apps/web/agent/agent.ts",
    "docs/homa-planning/13-mr-prd.md",
  ]);
});
