# Hosted workspace timing, September 13, 2026

Status: diagnostic completed on protected previews; five-second goal not achieved. [Issue #1171](https://github.com/sidneyswift/homa/issues/1171), draft [PR #1191](https://github.com/sidneyswift/homa/pull/1191). Instrumentation commit `b8be1a95ea9577cc96d75b70385d7a15cec33fcf`, owned branch `codex/gh-1171-inline-turn-preview`. No production change was made by this experiment.

## Finding

Workspace acquisition was not the main delay in this run. On the corrected preview, its four measured acquisitions took 163–388 milliseconds, skill-body reads took 56–1,740 milliseconds, and state capture rounded to zero milliseconds. The previous 15.852-second load_skill outlier did not recur, so its cause remains unresolved.

All six corrected hosted replies missed five seconds, including the simple definitions. Send to first provider invocation took 2.887–7.067 seconds. Counting requests made three successive chat model calls before the question appeared; recording the follow-up observation and returning an activity made five calls, plus model interpretation within the progress tool. The first family's second model call took 13.174 seconds to complete, with its first model output at 12.153 seconds. Tool time and provider time must not be conflated.

These observations prioritize reducing preparation and model round trips, and testing first-output request racing inside the real agent. They do not prove that racing will meet the target, justify bypassing canonical evidence or verification, or establish a p95 from six samples.

## Instrumentation and verification

`apps/web/lib/observability/chat-sandbox-timing.ts` decorates Eve's public sandbox backend only when both the preview environment and `HOMA_PREVIEW_SANDBOX_TIMING=1` are present. It preserves the backend name, prewarm inputs, create inputs, method receivers, session methods, state capture and disposal. Logs contain only operation, acquisition id, Eve session correlation, timestamps, duration, outcome and a reconnect-metadata-presence boolean. They contain no file path, file content, credentials or reconnect metadata.

The installed Eve Vercel backend's create operation reads the template, finds or creates the session and obtains its SDK handle. File reading includes the remote read and decoding; it is not an isolated disk-speed measurement. A reconnect-presence flag does not prove the process was warm. The additional instrumentation does not identify individual Vercel infrastructure phases or the pre-create runtime-key/template-lock interval.

Three focused tests passed against real local just-bash seeded reads, writes, missing-file behavior and reconnect, plus acquisition error/logging failure and disabled/production identity checks. App typecheck, changed-file lint, Next build, hosted-shape Eve build and the streaming-duration guard passed. An initial restricted build could not bind its compiler worker port; that failure and its cached repeat are retained. Clearing only the owned regenerable Turbopack cache allowed the complete build to pass. Source-only Vercel builds subsequently reached READY; no prebuilt deployment was used.

## Environment mismatch retained

The first preview was `dpl_5u2QH2fCvuBvYVLkYebk63C59Tny`, [protected preview](https://homa-71f1ja7ma-homa-1d878b0e.vercel.app). Its first two browser observations were 19.117–19.189 and 25.602–25.673 seconds. The follow-up could not save Progress. The Vercel project configuration showed `HOMA_LIVE_PROGRESS_ENABLED` scoped only to production, and the preview's tool correctly followed its disabled path. This is a preview mismatch, not evidence of a production outage.

That six-slot protocol was stopped after two attempts, with four explicitly unattempted slots. Both observations, the unavailable answer, metadata and timings are preserved; neither was silently retried. The first workspace acquisition there took 374 milliseconds and its first read 1,134 milliseconds. Two reconnect acquisitions took 963 and 321 milliseconds, with reads of 103 and 52 milliseconds.

A Progress-only corrective build reached READY as `dpl_ErD8ZLmVnrN9QdZC3rzDU493o6Qp`. Before sending messages, source review also identified `HOMA_CLAIM_EXTRACTION_ENABLED` as necessary for model interpretation of the observation. No messages were sent to that intermediate deployment.

The final corrected preview explicitly enables both Progress and claim extraction in runtime and build settings. Other production-only feature flags are not presumed equivalent, and this remains a diagnostic, not a production-parity acceptance batch. No project-wide or production flag was modified.

## Corrected hosted run

Deployment: `dpl_DDdxzt3YPZxUezF8u68D153Ax41p`, [protected preview](https://homa-boqf4h1un-homa-1d878b0e.vercel.app). The frozen protocol uses Astra medium, Eve 0.19.0, AI SDK 7.0.14 and Node 24. Two fresh synthetic families each receive counting, follow-up observation/activity request, and one-sentence phonics definition. The unused second family from the interrupted batch remained fresh and was reused as corrected family B; corrected family C was newly created. Each family finishes and signs out before the next signs in on the same origin.

No health warmup, artificial Ready message, automatic retry or excluded first-use sample. The continuous browser observer retains bounded first-visible-text intervals, visibility and coverage. It measures sampled visible DOM, not physical screen paint. Every observation has no gap over one second; the largest gap was 343 milliseconds.

Seconds, except the model-call count:

| Family | Prompt | First visible text | Send to provider | Chat model calls | Model wait to final-step first output |
|---|---|---:|---:|---:|---:|
| B | counting | 29.903–29.971 | 7.067 | 3 | 19.971 |
| B | followup | 28.272–28.346 | 2.998 | 5 | 16.790 |
| B | phonics | 8.670–8.740 | 6.416 | 1 | 2.118 |
| C | counting | 18.376–18.445 | 6.191 | 3 | 8.812 |
| C | followup | 27.729–27.807 (save notice) | 3.555 | 5 | 28.620 |
| C | phonics | 7.946–8.015 | 2.887 | 1 | 5.063 |

The last column sums completed earlier chat model requests and the final step's first provider output. It excludes time executing tools, including their own model calls, and excludes app transport/rendering. It is not an additional independent stage to add to first-visible time. For family C's follow-up, visible text began during an earlier model step, so that column describes the later final activity, not the earlier save notice.

Family C's 27.807-second first text was a save confirmation and a checking notice. The activity arrived later, with the completed UI showing Worked for 43 seconds. A later UI snapshot proves the activity appeared but does not establish its precise first-visible time. The notice is not treated as meeting the useful-activity target. All six samples already exceeded five seconds even at first text.

The two first-use skill acquisitions/reads were 300/794 and 388/1,740 milliseconds; the two follow-up acquisitions/reads were 196/78 and 163/56 milliseconds. Progress recording occupied 5.863 and 5.134 seconds. Subsequent canonical map reads took 734 and 120 milliseconds, and activity verification took 189 and 66 milliseconds. These operational timings come from distinct boundaries and workers; millisecond-level differences between the enclosing tool interval and nested log intervals are not an exact partition.

All 18 chat model calls have corresponding start/end timing records and scoped usage rows. All 12 tool calls completed. Six user messages and six assistant messages were verified in the canonical server table, family scoped and indexed. Both follow-ups displayed server-generated Progress updated cards and produced a counting-socks activity after a verifier call. The final activity wording referred to the parent's current report and date but did not explicitly distinguish model-matched evidence, so this run does not certify the separate provenance-copy requirement. No broader quality or isolation certification is inferred from these diagnostic samples.

Both corrected accounts and the interrupted account were signed out; this run's tabs were closed after completion. Synthetic fixtures are retained with their receipts, not retired. No user chat or unrelated workflow was stopped.

## Next experiment and limits

A safe app race must let only one model stream reach tool execution and durable conversation output, while preserving that complete stream's tool and answer protocol. The previous text-only screen cannot be reused unchanged: a valid tool request can precede text, and provider-executed tools may act before selection. Use the main agent's model boundary, keep specialist/voice overrides separate, and test cancellation, single execution, partial failures, usage reporting and provider-tool behavior before hosted comparison.

Separately, the multi-call sequences create a floor that request racing alone may not remove. Inspect skill selection and preparation for avoidable repeated work while retaining exact current evidence, authenticated ownership, save receipts and activity verification. Do not count a progress notice as a useful answer, lower Astra's requested medium effort, or hide a failed save to manufacture a five-second result.

Local evidence: `/private/tmp/homa-eve-hosted-b8be1a95/` contains immutable source staging, build/deployment receipts, both frozen protocols, all eight attempted samples, interrupted-slot accounting, family-scoped metadata, segmented raw logs, deduplicated timing records, UI snapshots and analyses. Build checks are in `/private/tmp/homa-five-second-active/sandbox-timing-experiment/build-receipt.json`. The task artifact `ttft-workspace-timing-summary.json` preserves a sanitized corrected summary and protocol; it is a derived summary, not the full raw receipt. Local temporary files are not shared permanent evidence storage.

Production was rechecked after the experiment: `dpl_HJ8w7KiwbdjFEcPxeorznh9mDQ7i`, READY, source `2e67c7f13a0e67b3b8d726c6615180dc94db71ce`, unchanged from the start receipt.
