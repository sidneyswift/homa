# Two-copy Astra latency screen, September 13, 2026

Status: diagnostic completed, not shipped. The five-second hosted acceptance goal remains unmet. Tracking: [#1171](https://github.com/sidneyswift/homa/issues/1171), draft [PR #1191](https://github.com/sidneyswift/homa/pull/1191). Owned branch: `codex/gh-1171-inline-turn-preview`; source baseline `c9c15610` plus the three experiment scripts committed with this report.

## Result and decision

Sending two model requests together, accepting the first response-text stream and cancelling the other barely changed the median: 1.823 seconds for single requests versus 1.801 seconds for two-copy races. The maximum observed fell from 3.848 to 2.140 seconds. Two singles exceeded 2.5 seconds, versus zero races. All 24 logical samples completed; all 12 losing attempts were observed cancelled.

The race was faster in 7 of 12 adjacent prompt/round comparisons and slower in five. This small screen supports investigating occasional long waits, not adopting the mechanism for every chat or claiming a p95 improvement. Both arms already stayed below five seconds without app overhead. The hosted target remains Send to first visible useful answer in at least 19 of 20 representative normal replies, with Astra medium, including preparation, hidden reasoning and rendering.

## Frozen protocol

- Run: 2026-09-13T23:07:42.311Z through 23:08:43.851Z. Node 24.18.0, installed Eve 0.19.0, AI SDK 7.0.14, Vercel Gateway OIDC.
- Model `openai/gpt-6-astra`, explicit reasoning `medium`, no retries, output ceiling 8,192 tokens, 90-second deadline, automatic caching, disallowed prompt training. No pre-run warmup; every sample retained.
- Three synthetic prompts: one-sentence phonics definition, one sentence for a frustrated child, and shortening a fixed synthetic prior answer. Four rounds. Single/race order alternates within adjacent prompt blocks. Frozen 24-slot plan saved before the first call; 12 singles plus 12 two-copy races equals 36 model requests.
- Input: compiled Homa static instructions and 89-tool catalog, about 32,550 to 32,585 input tokens. This is not the full hosted input, which had 95 tools and approximately 41,000 input tokens in the preceding experiment. Dynamic authenticated family context is absent.
- All tool implementations removed and `toolChoice: "none"`. Only synthetic text goes through inference; no family access, writes, actions, app workflow, database persistence or browser rendering.
- First text is the first nonempty `text-delta`, excluding setup and reasoning events. This boundary can include whitespace and is not a proof of a useful visible prefix. The winner alone contributes answer text. A winner that breaks after first text remains an incomplete sample; no silent replacement.
- Every recorded completed provider result reports `openai`. Reported reasoning-token counts are zero for these easy prompts despite the explicit medium setting. This is not evidence that medium was ignored.
- Cache hits dominate after the first call. Timing, cache sharing, prompt simplicity, alternating rather than random order, and correlated provider load limit inference. The first single includes a large cache write. No cost comparison is possible from winner usage alone: cancelled requests have no complete usage receipt and may still incur charges.

## All first-text observations

Seconds from local invocation, excluding hosted app overhead:

| Round | Prompt | Single | Two-copy race |
|---|---|---:|---:|
| 1 | phonics | 2.397 | 2.131 |
| 1 | frustration | 2.051 | 1.667 |
| 1 | shorter | 1.899 | 1.767 |
| 2 | phonics | 3.848 | 1.429 |
| 2 | frustration | 1.514 | 1.880 |
| 2 | shorter | 2.629 | 2.060 |
| 3 | phonics | 2.375 | 1.736 |
| 3 | frustration | 1.747 | 1.473 |
| 3 | shorter | 1.531 | 2.140 |
| 4 | phonics | 1.385 | 1.797 |
| 4 | frustration | 1.532 | 1.804 |
| 4 | shorter | 1.349 | 1.922 |

## Safety and integration findings

`scripts/latency-first-text-race.mjs` is a read-only experiment aggregator, not app streaming middleware. It cancels losers, retains attempt outcomes, and does not log raw provider errors. Four focused tests pass: setup/reasoning exclusion and loser cancellation; independent failure handling; failed winner retention; and parent cancellation before starting provider work. The paid run verifies cancellation was observed by the installed SDK, not that the provider performed or billed no further work.

The installed Eve resolver (`dist/src/runtime/agent/resolve-model.js`) returns the string model id for Homa's current configuration. AI SDK's `src/model/resolve-model.ts` resolves strings through its global default provider. A middleware seam therefore exists in source, but its app-wide scope, Eve lifecycle, telemetry, winner usage and cancellation must be tested before a preview implementation. No global provider override was added.

An app implementation cannot simply reuse this text-only race. A model may validly request a tool before any answer text. It must select one stream on its first actionable model output, preserve that winner's full tool/answer protocol, and allow exactly one execution path. First tool output is not the visible-answer success metric. Provider-executed tools and their effects also need separate handling because they may run before selection.

The prior hosted experiment also found a 15.852-second `load_skill` interval in one session and 1.569 seconds in another. Installed Eve's `loadSkillFromSandbox` awaits sandbox acquisition, then reads `/workspace/skills/<id>/SKILL.md`. The measured interval does not isolate machine creation from reconnect, setup or read time. Its public backend interface exposes `create` and the resulting session, which permits measuring that split without replacing the deployed sandbox or weakening its network policy. No sandbox backend change was made in this screen.

## Research checked September 13

[OpenAI latency guidance](https://developers.openai.com/api/docs/guides/latency-optimization) supports parallel independent work and speculative execution. It does not prove that duplicate requests reduce Homa's tail latency. [Gateway provider options](https://vercel.com/docs/ai-gateway/models-and-providers/provider-options) expose routing order, provider filters, caching and latency sorting. [Vercel latency and failover guidance](https://vercel.com/academy/ai-gateway/latency-failover) distinguishes provider deadlines from whole-operation timeouts: its provider deadline control requires customer-supplied provider keys, while Homa uses Gateway OIDC. A first provider chunk may contain hidden reasoning, so that deadline is not the visible-answer target. Cancellation can still incur cost.

## Evidence and remaining work

No application source, model setting, deployment or production configuration changed in this screen. No hosted browser acceptance samples were added. Further adoption requires a protocol-preserving preview implementation, action/cancellation/durability verification, and a hosted comparison retaining failures and cold starts. The next preparation investigation should split sandbox acquisition from skill-file reading before attributing the long tool interval to startup.

The complete synthetic receipt is preserved alongside the user-facing artifact as `ttft-astra-race-screen-20260913.json`; its original location is `/private/tmp/homa-astra-race-screen-20260913.json`. It includes the frozen slots, every answer, attempt outcome, and available usage metadata. SHA-256: `542e655425c3d92aca5329481602b7293d77a5ba3edc8ee9a5440a4f6c6497b1`. Compiled manifest SHA-256: `d241873aa00847de794b7d97d8d7d9440b0fc90ce3ce3376c265d9c91f174ec8`.
