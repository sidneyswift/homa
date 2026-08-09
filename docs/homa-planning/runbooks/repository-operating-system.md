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
Git directory, common Git directory, and stored origin. The safe removal wrapper
also requires the target to share the common Git directory and origin of the Homa
checkout containing the wrapper. It removes every ambient `GIT_*` variable before
each Git or GitHub subprocess, then installs its own no-prompt, no-replacement,
no-system-config environment. `GIT_DIR`, `GIT_WORK_TREE`, injected config, alternate
object stores, and similar caller state cannot redirect inspection. A standalone
clone can occupy a path once used by a missing linked worktree while containing
unrelated work.

The wrapper reads current GitHub branch commits through authenticated `gh api`
requests, not `git ls-remote`. Private-origin inspection therefore does not depend
on an ambient Git credential helper, while every local Git command remains isolated
from caller-supplied Git configuration.

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
   outside every operating-system temporary root. This includes `/tmp`,
   `/private/tmp`, `/var/tmp`, runtime directories, memory-backed temporary storage,
   and macOS per-user `/var/folders/.../T` directories. The wrapper restores it into
   a new empty repository and compares the restored HEAD and tree with the source.
   The empty repository has no object alternates, ignores caller object indirection,
   and passes a full strict object check. A bundle that depends on prerequisite
   objects outside itself fails this proof.
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

Store schema version 2 evidence outside the target worktree and outside every
operating-system temporary root named above. Capture it within thirty minutes of
execution. It must identify the exact primary checkout, common Git directory,
stored origin URL, target path, registered path, target Git directory, branch,
HEAD, tree, base ref, and binary patch checksum. Evidence, recovery, ignored-file,
replacement, task, check, and approval timestamps must be valid and cannot be in
the future.

Generate the evidence and its review queue as owner-only mode-0600 files. The
paths must be distinct, absolute, durable, and outside the target and common Git
directory:

```sh
node scripts/remove-worktree-safely.mjs \
  --generate \
  --target /absolute/worktree/path \
  --evidence-out /durable/private/removal-evidence.json \
  --review-queue-out /durable/private/removal-review.json
```

The removal wrapper consumes only a direct regular evidence file owned by the
current user with mode exactly `0600`. A symbolic link, path alias, different
owner, or any group or other permission blocks inspection and execution.

Use `--issue-number` when the branch does not contain its issue number. Use
`--recovery-bundle`, `--handoff-url`, or `--issue-disposition` when the generated
queue calls for them. The generator classifies only known build and cache files
automatically. It leaves every sensitive or ordinary ignored file, incomplete
issue handoff, approval, and execution task proof in the review queue.
The human approval keeps the generated `scanNonce` and `scanSha256` unchanged,
so it cannot be copied onto a different scan.

Every ignored file needs one evidence decision bound to its relative path, file or
symlink type, byte size, and SHA-256 digest. The wrapper gets this inventory from
Git's NUL-delimited ignored-file listing, so newlines in names are unambiguous. A
directory-level decision is not enough. Adding, removing, renaming, or changing one
ignored file invalidates the evidence. Allowed decisions are:

- `regenerable`, with a reason.
- `discard-approved`, with a reason.
- `backed-up-private`, with a reason and private recovery reference.

A private backup is accepted only when the source and backup have the same byte
count and SHA-256 digest at validation time. The backup file and its immediate
parent must belong to the current user and grant no group or other access. The
backup must remain outside temporary storage and outside the worktree being
removed.

`regenerable` is valid only when the file is inside an explicit generated, cache,
build, coverage, distribution, output, temporary, or dependency directory. A root
ignored file or an ignored file in an ordinary source directory needs a deliberate
discard or private-backup decision instead.

Secret-shaped ignored paths cannot be classified as regenerable, including a
secret-shaped file nested inside an otherwise generated directory. Detection
normalizes camelCase, underscores, hyphens, dots, and letter case. It includes
environment-file variants such as `.envrc`, `.pgpass`, `.docker/config.json`,
service-account and application-default credential files, `AuthKey` files,
`config.local`, bounded secret and token names, SSH key names, and standard key,
certificate, and keystore extensions such as `.p8`, `.pem`, `.p12`, `.pfx`, and
`.jks`, including backup suffix chains such as `.pem.bak`, `.p12.backup`,
`.crt.old`, and `.key.bak`. Ordinary names such as `tokenizer-cache.json` are not
treated as secrets merely because they contain the letters `token`.
An exact sensitive filename stays sensitive when more dot suffixes are appended,
so `.npmrc.bak`, `.pgpass.bak`, `auth.json.backup`, and longer backup chains cannot
be relabeled as regenerable.

The wrapper also walks the physical checkout without following symlinks and blocks
any nested `.git` file or directory. Git status can hide a nested repository when
the outer repository already tracks its visible files. Its separate object history
must never be treated as disposable outer-worktree content. Nested bare repositories
also block when they have a valid Git `HEAD`, a regular config with `core.bare=true`,
and real `objects` and `refs` directories. A folder name or Git-shaped source files
alone do not trigger that classification.

Recovery kinds are:

- `integrated` when the exact HEAD is already an ancestor of current remote main.
- `remote-branch` when the trusted remote ref resolves to the exact HEAD.
- `bundle` when a durable bundle advertises the exact local-only HEAD and the
  wrapper's own empty-repository restore produces the same HEAD and tree.

An open issue needs a verified handoff comment containing the old path, branch,
full HEAD, and replacement lane when one exists. A closed issue needs recorded
completion evidence.

### Export the Desktop task snapshot

Immediately before each execution attempt, use the Codex app task-list tool to
export all open and recent Homa tasks. Store the snapshot outside the target
worktree. Do not use a new app-server process as a substitute. A separate process
can read stored tasks but cannot prove the Desktop app's live ownership state.

The execution snapshot is valid for thirty seconds. The wrapper reads it only after
printing a fresh READY record. `capturedAt` must be a normalized UTC ISO timestamp
at or after that record's `readyAt`, no later than the read time, and bound to the
record's random execution nonce. If it is prebuffered, replayed, stale, future-dated,
malformed, contains a matching active task, or contains a matching task whose status
is anything other than the exact value `completed`, execution stops. Inspection mode
accepts a snapshot up to ten minutes old because it changes nothing.

The snapshot shape is:

```json
{
  "schemaVersion": 1,
  "source": "codex-list-threads",
  "coverage": "all-open-and-recent-homa-tasks",
  "capturedAt": "2026-08-06T03:00:00.000Z",
  "repositoryOrigin": "https://github.com/sidneyswift/homa.git",
  "retirementScan": {
    "nonce": "64 lowercase hexadecimal characters copied from evidence.scan.nonce",
    "sha256": "exact evidence.scan.sha256"
  },
  "tasks": [
    {
      "id": "task-id",
      "status": "completed",
      "branch": "codex/gh-872-short-slug",
      "worktree": "/absolute/worktree/path",
      "handoff": {
        "outcome": "Completed outcome",
        "issue": "#872",
        "branch": "codex/gh-872-short-slug",
        "worktree": "/absolute/worktree/path",
        "commitOrPr": "full commit or pull request URL",
        "checks": {
          "executed": true,
          "status": "passed",
          "commands": ["exact command that ran"],
          "completedAt": "2026-08-06T03:00:00.000Z"
        },
        "productionState": "Verified state or not applicable",
        "nextStep": "cleanup-coordinator-remove-worktree",
        "handoffComplete": true,
        "recordedAt": "2026-08-06T03:00:00.000Z"
      }
    }
  ]
}
```

Inspection snapshots omit `executionBoundary`. After READY, copy the fresh values
printed by that exact process into the newly exported execution snapshot:

```json
{
  "capturedAt": "normalized UTC timestamp at or after readyAt",
  "executionBoundary": {
    "nonce": "exact executionNonce printed by this READY event",
    "readyAt": "exact readyAt printed by this READY event"
  }
}
```

Every matching task must be `completed` and include an exact handoff. The issue is
exactly `#<number>` or its GitHub issue URL. `commitOrPr` is exactly the current HEAD,
its GitHub commit URL, or an associated pull request URL whose head is the current
HEAD. Checks explicitly record execution, passing status, at least one command, and
completion time. The next step is exactly `cleanup-coordinator-remove-worktree` and
`handoffComplete` is true. Automatic removal requires at least one matching task. A
matching active, cancelled, interrupted, archived, or otherwise noncompleted task
always blocks.

The JSON fields prove freshness and internal consistency, not app-authenticated
provenance. The operator remains responsible for exporting the complete task-list
result. A taskless legacy lane uses a separate manual path: evidence records a fresh
`task.legacyTasklessOverride` with `approvedBy`, `reason`, `approvedAt`, and the
exact `scanNonce`, and the command includes
`--legacy-taskless-confirmation "ALLOW TASKLESS /absolute/worktree/path"`.
The approver must be exactly `sidneyswift` and the reason exactly
`legacy-lane-predates-task-tracking`. Do not use that override for a lane with a
matching task.

A secondary worktree that the active cleanup coordinator created or deliberately
repurposed by hand may use a third proof mode only when the complete fresh task
snapshot contains no task matching the target branch or path. Record this exact
shape under `task.coordinatorOwnedManualLane` in the reviewed evidence:

```json
{
  "coordinator": {
    "taskId": "active-cleanup-coordinator-task-id",
    "branch": "exact-primary-branch",
    "worktree": "/absolute/primary/worktree"
  },
  "target": {
    "branch": "exact-target-branch",
    "worktree": "/absolute/target/worktree",
    "head": "full-target-head"
  },
  "ownershipEvent": {
    "kind": "created",
    "occurredAt": "normalized UTC timestamp",
    "details": "Exact concise description of how the coordinator created this lane."
  },
  "approval": {
    "approvedBy": "sidneyswift",
    "approvedAt": "fresh normalized UTC timestamp at or after evidence capture",
    "reason": "coordinator-created-manual-lane",
    "scanNonce": "exact evidence.scan.nonce",
    "scanSha256": "exact evidence.scan.sha256"
  }
}
```

Use `ownershipEvent.kind: "repurposed"` and the exact reason
`coordinator-repurposed-manual-lane` when the coordinator adopted an existing
manual lane. The target must have a named branch. The coordinator and target must
be distinct. The attested coordinator branch and worktree must equal the freshly
inspected primary branch and primary worktree. The snapshot must contain exactly
one task with the attested coordinator task ID. Its status must be exactly one of
`active`, `idle`, `in_progress`, `needs_input`, `pending`, `running`, or `waiting`,
with the exact case shown, and it must remain on the same primary branch and worktree.
All times are normalized UTC. The ownership event must be at or before evidence
capture. Approval must be at or after both the ownership event and evidence capture,
no later than validation, and no more than thirty minutes old.

Inspection and execution also require this exact confirmation, with values copied
from the same reviewed evidence:

```sh
--coordinator-manual-lane-confirmation \
  "ALLOW COORDINATOR MANUAL LANE <taskId> <targetBranch>@<fullHead> <targetPath> <scanNonce>:<scanSha256>"
```

Never combine this attestation with the legacy taskless override. Never use either
manual proof when the snapshot contains a task matching the target branch or path.
An active target task blocks cleanup, and a completed target task must use its own
normal completed-task handoff. Unused special evidence or confirmations also block.
At execution, the coordinator task must survive the fresh post-READY snapshot with
the same branch and worktree and any exact status in the allowlist above. Its status
may change from one allowed active state to another between inspection and execution.

Coordinator-owned manual-lane execution consumes `scanNonce` exactly once. After
the final task proof and while holding the repository cleanup lock, the wrapper
atomically publishes an owner-only mode-0600 record under the owner-only mode-0700
`.git/homa-coordinator-manual-lane-consumptions/` directory before moving the
worktree. Any pre-existing record for that nonce blocks execution, even if the same
branch, path, and HEAD are recreated. Normal completed-task and legacy taskless proof
modes do not use this one-time record.

The record moves through `move-intent-recorded`, `quarantined`,
`content-preserved`, and `registration-removed`. A caught failure becomes
`recovery-required` and records whether the original, quarantine, and preserved
paths exist. A crash can leave an earlier truthful state, whose recorded paths are
the recovery map. A consumed nonce is never retried: inspect those paths and the Git
registration, preserve any moved content, then generate new evidence and a new
confirmation.

This mode proves internal consistency and records an owner attestation. It cannot
prove that an operator omitted an unrelated task from the Desktop export. Keep the
named repository freeze for the complete execution window, exactly as required for
the other proof modes.

Task metadata cannot prove that an unrelated agent was omitted from a snapshot. The
named cleanup operator must keep a repository freeze during the execution window.
Both cleanup executors also acquire the same repository-scoped
`.git/homa-repository-cleanup.lock` as an owner-only mode-0600 file. That exclusive
lock covers the final rescan, READY output, task attestation, mutation, and
postcondition. Contention always blocks. The scripts never infer that an old lock is
stale or remove it automatically; inspect ambiguous lock ownership manually. This
coordinates the cleanup executors but cannot stop an uncooperative process that
directly ignores the lock and rewrites Git metadata.

### Inspect, then execute

Run inspection first:

```sh
node scripts/remove-worktree-safely.mjs \
  --target /absolute/worktree/path \
  --evidence /durable/path/removal-evidence.json \
  --task-snapshot /absolute/path/codex-task-snapshot.json
```

Review the exact identity, issue, pull request, task, ignored-file, and recovery
result. Start execution with standard input open. The wrapper completes GitHub and
slow local checks first, creates a private sibling directory on the same filesystem,
then prints `READY_FOR_FINAL_CODEX_TASK_SNAPSHOT` with the expected scan binding,
`executionNonce`, and `readyAt`. Only then export the complete Desktop task list,
copy the exact execution boundary into it, send its normalized JSON to the process,
and close input. The snapshot must be captured at or after READY and less than thirty
seconds old. No Git or network command runs between that task proof and the atomic
move. Coordinator nonce consumption in that interval uses only durable local file
operations. The moved worktree is reinspected and sealed at a separate
`preserved-worktree` path before normal, non-force `git worktree remove` runs against
the now-missing registered path. Git can remove the registration, but it cannot
recursively delete the sealed content. If a file recreates the registered path at
the final boundary, Git refuses
removal or the postcondition blocks, and the late file remains present beside the
sealed copy. If anything arrived at the move boundary or an inspection differs,
execution also stops and reports the preserved path:

```sh
node scripts/remove-worktree-safely.mjs \
  --target /absolute/worktree/path \
  --evidence /durable/path/removal-evidence.json \
  --task-snapshot - \
  --execute \
  --remote-branch-action keep \
  --confirmation "REMOVE /absolute/worktree/path"
```

After success, confirm the original path and registration are gone and the reported
`preservedPath` exists. The wrapper deliberately keeps that sealed checkout copy,
so closing a registered worktree never silently deletes a file that arrived after
the final scan. Physical deletion of the sealed copy is a separate disposal action
after its path is reviewed and explicitly approved. Because the seal stays on the
source filesystem to make the rename atomic, it is not a durability claim. Relocate
anything that needs longer retention to the approved private archive. The local
branch remains.
Delete a merged local branch separately with normal `git branch -d` only after
ancestry or merged pull request evidence proves integration. Remote deletion is a
separate action requiring the current issue owner or a repository maintainer to name
the exact remote and branch after recovery and handoff are proven.

## Retire damaged worktree registrations

A damaged registration is a linked-worktree administrative record whose recorded
root `.git` entry is missing. Do not pass that path to the normal linked-worktree
wrapper. A path can disappear and later be replaced by an unrelated directory,
standalone clone, nested repository, bare repository, or symbolic link.

Only [the damaged-registration guard](../../../scripts/retire-damaged-worktree-registrations.mjs)
may retire this metadata. Run it from the trusted primary Homa checkout during a
repository freeze. It refuses to run from a linked worktree, from an untracked or
modified copy of itself, against a different common Git directory, or against a
different origin.

### Capture and approve the complete batch

Wait at least two seconds after the last registration change, then generate the
schema version 2 evidence and review queue. Both paths must be distinct, durable,
owner-only mode-0600 files with no symbolic-link or path-alias boundary. They must
be outside the primary checkout, common Git directory, every candidate path, and
every operating-system temporary root:

```sh
node scripts/retire-damaged-worktree-registrations.mjs \
  --generate \
  --evidence-out /durable/private/damaged-registration-evidence.json \
  --review-queue-out /durable/private/damaged-registration-review.json
```

The generator streams every surviving regular file and administrative index in
bounded chunks. It records repository and script identity; exact path state and
directory manifest; full HEAD and tree; branch or detached state; an explicit
allowlisted inventory and content fingerprint for every administrative file; a
random scan nonce; the complete set digest; and a fixed prune cutoff two seconds
older than capture. The required administrative files are `gitdir`, `HEAD`,
`commondir`, and `index`. The optional paths accepted after explicit review are
`AUTO_MERGE`, `CLAUDE_BASE`, `COMMIT_EDITMSG`, `FETCH_HEAD`, `ORIG_HEAD`,
`REBASE_HEAD`, `config.worktree`, `gc.log`, `locked`, `logs/HEAD`, an empty `refs`
directory, and the exact `hooks/post-commit` path. The guard fingerprints every
accepted file, preserves its bytes in the private administrative backup, and copies
files as mode `0600` so a preserved hook cannot execute. Any other path blocks the
batch for review. Git's verbose dry run must name exactly that administrative set.

The guard compares each prunable administrative index with its recorded HEAD without
refreshing or rewriting the index. If the index differs from HEAD, retirement fails
closed. This protects a uniquely staged version that a HEAD ref or ordinary bundle
does not preserve.

Review every queue item. Each registration must have all of these before the batch
can pass:

- One exact issue. A closed issue records `closed`. An open issue records an
  `updated-open` or `replacement-active` disposition and a verified handoff comment
  containing the old path, branch when present, HEAD, and recovery reference.
  A `codex/gh-<number>-*` branch normally owns that exact issue. When the embedded
  number instead identifies a historical pull request, the issue evidence must add
  a fresh `branchNumberOverride` with the inferred number, exact pull request URL,
  `kind: "pull-request"`, approver, reason, approval time, and scan nonce. The guard
  verifies that the pull request is closed or merged and still verifies the separate
  canonical `/issues/<number>` owning issue and handoff. An open pull request cannot
  authorize cleanup, and a matching issue cannot carry this override.
- One recovery proof. Use a retained local branch or `refs/homa/recovery/*` ref at
  the exact HEAD and tree, or an owner-only durable Git bundle. The guard verifies
  the bundle, restores it into a new empty repository with no object alternates,
  runs strict object checks, and compares the restored HEAD and tree.
- One completed task handoff in the task snapshot. A truly old lane with no task
  may instead carry its own `task.legacyTasklessOverride`, bound to the scan nonce,
  plus its own command-line confirmation. An override never covers another lane.

Set `approval.approvedBy` to `sidneyswift`, set `approval.approvedAt` to a current
ISO timestamp after `capturedAt`, write a specific reason, and leave
`approval.scanNonce` and `approval.scanSha256` unchanged. Reinspect with a complete
Desktop task snapshot up to ten minutes old:

```sh
node scripts/retire-damaged-worktree-registrations.mjs \
  --evidence /durable/private/damaged-registration-evidence.json \
  --task-snapshot /durable/private/codex-task-snapshot.json
```

The task snapshot uses the shape shown above and copies the damaged evidence
`scan.nonce` and `scan.sha256` into `retirementScan`. Every task matching any lane
by branch or path must be exactly `completed` with a complete handoff. One active,
waiting, interrupted, cancelled, or otherwise noncompleted matching task blocks
the entire batch before any path moves. For this damaged-registration guard,
`handoff.commitOrPr` must be the exact HEAD or its exact Homa commit URL.

For a taskless lane, add this argument once for that exact path during inspection
and execution:

```sh
--legacy-taskless-confirmation "ALLOW TASKLESS /absolute/legacy-lane/path"
```

The safe inspection result supplies the exact batch confirmation. Start execution
with standard input open. After the slow checks and administrative backup restore
proof, the guard prints `READY_FOR_FINAL_CODEX_TASK_SNAPSHOT`, the expected scan
binding, a random `executionNonce`, and `readyAt`. Export a new complete Desktop task
snapshot at that point, bind it to both the same scan and exact execution boundary,
send the normalized JSON to standard input, and close input within thirty seconds:

```sh
node scripts/retire-damaged-worktree-registrations.mjs \
  --evidence /durable/private/damaged-registration-evidence.json \
  --task-snapshot - \
  --execute \
  --confirmation "RETIRE DAMAGED REGISTRATIONS <set-sha256>"
```

Before reading that final task proof, the guard re-reads the evidence checksum,
recomputes the complete eligible set, revalidates every issue and recovery proof,
and prepares private same-filesystem destinations. Each eligible registration
must have a missing root `.git` entry, Git's exact prunable reason, a matching
administrative record, and an existing local commit for its recorded HEAD. A
directory still at the registered path must be an ordinary directory with no
parent-repository fallback, root or nested Git metadata, bare repository,
symbolic-link boundary, or overlap with the primary checkout or another candidate.

Before READY, the guard creates a collision-resistant owner-only backup root beside
the durable evidence file. It copies every allowlisted administrative file with mode
0600, verifies the complete manifest and exact index bytes, then reconstructs the
administrative record in a disposable same-depth location. The restore test separately
verifies recorded HEAD, committed tree, staged tree, and index checksum. Because
eligible indexes must match HEAD, all indexed objects are reachable through the
already verified recovery ref or bundle.

After the fresh task proof passes, the guard rechecks both the source and backup
manifests using filesystem-only reads. It then moves every surviving directory before
running another Git or network command. This keeps the active-task proof adjacent to
the preservation boundary for the complete batch. If the task proof blocks, the
owner-only backup remains at the exact path named in the error instead of being
silently deleted.

Surviving ordinary directories are atomically moved into owner-only sibling
directories on the same filesystem and kept as `preserved-worktree`; their working
tree inventory is verified again after the move. An already absent path is eligible
only through the exact registration, administrative-record, and dry-run proof. The
guard then recomputes the approved identities and dry-run set before running Git's
metadata-only `worktree prune` with the fixed approved cutoff. A registration created
after capture is too new for that cutoff. Prune deletes the original administrative
record, including its original index file, so the receipt says that explicitly. It
also records the durable backup path, exact index checksum, and successful restore
test. It never claims that prune deleted zero bytes.

After prune, the guard proves that only approved registrations disappeared. It
reports every preserved path, any new registration, and anything that arrived at
an original path during execution. It keeps local and remote branches. If the
operation stops after sealing some directories, the error also reports where
their bytes remain. Inspect those paths before another attempt.

Never substitute direct `git worktree remove` for this path. If missing content
reappears at the wrong moment, that command can become content deletion. The fixed
cutoff and postcondition make official prune suitable for the administrative
records only.

This guard coordinates trusted same-account processes; it is not a security
boundary against a process that can directly rewrite and backdate
`.git/worktrees` records. Keep the repository freeze until the final report is
reviewed.

## Repository governance verification manifest

The focused Node 24 gate runs command-hook, ordinary worktree, and
damaged-registration tests together. The CI command is the source of truth and must
run all three files:

```sh
node --test \
  scripts/git-safety-hook.test.mjs \
  scripts/remove-worktree-safely.test.mjs \
  scripts/retire-damaged-worktree-registrations.test.mjs
```

The suite includes true READY-then-stdin exchanges, prebuffer/replay/time/binding
negatives, cross-executor lock contention, staged-index refusal, administrative
backup restore, collision and late-arrival races, owner-only evidence, large-file
streaming, and an exact 101001-file ignored inventory.

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
5. Post the task handoff and let the lane task reach a finished state.
6. From the cleanup coordinator, export a fresh Desktop task snapshot and remove
   the clean worktree.
7. Delete the proven merged local branch, then any separately approved remote branch.
8. Archive the finished lane task.
9. Recount active lanes and choose the next issue by user value and priority.

## Advisory Claude Code hook

The project hook at [.claude/hooks/block-dangerous-git.mjs](../../../.claude/hooks/block-dangerous-git.mjs)
is a tripwire. It blocks direct worktree removal and common destructive Git forms,
including nested shell text, Git `-C`, hard reset, forced clean, any branch deletion
in combined, separate, or abbreviated option forms, direct worktree remove or prune,
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
