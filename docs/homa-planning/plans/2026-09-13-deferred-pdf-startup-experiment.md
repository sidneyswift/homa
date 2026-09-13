# Deferred PDF startup experiment, September 13, 2026

Status: protected-preview experiment complete; the five-second target remains unmet. Tracked by [#1171](https://github.com/sidneyswift/homa/issues/1171). Corrected implementation: `c734aa8f4466261fda6714467a6c8ccc64c6b2fe`. No production deployment or runtime upgrade was made.

The acceptance boundary remains Send to the first visible useful answer within five seconds for 19 out of 20 normal replies, with Astra medium. Preparation, hidden reasoning and transport count. This small diagnostic screen does not establish a p95 or a reliable causal improvement.

## Change and verification

Ordinary chat previously imported PDF.js and its worker when the shared agent service loaded. The corrected implementation defers both until a PDF is read or rasterized. Concurrent first readers share one loading promise; a failed load is retryable. It preserves the packaged worker registration, native canvas and existing PDF parsing/rendering boundaries. Both environments in this source use asynchronous loading. Only protected previews received the changed source.

Literal dynamic imports live together at the module boundary so Eve can include the dependencies in its deployment package. An initial opaque `createRequire` implementation passed locally by resolving dependencies from ancestor workspace folders, but omitted PDF.js from the function package. That version was rejected before deployment. The new package checker copies the server and workflow function packages outside the workspace, verifies their dependencies resolve inside those copies, and parses and renders a real red-square PDF with a pixel check. Both isolated packages passed.

A subsequent experimental eager control used synchronous `require` for the PDF ES module. Local Node 24 accepted it, but Vercel's module wrapper rejected it with `ERR_REQUIRE_ESM`. Its first Send never reached admission, displayed `Not sent`, and had no answer through the 90-second observation cap. The paired delayed version answered in 11.357 to 11.426 seconds. The eight-slot screen was stopped after those two attempts, leaving six unattempted. This failed control is retained and is not a valid latency comparison. Commit `c734aa8f` removes the incompatible eager path entirely.

The corrected source passed 18 PDF reading/startup tests, typecheck, focused ESLint, full Next and Eve builds, the stream-duration guard, and the isolated package checks. A real hosted PDF check on the exact corrected deployment produced a PDF and preview, with `generation.render.renderer = pdfjs-raster`, not the screenshot fallback. Material: `836f3beb-4807-4786-af70-d83755463492`, scoped to the owned synthetic family. The agent first requested acceptance of the required footer; one explicit follow-up completed creation. Those two supplementary Sends are excluded from the eight-slot comparison.

## Corrected hosted comparison

Both arms use Eve 0.19.0, AI SDK 7.0.14, Astra medium and deferred user indexing. Priority, inline-turn and chat warmup switches are off. Each starts with a fresh, identically shaped synthetic family. No health warmup was sent.

- Control: source `5ef8844d38e2ee3f1131e511b977e2e737fb4a72`, deployment `dpl_CUGK4VU7gDbynfDYjwcRa9Dpraoe`, https://homa-wozeyp6ik-homa-1d878b0e.vercel.app.
- Delayed PDF: source `c734aa8f4466261fda6714467a6c8ccc64c6b2fe`, deployment `dpl_9w2ZKyfRiVRVKHMP3KLb9491SoZf`, https://homa-36m6xsgxn-homa-1d878b0e.vercel.app.

The only application-code difference is the PDF loader; other differences are tests, verification scripts and evidence documentation. The control reuses an older deployment and the candidate is newly deployed. Deployment age and unknown instance reuse remain confounders. The protocol records the actual distinct source hashes per arm.

| Prompt | Control, seconds to first text | Delayed PDF, seconds to first text |
| --- | ---: | ---: |
| Reply with only the word Ready. | 15.683 to 15.762 | 9.615 to 9.697 |
| What does phonics mean? Answer in one short sentence. | 5.139 to 5.211 | 4.618 to 4.686 |
| Give me one sentence I can say when a child feels frustrated by a hard task. | 4.392 to 4.459 | 7.850 to 7.918 |
| Make that sentence shorter. | 10.119 to 10.194 | 7.424 to 7.494 |

All eight Sends completed, with all eight user messages and eight final assistant messages saved and indexed. No tools ran in this comparison. Each arm had only one of its four replies begin within five seconds. Ready is artificial. At five seconds, the candidate phonics answer already explained the letters-to-sounds connection; the control frustration answer was complete. First letters alone are not a useful-answer acceptance claim.

The continuous viewport observer recorded visible-page samples without gaps over one second. Ranges bound sampled visible text, not physical paint. Its six-second prefix window ends at first text when the reply starts later than six seconds. Complete answers were separately checked in the app and database. One local helper reference error occurred before the candidate's first Send; it created no sample or request and was repaired before the single recorded attempt.

## What the timings support

The control's first request had 5.092 seconds between its recorded arrival and authentication beginning. The candidate had 84 milliseconds. Their model-step-to-first-append intervals were similar, 2.565 and 2.522 seconds. Total preparation before the model step was 13.091 versus 7.086 seconds. This is a promising startup signal, not proof that PDF loading explains every second saved. Fresh-process local profiles also implicated native canvas loading, but local import timings cannot substitute for hosted cold-start measurements.

On later requests, arrival-to-authentication gaps were only 9 to 30 milliseconds in both arms. The candidate still took 2.235 to 3.866 seconds before the model step and 2.323 to 4.523 seconds from that step to its first append. The control's short follow-up spent 7.889 seconds in the latter interval. Across all eight, append-to-observed-text was at most 88 to 245 milliseconds. The final display stage is not the dominant delay in this screen. Browser/server timestamp comparisons are approximate; the model-step interval includes any work between the hook and the first appended text, not just provider execution.

Both arms' follow-ups had nearly complete prompt-cache hits. Large waiting differences persisted. Delaying PDF startup therefore does not resolve the target on its own. The next experiments should separate provider invocation from the existing model-step timing and explain remaining session preparation, while retaining the current model and reasoning setting. Do not call the smaller indexing change or this startup change a five-second solution.

## Evidence and closeout

- Corrected source, deployment receipts, frozen protocol, eight raw comparison samples, two supplementary PDF samples, complete-answer metadata, runtime logs, deduplicated preparation marks and `analysis.json`: `/private/tmp/homa-eve-hosted-c734aa8f/`.
- Rejected hosted control, its retained failure and successful delayed-path PDF: `/private/tmp/homa-eve-hosted-aec0701b/`. Reproducible source copies were removed for disk space; source archive, provenance, results and exact dependency hashes remain.
- Local startup profiles: `/private/tmp/homa-startup-profile/`. The early missing-package run is not valid isolated-package evidence.
- Final build receipt: `/private/tmp/homa-five-second-active/pdf-startup-fixed/build-receipt.json`.

These local paths are evidence locations, not permanent shared artifact storage. Both test accounts were signed out after complete-answer verification. Owned fixtures remain registered for reuse. Production remained `dpl_HJ8w7KiwbdjFEcPxeorznh9mDQ7i`, source `2e67c7f13a0e67b3b8d726c6615180dc94db71ce`, READY at the last check. Draft PR #1191 has not been merged; local verification does not establish its current CI status. The unrelated parked-session compatibility failure still prevents treating the newer Eve runtime as production-ready.
