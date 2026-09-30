# Homa startup investigation: the 7.440-second definition sample

September 17, 2026. Instrumented preview, not a production average. Model: Astra medium. Send ID: 859b15a2-f9d5-4ddf-aaee-7a0c3066ddbf. Preview source: 3de23848b215032ea4e6e16531296c142f13ee87.

## What is established

The original 3.80-second label was too broad. It is the browser interval from session-binding completion to receipt of turn.started, not a measured startup function. It contains two HTTP exchanges plus waiting for durable workflow execution and event delivery. It is before the model call.

The app performs several serial remote operations. Tiny local resolver functions are not the main contributor. There are two specific optimization candidates: a resume lookup using a freshly generated token, and semantic indexing that blocks the model even though the message can be saved independently. The larger workflow activation delays remain incompletely attributed.

## Exact browser accounting

These non-overlapping intervals sum to 3,797.7 ms. They all use the browser's clock.

| Interval | ms | What happens |
|---|---:|---|
| Binding completed to create-request start | 5.5 | Start send, acquire browser auth token |
| POST /eve/v1/session to response headers | 1,539.6 | Authenticate, authorize, resolve conversation, attempt delivery, create session workflow, bind ownership |
| First response to stream-request start | 1.2 | Process response and acquire token |
| GET session stream to response headers | 126.6 | Authenticate again, authorize session, open stream |
| Stream headers to first event | 2,089.7 | Stream is open but no event has arrived; workflow execution and transport overlap here |
| First event to turn.started | 35.1 | Subsequent turn-start event arrives |
| Total | 3,797.7 | No model reasoning included |

Before this interval: Send to binding completion was 315.1 ms. After it: turn.started to first model-step event was 955.3 ms, then first answer text arrived at 7,434.6 ms and DOM visibility at 7,440.3 ms. A step-start event is not the exact provider request boundary.

## Session binding before the 3.80-second interval

The browser waits 307.9 ms for response headers. Inside the measured server handler: 103.25 ms, comprising authentication 56.63 ms, membership 36.83 ms, binding read 7.99 ms, and about 1.8 ms other work. The remainder outside the handler is about 205 ms. It includes transport and any platform work outside this timer; it is not established as cold start.

Browser lock acquisition: 5.3 ms. Not a meaningful optimization target in this sample.

## Inside the 1,539.6 ms create request

Measured server handler: 1,099.73 ms. About 439.9 ms lies outside that handler timer. Do not label that remainder network alone, or cold start alone.

| Function / stage, in execution order | ms | Purpose | Optimization assessment |
|---|---:|---|---|
| readEveAuthentication | 173.83 | Verify user with Supabase auth.getUser; outbound headers 140.40 ms within this parent | Remote authentication is substantial. Preserve authentication; investigate reusable verified identity across the send flow. |
| readEveMembership | 58.07 | Resolve family membership and account fields; outbound headers 49.11 ms | Serial after identity. Avoid duplicate retrieval where equivalent authenticated evidence already exists. |
| owners.provision | 89.36 | Reserve family-scoped session ownership before starting work; one measured database query | Source/order mapping, not an explicitly named provision span. Needs dedicated function timer to eliminate mapping uncertainty. |
| onEveMessage account gate | 0.44 | Check permitted account access from resolved data | Negligible; retain. |
| resolveInboundContinuity | 79.80 | Resolve durable conversation/episode/thread association | Six query spans: 17.24, 5.62, 8.05, 15.62, 18.58, 8.74 ms. Individual query-purpose labels were not exported. Investigate redundant work with prior binding request. |
| createSendFn -> runtime.deliver -> resumeHook | 167.61 | Try to deliver to an existing workflow; then fall back when missing | Source/order/status mapping: matching outbound returned 404 in 159.46 ms. New-session route generates a new random token immediately beforehand. Skip the resume attempt only for explicitly new sessions; preserve continuation behavior. |
| createSendFn -> runtime.run -> startWorkflowPreferLatest | 485.03 | Build serialized runtime context and create the session workflow | Source/order mapping of generic platform parent. Includes 468.22 ms outbound request and an overlapping 71.08 ms outbound request. Nested durations must not be added. Need operation-name labels for precise SDK internals. |
| owners.activate | 25.07 | Atomically bind newly created session to its authorized owner and conversation | Source/order mapping to transaction with two queries, 8.94 and 8.81 ms. Keep the security boundary. |
| Remaining handler work | about 20.5 | Parsing, validation, context construction, response checks and gaps | Several small functions share this remainder; not separately timed. |

Source: apps/web/agent/channels/eve.ts; apps/web/lib/conversation-continuity/eve-session-channel.ts; eve-session-owners.ts; installed Eve 0.19 channel/send.js, public/channels/eve.js, execution/workflow-runtime.js.

Important source finding: createCachedRouteAuth caches within a single Request object. It prevents duplicate auth inside that one request; it does not eliminate fresh authentication in the binding, create, and stream requests.

## Inside the stream-opening request

Browser duration 126.6 ms. Server handler 73.75 ms: authentication 36.29 ms; membership 25.89 ms; ownership query 5.89 ms; about 5.68 ms other work. Outside-handler remainder about 52.85 ms. getEventStream produces a lazy stream; receiving its headers does not mean the workflow has produced an event. Work occurring after headers cannot be counted as part of the 73.75 ms handler.

## Workflow handoff: recovered trace evidence

The offline report previously omitted a dispatch trace because managed-step receipts had session IDs but no trace IDs. They share clock and span IDs with native tracing. Joining on both recovers that trace without another paid request. The association is seeded by this send's time window so later turns are not used as seeds.

| Boundary / operation | ms | Confidence / meaning |
|---|---:|---|
| First recovered dispatch-trace operation to dispatchTurnStep start | 473 | Same worker clock. Several platform spans precede application dispatch; not all root spans have end receipts. |
| Within the above: platform operation | 39.49 | Has outbound request 38.36 ms; purpose redacted |
| Within the above: platform operation | 278.25 | Nested platform operations 277.63 and 273.41 ms; purpose redacted |
| Within the above: platform operation | 59.26 | Has outbound request 58.20 ms; purpose redacted |
| Within the above: platform operation | 80.26 | Has outbound request 79.26 ms; purpose redacted |
| dispatchTurnStep | 136.13 | Managed receipt. Starts a separate turnWorkflow; tracing wrapper reports 136.27 ms |
| dispatch completion to turnStep beginning | 605.87 | Same worker clock; real delay, but not entirely queue time |
| Within that gap: time before next measured worker request span | about 334 | No function-level attribution; scheduling/transport/bootstrap cannot be separated |
| Within that gap: worker request span start to turnStep | 272 | Platform setup, including spans around 82.38, 82.21 and 94.80 ms |
| readDurableSession | 0.35 | State restoration is negligible in this sample |
| deserializeContext | 0.55 | Context deserialization is negligible |
| Turn-start durable write | 107.01 | Writes the turn event into the durable response stream |

These are drill-down measurements, NOT additional amounts to add to the browser table. The worker and browser clocks have not been synchronized. The 2,089.7 ms browser wait overlaps workflow execution, subscriptions and event delivery.

Source: installed Eve execution/turn-dispatch.js calls dispatchTurnStep then waits for its control action; execution/workflow-steps.js starts turnWorkflow from dispatchTurnStep, then turnStep restores state, emits events, runs hooks and invokes the model harness.

## Remaining work before the model

| Operation | ms | Why / optimization |
|---|---:|---|
| Dynamic family context | 300.74 | Family rows 98.03 ms; then progress 3.55, continuity 83.72 and recent calls 185.76 ms overlap. Recent calls dominate the second phase. Bound or preload only with a freshness policy. |
| User-message persistence preparation | 619.05 | Serial indexing, canonical save, index update. Detailed below. |
| Semantic embedding provider | 382.78 | A separate model call to make the message searchable; SDK input 12 tokens. |
| Embedding usage bookkeeping | 22.62 | Database write, awaited before saving the actual message. |
| Embedding total | 406.45 | Includes both preceding entries and overhead. |
| Canonical message persistence | 174.75 | Episode resolution 66.22 ms and transaction 107.16 ms. Required durable record. |
| Save embedding on stored message | 37.03 | Search-index database update. |
| Tool / skill dispatch resolvers | Usually below 1; one tool resolver 1.64 | Resolving advertised capabilities is not a seconds-long delay in this sample. No worksheet tool execution occurred. |
| Model stream invocation to first response text | 2,344.33 | Includes provider processing/reasoning and delivery to server, not browser DOM. Input reported 41,015 tokens. Not comparable to a minimal bare-model prompt. |
| Browser first answer text to visible DOM | 5.70 | Rendering is not the problem here. |

Source: apps/web/lib/conversation-log.ts explicitly awaits dependencies.embed BEFORE dependencies.persistCanonical, then awaits dependencies.saveEmbedding. The code describes the semantic index as best-effort. This means a nonessential search enhancement is blocking both durable saving and the first answer.

## Ranked experiments with stop conditions

1. **Move semantic indexing off the answer-start path, retaining durable message saving first.** About 443 ms of this sample is indexing plus index storage. That is candidate exposure, not promised improvement. Use durable scheduled work with retry/idempotency; do not use an untracked fire-and-forget promise. Test immediate server persistence, recall after indexing, failures and replay. Compare paired identical prompts and stop if visible response does not improve or durability regresses.
2. **Skip resume lookup for explicitly new sessions.** About 168 ms candidate exposure. Do not change continuation-token semantics for existing sessions. Verify new session, existing continuation, retries, ownership and failed creation. Patch narrow Eve behavior or propose upstream; no whole-stack migration required.
3. **Name and timestamp the workflow boundary operations.** Largest unresolved area. Add a fixed safe allowlist of Workflow operation names plus enqueue accepted, worker request entered, workflow replay begin/end, dispatch step entered, turn queued and turn step entered. Include clock IDs and causal run/step IDs; no raw URLs, payloads or credentials. Recover missing span-end receipts. A gap must stay classified unknown until both endpoints exist. Stop broad latency tuning until this ledger explains the largest waits.
4. **Consolidate repeat identity/family work.** Binding, create and stream together spend about 388 ms in authentication/membership functions. Not all is removable. Test a scoped, short-lived verified handoff or a single authenticated transport; preserve revocation and tenant isolation. This is a security design change, not permission to omit checks.
5. **Only then test bypassing the workflow handoffs.** A thin direct-stream path must use the same model, prompt, tools, family context and persistence. Otherwise it measures a different product. It must retain recovery/cancellation semantics or explicitly test the tradeoff. Choose based on paired results, not vendor labels.

## Explicit incompleteness

We do not yet have every function individually measured. Generic platform span labels hide their purpose; the initial session workflow is not fully joined by causal IDs; outside-handler time is not split into routing/network/cold start; database durations include connection/pool/network/server work without separating them; provider queue/prefill/reasoning are not independently exposed; some spans lack end receipts. Nine unfinished spans appear for this definition sample after recovering the dispatch trace. No production speed improvement is claimed from this diagnostic change.

This artifact is a measured partial function ledger, with unknowns exposed. The appendix below lists every captured completed span starting before the model invocation that is associated with this send. Parents and children overlap; do not sum the column. Generic names are intentional evidence of an observability gap, not a diagnosis.

## Captured pre-model span appendix

| Clock | Start epoch ms | Duration ms | Operation | Span ID | Parent ID |
|---|---:|---:|---|---|---|
| bfe71ad8 | 1789617751702 | 103.503 | homa.http.binding | 5cd541125f636f03 | 579d597082779f07 |
| bfe71ad8 | 1789617751702 | 104.253 | platform.operation | 579d597082779f07 | 96d5b6e7cc689603 |
| bfe71ad8 | 1789617751702 | 106.796 | platform.operation | 96d5b6e7cc689603 |  |
| bfe71ad8 | 1789617751703 | 103.251 | homa.prepare.binding_total | 4b16c69174fa22c1 | 5cd541125f636f03 |
| bfe71ad8 | 1789617751704 | 56.632 | homa.prepare.binding_authenticate | b61eb9135cefcd3c | 4b16c69174fa22c1 |
| bfe71ad8 | 1789617751707 | 51.131 | platform.operation | 1cd49dec2f1fbade | b61eb9135cefcd3c |
| bfe71ad8 | 1789617751707 | 51.998 | homa.http.outbound | 270aa8291001e230 | 1cd49dec2f1fbade |
| bfe71ad8 | 1789617751760 | 36.830 | homa.prepare.binding_membership | c0ff29ef6e84fe5f | 4b16c69174fa22c1 |
| bfe71ad8 | 1789617751762 | 34.131 | platform.operation | a052640e94783cb5 | c0ff29ef6e84fe5f |
| bfe71ad8 | 1789617751762 | 34.742 | homa.http.outbound | 71edae8ba1c0c288 | a052640e94783cb5 |
| bfe71ad8 | 1789617751797 | 7.991 | homa.prepare.binding_read | 6cdd9d79a685e8d7 | 4b16c69174fa22c1 |
| bfe71ad8 | 1789617751798 | 7.555 | homa.database.query | 0653cf983ae38934 | 6cdd9d79a685e8d7 |
| bfe71ad8 | 1789617751808 | 0.031 | platform.operation | 1edf76448db84953 | 96d5b6e7cc689603 |
| 45287965 | 1789617752202 | 1099.731 | homa.http.admission | 306a1333f113538b |  |
| 45287965 | 1789617752210 | 173.830 | homa.prepare.authenticate | 5b43adfbb11c7bbf | 306a1333f113538b |
| 45287965 | 1789617752211 | 140.404 | homa.http.outbound | 68266704c867ea22 | 5b43adfbb11c7bbf |
| 45287965 | 1789617752384 | 58.068 | homa.prepare.membership | 2111730261dc9311 | 306a1333f113538b |
| 45287965 | 1789617752386 | 49.110 | homa.http.outbound | b10ed9e363627367 | 2111730261dc9311 |
| 45287965 | 1789617752447 | 89.364 | homa.database.query | f68e5e8771f0fb4d | 306a1333f113538b |
| 45287965 | 1789617752538 | 0.442 | homa.prepare.account_gate | 9ad805a85835bffb | 306a1333f113538b |
| 45287965 | 1789617752538 | 79.797 | homa.prepare.inbound_continuity | 4c3e911d8221332c | 306a1333f113538b |
| 45287965 | 1789617752539 | 17.235 | homa.database.query | 59e4b92fa102a6f5 | 4c3e911d8221332c |
| 45287965 | 1789617752559 | 5.617 | homa.database.query | effc6a2e9340c9bb | 4c3e911d8221332c |
| 45287965 | 1789617752565 | 8.051 | homa.database.query | 2f8ad4a683c52e7e | 4c3e911d8221332c |
| 45287965 | 1789617752574 | 15.623 | homa.database.query | ec92da81354b58b4 | 4c3e911d8221332c |
| 45287965 | 1789617752590 | 18.579 | homa.database.query | 7e9e5d4e483d8007 | 4c3e911d8221332c |
| 45287965 | 1789617752609 | 8.744 | homa.database.query | acb3673451a8ef6a | 4c3e911d8221332c |
| 45287965 | 1789617752621 | 167.608 | platform.operation | 127841de6e219c5b | 306a1333f113538b |
| 45287965 | 1789617752623 | 165.126 | platform.operation | 261298b452766434 | 127841de6e219c5b |
| 45287965 | 1789617752625 | 163.054 | platform.operation | 5e9bdc55d4669bb1 | 261298b452766434 |
| 45287965 | 1789617752627 | 159.461 | homa.http.outbound | 294605473bc7d98d | 5e9bdc55d4669bb1 |
| 45287965 | 1789617752790 | 485.027 | platform.operation | d8a13194e3f0091c | 306a1333f113538b |
| 45287965 | 1789617752804 | 81.561 | platform.operation | 4c860a628a809a4b | d8a13194e3f0091c |
| 45287965 | 1789617752807 | 468.216 | homa.http.outbound | f7fd2c63719d1619 | d8a13194e3f0091c |
| 45287965 | 1789617752810 | 70.545 | platform.operation | 6dc48fd72217907c | 4c860a628a809a4b |
| 45287965 | 1789617752810 | 71.082 | homa.http.outbound | b6bde9f230c62548 | 6dc48fd72217907c |
| 45287965 | 1789617753276 | 25.073 | homa.database.transaction | ea68eed819bf7386 | 306a1333f113538b |
| 45287965 | 1789617753280 | 8.944 | homa.database.query | f504920dba81dcac | ea68eed819bf7386 |
| 45287965 | 1789617753289 | 8.813 | homa.database.query | 67d6bc50c6361436 | ea68eed819bf7386 |
| 45287965 | 1789617753418 | 73.751 | homa.http.admission | f14e9ca1b960bb1c |  |
| 45287965 | 1789617753419 | 35.422 | homa.http.outbound | c3cfcbbd256c4ff5 | 0155bc7c1c78a576 |
| 45287965 | 1789617753419 | 36.295 | homa.prepare.authenticate | 0155bc7c1c78a576 | f14e9ca1b960bb1c |
| 45287965 | 1789617753456 | 25.169 | homa.http.outbound | cfd8aa486b69277a | f275e829198dbb9d |
| 45287965 | 1789617753456 | 25.894 | homa.prepare.membership | f275e829198dbb9d | f14e9ca1b960bb1c |
| 45287965 | 1789617753482 | 5.894 | homa.database.query | b2edf62c1683999e | f14e9ca1b960bb1c |
| 45287965 | 1789617753493 | 65.017 | platform.operation | 41c2e3cb1e798e92 | f14e9ca1b960bb1c |
| 5f640749 | 1789617754199 | 0.042 | platform.operation | 7749bc9c4c09dd99 | 2d523959caecc8eb |
| 5f640749 | 1789617754200 | 37.972 | platform.operation | 5bd3c7834b79524c | aca12f9136ba6e52 |
| 5f640749 | 1789617754200 | 38.361 | homa.http.outbound | cb9053b6674e27cf | 5bd3c7834b79524c |
| 5f640749 | 1789617754200 | 39.490 | platform.operation | aca12f9136ba6e52 | d766a5d8b325ac50 |
| 5f640749 | 1789617754240 | 278.246 | platform.operation | 0e684d457e3f182e | d766a5d8b325ac50 |
| 5f640749 | 1789617754241 | 277.630 | platform.operation | 0ef8f0fd8abb79f4 | 0e684d457e3f182e |
| 5f640749 | 1789617754242 | 273.415 | platform.operation | b121d26ad49163de | 0ef8f0fd8abb79f4 |
| 5f640749 | 1789617754519 | 5.540 | platform.operation | 9c0b65daa2fb4bda | d766a5d8b325ac50 |
| 5f640749 | 1789617754525 | 57.718 | platform.operation | 9c152b083256c62c | a0086d3db8652f75 |
| 5f640749 | 1789617754525 | 58.199 | homa.http.outbound | 7dc0d5a72e6c46c3 | 9c152b083256c62c |
| 5f640749 | 1789617754525 | 59.259 | platform.operation | a0086d3db8652f75 | d766a5d8b325ac50 |
| 5f640749 | 1789617754588 | 78.704 | platform.operation | 22916408785325a3 | adb07d2e8b142181 |
| 5f640749 | 1789617754588 | 79.261 | homa.http.outbound | 6dfda26ea392836c | 22916408785325a3 |
| 5f640749 | 1789617754588 | 80.262 | platform.operation | adb07d2e8b142181 | dc94411ee671da29 |
| 5f640749 | 1789617754669 | 2.782 | platform.operation | 358991f7e83694fc | dc94411ee671da29 |
| 5f640749 | 1789617754672 | 135.894 | homa.runtime.workflow.dispatch | 4014b8836ee686aa | 7a08f7f27b8904c9 |
| 5f640749 | 1789617754672 | 136.272 | homa.runtime.dispatchTurnStep | 7a08f7f27b8904c9 | e67798776554e2d6 |
| 5f640749 | 1789617754673 | 134.759 | platform.operation | a3e9c71a71875179 | 4014b8836ee686aa |
| 5f640749 | 1789617754679 | 41.292 | homa.http.outbound | 917d689953123c05 | a3e9c71a71875179 |
| 5f640749 | 1789617754679 | 129.355 | platform.operation | 7d341f5ed86745a9 | a3e9c71a71875179 |
| 5f640749 | 1789617754681 | 125.965 | platform.operation | 8749ce8ae57e7e62 | 7d341f5ed86745a9 |
| 5f640749 | 1789617754681 | 126.633 | homa.http.outbound | d80b21749ab0c54f | 8749ce8ae57e7e62 |
| 5f640749 | 1789617755142 | 6516.109 | platform.operation | 40338e59498f470e |  |
| 5f640749 | 1789617755144 | 6479.130 | platform.operation | 9b7ad168dab3e041 | 40338e59498f470e |
| 5f640749 | 1789617755144 | 0.044 | platform.operation | 4e4eff77614adffc | 40338e59498f470e |
| 5f640749 | 1789617755144 | 80.885 | platform.operation | 18b5b3bc27d6ae74 | c3cd73bd057551fd |
| 5f640749 | 1789617755144 | 81.376 | homa.http.outbound | d17d7bdca36508ab | 18b5b3bc27d6ae74 |
| 5f640749 | 1789617755144 | 82.381 | platform.operation | c3cd73bd057551fd | 9b7ad168dab3e041 |
| 5f640749 | 1789617755227 | 74.974 | platform.operation | cb103122a644ef90 | ff4a7e0da52341fc |
| 5f640749 | 1789617755227 | 81.888 | platform.operation | ff4a7e0da52341fc | 5d88e05fa414e2b5 |
| 5f640749 | 1789617755227 | 82.207 | platform.operation | 5d88e05fa414e2b5 | 9b7ad168dab3e041 |
| 5f640749 | 1789617755309 | 4.582 | platform.operation | 2fbfad8da721aa0f | 9b7ad168dab3e041 |
| 5f640749 | 1789617755317 | 5523.579 | platform.operation | 381b73619e15cc02 | 9b7ad168dab3e041 |
| 5f640749 | 1789617755317 | 94.805 | platform.operation | 0e54af5016bc7b0d | 381b73619e15cc02 |
| 5f640749 | 1789617755318 | 93.461 | platform.operation | 98558f01b0b3d27c | 0e54af5016bc7b0d |
| 5f640749 | 1789617755318 | 94.028 | homa.http.outbound | c108cdd3b3204b85 | 98558f01b0b3d27c |
| 5f640749 | 1789617755413 | 1.226 | platform.operation | a98185b7f65b37d9 | 381b73619e15cc02 |
| 5f640749 | 1789617755414 | 5213.884 | homa.runtime.turnStep | f6cbf18fb65090ce | 16949a9227c4378e |
| 5f640749 | 1789617755414 | 5214.454 | platform.operation | 16949a9227c4378e | 381b73619e15cc02 |
| 5f640749 | 1789617755415 | 0.420 | homa.runtime.state.read | c8d0a11098b4efcc | f6cbf18fb65090ce |
| 5f640749 | 1789617755415 | 0.614 | homa.runtime.context.deserialize | 7c7508581f4001f7 | f6cbf18fb65090ce |
| 5f640749 | 1789617755417 | 5210.995 | homa.runtime.turn.execute | 6ee0ce1bf46f850b | f6cbf18fb65090ce |
| 5f640749 | 1789617755419 | 5208.632 | ai.eve.turn | a84268653c4ec6c0 | 6ee0ce1bf46f850b |
| 5f640749 | 1789617755421 | 0.191 | homa.runtime.channel.event | e73a3ce68e6824aa | a84268653c4ec6c0 |
| 5f640749 | 1789617755421 | 1.556 | homa.runtime.stream.durable_write | 3929f2a073bd3789 | a84268653c4ec6c0 |
| 5f640749 | 1789617755423 | 0.163 | homa.runtime.hooks.all | da3efd211064b173 | a84268653c4ec6c0 |
| 5f640749 | 1789617755423 | 0.282 | homa.runtime.tools.resolve | 2b2093c27cadfe8f | a84268653c4ec6c0 |
| 5f640749 | 1789617755423 | 0.475 | homa.runtime.skills.resolve | f751a7416eae4bca | a84268653c4ec6c0 |
| 5f640749 | 1789617755424 | 0.249 | homa.runtime.instructions.resolve | f73e44ddc6f4c0be | a84268653c4ec6c0 |
| 5f640749 | 1789617755424 | 0.047 | homa.runtime.channel.event | 61bccea075563da4 | a84268653c4ec6c0 |
| 5f640749 | 1789617755424 | 107.047 | homa.runtime.stream.durable_write | ef78d7f7e6f66cf9 | a84268653c4ec6c0 |
| 5f640749 | 1789617755433 | 95.274 | platform.operation | be27ab6fb99c35c2 | a98185b7f65b37d9 |
| 5f640749 | 1789617755434 | 97.164 | homa.http.outbound | 7eb406f24a0e3b1a | be27ab6fb99c35c2 |
| 5f640749 | 1789617755532 | 0.391 | homa.hook.reset-outbound-child-framing.turn.started | 329bba568dda561d | a811b939b1d5b0a7 |
| 5f640749 | 1789617755532 | 1.028 | homa.runtime.hooks.all | a811b939b1d5b0a7 | a84268653c4ec6c0 |
| 5f640749 | 1789617755533 | 0.065 | homa.runtime.tools.resolve | 1d4c6944c0c838a0 | a84268653c4ec6c0 |
| 5f640749 | 1789617755533 | 0.038 | homa.runtime.skills.resolve | 3df9edcaa7dea7af | a84268653c4ec6c0 |
| 5f640749 | 1789617755533 | 300.740 | homa.prepare.family_context_total | 6ce8caafd9a65915 | 04fb993d3f988f39 |
| 5f640749 | 1789617755533 | 301.509 | homa.runtime.instructions.resolve | 04fb993d3f988f39 | a84268653c4ec6c0 |
| 5f640749 | 1789617755534 | 98.029 | homa.prepare.family_rows | ddaf7cd1ad66f552 | 6ce8caafd9a65915 |
| 5f640749 | 1789617755543 | 57.682 | homa.http.outbound | ff86bb1e2b1628f3 | ddaf7cd1ad66f552 |
| 45287965 | 1789617755544 | 29.389 | platform.operation | 42fa16fd19e14cd9 | f14e9ca1b960bb1c |
| 45287965 | 1789617755545 | 26.517 | homa.http.outbound | 48bab4dad06dfee9 | c98ccf25ec68fa78 |
| 45287965 | 1789617755545 | 28.783 | platform.operation | c98ccf25ec68fa78 | 42fa16fd19e14cd9 |
| 5f640749 | 1789617755547 | 79.784 | homa.http.outbound | e40f52618e319a82 | ddaf7cd1ad66f552 |
| 5f640749 | 1789617755548 | 83.419 | homa.http.outbound | ebb215037b16ce3d | ddaf7cd1ad66f552 |
| 5f640749 | 1789617755549 | 50.939 | homa.http.outbound | 50248d8110cda677 | ddaf7cd1ad66f552 |
| 5f640749 | 1789617755550 | 79.145 | platform.operation | 7738b06fa909079d | a98185b7f65b37d9 |
| 5f640749 | 1789617755550 | 80.020 | homa.http.outbound | 1cbf9185c99364f8 | 7738b06fa909079d |
| 45287965 | 1789617755571 | 0.862 | platform.operation | 740413d9f716cca6 | c98ccf25ec68fa78 |
| 45287965 | 1789617755572 | 1.551 | platform.operation | 53d593a10d6c9d53 | c98ccf25ec68fa78 |
| 5f640749 | 1789617755645 | 3.548 | homa.prepare.progress | e50f64603755d237 | 6ce8caafd9a65915 |
| 5f640749 | 1789617755645 | 83.719 | homa.prepare.continuity | 17b4c78b8af3f354 | 6ce8caafd9a65915 |
| 5f640749 | 1789617755648 | 80.393 | homa.database.query | 695af15fec43a94e | 17b4c78b8af3f354 |
| 5f640749 | 1789617755648 | 184.980 | homa.database.query | 07428304f579e63c | e4b92abc226a3f6d |
| 5f640749 | 1789617755648 | 185.755 | homa.prepare.recent_calls | e4b92abc226a3f6d | 6ce8caafd9a65915 |
| 5f640749 | 1789617755834 | 0.057 | homa.runtime.channel.event | 4dec0ebe1308c7ec | a84268653c4ec6c0 |
| 5f640749 | 1789617755834 | 62.803 | homa.database.query | ba0ca572a8ffcd68 | 6ce8caafd9a65915 |
| 5f640749 | 1789617755835 | 0.679 | homa.runtime.stream.durable_write | 0ee12ea056b0d296 | a84268653c4ec6c0 |
| 5f640749 | 1789617755835 | 620.080 | homa.hook.persist-conversation.message.received | 5c4e06cf8e25e26c | dfc6750fe42778da |
| 5f640749 | 1789617755835 | 620.253 | homa.runtime.hooks.all | dfc6750fe42778da | a84268653c4ec6c0 |
| 5f640749 | 1789617755836 | 406.447 | homa.prepare.embedding_total | d1273deb7934c0ae | dbbd0a13ff4f0555 |
| 5f640749 | 1789617755836 | 619.047 | homa.prepare.user_persistence | dbbd0a13ff4f0555 | 5c4e06cf8e25e26c |
| 5f640749 | 1789617755837 | 382.780 | homa.prepare.embedding_provider | a7362a1e927a8a98 | d1273deb7934c0ae |
| 5f640749 | 1789617755839 | 379.892 | gen_ai.embeddings | e78214e730beaff7 | a7362a1e927a8a98 |
| 5f640749 | 1789617755840 | 378.151 | gen_ai.embeddings | 12dfd47b4263b8fb | e78214e730beaff7 |
| 5f640749 | 1789617755844 | 367.987 | homa.http.outbound | f23e2f4576113d8c | a7362a1e927a8a98 |
| 5f640749 | 1789617755846 | 67.555 | platform.operation | 9eecde359d4a08eb | a98185b7f65b37d9 |
| 5f640749 | 1789617755846 | 68.588 | homa.http.outbound | bcc58d7e4d0b7ed9 | 9eecde359d4a08eb |
| 5f640749 | 1789617756219 | 22.618 | homa.prepare.embedding_usage | 349e818a9864d7c3 | d1273deb7934c0ae |
| 5f640749 | 1789617756220 | 21.989 | homa.database.query | d5fb40f294257fb3 | 349e818a9864d7c3 |
| 5f640749 | 1789617756243 | 66.217 | homa.prepare.canonical_episode | fdc36cd6e06a5bac | 5d541c39cbf14005 |
| 5f640749 | 1789617756243 | 174.753 | homa.prepare.canonical_persistence | 5d541c39cbf14005 | dbbd0a13ff4f0555 |
| 5f640749 | 1789617756244 | 39.948 | homa.database.query | 5a8d408ece266ae9 | fdc36cd6e06a5bac |
| 5f640749 | 1789617756284 | 25.103 | homa.database.query | dfc8b896209b9662 | fdc36cd6e06a5bac |
| 5f640749 | 1789617756310 | 107.157 | homa.prepare.canonical_transaction | a2c2e2bb62b7e1c1 | 5d541c39cbf14005 |
| 5f640749 | 1789617756311 | 106.505 | homa.database.transaction | 9515aeaa4dc3ff74 | a2c2e2bb62b7e1c1 |
| 5f640749 | 1789617756315 | 70.706 | homa.database.query | 94c3c2f55a319086 | 9515aeaa4dc3ff74 |
| 5f640749 | 1789617756386 | 26.465 | homa.database.query | 1b5017abdce8533b | 9515aeaa4dc3ff74 |
| 5f640749 | 1789617756418 | 36.473 | homa.database.query | 6d85b737d62d38c0 | 2d95a5d4db885a55 |
| 5f640749 | 1789617756418 | 37.034 | homa.prepare.embedding_update | 2d95a5d4db885a55 | dbbd0a13ff4f0555 |
| 5f640749 | 1789617756456 | 0.070 | homa.runtime.tools.resolve | 76428d9b66edf98d | a84268653c4ec6c0 |
| 5f640749 | 1789617756456 | 0.039 | homa.runtime.skills.resolve | 0675562d1c6278f9 | a84268653c4ec6c0 |
| 5f640749 | 1789617756456 | 0.030 | homa.runtime.instructions.resolve | d00a579412cd4bbd | a84268653c4ec6c0 |
| 5f640749 | 1789617756458 | 0.065 | homa.runtime.channel.event | 5fa6f13aabc805cd | a84268653c4ec6c0 |
| 5f640749 | 1789617756458 | 0.562 | homa.runtime.stream.durable_write | 55a26143cada8a69 | a84268653c4ec6c0 |
| 5f640749 | 1789617756459 | 0.260 | homa.hook.preparation-timing.step.started | 6848bb001d188a84 | df5822803773f645 |
| 5f640749 | 1789617756459 | 0.427 | homa.runtime.hooks.all | df5822803773f645 | a84268653c4ec6c0 |
| 5f640749 | 1789617756459 | 1.644 | homa.runtime.tools.resolve | fd6be3107a7b8134 | a84268653c4ec6c0 |
| 5f640749 | 1789617756461 | 0.052 | homa.runtime.skills.resolve | 5e9f0db381dd334a | a84268653c4ec6c0 |
| 5f640749 | 1789617756461 | 0.033 | homa.runtime.instructions.resolve | 851368b476ff0ee4 | a84268653c4ec6c0 |
| 5f640749 | 1789617756470 | 3590.057 | gen_ai.invoke_agent | d05e59860ffd037f | a84268653c4ec6c0 |
| 5f640749 | 1789617756519 | 3535.101 | gen_ai.chat | 43f96f18e3d512fb | 122c5b9bddd6fd80 |
| 5f640749 | 1789617756519 | 3538.797 | gen_ai.agent_step | 122c5b9bddd6fd80 | d05e59860ffd037f |
