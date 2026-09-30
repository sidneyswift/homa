# Family Drives implementation notes

Owner: Codex chat `01a0e758-1083-7a82-9088-5331d82ce067`, issue #1199.
Branch: `codex/gh-1199-family-drives`.
Checkout: `/private/tmp/homa-family-drives`.

## 2026-09-28: Plan-confirmed

The founder authorized the researched pilot. Begin with synthetic Drive
persistence, concurrent writer, snapshot, and cleanup checks before enabling
family data. The proposed product uses one lazy-provisioned workspace per family,
bounded tools, existing Library/Binder flows, and Postgres/Blob authority.

## 2026-09-28: Discovery

Sandbox SDK 3.5.1 exports `Drive` and mount types. Homa's installed eve bundle
does not. Use a separately pinned SDK without upgrading eve. Existing PDF page
text caching already lives in Postgres and will remain authoritative.

The managed worktree tool returned `Git is unavailable`. Git works with
`DEVELOPER_DIR=/Library/Developer/CommandLineTools`, so an isolated manual worktree
was created from refreshed origin/main, commit
`2e67c7f13a0e67b3b8d726c6615180dc94db71ce`. The primary checkout is newer and was
left unchanged. The local OIDC token was expired and refreshed using the existing
token-only script, without exporting or replacing other environment variables.

## 2026-09-28: Implementation and local evidence

The live provider probe passed persistence, writer exclusion, point-in-time
snapshots, and exact cleanup. An active-writer snapshot missed an acknowledged
write, so reads use a new writer mount and success waits for writer stop. The
checkpoint/metadata write precedes the Drive mirror, making an ambiguous write
recoverable. Production activation remains off and fixture-only.

Thirteen service tests pass, including cross-family denial, stale updates, ambiguous
DB responses, failed mirror retries, and isolated-eval refusal. Disposable
Postgres tests pass for real scoped SQL, quota races, compare-and-set races, RLS,
and unsafe family-fold refusal. All 13 existing account deletion integration
tests pass with additional workspace cascade and repeat-sweep assertions.

The spec and release gates live in
[the plan](../homa-planning/plans/2026-09-28-family-drives.md).

Both model-backed evals passed with six gates. The actual service passed a real
Drive probe against disposable local Postgres, including idempotent retries,
rebuilding a deleted Drive, and final cleanup. The probe exposed and fixed an
SDK mkdir retry error. Checkpoints in that probe were in memory; hosted private
Blob acceptance is still a release gate, not an implied result.

The refreshed tenant-isolation guard passed. Typecheck, focused lint, fleet-skill
hygiene, event registry, migration uniqueness, deadline guards, and the seeded
co-deployed eve build/stream guard passed. Documentation reconciliation remains
red: the historical immutable manifest has broad drift, including the two new
pilot documents not registered there. It is not a required CI gate.
