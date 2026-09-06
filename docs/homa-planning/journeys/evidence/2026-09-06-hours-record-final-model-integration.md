# #1095 final bounded model integration

**All three requested cases passed.** This run made no repository edits and preserved the earlier eight-case and routing samples. Its source is clean commit `cb0c8a810fcd4c55f746644d1f8e9520e1b0f227`, including the new `hours-records` and main's `family-librarian` skill. Root's later five-source compatibility correction is a separate deterministic review, documented below; no model rerun is claimed for that correction.

## Executed evidence

| Run | Result | Exact scope |
| --- | --- | --- |
| `family-counts-shared-once` | Pass | Actual current tool and receipt validator, 93-tool menu, synthetic authenticated SQL snapshot, independent semantic model judge |
| `incomplete-read-honest-refusal` | Pass | Same full-menu harness; unavailable read remains incomplete, with no guessed totals or day count |
| `hours-read/routing/0000`, read-positive | Pass, all 5 assertions | Actual Eve runtime, ordinary hooks/skill discovery, real new SQL reader, disposable Walker PostgreSQL |

Both direct cases called `load_skill(hours-records)` then `find_hours`. The family response gave 215 family minutes with shared counted once, Avery 155 and Riley 110 with shared included, and explained why child totals cannot be added to recover family time. The unavailable-read response refused to give Avery a total/day count rather than interpreting absence of a result as zero. Deterministic and semantic finding arrays are empty in both saved transcripts.

The actual Eve case was selected by listing routing eval IDs offline, then running only `hours-read/routing/0000` with concurrency 1. It loaded `hours-records` once and called `find_hours` once for Maya, September 1 through 6, includeShared true. The current SQL returned a valid complete zero receipt; Eve said nothing was logged and did not infer that no learning happened. The unchanged Walker seed contains no Hours rows, so this is a real empty-record integration proof, not populated shared arithmetic proof. Populated arithmetic is covered by the direct synthetic snapshot cases and separate PostgreSQL fixtures.

There were no unrelated tools, subagents, user-input requests, or external write tools in the observed Eve trace. The runtime retained its normal fleet capabilities; this report does not claim a narrow server-side tool allowlist. The canonical sandbox applied 193 migrations, seeded its own Walker family, used an ephemeral artifact server, and removed the cluster. It did not access hosted Auth/PostgREST or production families.

## Source and environment

`source-manifest.json` pins 14 critical source/build files. `fleet-skill-manifest.json` pins all 14 current skill bodies. Direct menu evidence is `direct/menu.json`. Root's fresh compiled manifest was copied before the direct runs. Eve's ordinary runtime then compiled inside the temporary archive. Its runtime snapshot independently matches:

- Reader: `361e42532c01dcbaaed87f50393eefc726a7005689b4240e8c76cae1a93ef35e`.
- Tool: `d2a80727b2114b8f6d3e615902915025ea0712dee2b522d8a1ad3721bd717ada`.

The source mirror came from `git archive HEAD`, without `.git` or environment files. Installed dependency symlinks are recorded in the manifest. The wrapper exports only an allowlisted process environment and Vercel OIDC to model runs; no production DB, Blob, messaging or other provider credentials are passed. The canonical eval sandbox/config retains its normal isolation. OIDC values were neither persisted nor printed. Node was 24.18.0. The initial file-path CLI list filter returned no matches; the corrected ID filter listed five tests, of which exactly one executed. The failed offline list log is preserved.

## Tokens and reported cost

| Run | Input tokens | Output tokens | Total | Reported Gateway dollars |
| --- | ---: | ---: | ---: | ---: |
| Two direct cases, including their two judges | 424,105 | 1,414 | 425,519 | $0.862350 |
| One actual Eve case, three completed steps | 216,402 | 640 | 217,042 | Unavailable |
| Total | 640,507 | 2,054 | 642,561 | Known $0.862350 plus unreported Eve cost |

Direct cost sums reported `cost` once per candidate step and judge, not both `cost` and `marketCost`. Eve usage comes from its three unique `step.completed` events, not duplicated session summaries. Eve reports 143,304 cache-read and 73,092 cache-write tokens; its artifacts expose no dollar cost. There were six direct candidate calls, two direct judge calls, and three Eve model steps. No additional calibration or full matrix repetition was executed.

## Five-source follow-up review

After these model runs, root discovered that migration `20260709233000` already permits email and dispatch in addition to chat/sms/call. My prior source-compatibility statement was wrong and has been explicitly corrected in `/tmp/homa-feedback-implementation/1095-summary-independent-review.md`; its prior bytes are preserved here. Root's new shared exact source type/schema and web row/archive/CSV mappings correctly preserve those five stored values and reject invented ones. I inspected the ten-file diff and independently ran the two focused source-preservation tests: 2/2 passed. The incorrect unquoted CSV test expectation was reported and is fixed in the reviewed diff. Actual source hashes, diff, test log and review timing are saved separately; root owns the expanded PostgreSQL/type/build acceptance.

The inspected native Hours reader still maps email/dispatch to Chat and displays that source. This pre-existing compatibility limitation was sent to root. No claim of native device behavior, native parity, physical print, hosted deployment, production migration or hosted model verification is made here.

## Artifacts

- `direct/*.json`: both complete candidate/judge transcripts, menu, summary, cost receipt.
- `eve-routing/`: original Eve summary/results/events and independently asserted `verification-receipt.json`.
- `direct.log`, `routing.log`, `list.log`, `selected-routing.json`: exact bounded execution evidence.
- `oidc-runner.py`, `run-direct.ts`, `*-environment-receipt.json`: wrapper and environment boundaries.
- `source-manifest.json`, `fleet-skill-manifest.json`: pre-follow-up source pins.
- `source-correction-reviewed.diff`, `source-correction-review-receipt.json`, `source-correction-units.log`: later deterministic review, not silently substituted into model evidence.
- `bundle-manifest.json`: hashes of frozen result artifacts, excluding regenerable temporary runtime/dependency trees.
