# App2 live voice connection

Owner: [#1158](https://github.com/sidneyswift/homa/issues/1158). Founder request: connect real voice to the local `/app2` exploration.

## Behavior

- Page load does not request microphone access. Clicking Voice mounts the existing web `VoiceMode` transport after account admission through the existing authenticated app shell resolver.
- Founder correction, September 12: local `/app2` voice does not require an active plan. The session route skips its two billing checks only when the server runs in development, the request URL is loopback, and the client marks the app2 surface. The marker alone grants nothing in production or on a non-loopback origin. Ordinary voice clients retain both billing checks.
- Authentication, family identity, session limits, provider configuration, tools, and saved transcripts retain the existing server paths. There are no new credentials, provider integrations, schema changes, or family-ID request parameters. This exception only admits a local voice session; it does not remove billing policy from agent actions.
- Text and Voice select layouts independently of the live session. Switching to Text keeps microphone and playback preferences unchanged.
- Mic sets the real local audio track's `enabled` property. Sound sets the playback element's `muted` property. Preferences survive layout changes and replacement calls.
- End voice stops capture and playback, closes the connection through the shared transport, and finishes transcript persistence. Failed saves remain retryable.
- Typed messages use the same `LiveVoiceConversation.sendText` bridge while connected. Sending before connection or after ending is disabled. Standalone text sessions and attachments remain outside this change.
- A compact status identifies connection and mic/sound state. Conversation captions are expandable. Actual work opens the existing result renderer, including report, planner, and checklist controls.
- The existing `VoiceResultHandoff` announces newly completed work in replacement calls. Session generation and source sequence prevent an old follow-up question from becoming an instruction in a new call.
- The character retains its separately approved thicker body and forward resting pose. Its idle movement is not a representation of listening, speaking, or backend work.

## Shared component boundary

`apps/web/app/app/voice-mode.tsx` retains its default `/app` panel and gains optional audio preferences, an imperative end/send handle, and a stable custom presentation component. `/app2` supplies its dock and compact status. No copy of the WebRTC transport was introduced.

## Evidence and limits

Focused transport, shared conversation, and result-rendering tests verify controlled resource behavior without contacting a microphone or provider. Added cases cover independent mic/playback changes without reconnecting, explicit shutdown, and rejection of typed sends before connection or after end. TypeScript and focused ESLint are required before the checkpoint.

Browser verification reached the account-admission message on the local origin. This browser did not have an admitted local Homa account, so no microphone permission or paid voice session was opened. Real spoken input, audible response, device turn-taking, and local provider credentials remain unverified until local sign-in and a spoken test. A static UI or passing transport fixture is not live audio certification.

Independent review found and corrected old-question continuation, delayed-result announcements, hidden work progress, capture visibility, and unstable status-component identity. This remains development-only; no production rollout is claimed.

Local billing-exception verification: 16 focused session/transport tests passed, including unpaid local app2 admission, production and ordinary-client billing enforcement, unauthenticated and rate-limited rejection, and cross-user shutdown rejection. The founder subsequently reached the signed-in session billing error; the earlier anonymous-browser observation describes the initial wiring check.

## September 12 spoken-session result delivery failure

The founder completed a real local voice conversation, then asked for a worksheet. The backend run `wrun_01M2AVSG730DNDMJNHHEE0DKYP` received that request at 13:09:31 UTC and durably emitted `message.completed` plus `session.waiting` at 13:10:13 UTC. It asked about the child's age and offered a picture card; there was no worksheet creation tool call. The result reader remained open until the 290-second bridge deadline, then displayed a generic failure. A subsequent delegated request was held behind it and completed in approximately 29 seconds after the first reader released. Its clarification was visibly transcribed in the ongoing voice call. No request was replayed during investigation.

The local workflow stream files establish that the first answer existed well before the bridge returned. They do not establish why the initial live stream missed delivery. Eve 0.19.0's client also defaults a stream with no terminal event to `completed`, including an aborted read. The bridge now reads the existing session's event stream explicitly, reattaches after 15 seconds without events using its next unread cursor, and requires a terminal session event. Reattachment never calls `send` again. The total bridge deadline, authentication, family scope, and action admission remain unchanged.

Local fix validation: 39 focused stream, bridge, and Live conversation tests passed; web typecheck and focused ESLint passed. Recovery tests cover a stream stalled before its first event, a stall after a partial result, exact cursor continuation, overall cancellation, premature EOF, and authorization failure. This fix is local and uncommitted. A fresh spoken handoff with the changed reader remains necessary before claiming audible recovery is certified. The dev overlay's hook-dependency warning came from hot reload during the earlier local admission edit; it is separate from the durable result delivery evidence.

## Save-warning recovery

On the later save-warning report, no process was listening on local port 3002 and the inspected app2 tabs showed connection errors. The development server was restarted. Audio and transcript persistence have separate connections, so audio admission does not prove saving is available. Recovery of every earlier transcript line has not been established.

The web client now receives save-failure state independently of general voice errors, offers the existing retry action during an active call, and clears that state only after pending writes are acknowledged. A successful active-call retry does not close the voice panel or stop audio. Manual retries use the existing serial save queue. Shared core callers without the optional save-state callback retain their existing error reporting. Verification: 36 focused conversation and transport tests passed, including active-call recovery and concurrent retries; web typecheck and web ESLint passed. Changes remain local and uncommitted.
