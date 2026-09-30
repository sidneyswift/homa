# Deferred indexing and direct session creation: measured experiment

Implementation: 9787eea9, draft PR #1198, issue #1171. Both previews READY. Astra medium and prompt unchanged. These are six diagnostic messages, not a p95 or production result.

Control: dpl_Ewjepy6M2DBd4y8w5CUpJoZM6ANj. Candidate: dpl_ATrXukmurTVVXdw7Y8U67HkdRDwf. Same code, both switches false for control and true for candidate: HOMA_DEFER_USER_INDEX and HOMA_DIRECT_CREATE. Separate synthetic families with matching fixture data. One new conversation and two continuations per arm. Order: control definition, candidate definition, candidate introduction, control introduction, control reading, candidate reading. No excluded failed or slow samples, no warmup exclusion. Browser sampling independently confirmed visible text; table uses in-app Send-to-DOM timestamps.

| Prompt | Control first visible | Candidate first visible | Control message persistence | Candidate message persistence |
|---|---:|---:|---:|---:|
| definition | 15.34 s | 8.30 s | 757 ms | 148 ms |
| intro | 6.22 s | 15.05 s | 564 ms | 44 ms |
| reading | 16.23 s | 14.39 s | 503 ms | 52 ms |

Mean first visible: control 12.60 seconds, candidate 12.58 seconds. This tiny difference is not evidence of an overall improvement. The individual persistence stages were about 0.45 to 0.61 seconds shorter, averaging 0.53 seconds, but these are small unrandomized samples and other work varied.

## Verified behavior

- Control new-session trace contains a 176.9 ms hook.resume call; candidate create request does not. Continuations still resume correctly.
- All three candidate user-message preparation traces omit embedding work. Canonical messages and pending markers exist before indexing.
- The actual worker and embedding provider were invoked against only the experimental fixture after all six response measurements completed. Before: three user messages pending and zero indexed. After: all three indexed, zero pending, zero retries. Preview cron does not run automatically, so this proves the worker, not production scheduling.
- Additive migration 20260917120000 applied and verified on kzplntcdtsvdowntvlza. Production application deployment unchanged; sign-in HTTP 200 after migration. No old rows backfilled.
- Disposable PostgreSQL verifies atomic save/queue, exclusive worker claims, expiring crash lease, failed-provider retry, completion, wrong-family rejection and replay.
- 294 continuity tests passed, including the new indexing/runtime tests. Focused tests: 18; explicit new-session tests: 2. Typecheck, Eve build and stream-duration guard passed. Lint has five pre-existing warnings and zero errors. Tenant-isolation guard passed.

## What dominates now

Definition: provider invocation to first answer text was 9.41 seconds in control and 2.10 seconds in candidate. Introduction: 3.13 seconds in control and 12.94 seconds in candidate. These differences dwarf the removed preparation work and reverse direction. They are provider-stream timings, not pure model-compute measurements.

Reading help also triggered multiple model steps: three step-start events in control and two in candidate. It is therefore not a clean single-model-call benchmark, even though the user's question sounds simple. Do not attribute all of its elapsed time to its final model call.

Candidate new-conversation startup was still slow: binding completed at 1.81 seconds, turn-start event at 5.48 seconds, first model-step event at 6.29 seconds. Removing the failed lookup did not eliminate the workflow activation delay. Improved tracing now exposes hook.resume, queue.publish, step hydration/dehydration, workflow route spans and safe queue/initialization numeric fields. Some platform operation names and scheduling gaps remain unresolved.

## Decision

Keep the changes on the experimental preview and draft PR; do not claim the five-second target or a production performance win. The targeted work is removed safely, but overall latency is not solved. Next bounded experiment should isolate the remaining workflow path with identical full Homa context and persistence; separately evaluate why apparently simple requests use extra model steps. No additional repetitions are justified merely to obtain a better average.

Rollback: turn off HOMA_DEFER_USER_INDEX and HOMA_DIRECT_CREATE. Keep the worker draining already queued rows. Keep the additive column in place; removing it would break the new canonical writer. Automatic once-per-minute worker execution still requires production deployment verification before rollout completion.

Both exact synthetic fixture families were retired and credential files removed with cleanup-verified receipts. Test browser tabs were closed.
