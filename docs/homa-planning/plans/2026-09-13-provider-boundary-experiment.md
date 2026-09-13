# Provider boundary experiment, September 13, 2026

Status: protected-preview diagnostic complete; five seconds for 19/20 normal replies remains unproved and unmet in this batch. Tracked by [#1171](https://github.com/sidneyswift/homa/issues/1171). Implementation `219bdd3bcd6e70d696e0d25cb67f309501ce8a86`, Eve 0.19.0, AI SDK 7.0.14, Astra medium. No model setting, family policy or production deployment changed.

## What changed

`agent/instrumentation.ts` enables Eve's supported instrumentation path with input/output recording disabled. Its final-input callback marks `model_input_ready`. An AI SDK telemetry integration records model-call start/end timestamps, bounded correlation identifiers, tool count and the SDK's first-generated-output duration. Registration and the added logs require both `VERCEL_ENV=preview` and `HOMA_PREVIEW_MODEL_TIMING=1`. No exporter, service, dependency or network logger was added. Merely including the instrumentation module enables Eve's own telemetry path; this source has only been deployed to the protected experiment.

The callback registry is bounded to 128 calls, expires stale entries after ten minutes when another call arrives, and removes completed calls. Aborted calls can lack end callbacks. Missing context is ignored. Logger failures cannot interrupt the answer. The logs never serialize prompt text, responses, auth, headers or provider metadata.

## Blindspots resolved

The task sounded like splitting app overhead from model waiting. Three interfaces hide details that could otherwise produce a misleading result:

1. **A step event is not a provider request.** Installed Eve `dist/src/harness/tool-loop.js` prepares the model input before emitting `step.started`; the new input marker therefore precedes that old marker by 0 to 32ms in these traces. The interval is event ordering, not negative preparation time. Use the SDK's model-call callback for the provider invocation boundary.
2. **Telemetry context is opt-in.** AI SDK filters runtime context unless `includeRuntimeContext` names the fields. Eve includes its own session, turn and step keys. The real SDK integration test initially caught missing context in the test setup. Do not associate concurrent calls by a process-global last session.
3. **First model output is not first visible text.** Installed AI SDK `stream-language-model-call.ts` counts nonempty reasoning deltas, text, tool input and tool calls as generated output. Keep that duration separate from the browser measurement and from first durable text append. Tool-using turns can have several model calls before any visible answer.

The revised work order was to add content-free, preview-gated markers; verify actual SDK callbacks and correlation; deploy the current compatible runtime; run a frozen hosted protocol; and identify the next intervention from those traces. No latency target or recording/authentication rule was relaxed.

## Hosted evidence

Deployment `dpl_E6gUFXcKv1H3aanzL8cqrRpNjwTF` was verified READY at https://homa-pdzz8cpkr-homa-1d878b0e.vercel.app. User-index deferral and delayed PDF loading remain on. Priority, inline-turn and chat warmup remain off. Two fresh synthetic families each received the same four ordinary prompts, with no artificial Ready prompt and no health warmup. Because both accounts share an origin, family A completed and signed out before family B signed in. This is an observational breakdown, not a treatment/control comparison or p95 certification.

| Prompt | Family A first visible text, seconds | Family B first visible text, seconds |
| --- | ---: | ---: |
| What does phonics mean? Answer in one short sentence. | 7.175 to 7.244 | 17.104 to 17.178 |
| Give me one sentence I can say when a child feels frustrated by a hard task. | 4.806 to 4.874 | 10.596 to 10.665 |
| Make that sentence shorter. | 4.406 to 4.478 | 6.416 to 6.488 |
| What is one simple way to practice counting to ten without a worksheet? | 43.526 to 43.595 | 16.480 to 16.551 |

All eight logical Sends completed, with eight user and eight final assistant messages saved and indexed. Only two began with text inside five seconds; the initial letters or words alone do not certify a useful prefix. The counting replies asked a clarification and supplied no activity. Continuous viewport observation had no gap over one second and no hidden-page samples. It bounds DOM visibility, not physical paint. Complete responses were separately verified in the UI and scoped database reads. Both accounts were signed out and the owned browser tab closed. Fixture accounts remain registered for reuse.

### Simple replies

For the six replies without tools, final-input-ready to provider-call-start took 34 to 118ms. The first provider invocation to first durable text append took 1.810 to 9.966 seconds. The SDK's first-output durations agreed with those append intervals within about 2ms for these six cases. This establishes that the large model-phase waits were not seconds spent assembling the request locally. It does not distinguish queueing, provider-side retries, prompt processing and hidden reasoning inside the Gateway/provider call.

The two slow simple replies in family B spent 9.964 and 8.048 seconds waiting for first generated output. Each had one observed SDK model invocation; any Gateway-internal retries remain invisible. Later prompts still had nearly complete input-cache hits. Every first model call advertised 95 tools. Neither tool count nor cache hits alone prove a cause.

Send-to-step preparation still ranged from 2.329 to 7.097 seconds for these six replies. Across all eight, first durable append to observed text was at most 78 to 207ms. Browser/server clock comparisons are approximate. Reducing final SDK setup or browser rendering cannot remove most of the remaining delay.

### Activity request

Both families loaded `progress-next-move`, read `explore_child_map` for the child's math subject, then asked about current counting ability. Each turn used three model invocations. The skill's current instructions require the canonical evidence read and a clarification when there is no saved evidence. Returning a question followed that contract; this experiment does not authorize bypassing it or silently supplying an unverified activity.

The recorded `load_skill` tool interval was 15.852 seconds in family A and 1.569 seconds in B. The map read took 399 and 222ms respectively. Family A's three complete model invocations took 3.454, 5.463 and 16.394 seconds; B's took 2.882, 3.811 and 5.909 seconds. These are invocation durations, not first-visible-answer durations. Tool and hook work adds between them.

Installed Eve `runtime/skills/sandbox-access.js` implements `load_skill` by calling the sandbox handle's `get()` and then reading `/workspace/skills/<skill>/SKILL.md`. The long tool interval is consistent with sandbox startup, but these traces do not separately measure sandbox creation, setup and file reading. That split must be measured before claiming sandbox startup caused all 15.852 seconds. The difference is a stronger next preparation lead than the tens of milliseconds in final request setup.

## Verification and next experiments

Three new tests exercise the actual SDK streaming callback path: concurrent session correlation and exclusion of unrelated calls, unchanged reasoning/text order with no content leakage, logger failure tolerance, and explicit preview/flag gating. Nine existing preparation and append-observation tests also passed. Typecheck, focused ESLint, full Next/Eve builds and stream-duration verification passed. Both server and workflow packages include the instrumentation through their generated handlers.

Two independent leads remain. First, isolate sandbox acquisition from skill file reading, then test moving necessary setup off the visible-answer path while preserving skill semantics and tenant scope. Second, test whether redundant read-only Astra-medium inference can reduce the observed provider tail before considering an app integration. Any such race must keep only one winning stream, cancel losing work, execute tools only from that winner, preserve durable recording, and be measured with the full app afterward. Paid test messages are authorized; this document does not claim that racing requests already works or has been implemented.

Evidence: `/private/tmp/homa-eve-hosted-219bdd3b/` contains the exact source archive/provenance, deployment receipt, frozen protocol, eight raw samples, complete-answer/tool metadata, deduplicated preparation/model markers, `analysis.json`, and the analysis script. Log result limits initially omitted family A; explicit one-minute windows and the retained initial capture recovered all twelve model invocations. Final build evidence is `/private/tmp/homa-five-second-active/model-timing-experiment/build-receipt.json`. Local paths are not permanent shared storage. Production was verified unchanged before fixture creation, and no production mutation occurred. Draft PR #1191 remains unmerged; local checks are not a claim about its current CI.
