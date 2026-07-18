# Recovered Task 2

Status: DONE

Recovered the final reviewed Task 2 implementation into the isolated
`feat/subject-lessons` worktree only:

- added the additive `public.subject_lessons` migration without applying it;
- recreated subject lesson types, runtime JSON decoding, exact feature flag,
  canonical source fingerprinting, and focused tests;
- recreated the durable family-scoped store and all reviewed transaction,
  idempotency, retry, completion, token-read, and planner-read behavior;
- restored the isolation guard's anonymous, own-family, cross-family,
  server-write-only, cascade, and public-table coverage probes; and
- documented `HOMA_SUBJECT_LESSONS_ENABLED` in the safe environment template.

## Final reviewed behavior

The recovered store includes every later reviewer fix:

- The family-scoped child row is locked before report facts, subject answers,
  target selection, fingerprinting, or current-row comparison.
- Retry claims recover a trusted unattached material by
  `generation.input.lessonId` before later code can generate another
  worksheet.
- Normal attachment and both recovery paths share one SQL review predicate.
  A JSON boolean `generation.review.pass = false` is rejected, while true,
  missing, SQL null, and JSON null remain eligible.
- Permanent report-token reads return current ready lessons only and expose a
  bounded view without runtime session id, attempt count, internal error code,
  idempotency key, source fingerprint, or supersession state.
- `getSubjectLessonStateByTokenForFamily` provides the separate
  authenticated-family state seam for later owner-authorized routes.
- Runtime session writes require the matching attempt number.
- Postgres JSONPath checks reject non-string `materials` and `steps` entries.
  Store rows decode unknown JSON before crossing the typed boundary.
- `HOMA_SUBJECT_LESSONS_ENABLED` enables access only for the exact string
  `"true"`. Every store export returns before `mapDb()` when disabled.

## Files recovered

- `supabase/migrations/20260715210000_subject_lessons.sql`
- `apps/web/lib/subject-lessons/types.ts`
- `apps/web/lib/subject-lessons/flag.ts`
- `apps/web/lib/subject-lessons/fingerprint.ts`
- `apps/web/lib/subject-lessons/fingerprint.test.ts`
- `apps/web/lib/subject-lessons/store.ts`
- `apps/web/lib/subject-lessons/store-contract.test.ts`
- `scripts/isolation-check.mjs`
- `apps/web/.env.example`
- `.superpowers/sdd/recovered-task-2.md`

Task 1 files and the pre-existing `pnpm-lock.yaml` modification were not
changed during this recovery.

## Origin compatibility

The worktree branch points one commit behind `origin/main`. The only current
origin commit ahead is the Eve standalone stream-duration CI fix. A read-only
comparison confirmed that it does not change Task 2's environment template,
isolation guard, database client, package scripts, or migration baseline, so no
origin change needed to be copied into this scoped recovery.

## Verification

Focused Task 2 tests:

```text
pnpm exec tsx --test \
  apps/web/lib/subject-lessons/fingerprint.test.ts \
  apps/web/lib/subject-lessons/store-contract.test.ts

tests 10
suites 2
pass 10
fail 0
```

Web typecheck:

```text
pnpm --filter web typecheck
PASS, exit code 0
```

Isolation script syntax:

```text
node --check scripts/isolation-check.mjs
PASS, exit code 0
```

The dynamic isolation guard was attempted and correctly reported unavailable:

```text
pnpm check:isolation
Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
exit code 2
```

The isolated worktree intentionally has no secret-bearing `.env.local`, so
dynamic RLS and cascade probes could not run. The guard syntax and focused
source contracts pass.

No migration was applied. No commit, push, deployment, environment value, or
shared-checkout file was changed.
