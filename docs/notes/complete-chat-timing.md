# Complete chat timing, #1171

The founder requested every stage be timed, September 16, 2026. This lane adds observation, not a latency optimization. Keep Astra medium, the current prompt, authorization, saving and workflow behavior.

Each send must correlate browser preparation, binding, admission, workflow dispatch and worker startup, dynamic context, each database/network operation, each hook, each model attempt and tool, durable stream writes, browser receipt and visible answer. Record monotonic local durations and explicit clock domains. Concurrent spans overlap and are never summed as sequential time. An unfinished span remains unfinished. Unknown transport/scheduling intervals remain visible; provider-internal work is opaque, not invented.

Existing logs receive metadata only. No prompts, answers, auth headers, SQL text/parameters, tool arguments, results, or family attributes are exported. Model telemetry inputs and outputs are disabled. Browser visible-text detection is separate from reasoning and stream setup. Next frame is not a physical-paint guarantee.

Native Eve telemetry supplies model/tool spans. The existing Eve patch adds managed-step state loading, context deserialization, dispatch, adapter execution, stream write and resolver timing. No workflow replay code is modified. Homa spans surround its individual recorders and database operations. New dependencies provide a local metadata-only trace processor, not an external telemetry service.

Verification: privacy and failure tests, unchanged lazy query behavior, unchanged streamed chunks/cancellation, native patch structure and stream guards, web typecheck/lint, Eve build, preview deployment and synthetic browser trace. Before claiming completeness, account for the full first-answer interval and report any missing boundary explicitly.

## Hosted evidence, September 17

Draft PR #1198, issue #1171. Instrumentation is on previews, not production. Astra remains medium. These are diagnostic samples, not an average, a p95 claim, or an optimization comparison.

On preview `dpl_FKB198QkyT5pNJ8MhUZnTdEj2bdA`, source `3de23848b215032ea4e6e16531296c142f13ee87`:

| Measurement | Definition | Saved-child lookup |
| --- | ---: | ---: |
| Send to first visible answer, browser timer | 7.440 s | 13.825 s |
| Independent visible-DOM polling upper bound | 7.465 s | 13.938 s |
| Final model attempt to first answer text | 2.344 s | 7.213 s |
| Actual get_children execution | Not used | 0.216 s |
| Received answer text to visible DOM | 0.006 s | 0.002 s |

The definition had one model call. The lookup had two, with the real tool between them. Both user questions and assistant answers were saved; the tool result was verified in the family-scoped ledger. The definition's total less its one model wait is 5.096 seconds outside that wait, including preparation and delivery. This is not all Vercel scheduling time.

The definition's browser milestone intervals add to its 7.440-second total:

| Sequential browser interval | Duration |
| --- | ---: |
| Send to session-binding completion | 0.315 s |
| Binding completion to turn-start event | 3.798 s |
| Turn-start event to model-step event | 0.955 s |
| Model-step event to first answer-text event | 2.367 s |
| First answer-text event to visible DOM | 0.006 s |

These are browser event boundaries, not exact server task boundaries. The server's nested measurements separately identify 1.100 seconds for request admission, 0.301 seconds building family context, and 0.619 seconds saving the question. Within saving, the embedding call was about 0.380 seconds. These measurements overlap the browser intervals and must not be added to them.

Two observability defects were discovered and repaired during verification. First, the platform's request-log response capped individual entries at 256. Batching preserves individual timers within bounded 16 KB entries; a 1,500-record test verifies lossless retention. Second, some SDKs intentionally ignore response bodies. The final code ends the request timer when headers arrive and starts a separate body timer only when the body is consumed or cancelled. Unfinished spans remain explicit in the report.

The local evidence folder is `complete-chat-timing-2026-09-17` under the task's visualization directory. `definition-and-lookup.json` contains sanitized individual measurements, same-clock nesting, browser milestones, clock-offset bounds, and unfinished-span listings. The earlier source has unfinished HTTP-body spans, so it must not be labeled complete in the stricter final report. Verification of the request/body repair is recorded below after the final hosted probe.

## Interpretation and boundaries

The report includes every instrumented operation, not only slow operations. Providers' private queueing, reasoning, database internals, DNS/TLS, and pre-handler platform startup are not individually observable from these hooks. Their aggregate waits are measured at the surrounding boundaries; internal causes remain unknown unless platform/provider traces expose them. Browser/server offsets are bounded from request receipts, not assumed equal. Background and nested work is not added to the first-answer total.

Capture overhead has not been quantified in a controlled A/B comparison. Do not present these timings as uninstrumented production averages. Long runs that exceed a platform export limit, failed browser uploads, unfinished spans, or missing visibility receipts invalidate a completeness claim. Logging contains no prompts, answers, tool arguments/results, SQL, or credentials.

Validation completed locally: isolation guard, 289 conversation-continuity tests, 147 agent-context tests, 422 Progress UI tests, 9 focused observer/privacy/stream tests, report union/batching tests, native ordered-stream tests, typecheck, lint (five pre-existing warnings), Eve build, and stream-duration guard. CI's original Progress UI source assertion expected the old two-argument queue helper; it was updated for the new timestamp and the complete 422-test guard passed. Actual final CI state must be checked before release.

## Final request/body probe and release status

Source `b0b73c9f`, READY preview `dpl_Dxno3eLHACFoZQG51HyCsDewWtjB`, produced one real saved-child lookup. Browser first-visible timing was 11.464 seconds; independent viewport polling observed it by 11.494 seconds. The actual get_children call took 60.4 ms. The second model call produced its first answer text after 2.660 seconds. Both model attempts, the tool, and managed workflow completion are present. The question and final answer were verified saved before cleanup.

`verified-trace.json` retains 1,099 correlated records for this send. No request hit the 256-entry export boundary. All native managed-operation start receipts have endings. Eight other span starts still have no exported ending: four response-body spans, three platform spans, and one outbound request. Some begin after first answer text. The evidence does not distinguish unconsumed or still-open streams from lost final export records. They remain explicitly unfinished, and `collection.complete` is false. Do not call this full attribution or production-ready telemetry. Further investigation must preserve stream behavior, not eagerly drain bodies merely to close a timer.

All three synthetic accounts from this lane were deleted and their exact sandbox families retired; temporary credentials were removed. Six diagnostic sends total, with no production model, prompt, or deployment change. Draft PR #1198 is preserved for review. Release remains gated on resolving the remaining export/stream-ending ambiguity, measuring observation overhead, and final CI. No additional paid experiment is needed to establish the findings above.
