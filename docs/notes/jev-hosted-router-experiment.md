# Hosted router comparison, September 18, 2026

Status: completed bounded preview experiment. No production activation. PR #1198 ships the experiment with production routing disabled.

## Result

Measured 16 actual browser messages: four questions, repeated twice, across two synthetic accounts. The timer starts immediately before the Send click and ends at the first observed answer text visible in the viewport. Reasoning, status indicators, and HTTP acknowledgements do not count.

| Measure | Astra medium only | Jev router, Luna low when eligible |
|---|---:|---:|
| Average | 10.84 s | 8.38 s |
| Median | 11.23 s | 6.23 s |
| Under five seconds | 0/8 | 2/8 |
| First message | 17.48 s | 14.48 s |
| Average after first message | 9.89 s | 7.50 s |
| Slowest | 17.48 s | 16.67 s |

Routing was faster in six of eight paired comparisons. Mean reduction was 22.7%. This small, unblinded, single-account-per-arm pilot does not estimate a reliable p95 or establish performance for all families.

## Matched questions

| Pair | Question | Astra only | Router enabled | Actual candidate answer model |
|---|---|---:|---:|---|
| 1 | Introduction | 17.48 s | 14.48 s | Luna |
| 2 | Number bond | 11.76 s | 5.09 s | Luna |
| 3 | Phonemic awareness | 10.71 s | 9.62 s | Luna |
| 4 | Counting game | 14.70 s | 4.42 s | Luna |
| 5 | Introduction repeated | 5.11 s | 4.26 s | Luna |
| 6 | Number bond repeated | 6.10 s | 5.82 s | Luna |
| 7 | Phonemic awareness repeated | 6.45 s | 6.65 s | Astra |
| 8 | Counting game repeated | 14.38 s | 16.67 s | Astra |

## What the traces establish

- All ten baseline provider calls used Astra. Candidate used Luna for the first six turns and Astra for the last two. Authenticated database usage records and deployment timing logs agree.
- Jev decisions took 156 to 364 ms. The six Luna calls produced first answer text in 1.37 to 2.18 seconds after the provider timer began.
- Candidate turns seven and eight had `context_requires_astra`, so Jev was not called. The present guard rejects non-text conversation parts and serialized conversation over 12,000 characters. Logs do not distinguish which condition triggered. Do not assert a specific cause without adding bounded structural diagnostics.
- Candidate first turn: approximately 12.74 seconds elapsed from Send to the routing call, 0.25 seconds to route, 1.37 seconds from the answer-model invocation to first text, and about 0.12 seconds from server first text to browser observation. Cross-process wall clocks make these approximate. This is not evidence that all pre-model time belongs to Vercel.
- Baseline counting-game turn four and candidate counting-game turn eight called `load_skill` and `explore_child_map` before answering. Both ended with a clarifying question instead of supplying the requested activity. Their timings measure first visible answer, not successful completion of the requested activity.
- Generic agent telemetry still labels the wrapper's base model as Astra; use `model.route` and stored model usage for the actual selected model.

## Quality review

Manual, unblinded review found the introductions and short definitions responsive and substantially correct on both arms. Luna's first counting-game answer supplied a practical activity with socks, blocks, or spoons. Astra's counting-game replies asked about the child's current counting ability; the final candidate reply did likewise after reverting to Astra. This is preliminary review, not a qualified evaluation of teaching, safety, worksheets, or consequential advice. No claim that an acknowledgement equals a completed useful answer.

## Controls and limitations

Both previews ran commit `01bb7cc48870a8b0a4be62ddbaed00c6896014cf`.

- Control: `dpl_49wdka9bPsnYKc9CKzSLTHgPZ9NW`, https://homa-av1rissl6-homa-1d878b0e.vercel.app. Router and preparation experiment flags absent, corresponding to disabled defaults. Route logs confirm disabled.
- Candidate: `dpl_AtaRGkKTdbMK9h7Pn3ZEQRPN2E1p`, https://homa-gte0ht35e-homa-1d878b0e.vercel.app. Router set to Luna, other preparation experiment flags false.
- Two newly created sandbox families with equivalent synthetic adult/child context. Required isolation guard passed before creation. No real family conversation was used.
- Fixed budget of 16 messages, no warmup messages or replacement samples, alternating arm order. Both accounts received identical question order, but model answers and tool use naturally diverged.
- Initial plan specified fresh sessions; after the first pair, the plan was amended because Homa exposes a continuous chat. All eight messages per arm belong to that account's continuous conversation. Repeated prompts, context growth, prompt caching, and server warming are not independently controlled.
- Every browser sample completed with visible document state and no observation gap over one second. Largest gap across the batch was 580 ms; this is sampled DOM evidence, not physical paint measurement.
- Both accounts produced eight user and eight assistant records. Both exact test families were soft-retired; synthetic Auth identities and credentials were removed. Cleanup independently verified.
- CI build, Vercel preview, database, browser, brand, and end-to-end checks passed. Two other checks failed: a source-shape assertion in `chat-client-boundary-watchdog.test.ts` and upstream literal punctuation in `patches/eve@0.19.0.patch`. Overall required gate is failed. Both check failures were subsequently repaired without changing runtime behavior. Fresh CI and deployment verification are required before merge.

## Bounded next step

Keep production on its existing setting. Before another timing batch, distinguish the router's structural fallback reasons and qualify long-conversation routing without dropping relevant context or tool results. Then compare a small held-out set of simple follow-up requests in established conversations, with actual model choice recorded. Verify the repaired validation checks before merge. Do not broaden the model roster or keep rerunning this same batch to chase a five-second headline.

Evidence: `summary.json`, `plan.json`, and `cleanup.json` alongside this report. Full synthetic samples, database verification, and deployment log exports are retained in `/private/tmp/homa-router-app-20260918/`.
