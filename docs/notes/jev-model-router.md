# Jev model router experiment, September 18, 2026

Status: implemented as a flag-controlled experiment; production remains Astra medium. Tracks #1171, draft PR #1198. The founder requested invisible query-dependent routing after sharing Agent Native's Jev/Eve post. Its UI instructions were not adopted.

## Decision

Start with Jev choosing between Luna low for confidently simple text requests and Astra medium for everything else. Gemini 3.8 Flash low is an evaluation candidate, not the recommended initial choice. No medium-complexity downgrade until behavioral evidence supports it.

This is model selection at the existing agent boundary, not a new parent capability or workflow tool. No fleet procedure is moved into a tool. A model judges intent and code validates the candidate roster and probability thresholds. Existing instructions, tools, ownership checks and conversation persistence remain in place.

## Implementation

`apps/web/lib/model-router/router.ts` uses the AI SDK's experimental evaluate API with `typesafe-ai/jev` through existing Gateway OIDC. AI SDK and Gateway patch releases were updated to 7.0.105 and 4.0.85; Eve stays 0.19.0. No additional provider account, API key, or new application service was provisioned. The existing Gateway serves Jev.

Jev evaluates complexity and whether the request can be responsibly completed as simple text, separately in one call. Both estimates must reach 0.90 for the simple option. This is a conservative experimental threshold, not a measured guarantee of 90% accuracy. The conversation is data; model-selection instructions inside user text must not control the route.

Only text-only conversations of at most 12,000 serialized characters with a user message last are eligible. Nothing is silently trimmed. Attachments, tool history, tool continuations and larger histories bypass Jev and use Astra. Non-streaming internal generation, including compaction, stays on Astra. Complex requests and uncertain judgments also use Astra. This initial scope deliberately misses some opportunities in long conversations.

Jev has a one-second deadline with no retries; error or deadline falls back to Astra. Caller cancellation aborts instead of producing a fallback answer. Once an answer stream starts, it is not replayed onto another model. Failure of the answering provider retains the existing agent failure behavior.

`HOMA_MODEL_ROUTER=luna` selects Luna as the eligible fast candidate; `flash` selects Flash for experiments; unset or any other value disables classification and keeps Astra. No UI changes. Compaction uses the smallest candidate window, 1,000,000 tokens. Session-scoped routing state feeds the usage hook so answer calls are attributed to the selected model and completed Jev usage is recorded separately. Usage from requests aborted before a completed result is not available to this recorder.

## Measured evidence

Forty routing evaluations: 20 synthetic cases repeated twice. All 28 complex, consequential, action, or adversarial cases stayed on Astra. Ten of 12 simple cases selected Luna. Both conservative misses were "Thanks, that helps!". Total 38/40 expected routes, no unsafe downgrades in this fixture set. Median Jev decision time 0.220s; maximum 0.680s. This does not establish production routing accuracy; no thresholds were tuned to force a pass.

Forty answer calls: four simple questions, two rounds, five arms, rotating execution order. Same generated Homa instructions with an explicit no-tools synthetic environment in every arm. Astra medium and candidates low are deliberately tested as model-plus-effort configurations. Eight calls per arm, no failures. All raw outputs, cache usage, reasoning usage and router decisions are retained.

| Configuration | Median first answer | Mean | Slowest sample |
| --- | ---: | ---: | ---: |
| Astra medium | 1.896s | 2.047s | 4.077s |
| Luna low, no router | 0.712s | 0.735s | 1.011s |
| Flash low, no router | 1.263s | 1.329s | 1.567s |
| Jev then Luna low | 0.924s | 0.979s | 1.341s |
| Jev then Flash low | 1.831s | 1.764s | 2.278s |

The routed rows include the actual Jev call in the first-answer timer, not a subtraction or an estimate. They exclude app preparation and browser rendering. Shared prefixes may cache naturally, and cold versus warm performance is not independently isolated. Eight cases per arm cannot establish a p95 or a 19-of-20 production guarantee. Concurrent build/evaluation activity and normal service variance are additional limitations.

Two real local Eve agent smoke runs completed with correct number-bond answers and no tool calls. The fully captured second trace confirms Jev selected Luna in 0.390s and Luna produced its first answer text after a further 2.077s. That is 2.467s across routing plus model waiting, not total Send-to-visible. Production database and artifact writes were disabled by evaluation isolation, so this is neither hosted verification nor a database-durability test.

## Answer review and release gates

Manual, unblinded review: all number-bond and phonemic-awareness answers contained the correct core concept and examples. Luna's responses were generally shorter. Flash produced two awkward claims that phonemic awareness happens "in the dark" and tended to give longer introductions. Several introductions advertised capabilities unavailable in the synthetic no-tools environment; these were offers, not claims that a write had happened, and need a stricter capability-honesty eval. Activity suggestions also need age-specific practicality and small-object safety coverage before a broad quality claim. This small review does not certify worksheet generation, legal advice, assessments, saved-context use, or tool behavior on the smaller models. Those requests remain on Astra.

The suite has three layers:

1. `pnpm check:model-router`: deterministic dispatch, prompt/tool preservation, attachment/history boundaries, caller cancellation, provider failure/deadline, approved model roster, and both confidence gates. Included in CI.
2. `pnpm eval:model-router --mode routing --rounds 2 --env <existing OIDC env> --out <new JSON path>`: live Jev decisions against reviewed synthetic labels, preserving misses.
3. `pnpm eval:model-router --mode latency --rounds 2 --env <existing OIDC env> --out <new JSON path>`: direct and actual routed first-answer measurements with saved answers for quality review. `eve eval model-router/agent-smoke --strict` checks the real agent with the desired flag set.

Before production enablement: match baseline and router preview Send-to-visible measurements, add ambiguous multi-turn/attachment/safety quality holdouts, and ensure speed improves without tool or answer regressions. Do not substitute this model-path median for an app latency claim. Keep the wider preparation investigation open.

## Sources and artifacts

Official references consulted: https://docs.typesafe.ai/primitives/choice , https://docs.typesafe.ai/confidence , https://vercel.com/ai-gateway/models/jev , https://vercel.com/changelog/gpt-5-6-now-available-on-ai-gateway , https://vercel.com/ai-gateway/models/gemini-3.8-flash . Current model IDs verified against the live Gateway model catalog. Installed SDK and Eve sources were inspected for exact API behavior.

Sanitized evidence directory: `/Users/sidneyswift/.codex/visualizations/2026/09/12/01a09475-7b96-7372-b5dc-e434c12764ea/model-router-2026-09-18/`. Contains `routing.json`, `latency.json`, `summary.json`, and `agent-smoke-timing.json`. These contain only synthetic questions/answers and numeric observations, not credentials or family records.
