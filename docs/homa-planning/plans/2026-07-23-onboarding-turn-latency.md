# Where the 12-17 seconds go: the onboarding per-turn latency floor

**Date:** 2026-07-23 · **Status:** measured, three fixes shipped, four
founder decisions open · **Mandate:** founder ruling 2026-07-23
("all four post-loop items approved", item 3), an infra investigation
into the per-turn latency floor of chat-first onboarding.

**Headline:** the kickoff turn went from 17.8-23.8s to **6.3-10.9s**
measured, and the investigation surfaced a silent wiring bug: from the
second turn of every walk onward, the family was being read as
onboarding-DONE, so onboarding-mode (and with it the arc's whole
instruction set) unloaded right after the first card saved. A good part
of the observed "slow, thinky" turns was a model navigating the arc
blind.

Method: instrumented walks against the real dev server (launch config
"onboarding", `/api/dev/test-session` families, driving `/eve/v1/session`
directly and timestamping every NDJSON stream event), the compiled agent
manifest for prompt composition, eve 0.19.0's shipped harness source for
the turn mechanics, and production `model_usage` rows (last 7 days,
`channel='web'`) for the prod cross-check. Raw traces:
one-off kickoff capture, three full walks, and a post-fix verification
walk, all 2026-07-23.

## The anatomy of one turn

Every eve turn is a durable workflow. One **step** = one model call plus
the tool calls it makes; after any tool call the harness must call the
model again with the tool result. Dynamic instructions (family context,
onboarding mode, progress, continuity) are rebuilt on `turn.started`
and ride in the system block.

A pre-fix reaction turn (the turn after the basics card saves) ran
**three model steps**:

1. `load_skill` (the model pulling the onboarding skill),
2. the real step: think, react, call the next `ask_for_details` card,
3. a tail step whose only job is to say nothing after the card.

## Where the time goes (measured)

Local walks, warm dev server, times from send to `session.waiting`.
Kickoff turns ran 17.8-23.8s (2 steps); reaction turns 22.9-37.4s
(1-3 steps). The founder's 12-17s walks sit at the fast end of the same
structure. Per phase:

| Cost | Measured | Share of a reaction turn |
|---|---|---|
| Invisible reasoning + generation in the main step | 8-25s (TTFT 15-24s; 450-1,900 output tokens against 28-68 chars of visible text) | **dominant, ~60-75%** |
| `load_skill` step (once per session, on the most-watched turn) | 3.2-6.4s incl. its own full-prompt prefill | ~15-25% of that turn |
| Tail step after a card | 2.2-3.5s, 11-15 tokens of filler | ~10% of card turns |
| Full prompt-cache miss on step 0 | cacheRead=0 on **every** local turn, 43-54k tokens re-prefilled (~2-4s) | ~10-15% |
| Harness: dispatch + turn.started hooks (context queries) | 0.6-1.6s warm | small |
| Dev-only: first-hit route compile | 7-9s POST ack once, 0.3-0.6s after | noise, excluded |

Supporting numbers:

- **Prompt size:** ~44k tokens on a brand-new family. Composition from
  the compiled manifest: 50 static tool schemas ~17.9k tokens (the two
  largest, `create_printable` 1,284 and `generate_image` 1,156),
  `instructions.md` ~8.1k, skill descriptions ~0.6k, dynamic family and
  onboarding context, harness scaffolding, and history making up the
  rest. Loading the onboarding skill adds ~6.9k.
- **Reasoning dominates, and it is invisible.** The main step of each
  reaction turn emitted 489-1,880 output tokens; the visible text was
  one or two sentences. Sonnet 5 through the gateway runs with
  provider-default thinking (`agent.ts` sets no `reasoning`), and the
  stream's `reasoning.appended` deltas are empty strings, so nothing on
  screen moves while it thinks. Prod confirms the shape: step wall time
  scales with output tokens, p50 6.6s under 500 tokens rising to 39.6s
  above 2,500. Caveat discovered late: part of that thinking was the
  model navigating without its mode instructions (bug 3 below), so the
  post-fix baseline for how much a well-instructed reaction turn thinks
  is smaller; re-measure before acting on R1.
- **The prompt cache does not survive turns.** eve's gateway path sends
  `gateway.caching: "auto"` with no stable breakpoints; the per-turn
  dynamic context rewrites the system block, so step 0 of every measured
  local turn was a full cache miss (`cacheReadTokens: 0`, 43-54k written
  fresh). Prod: 58.8% of web-chat turns contain a full-miss step, and
  the misses concentrate on step 0 (within-turn steps almost always
  hit: 1,477 hit vs 19 miss among non-first steps). The 5-minute
  Anthropic cache TTL also guarantees a miss whenever a parent takes
  longer than that to reply, independent of context changes.
- **Prod is the same animal, not a dev artifact.** Prod web-chat turns
  (330, 7 days): median 3 steps, median 1,557 output tokens, p50
  cache-hit step 15.9s, p50 full-miss step 33.7s. Local dev adds
  compile noise on first hits but the floor is model-side.
- **Perceived latency is better than total, by design that already
  exists.** The card renders the moment its tool result streams
  (`state === "output-available"`), ~7s in on the kickoff; the tail
  step burns behind an already-visible card. Reaction text streams
  token-by-token, so its perceived cost is the thinking-dominated TTFT.

## Shipped now (this branch)

**1. The onboarding skill rides in onboarding-mode's instructions; the
`load_skill` step is gone.** `lib/onboarding/onboarding-mode.ts` owns
the composition; `agent/instructions/onboarding-mode.ts` reads
`SKILL.md` from the source tree (module-cached, the same pattern
`narrative-generate.ts` uses for `report-writer.md`) and inlines the
body under a "already loaded, never call load_skill for onboarding"
header. Costs ~5.8k prompt tokens per onboarding turn, only for
sessions the auth walk stamped `onboardingActive`. Removes one full
model step, including its full-prompt cache-miss prefill and its
sandbox read (eve's `load_skill` reads through the sandbox session),
from the first reaction turn of every onboarding session.
Known gap: the deployed eve function bundle carries no source tree, so
in that runtime the composer falls back to the original load_skill
line (same behavior as before, never worse) and logs
`onboarding-mode: SKILL.md not reachable`. eve 0.19's build rejects
both the static `?raw` asset import (its extension resolver wins over
its asset plugin) and the dynamic variant (authored modules must
bundle to one chunk); closing the gap wants either a defineSkill
single-sourcing pass or an eve-side fix, see R4.

**2. The card's tail step asks for eve's empty-delivery sentinel
instead of the impossible "emit no text".** The harness never accepts
an empty reply (it retries one with a corrective nudge), so a model
told to say nothing invents filler: this investigation caught
"I'll wait for her to fill that in." and "(No further text this
turn.)" live, the sixth and seventh members of the family
`assistant-text.ts` already enumerates. The tool result now instructs
`<eve-empty-delivery/>` exactly, which the harness delivers as true
silence (`message.completed` with `null`, dropped from history), the
web reducer removes even the streamed deltas, and `message-parts.tsx`'s
`ENDS_THE_TURN` guard was already hiding every post-card text part
anyway, so the note now also tells the model the honest fact that
words written there are never shown. Verification walk after both
fixes: reaction turn dropped to two steps (no `load_skill`), tail step
delivered silence, no filler bubble.

**3. The silent onboarding-mode unload after the first card save.**
Found by watching prompt sizes shrink turn-over-turn: `beginOnboarding`
(the function whose docstring says it stamps the durable record "the
first time a family enters the chat flow, so profile_completed_at stops
mattering") was never called by anything. The basics card's save stamps
`profile_completed_at`, and with no record the predicate's fallback
reads that stamp as done: from the next turn the auth walk stopped
stamping `onboardingActive`, onboarding-mode returned null (eve deletes
a dynamic block whose resolver returns null), and family-context's
onboarding lines dropped too. The arc kept limping only because the
model re-loaded the skill by its description. Fix: `/onboarding`'s
`loadChatProps` now calls `beginOnboarding` once the chat surface
admits the family, before any card can save; `beginOnboarding` also
early-returns when a record already exists rather than rewriting
"active" per visit. Verified by walk: the mode block now survives the
basics save (turn-1 prompt carries the full mode + skill).

**Post-fix verification walk** (same instrumentation, the realistic
shape: basics + homeschool saved, then ONE combined `details_saved`,
exactly as the client's card chaining sends it):

- Kickoff turn: **6.3-12.1s** (was 17.8-23.8s). Step 0 hit the prompt
  cache in full (51,512 cache-read: the prefix is stable before any
  card saves), the card streamed at ~7s, and the tail step delivered
  the sentinel as true silence in ~2s.
- Combined reaction turn: **16.1s** with the real reaction ("Good to
  meet you, Sarah. Charlotte Mason is a lovely way...") streaming at
  8.7s and the child card at 12.3s. No `load_skill` step anywhere.
- Two earlier walk artifacts explained on the way: a basics-only
  `details_saved` (a message the real client never sends) is answered
  with silence, which is the skill's own between-cards rule working;
  and the sentinel note was tightened to bind to the current turn only
  after one walk over-applied it.

Two behaviors observed in the verified walk for follow-up, not changed
here because SKILL.md has concurrent in-flight edits this session:
the model spent one step re-saving card entries through
`save_family_basics` + `save_homeschool_profile` (~6s) although the
card routes had already saved them (the skill should state a card's
save is durable); and see R6 for the post-reply hook cost.

## Open levers, in impact order (founder decisions)

- **R1 · Cap or trim reasoning on chat turns.** The single biggest
  lever: 450-1,900 invisible thinking tokens per reaction turn is
  8-15s. eve 0.19 exposes `reasoning` only agent-wide in `agent.ts`,
  so an onboarding-only cap needs eve support; a fleet-wide change
  alters model behavior everywhere and needs its own eval (materials
  judgment may want the thinking that a "which card next" decision
  wastes). Do not flip blind; A/B with the existing walk fixtures.
- **R2 · Give the prompt a stable cache prefix.** Today every
  content-bearing turn re-prefills 43-54k tokens because volatile
  per-turn context shares one cache segment with 26k tokens of static
  tools + instructions. Options: eve's anthropic-direct path (it
  places explicit breakpoints at tools-end, system-end, and
  conversation; but it changes gateway routing/billing), an eve
  feature ask (stable breakpoints on the gateway path, or dynamic
  instructions positioned after a static prefix), or trimming how
  often family context changes shape mid-onboarding.
- **R3 · Make cards runtime actions.** eve 0.19 already supports tools
  whose `runtimeAction` parks the turn for the client to resolve, with
  **no tail model step at all**: the right long-term shape for
  `ask_for_details` (and `start_checklist`). Kills the tail step
  (~2.2-3.5s per card turn) and the sentinel dance in one move, but
  changes the client contract (the card must answer the pending
  action), so it wants a spike, not a drive-by.
- **R4 · Close the deployed-bundle gap for the skill preload** once the
  in-flight SKILL.md edits land: single-source the body through
  `defineSkill` (markdown in a TS module both the skill system and
  onboarding-mode import), or land an eve fix for authored asset
  imports.
- **R5 · Tool-schema diet.** 50 static tools ≈ 17.9k tokens on every
  step of every web turn, fleet-wide. Several are irrelevant per
  channel and could go `defineDynamic` the way `ask_for_details`
  already does; the two image/printable tools alone are 2.4k tokens.
- **R6 · Move the post-reply hooks off the turn's critical path.**
  `classify-conversation` awaits a `generateObject` call
  (`openai/gpt-5.6-terra`) on every completed assistant message, inside
  the hook. Measured in the verified walk: 9.6s between
  `message.completed` and `step.completed` on a no-tool turn, and 14.1s
  before the NEXT turn's POST acknowledged while the previous turn's
  hooks drained. A naive un-await loses classifications when the
  serverless invocation ends first, so the honest options are a queue
  (agent-jobs or a schedule) or accepting lossy fire-and-forget;
  founder's call.

## What was ruled out

- Turn COUNT was already minimal (client-side card chaining, no-turn
  welcome); confirmed, nothing shipped there.
- The harness itself (dispatch, hooks, DB context reads) is ~1-1.6s
  warm and not worth touching before R1-R3.
- Dev-server compile overhead exists (7-9s first-hit POST acks) but
  prod steps measured from `model_usage` timestamps carry the same
  model-side floor, so no dev-only conclusion was drawn.
