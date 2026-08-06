# Repository operating system

This runbook is the canonical lifecycle for Homa issues, agent tasks, branches,
worktrees, pull requests, preservation artifacts, and cleanup. The tracker holds
status and priority. This runbook holds the operating rules. Repository files and
production evidence establish what is actually built and shipped.

## One outcome, one owned lane

One product outcome has these linked objects:

1. One GitHub Issue with priority, status, acceptance criteria, and evidence.
2. One primary agent task with the working context.
3. One branch with the code history.
4. One worktree with the isolated checkout.
5. One pull request when review and integration are needed.

Review agents may inspect the primary lane. They do not need separate branches or
worktrees unless they own a separately tracked outcome.

Before creating a lane, search open issues, pull requests, local and remote
branches, registered worktrees, and open Codex tasks for the same outcome. Reuse
the owned lane when it matches. Otherwise update the current origin main branch,
create a branch named `codex/gh-<issue>-<short-slug>`, and add one worktree.

Record the task, branch, exact worktree path, owner, next action, and blocker on
the issue. Branch names are single-use. A correction or rebuild gets a new branch
from current main and links the old lane as frozen evidence.

Keep six to eight active worktrees in normal operation. Twelve registered
worktrees is the hard ceiling. At the ceiling, finish, preserve, or remove one
lane before creating another. A P0 production containment may exceed the ceiling
by one only when its issue names the incident owner, user-facing failure, new lane,
and the lane that will be retired next.

The primary checkout is an integration surface. Keep it clean and use it for
syncing, inspection, and final verification. Do implementation in owned lanes.

## Inventory before classification

Capture a timestamp, the primary worktree, the common Git directory, the stored
origin URL, the current remote main commit, and the current production deployment
before making completion claims.

Inventory these sources separately:

- Registered worktrees from `git worktree list --porcelain`.
- Standalone Homa clones under approved temporary and project-parent paths.
- Open Codex tasks that name a Homa branch, checkout, or outcome.
- Open pull requests and their exact head commits.
- Local branches and remote branch refs.
- Recovery bundles and patches under the approved durable archive.
- Standalone test or reproduction repositories with an owner and expiry.
- Stale registrations, beginning with `git worktree prune --dry-run`.

Never infer repository identity from a directory name. Resolve the checkout root,
Git directory, common Git directory, and stored origin. A standalone clone can
occupy a path once used by a missing linked worktree while containing unrelated
work.

For every checkout, record:

- Physical path and resolved repository identity.
- Branch or detached commit, full HEAD, tree, upstream, and distance from main.
- Tracked, untracked, and exact ignored-file status.
- Commits reachable from the checkout but not remote main.
- Matching branch, pull request, issue, task, and recovery artifact.
- Owner, last activity, next action, and intended expiry.

Restart the affected preflight when another agent creates or changes a lane.

## Classify each checkout

Use exactly one state:

- **Active:** owned, linked to an open issue, and expected to change now.
- **Ready to integrate:** committed, verified, and has one clear pull request action.
- **Preserve:** useful or ambiguous work exists, but the lane is not active.
- **Removable:** no unique work, active owner, open pull request, or unresolved risk.
- **Stale registration:** Git metadata names a missing path.
- **Standalone collision:** a separate clone occupies a path associated with other
  worktree metadata.

A clean status is necessary but is not enough to classify a checkout as removable.

## Preserve work before cleanup

1. Identify the owning issue and outcome.
2. Separate unrelated edits. Never commit a mixed checkout as one change.
3. For commits already on a trusted remote, record the exact remote ref and commit.
4. For local-only commits, create a Git bundle outside the source worktree and
   outside `/private/tmp`. Verify it, restore it into a disposable clone, and compare
   the restored HEAD and tree with the source.
5. For tracked edits, create a binary-capable patch. Restore it in a disposable
   checkout before accepting it.
6. For useful untracked files, copy the sanitized files into the recovery package.
   Record source and recovered checksums. A filename manifest alone is not recovery.
7. Never copy environment files, keys, certificates, credentials, live family data,
   or other secrets into Git or a shared archive. Back them up to an approved private
   store or record an explicit discard decision.
8. Record the source HEAD, tree, patch checksum, artifact checksum, restore result,
   issue, owner, and expiry.

GitHub may return HTTP 422 when a local-only commit does not exist there. That is
expected only for bundle-backed recovery. The wrapper still checks open pull
requests by branch and verifies the bundle locally. Authentication, network, and
other GitHub failures stop cleanup.

## Remove a linked worktree

Only [the safe removal wrapper](../../../scripts/remove-worktree-safely.mjs) may
remove a registered secondary worktree. It never removes the primary worktree,
uses force, deletes a branch, deletes a remote ref, or mutates GitHub.

### Prepare reviewed evidence

Store the evidence file outside the target worktree and outside `/private/tmp`.
Capture it within thirty minutes of execution. It must identify the exact primary
checkout, common Git directory, stored origin URL, target path, registered path,
target Git directory, branch, HEAD, tree, base ref, and binary patch checksum.

Every exact ignored path needs one evidence decision. There is no repository-wide
ignored-directory exemption. Allowed decisions are:

- `regenerable`, with a reason.
- `discard-approved`, with a reason.
- `backed-up-private`, with a reason and private recovery reference.

Secret-shaped ignored paths cannot be classified as regenerable.

Recovery kinds are:

- `integrated` when the exact HEAD is already an ancestor of current remote main.
- `remote-branch` when the trusted remote ref resolves to the exact HEAD.
- `bundle` when a durable verified bundle advertises the exact local-only HEAD and
  a disposable restore produced the same HEAD and tree.

An open issue needs a verified handoff comment containing the old path, branch,
full HEAD, and replacement lane when one exists. A closed issue needs recorded
completion evidence.

### Export the Desktop task snapshot

Immediately before each execution attempt, use the Codex app task-list tool to
export all open and recent Homa tasks. Do not use a new app-server process as a
substitute. A separate process can read stored tasks but cannot prove the Desktop
app's live ownership state.

The execution snapshot is valid for thirty seconds. The wrapper re-reads it after
the final Git and GitHub checks. If it is stale, malformed, incomplete, contains a
matching active task, or contains an unknown task state, execution stops. Inspection
mode accepts a snapshot up to ten minutes old because it changes nothing.

The snapshot shape is:

```json
{
  "schemaVersion": 1,
  "source": "codex-list-threads",
  "coverage": "all-open-and-recent-homa-tasks",
  "capturedAt": "2026-08-06T03:00:00.000Z",
  "repositoryOrigin": "https://github.com/sidneyswift/homa.git",
  "tasks": []
}
```

Every matching finished task includes a handoff with outcome, issue, branch,
worktree, commit or pull request, checks, production state, next step, and recorded
time. When the complete search finds no match, evidence must explicitly set
`task.noMatchingTaskConfirmed` to true. A matching active task always blocks.

Task metadata cannot prove that an unrelated agent has not started operating on a
path after the snapshot. The named cleanup operator must keep a repository freeze
during the execution window. The wrapper is fail-closed evidence validation, not an
operating-system lock against an uncooperative process.

### Inspect, then execute

Run inspection first:

```sh
node scripts/remove-worktree-safely.mjs \
  --target /absolute/worktree/path \
  --evidence /durable/path/removal-evidence.json \
  --task-snapshot /absolute/path/codex-task-snapshot.json
```

Review the exact identity, issue, pull request, task, ignored-file, and recovery
result. Refresh the Desktop task snapshot, then execute within thirty seconds:

```sh
node scripts/remove-worktree-safely.mjs \
  --target /absolute/worktree/path \
  --evidence /durable/path/removal-evidence.json \
  --task-snapshot /absolute/path/codex-task-snapshot.json \
  --execute \
  --remote-branch-action keep \
  --confirmation "REMOVE /absolute/worktree/path"
```

After success, confirm the path and registration are gone. The local branch remains.
Delete a merged local branch separately with normal `git branch -d` only after
ancestry or merged pull request evidence proves integration. Remote deletion is a
separate action requiring the current issue owner or a repository maintainer to name
the exact remote and branch after recovery and handoff are proven.

For stale registrations, compare the dry-run prune output with standalone clones,
then prune only confirmed stale metadata. Pruning metadata is not permission to
delete a directory.

## Standalone clones and path collisions

A standalone clone is never removed with the linked-worktree wrapper. Resolve its
own Git directory, origin, HEAD, branches, status, ignored files, unique commits,
pull requests, task owner, and issue. Quarantine ambiguous path collisions. Extract
useful outcomes onto fresh issue branches from current main. Remove the clone only
after every useful and secret-bearing artifact has a deliberate, tested disposition.

## Pull request decisions

Every open pull request has one owner and one recorded action:

- **Merge:** coherent scope, passing checks, resolved review, safe deployment order.
- **Revise:** same coherent outcome with a bounded correction.
- **Split:** useful independent outcomes need separate issue branches.
- **Rebuild:** stale or tangled work must be reapplied to current main.
- **Close:** shipped elsewhere, superseded, invalid, or preserved in a replacement.

Closing a pull request never deletes the only recoverable copy.

## Close a lane

Use this order:

1. Confirm required local checks and exact-head remote checks.
2. Merge through the repository's normal integration method.
3. Verify deployment and live behavior when production is affected.
4. Update or close the issue with commit, pull request, checks, deploy, and probe evidence.
5. Export a fresh Desktop task snapshot and remove the clean worktree.
6. Delete the proven merged local branch, then any separately approved remote branch.
7. Post the task handoff and archive the task.
8. Recount active lanes and choose the next issue by user value and priority.

## Advisory Claude Code hook

The project hook at [.claude/hooks/block-dangerous-git.mjs](../../../.claude/hooks/block-dangerous-git.mjs)
is a tripwire. It blocks direct worktree removal and common destructive Git forms,
including nested shell text, Git `-C`, hard reset, forced clean, forced branch delete,
whole-worktree restore, and push commands issued through Claude Code Bash.

It is not an authorization or security boundary. It cannot govern another shell,
another Git client, a computed executable name, a disabled hook, or an intentionally
rewritten command. The wrapper, reviewed evidence, repository freeze, and named
operator remain required.

## Weekly reconciliation

Once a week, compare issues, pull requests, branches, worktrees, tasks, recovery
artifacts, deployments, and production. Resolve these exceptions before starting
discretionary work:

- More than twelve registered worktrees.
- Ownerless or issue-less implementation lanes.
- Worktrees older than seven days without a next action.
- Pull requests without a merge, revise, split, rebuild, or close decision.
- Dirty temporary checkouts that are the only copy of work.
- Issues marked complete without merge, ruling, or live evidence.
- Shipped behavior whose issue or epic still says unfinished.

End the reconciliation with counts, preserved artifacts, removals, remaining active
lanes, and the next three user-value priorities on the cleanup issue.
