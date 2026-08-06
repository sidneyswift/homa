import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const liveFixtureScripts = [
  {
    path: "scripts/isolation-check.mjs",
    signupAnchor: "const familyAUser = await signUpFixtureUser",
  },
  {
    path: "scripts/conversation-continuity-e2e.mts",
    signupAnchor: 'const sidney = await signUp("sidney", suffix)',
  },
  {
    path: "scripts/conversation-continuity-agent-e2e.mts",
    signupAnchor: 'const auth = await authRequest("signup"',
  },
  {
    path: "scripts/parented-session-continuity-e2e.mts",
    signupAnchor: 'const auth = await authRequest("signup"',
  },
];

for (const fixture of liveFixtureScripts) {
  test(`${fixture.path} verifies cleanup access before signup`, () => {
    const source = readFileSync(path.join(repoRoot, fixture.path), "utf8");
    const preflightIndex = source.indexOf("select 1 as live_fixture_database_ready");
    const signupIndex = source.indexOf(fixture.signupAnchor);

    assert.notEqual(preflightIndex, -1, "missing database preflight");
    assert.notEqual(signupIndex, -1, "missing signup anchor");
    assert.ok(
      preflightIndex < signupIndex,
      "database preflight must happen before creating the Auth user",
    );
  });

  test(`${fixture.path} marks its family as sandbox`, () => {
    const source = readFileSync(path.join(repoRoot, fixture.path), "utf8");
    assert.match(source, /set\s+sandbox\s*=\s*true/s);
  });
}
