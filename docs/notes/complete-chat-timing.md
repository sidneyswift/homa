# Complete chat timing, #1171

The founder requested every stage be timed, September 16, 2026. This lane adds observation, not a latency optimization. Keep Astra medium, the current prompt, authorization, saving and workflow behavior.

Each send must correlate browser preparation, binding, admission, workflow dispatch and worker startup, dynamic context, each database/network operation, each hook, each model attempt and tool, durable stream writes, browser receipt and visible answer. Record monotonic local durations and explicit clock domains. Concurrent spans overlap and are never summed as sequential time. An unfinished span remains unfinished. Unknown transport/scheduling intervals remain visible; provider-internal work is opaque, not invented.

Existing logs receive metadata only. No prompts, answers, auth headers, SQL text/parameters, tool arguments, results, or family attributes are exported. Model telemetry inputs and outputs are disabled. Browser visible-text detection is separate from reasoning and stream setup. Next frame is not a physical-paint guarantee.

Native Eve telemetry supplies model/tool spans. The existing Eve patch adds managed-step state loading, context deserialization, dispatch, adapter execution, stream write and resolver timing. No workflow replay code is modified. Homa spans surround its individual recorders and database operations. New dependencies provide a local metadata-only trace processor, not an external telemetry service.

Verification: privacy and failure tests, unchanged lazy query behavior, unchanged streamed chunks/cancellation, native patch structure and stream guards, web typecheck/lint, Eve build, preview deployment and synthetic browser trace. Before claiming completeness, account for the full first-answer interval and report any missing boundary explicitly.
