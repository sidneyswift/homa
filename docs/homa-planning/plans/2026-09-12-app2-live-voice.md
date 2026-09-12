# App2 live voice connection

Owner: [#1158](https://github.com/sidneyswift/homa/issues/1158). Founder request: connect real voice to the local `/app2` exploration.

## Behavior

- Page load does not request microphone access. Clicking Voice mounts the existing web `VoiceMode` transport after account admission through the existing paid app shell resolver.
- Authentication, family identity, plan access, session limits, provider configuration, tools, and saved transcripts retain the existing server paths. There are no new credentials, provider integrations, schema changes, or family-ID request parameters.
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
