# Family working files with Vercel Drives

Issue: [gh#1199](https://github.com/sidneyswift/homa/issues/1199). The issue owns
rollout status. The founder authorized the researched pilot on September 28.

## Parent-facing capability

A parent asks Homa to keep a named working draft, then returns in another chat
to read, revise, rename, or remove it. Both adults in the authenticated family
share that file. Example: a curriculum-grounded week-two outline becomes a
worksheet through the existing materials-studio and Binder flow. A workspace
file does not establish curriculum provenance; Homa reopens its Library source.

The existing family-librarian fleet skill owns the procedure, source judgment,
conflict reconciliation, and honest failure behavior. Its working-files reference
routes to one bounded deterministic tool, `manage_workspace`. No changes to the
always-on prompt or arbitrary bash/write_file access are required.

## What Drives solve

Vercel's [Drive documentation](https://vercel.com/docs/sandbox/concepts/drives)
describes a persistent filesystem that can be mounted in successive sandboxes.
This avoids copying a complete working tree into each new execution environment.
Drives are project-scoped and region-bound. A Drive admits one read-write sandbox;
read-only snapshots can be mounted concurrently but do not follow future writes.
A mount alone provides neither Homa family authorization nor a Library browser.

The [synthetic provider receipt](../journeys/evidence/2026-09-28-family-drives/provider-probe.json)
verified creation, read/write, rejection of a second writer, persistence into a
new sandbox, frozen snapshots, and cleanup with SDK 3.5.1. A live snapshot did
**not** see an acknowledged write until the writer stopped. Homa therefore stops
the writer before returning success and does not use snapshots for current reads.

## Scope and storage contract

- One lazily created Drive per family and environment, with an opaque deterministic
  name. Every family identity comes from `resolveAgentAccess`, never tool input.
- Production pilot only, off unless `HOMA_FAMILY_DRIVES_ENABLED=true`. Even with
  the flag enabled, only existing disposable `families.sandbox=true` fixtures
  qualify. Real-family activation requires a subsequent rollout change.
- Text drafts under `drafts/`, in Markdown, plain text, CSV, or JSON. Maximum
  64 KiB UTF-8 per file and 100 active files per family/environment. Provider
  capacity is capped at 1 GiB in `iad1`.
- Postgres owns the index, revision, hash, and checkpoint URL. Private Blob owns
  immutable checkpoint bytes. The Drive is a recoverable working copy. These
  preserve BUILD.md's storage laws; the ordinary eve sandbox remains scratch.
- Uploaded originals stay in Library; finished materials stay in Binder; memories,
  progress, calendar and Hours records retain their existing typed storage.
  Private adult chats and voice transcripts cannot be copied into shared files.
- No parent file browser, arbitrary code execution, scheduled file maintenance,
  original-upload migration, or fleet activation ships in this pilot.

## Runtime and security

Homa's eve 0.19.0 bundle does not expose Drive mounts. A separately pinned
`@vercel/sandbox@3.5.1` provider opens short-lived, deny-all network sandboxes.
The existing agent sandbox and disabled bash/write_file tools stay as they are.
The tool reuses Homa's per-instance limiter at 12 operations per minute per family;
this is a burst safeguard, not a global billing cap.
Each operation acquires the Drive's exclusive writer and stops/deletes its
sandbox before success. A busy response changes nothing and can be retried.

The tool cannot select a family, provider name, region, or mount path. Logical
paths are validated, while actual files use UUID directories and SHA-256 names.
Reads verify bytes against the family-scoped database row; missing or mismatched
Drive bytes are restored from a verified private checkpoint. New checkpoints are
written before the database compare-and-set. A retry with the same write ID and
content repairs a missing mirror without creating another file revision.

Postgres serializes quota allocation with a family-row lock and rejects stale
revisions. The new table has RLS enabled and no browser/anonymous grants. Every
lookup and mutation scopes family and environment. The normal artifact deletion
fence checks access before and after external work. A late allocation after
revocation is removed; failed cleanup remains retryable through deletion sweeps.

Isolated evals cannot allocate or delete provider resources using their model
OIDC token. CI uses injected storage adapters and disposable local Postgres.
The explicit live probe uses a new synthetic family in local Postgres, real Drive
operations, and an in-memory checkpoint adapter. It never starts the agent or
accesses production family records. It is an operator command, not a CI eval.

## Lifecycle

Explicit file removal tombstones its row, removes private checkpoints, and erases
its provider object directory. Repeating removal finishes interrupted cleanup.
Account deletion cascades the index and cleans exact family Drive names for every
namespace, including recurring post-deletion sweeps. Cleanup runs even with the
feature flag off. A workspace-bearing family cannot be folded as an empty signup
stub, preventing silent loss or incorrect ownership transfer.

The existing account export includes verified text contents, paths, and revisions.
Downloads remain behind the authenticated private family-file proxy. No public
Blob URLs or direct provider paths are returned by the tool.

## Recorded acceptance

The [service receipt](../journeys/evidence/2026-09-28-family-drives/service-probe.json)
passed with real Drive operations and the actual service/index code: fresh-sandbox
read, idempotent retry, reconstruction after Drive deletion, rename, remove, and
cleanup. Checkpoints in this probe used an in-memory adapter, so this does not
claim a hosted private Blob integration test. The first service probe exposed
non-idempotent `mkDir`; the corrected implementation uses recursive `fs.mkdir`.

The [model eval receipt](../journeys/evidence/2026-09-28-family-drives/evaluations.json)
records both passing evals: requested-file routing with honest unavailable output,
and an adversarial quoted instruction requesting private transcript export.

## Verification and release

Required local checks include workspace unit tests, disposable PostgreSQL races
and browser-role denial, account-deletion regressions, model-backed positive and
adversarial routing, typecheck/lint, fleet-skill and tool-deadline guards, and the
co-deployed eve build plus stream-duration guard. CI runs the workspace unit and
Postgres suites. Provider receipts use only synthetic data and record cleanup.

The migration is additive. Ship it before enabling the flag. Roll back activation
by disabling the flag; keep checkpoint export and cleanup available. Do not drop
metadata or delete files as rollback. Existing production tools must continue
working before and after the migration.

Pilot acceptance needs a READY deployment plus an authenticated fixture-family
write/read from separate chats, an actual private Blob checkpoint round trip,
account export, deletion, and measured latency/cost. Local provider acceptance
and preview build status do not establish those hosted results. Full-family
rollout remains on gh#1199 until the hosted pilot passes.
