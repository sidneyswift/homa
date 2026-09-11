# GPT Live documentation audit

Date: 2026-09-11. Baseline: `6e733a503c880ea917693b29e9148dc227324295`.
Implementation and release: gh#1154. Remaining evaluation work: gh#1155.

## Outcome

Homa uses the appropriate documented architecture: `gpt-live-1`, Gleam,
WebRTC media, and client delegation to the authenticated Eve backend. This
review found three concrete lifecycle defects and an observability gap. The
fixes preserve the existing model, family authorization, tool execution,
caption grouping, and verified material handoff.

This is a protocol and implementation audit, not a certification that every
spoken interaction succeeds. The remaining evaluation and context risks below
are tracked explicitly rather than described as passing.

## Documentation coverage

Read all six GPT Live navigation guides and the Live sections of the four
connection guides, plus voice architecture, cost guidance, and the evaluation
Cookbook. Reviewed the relevant primary event schemas and the differences for
sideband/fork transports. Shared connection pages also include Realtime tabs;
those use a different protocol and must not supply Live event names.

| Official source | Scope checked |
| --- | --- |
| [Getting started](https://developers.openai.com/api/docs/guides/live) | Frontend/backend split, client delegation, startup and closure |
| [Prompting](https://developers.openai.com/api/docs/guides/live-prompting) | Concise voice instructions, backchannels, interruptions, delegation conditions |
| [Managing sessions](https://developers.openai.com/api/docs/guides/live-conversations) | Configuration, history, appends, captions, greeting, errors, finalization |
| [Delegation and tools](https://developers.openai.com/api/docs/guides/live-delegation) | Exact delegation IDs, context, authorized actions, corrections, typed input, progress |
| [Migration](https://developers.openai.com/api/docs/guides/live-migration) | Existing Eve adapter, preserved tools and safeguards, validation boundaries |
| [Partners](https://developers.openai.com/api/docs/guides/live-partner-integrations) | Direct integration remains suitable; partner adoption is optional |
| [WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live) | Server SDP exchange, media tracks, event channel, initialization |
| [WebSockets](https://developers.openai.com/api/docs/guides/voice-websockets?api=live) | Server transport and continuous audio; not the app media path |
| [Server controls](https://developers.openai.com/api/docs/guides/voice-server-controls?api=live) | Sideband ownership, guardrail and playback limitations |
| [SIP](https://developers.openai.com/api/docs/guides/voice-sip?api=live) | Separate inbound telephony contract; not web/native transport |
| [Cost](https://developers.openai.com/api/docs/guides/voice-latency-cost?api=live) | Cumulative duration, initialization charge, backend costs, active time |
| [Voice agents](https://developers.openai.com/api/docs/guides/voice-agents) | Architecture fit and separate quality axes |
| [Evaluation Cookbook](https://developers.openai.com/cookbook/examples/audio/voice_agent_evaluation) | Crawl, walk, run, independent grading and playback evidence |
| [Primary events](https://developers.openai.com/api/reference/resources/live/primary-websocket) | Append/ack, transcript/delegation, usage, close and error schemas |
| [Sideband events](https://developers.openai.com/api/reference/resources/live/sideband-websocket) | Existing-session attachment and reflected audio differences |
| [Fork events](https://developers.openai.com/api/reference/resources/live/fork-websocket) | Stored-session restoration, not enabled here |

Full public Markdown snapshots were fetched to `/private/tmp/live-audit-*` for
inspection. They are temporary research material, not runtime dependencies.

## Concrete fixes

| Finding | Before | After | Evidence |
| --- | --- | --- | --- |
| Provider error ended a healthy call | Web and native called `fail()` for every `error` event | Startup errors still fail; a running call reports rejected steps and waits for a terminal event or transport failure | Actual client modules tested with controlled transports |
| Event channel could close while UI kept listening | No channel close/error handlers | Both events end the call, release microphone, and update status | Web and native close/error regression cases |
| Native foreground reopened voice automatically | Returning to the app created a fresh paid session | Remains paused until the parent's explicit Resume tap | Native foreground regression; preserves gh#987 tap-only law |
| No append/finalization receipts | Appends and duration updates were untracked | Match acknowledgments by ID and event type, count rejections, retain latest duration and terminal reason | Shared diagnostics tests; no transcript content in diagnostics |
| Cleanup lacked finalization distinction | Always called hangup after a short wait | Wait up to five seconds for `session.closed`; use signed hangup fallback if needed; record incomplete finalization | Real synthetic session closure plus controlled transport tests |

Lifecycle code lives in `apps/web/app/app/voice-mode.tsx` and
`apps/mobile/src/features/voice/use-voice-session.ts`. Shared receipts and
protocol logic live in `packages/core/src/live-voice.ts`. Tests execute the
actual clients with mocked media/network dependencies in
`apps/web/app/app/live-connection.test.ts`, wired into `check:voice-persona`.

A completed session with missing/invalid usage does not certify its last
snapshot as final usage. A context acknowledgment never certifies playback.
Diagnostics remain client-local and are not an authoritative billing ledger.

## Existing alignment

- Session creation authenticates the adult, checks family entitlement and limits,
  pins model/voice on the server, and returns no project credential.
- Cleanup uses a signed handle scoped to the same adult and family.
- Audio stays on negotiated WebRTC media. Startup waits for `session.started`;
  no Realtime audio commits, VAD configuration, or speech-trigger commands leak
  into the Live transport.
- Only an actual delegation or explicit typed request starts backend work.
  Captions retain timing, overlap and stable identities. Display grouping is
  not permission to execute a tool.
- Delegation IDs remain opaque. Duplicate requests are suppressed, backend
  continuation is retained, and ambiguous tool failures are not automatically
  retried. Tool execution remains behind authenticated, scoped server routes.
- Result cards and spoken captions are distinct. Terminal backend results reach
  the chat even after the originating microphone closes. Confirmed final
  printables receive a spoken handoff during an active conversation.
- Speech is requested through commentary appends within the documented size
  bound. Application-authored clarification guidance uses instructions.
- Native mute disables local capture; it does not claim to cancel backend work.
  Ending or pausing voice releases the microphone independently of backend work.

## Deliberate choices and remaining limits

| Area | Audit disposition |
| --- | --- |
| Client delegation | Keep Eve. The docs recommend this for an existing custom agent and controlled result handling. No reason to migrate to hosted Responses delegation. |
| Prompt length | Homa retains its binding generated persona, longer than the minimal Live template. A shorter speech-only projection needs behavior comparisons, not an untested rewrite. Tracked in gh#1155. |
| Stored recordings and forks | `store: false` is intentional. Do not enable recording storage as a reliability workaround. |
| Restoring spoken history | A replacement audio session does not replay earlier family transcripts. Previous automatic approval review rejected that additional data transfer. Backend continuity is retained, and the new audio session is told the limitation. |
| Corrections during work | Serial backend continuation is present, but there is no general task-revision/cancellation protocol. gh#1155 must test active-task corrections and stale results before this can be certified. A speech interruption alone never establishes cancellation. |
| First delegation context | The adapter sends an exact source row plus backend continuation. Cross-row context before the first delegation needs explicit evaluation; captions alone do not establish that the backend received every earlier detail. Tracked in gh#1155. |
| Spoken completion | Commentary is a request to communicate a result. It is not guaranteed verbatim speech or proof the parent heard it. Device playback and interrupted-result coverage remain unverified. |
| Server-side conversation checks | Tool authorization remains deterministic. There is no independent streaming speech guardrail sideband. That is a separate product/control decision, not a benefit supplied automatically by client delegation. |
| Metrics | Client receipts now expose duration and finalization. Durable operational accounting, repeated audio latency distributions, and a production quality dashboard remain outside this patch, tracked in gh#1155. |
| Evaluation | Existing event tests and synthetic browser calls cover specific failures. Approved human recordings and independent continuous caller simulations are still needed for complete crawl/walk/run coverage. |
| Other transports | SIP, raw WebSocket audio, partner SDKs, custom voices, and stored-session forks are documented alternatives, not requirements for the web/native path. |

## Validation and release evidence

Local voice suite, native compatibility, web/core/native type checking, and
applicable lint are required. Run the actual web client against a synthetic
GPT Live session for greeting, delegation, clarification, and graceful close.
Keep credentials server-side and use no real family writes in that check.

Release evidence, exact merged SHA, required CI, production deployment/probes,
and the native delivery receipt are recorded on gh#1154. The iOS release rail
must prove that the OTA runtime matches a finished production binary. Neither
a published update nor a browser transcript proves physical-device playback.
