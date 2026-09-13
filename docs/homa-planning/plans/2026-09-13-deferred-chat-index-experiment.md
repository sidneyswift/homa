# Deferred user indexing experiment, September 13, 2026

Status: preview experiment complete; five-second target not achieved. Tracked by [#1171](https://github.com/sidneyswift/homa/issues/1171). Implementation commit `5ef8844d38e2ee3f1131e511b977e2e737fb4a72` remains in the owned draft branch. Production is unchanged.

The target remains Send to the first visible useful answer within five seconds for 19 out of 20 normal replies, using Astra medium. Hidden reasoning, app preparation and streaming transport count. This eight-Send diagnostic screen is not a p95 acceptance batch.

## Change and safety boundaries

The control awaits user-message embedding, canonical persistence, and the vector update before the model starts. The experiment saves the canonical user message immediately and retries missing user indexes in the authenticated session on `turn.completed`. It requires both `VERCEL_ENV=preview` and `HOMA_PREVIEW_DEFER_USER_INDEX=1`. Production and unflagged paths retain their existing ordering.

The retry source is canonical database rows with a null embedding, restricted by family, session, web channel, user role, family visibility, and minimum text length. Each pass reads at most eight rows with a two-second statement timeout and shares an eight-second model cancellation signal. The signal bounds provider work, not the complete hook including database/usage writes. Updates retain exact-content and family guards and never replace an existing user index. A later completed turn can retry interrupted indexing; a session that never completes another turn can remain full-text searchable without a semantic vector. No global recovery worker or migration was added.

## Matched hosted screen

Both protected previews use exact source `5ef8844d`, Eve 0.19.0, AI SDK 7.0.14, and `openai/gpt-6-astra` with medium reasoning. Both are READY in iad1. The only experiment setting difference is user-index deferral. Priority, inline-turn and chat warmup switches are off. Each arm starts with a fresh, identically shaped synthetic family. No health warmup was used.

- Control: `dpl_98WeixSvNGhbGxZ5oC114S2NBTyZ`, https://homa-llivumyde-homa-1d878b0e.vercel.app
- Deferred index: `dpl_CUGK4VU7gDbynfDYjwcRa9Dpraoe`, https://homa-wozeyp6ik-homa-1d878b0e.vercel.app

| Prompt | Control, seconds | Deferred index, seconds |
| --- | ---: | ---: |
| Reply with only the word Ready. | 8.687–8.754 | 6.802–6.872 |
| What does phonics mean? Answer in one short sentence. | 18.635–18.712 | 8.554–8.624 |
| Give me one sentence I can say when a child feels frustrated by a hard task. | 12.803–12.879 | 9.722–9.793 |
| Make that sentence shorter. | 6.220–6.294 | 5.531–5.607 |

All eight logical Sends produced complete answers. None produced even first text within five seconds. The Ready prompt is artificial. The shorter prompt followed the frustration answer consecutively in each arm, with the next input entered while the preceding answer was still streaming. Both subsequent answers completed, but this single pair does not establish safety under rapid sustained traffic.

The continuous v2.1 DOM observer found no observation gap above one second and recorded visible-page status throughout. The ranges bound sampled first text, not physical paint or keyboard focus. The six-second observation window ends at first text when the reply is later than six seconds. Complete answers were separately inspected in the UI and database.

## What actually improved

The control's indexing plus vector update occupied 227–381 milliseconds before the model. The experimental pre-model traces contain no embedding stages. User persistence fell from 269–482 milliseconds in the control to 40–82 milliseconds in the experiment. All eight user messages and eight assistant messages were subsequently verified present and indexed in the database, scoped to their two fixture owners. No tools ran.

The larger visible-time differences cannot be attributed to indexing. For the identical phonics answer, the model-step-to-first-append interval was 15.825 seconds in the control and 6.036 seconds in the experiment. Both follow-up prompts had nearly complete input-cache hits. Across this small screen, approximate Send-to-first-model-step time was 2.368–8.226 seconds, the first-model-step-to-append interval was 1.839–15.825 seconds, and append-to-observed-text was at most 130–232 milliseconds. Cross-host clock comparisons are approximate.

A separate startup lead remains: on the frustration prompt, the control's POST reached the function at 1789337291096 and authentication began at 1789337295424, a 4.328-second gap. The experimental arm showed a similar 4.157-second gap. This is consistent with handler startup, but not an independently measured cold-initialization span. It warrants a focused startup experiment before further attempts to trim small database reads.

## Verification and evidence

- 15 focused persistence, timing and experiment tests passed.
- Full conversation regression suite: 329 passed, zero failures.
- Typecheck and focused ESLint passed.
- Disposable local PostgreSQL test passed: family/session exclusion, hidden/internal and other-channel exclusion, null-only updates, stale-content rejection, replay protection and eight-row batch limit. It uses a minimal relational schema, not the complete migration stack.
- Full Next build, Eve build and stream-duration guard passed on the current 0.19 runtime.
- The prior same-session isolation guard passed before these query changes.
- Hosted UI replies and exact fixture database reads verified the experiment behavior; both test accounts were signed out afterward. Fixture accounts remain registered for reuse, not retired. An initial failed fixture signup/family-creation attempt was fully cleaned by its guarded helper before retry.

Local evidence: `/private/tmp/homa-eve-hosted-5ef8844d/` contains source provenance, deployment receipts, frozen protocol, all eight raw observer samples, complete-answer metadata, deduplicated preparation marks, `analysis.json`, and browser summaries. Build evidence is `/private/tmp/homa-five-second-active/index-experiment/build-receipt.json`. These local paths are not shared or permanent artifact storage.

Next: isolate the approximately four-second request-arrival-to-authentication gap on the current runtime, then measure model-phase variability independently. Keep the experimental indexing change preview-only until its queue/retry behavior and user-facing benefit justify rollout. Production runtime upgrade remains blocked by the previously documented parked-session compatibility failure.
