# Live conversation evaluations

Owner and open acceptance: gh#1155. Baseline: d76df25e6210c5e38b4b9485075188fc3e9528f9.

## Question and competing explanations

A fluent voice can still lose a request or fail to deliver a result. The three
independent hypotheses are missing source context at delegation, queued updates
arriving after an older result, and audio delivery differing from caption output.
Deterministic tests exercise the first two. Real provider calls through the actual
web client exercise the third with synthetic speech and a disposable backend.

## Implemented changes

- Preserve up to 20 whole earlier caption rows, bounded to 6,000 characters, from
  the same audio connection at the delegation timestamp. Carry those as reference
  context to Eve's documented one-turn `clientContext`. Keep the latest source
  text and canonical message identity unchanged. Context is not new permission to
  repeat an action, and assistant captions do not prove tool effects.
- Authenticate and validate the context bundle; persist it in the calling adult's
  namespaced voice session before dispatch. Reject malformed, future, unordered,
  or oversized bundles. Do not restore previous audio connections into a new one.
- When another request is queued, preserve completed effects in chat and send an
  application-authored pending-update notice to Live instead of speaking the older
  answer as the current result. The newer backend result controls its own spoken
  completion. Typed requests follow the same version ordering.
- While work runs, a bounded quiet gap after new speech sends intent-aware guidance to Live. It must judge whether the speech is a correction, cancellation, or small talk; captions never dispatch work themselves.
- Explicitly clear previous waiting notices when the latest backend result arrives before requesting its spoken handoff. A real provider run exposed a completed replacement described as still pending.
- Tell Live to delegate corrections/cancellation and distinguish acknowledging the
  request from confirming it took effect. Already-running work may finish first.

These are implementation changes until the merge/deployment evidence is recorded
on gh#1155. Regression tests failed on baseline and pass after the changes.

## Repeatable lab

`node --env-file=apps/web/.env.local scripts/voice-evaluation/server.mjs`
starts a random-path loopback lab with actual VoiceMode, shared conversation code,
and the Live session route. Backend tools/auth are disposable fixtures. macOS
synthetic speech provides input; optional generated noise tests one controlled
condition. It captures captions, backend requests/results, audio start, received
non-silent audio, final session diagnostics, and caption response gap distributions.
The lab never records a family's microphone or writes family data.

The independent caller sees its goal and conversation only, not expected outcomes.
The separate model grader sees hidden scenario criteria and observed evidence.
Both use the existing Vercel OIDC gateway. Failed, ungraded, and harness-failed runs
are reported separately; none count as passing. Private reports can be regraded:

```
node --env-file=apps/web/.env.local scripts/voice-evaluation/server.mjs --grade-report /absolute/report.json
```

Current and concise instruction variants both preserve the complete binding Homa
persona. The concise transport variant exists only in the lab. Do not replace the
production prompt based on an ungraded or single-sample comparison.

## Investigation dispositions

| Area | Decision and practical limit |
| --- | --- |
| Request completeness | Implemented explicit same-call context rather than relying on a race with recent-history loading. Tests cover the current request's identity, context roles/order/bounds and adult/session scoping. Whole oldest rows fall out at the bound; this is not unlimited memory. |
| Corrections | Implemented queue-aware result speech and honest update instructions. The second request uses the original Eve continuation. This does not cancel the running turn or undo a committed effect. |
| Cancellation | The installed Eve client exposes send/stream and an AbortSignal for the HTTP request, not a confirmed durable task cancellation receipt. Aborting transport is not evidence that creation or sending stopped. General immediate cancellation would require durable task identity and revision checks at side-effect boundaries. Existing tool-specific cancellation/undo remains authoritative. Do not add an unverified abort-and-retry workaround. |
| Spoken completion | Actual provider captions and browser non-silent audio are observed separately. Commentary acknowledgment is not playback proof; audio energy is not proof a specific phrase was heard. Physical speaker and interrupted-completion coverage remain open. |
| Prompt structure | Experimental concise transport projection added for controlled comparisons. Binding persona preserved. Keep production instructions unless repeated independent grades establish an improvement. |
| Latency/buffering | Record caption response gap P50/P90 with sample counts, plus backend timestamps. These are proxies, not acoustic turn-end measurements. Queued-result suppression addresses stale answers, not a blanket delay for all results. |
| Durable cost accounting | Current client diagnostics are useful observations, but client-submitted duration is not authoritative billing evidence. A durable ledger needs server-observed provider final usage keyed once by provider session, with incomplete finalization explicit. A server-side event connection and an idempotent ledger would be a separate production change. Do not bill families or report exact margin from client timers. |
| Independent speech checks | Existing authenticated tool validation remains the effect boundary. No evidence in this suite justifies adding broad sentiment or speech surveillance. A future server check must have a defined failure to catch and tested media intervention; a sideband alone cannot retract speech already played. |

## Evidence limits and remaining acceptance

The deterministic suite covers malformed context, repeated delegation, recoverable
errors, disconnect, explicit native resume, request cutoff, queued updates, and
transcript persistence. The browser lab covers synthetic interaction with real
GPT Live, but not the full Eve materials pipeline. Neither proves behavior on an
installed phone, Bluetooth output, real accents/noise, or long household sessions.

Approved human recordings and physical-device evidence remain unavailable. The
local Vercel login currently lacks the Homa team, preventing OIDC refresh for the
independent caller/grader. The founder has been asked to restore that access while
implementation and deterministic/provider tests continue. Do not close gh#1155 or
label it full voice certification until the remaining evidence is collected.

Official sources: [Live delegation](https://developers.openai.com/api/docs/guides/live-delegation),
[Live evaluation guide](https://developers.openai.com/cookbook/examples/audio/voice_agent_evaluation),
[server controls](https://developers.openai.com/api/docs/guides/voice-server-controls?api=live),
[cost and duration](https://developers.openai.com/api/docs/guides/voice-latency-cost?api=live).
Installed Eve contract: `apps/web/node_modules/eve/docs/guides/client/messages.mdx`
and `streaming.mdx`. Release evidence and numeric observations are recorded on the
issue and the dated report after testing.
