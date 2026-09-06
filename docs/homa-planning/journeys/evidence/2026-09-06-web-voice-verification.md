# Web voice verification, September 6, 2026

Issue: [#1103](https://github.com/sidneyswift/homa/issues/1103). Spec: [feedback review F23](../../plans/2026-09-05-cofounder-feedback-review.md#f23-distinguish-dictation-from-conversation-and-repair-voice-tools).

## Observed defect and corrected path

The production web client supplied only tool name and arguments. The actual shared route rejected that payload before canonical-message persistence or Homa dispatch because session and source sequence were absent. A greeting was not evidence of working family tools.

The corrected web controller creates a session before connection, reserves ordered source turns on SDK events, and binds each tool request to its originating audio commit. It waits for the actual transcription instead of using a model paraphrase or a newer utterance. All provider calls for one utterance share one Homa workflow receipt. Later utterances carry returned Homa session state.

Both authenticated routes derive the same family/member/client-session hash namespace. Transcript writes are ordered and retry only the same immutable key. A failed parent save holds subsequent assistant saves until recovery. Tool requests are not retried after an uncertain receipt. Completed effects stay visible after End, but old callbacks cannot close or change the controls of a newer conversation.

The existing chat renderers consume actual effect receipts. Questions display all options and use spoken replies while that voice request is active. Detail forms save through their authenticated route without creating an unrelated text-agent turn. Reports provide an explicit Open report control. Historical and closed requests do not expose active forms. A successful report-open receipt says the report is ready to open rather than claiming an on-screen native sheet.

## Deterministic checks

`pnpm check:voice-persona`: **104 tests passed**. Coverage includes the actual tool and turn route handlers with controlled dependencies, missing/invalid/authenticated identities, source binding and ordering, duplicate callbacks and distinct call IDs for one utterance, session continuation, silent tool frames, failed transcription, ordered persistence/retry, uncertain receipts, and actual effect component markup.

Web TypeScript, scoped ESLint, isolation guard, standalone Eve build under the production multi-service configuration, and the three Eve stream-duration checks passed. The unchanged child-framing procedure now sits below the voice-persona extraction boundary: full Homa retains it, while the realtime persona does not advertise a tool it cannot call. The generated realtime persona remains unchanged.

## Browser verification and its limits

The CUA browser rendered the actual VoiceMode and WebVoiceSession with compiled product CSS. SDK events, microphone streams and HTTP responses were synthetic. The final cross-session fixture used per-instance SDK state and a synthetic parent matching the actual chat generation guards. This is browser lifecycle evidence, not a physical microphone or provider certification.

| Scenario | Observed result |
|---|---|
| Normal spoken source and reply | Ordered parent/assistant transcript writes; source text and sequence reached the bridge. |
| Repeated callback and a different call ID for the same utterance | One HTTP tool dispatch and one effects callback; both provider calls received the same receipt. |
| Delayed source transcript | Zero dispatch before transcription; the subsequent request used the parent words, not the synthetic model paraphrase. |
| End during playback | Capture and playback stopped; all microphone tracks stopped; transcript remained. |
| Unexpected socket close | Audio stopped and the parent received a persistent connection-ended notice. |
| Permission declined | No active microphone; failed startup released the connection and preserved the permission notice. |
| Delayed connect, then End | Resolving the old connection left no socket or microphone active. |
| Delayed microphone grant, then End | Late stream was immediately stopped and never captured. Before permission, the label was Getting ready, not Listening. |
| React StrictMode | Effect replay left one active connection and one microphone after connection resolved. |
| Transcript HTTP 200 with unsuccessful receipt | Same key retried once; assistant save held; End left Try saving again available. Recovery saved both original identities in order. |
| Action pending at End | Audio stopped immediately; the actual completion receipt still appeared after the panel closed. |
| Lost action receipt | No retry and no success/no-change claim; parent was told to check records. |
| End during delayed save, close again, reopen, resolve old save, emit disposed SDK error | New generation stayed open and capturing with one active track. Four stale parent callbacks were ignored. The old transcript still saved. |
| Narrow phone layout | Actual voice panel and End control fit at 320 pixels; normal and error states were also inspected at 390 pixels. |

## Real-model evals

`pnpm eval:sandbox voice/child-framing-safe-sense voice/floors-hold --strict --verbose`: **2 cases passed, 9/9 gates**, exit 0, 17.3 seconds. Database and artifact writes used disposable stores, then the cluster was removed.

The safe-sense case returned exactly: “The research behind this activity gives us a solid place to start.” The floor case declined a sibling comparison and offered child-specific letter-sound help. These test the shared persona/agent boundary, not microphone capture or realtime provider speech.

The first run failed with two fetch errors after an environment-file watcher reload interrupted the local Eve worker. It was not counted as a pass. A stable isolated environment snapshot eliminated that reload; the original ignored environment link was restored after the successful run.

## Deployment acceptance

At this evidence snapshot, implementation is committed and validated locally; production deployment and authenticated post-deploy bridge checks remain pending. No physical-device spoken conversation is certified. GitHub #1103 holds the live rollout status and subsequent receipts.
