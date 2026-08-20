import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const hook = join(repositoryRoot, ".claude", "hooks", "block-dangerous-git.mjs");

function run(command) {
  return spawnSync(process.execPath, [hook], {
    encoding: "utf8",
    input: JSON.stringify({ tool_input: { command } }),
  });
}

for (const command of [
  "git -C /tmp/example worktree remove /tmp/example/old",
  "bash -c 'git -C /tmp/example worktree remove --force /tmp/example/old'",
  "zsh -lc \"git reset --hard HEAD~1\"",
  "command /usr/bin/git clean -fdx",
  "git branch --delete --force stale-branch",
  "git branch -d -f stale-branch",
  "git branch --delete -f stale-branch",
  "git branch -df stale-branch",
  "git branch -d merged-branch",
  "git branch -D stale-branch",
  "git branch -Df stale-branch",
  "git branch -fD stale-branch",
  "git branch --delet stale-branch",
  "git branch --delete=stale-branch",
  "git branch --delet --forc stale-branch",
  "git worktree prune --expire now",
  "git restore .",
  // Every force variant, including the lease. Publishing plainly is allowed
  // below; rewriting published history is not, and the lease is safer but
  // still a rewrite.
  "git push --force-with-lease origin main",
  "git push --force origin main",
  "git push -f origin main",
]) {
  test(`blocks ${command}`, () => {
    const result = run(command);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /BLOCKED:/u);
  });
}

for (const command of [
  "git status --short",
  "git -C /tmp/example worktree list --porcelain",
  "node scripts/remove-worktree-safely.mjs --help",
  // Publishing a branch destroys nothing and is reversible. It was blocked
  // only because it rode along with the cleanup-safety work in 46e07344,
  // and the cost was every agent session stopping mid-task to hand the push
  // to a person. Force variants above are the ones that can lose work.
  "git push",
  "git push -u origin feature-branch",
]) {
  test(`allows ${command}`, () => {
    const result = run(command);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
  });
}

test("fails closed when the Bash request is malformed", () => {
  const result = spawnSync(process.execPath, [hook], { encoding: "utf8", input: "not-json" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /could not parse/u);
});
