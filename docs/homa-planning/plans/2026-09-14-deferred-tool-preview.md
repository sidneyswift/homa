# Deferred tool-loading preview

Status: hosted provider acceptance and one real save verified on protected
previews; five-second target not met. No production promotion. Owner: gh#1171. The target is
still Send to a useful visible answer within five seconds for 19 of 20 normal
replies, with Astra medium and all Homa capabilities retained.

## Hypothesis and intervention

The [stream-boundary diagnostic](2026-09-14-stream-boundary-preview.md) measured
5.0–12.8 seconds from provider request to first answer text on four one-call,
zero-tool replies. Each sent roughly 43k input tokens and advertised 95 tools.
Those observations motivate a smaller provider context but do not establish
input size as the cause; earlier cached calls also had long waits.

The existing Eve 0.19.0 patch now applies a deferred-loading adapter after
static, dynamic, control and Workflow host tools have been assembled. Eligible
function tools receive `providerOptions.openai.deferLoading: true`; the
installed vendored OpenAI `toolSearch({ execution: "server" })` factory adds
hosted discovery. Tool definitions still travel through Gateway. The proposed
benefit is less detail in the provider's active context, not less application
serialization or fewer locally registered tools.

Existing tool objects and the set retain identity, preserving Eve's private
approval registry. Names, schemas, executors and provider search remain intact.
`ask_question`, `load_skill` and `final_output` stay eager. Explicit eager
opt-outs remain authoritative. Search-name or provider-ID collisions fail
before mutation. A count-only activation marker includes session/turn/step
coordinates; it never logs prompts, tool inputs or returned tool descriptions.

Activation requires `VERCEL_ENV=preview`,
`HOMA_PREVIEW_ASTRA_DEFERRED_TOOLS=1`, exact configured and resolved Astra,
no source-backed model, no mixed-model fallback, no disabled hosted search,
and no Priority/speed experiment. Production is unchanged even if the flag
is accidentally set. Eve, AI SDK and model versions are not changed.

## Verification

- `pnpm check:eve-deferred-tools` runs 18 repository checks with all real
  networking disabled. Actual Eve plus Gateway/OpenAI converters exercise
  hosted search, one/zero effects for approval/denial, JSON checkpoint history,
  parked input, store on/off, disabled/production behavior and ineligible gates.
- The broader retained adapter suite passes 19 checks against the actual
  compiled Homa catalogue, including unchanged request bytes when disabled,
  unchanged schemas and eager controls, opt-outs, collision handling, and the
  existing bounded search trace writer with its two awaited metadata writes.
- Eight retained full-harness comparisons also pass against the exact prior
  installed package, including default request/event/history equivalence.
  These use canned provider events, not remote inference or Workflow storage.
- The runtime environment gate survives the installed Rolldown bundle test.
- Web typecheck, Eve build, three stream-duration checks, three empty-delivery
  checks, 14 ordered-stream tests, and the existing inline suite pass. The
  inline suite reports 39 durable and 22 routing/channel assertions plus strict
  declaration validation.

The inline guard initially rejected the intentional tool-loop hash change.
Before updating its provenance, removing exactly the adapter import and one
assembly call was verified to restore the prior protected hash. Every other
protected patch section remained byte-identical. Both inline comparison arms
retain the new adapter with its switch off, and the added helper files are
now hash-protected too. This does not substitute for enabled hosted validation.

The packaged workflow Eve library grew by 2,536 bytes; other measured `.mjs`
files stayed the same size. This is a file-size comparison, not proof of equal
startup CPU. The lockfile changes only the Eve patch hash and its references.

Local evidence: `/private/tmp/homa-deferred-integrated-20260914/`.

## Hosted comparison boundary

Use protected immutable previews from the same source, with only the deferred
tool switch different. Keep Astra medium, timing and deferred user indexing
enabled, and racing, Priority, inline turns and chat warmup off. First verify
the candidate's activation and remote acceptance with one ordinary synthetic
definition reply. Stop on missing activation or provider rejection; retain the
failed Send and do not silently downgrade or resend it.

Then compare both simple definitions and tasks that use real family-scoped
tools, counting hosted search and all tool/model steps in Send-to-visible time.
Verify actual tool outcomes and saved messages separately. Search may itself
add waiting or retrieve the wrong tools; a token reduction alone is not success.
Keep each preview immutable through its accepted turns and later continuation.
Cross-deployment search-history replay and rollback are not certified for
production by the local JSON roundtrip tests.

## Hosted results, September 14

Exact source `3945e90c3a0647a89d061fc7d2cb42309dba8e31`, tree
`ea67d7489418768193f2d08e2402d0a6cd7614cf`, archive SHA-256
`aa4c1e1c8ffd3b7f61a0717f6b464c21cec042be1c35269f871e15f4f02c86c2`:

- Enabled: `dpl_7EwRxguFiYwvg5JdeXWwifUtHXh1`,
  [protected preview](https://homa-61fdas6hl-homa-1d878b0e.vercel.app).
- Disabled: `dpl_FSGrkQCXxFL2VVBkZDhxtSfG7eof`,
  [protected control](https://homa-mibf7gp0s-homa-1d878b0e.vercel.app).

Both deployment API receipts were READY and matched the same source identity.
Node 24, Eve 0.19.0, Astra medium, ordinary tool catalogue and all other
experiment flags were held constant. Each used an existing reserved synthetic
family. No new family or production deployment was created. The candidate had
one initial acceptance question before the fixed eight-Send comparison.

| Prompt | Ordinary setup, first visible text | Deferred tools, first visible text |
| --- | ---: | ---: |
| Syllable definition | 7.990–8.060 s | Not sent: membership-service timeout |
| Rhyme definition | 7.986–8.063 s | 8.493–8.562 s |
| Read saved counting progress | 15.887–15.964 s | 13.924–13.997 s |
| Save an eight-block counting observation | 29.177–29.248 s | 18.572–18.642 s |

The candidate's initial phonics acceptance reply took 8.971–9.040 seconds.
All nine Sends missed the five-second useful-answer target, including the
failed Send. Captured first prefixes were partial words, a bare subject or
`Saved`; none yet conveyed the requested fact. They are not credited as useful
answers. Continuous visible DOM sampling found no hidden samples or gaps over
one second; the largest gap was 533 ms. This does not measure physical paint.

Activation was present for all seven accepted candidate model calls: 92
deferred function tools and 96 total advertised tools, including hosted search.
The control advertised 95 tools with no deferral marker. The rhyme input was
19,232 tokens enabled versus 43,032 disabled. Initial model request to first
answer text was 1.824 seconds enabled versus 4.486 seconds disabled, but Send
to that request was 6.681 versus 3.488 seconds. The saved input and shorter
model wait therefore did not produce a faster visible rhyme answer.

The candidate save used three model rounds, `load_skill`, hosted `tool_search`
for `manage_child_progress`, and that real tool. The control also used three
model rounds, without hosted search. The search ledger interval was 857 ms;
the progress tool intervals were 5.957 seconds enabled and 6.491 seconds
disabled. These are instrumented ledger intervals, not isolated provider or
database execution costs. The read comparison used different paths: control
loaded the reading skill and called `explore_child_map`; candidate loaded the
skill and answered from supplied family context. That difference prevents
attributing the whole latency change to tool deferral.

Each preview session has eight saved, indexed conversation messages. Each
save tool was recorded completed without an error, and a fresh Progress page
read showed the new one-to-one counting journal note dated September 14 in
both families. The exact journal quote and duplicate count were not separately
audited in database rows. Both synthetic sessions signed out successfully on
their first attempt; only their test tabs were closed. This does not resolve
the separate production sign-out incident gh#1196.

The failed candidate Send had no model call and no saved user message. Its
session-binding membership read failed after 5,549 ms, then the later session
request membership read failed after 5,045 ms. The UI showed `Not sent` and
Retry. The test never retried that message; the next distinct planned question
succeeded. The existing gh#1178 fix classifies temporary membership failures
as service unavailability; it does not eliminate the upstream timeout. No new
production occurrence or new authentication fix is claimed here.

The successful candidate rhyme had a 4.983-second gap between the end of the
inbound-continuity marker and the start of family-context construction. This
interval includes uninstrumented scheduling and worker startup; it is not proof
that all five seconds are removable child dispatch. Cross-host phase splits
assume aligned clocks; the end-to-end observation uses one observer clock.

Decision: retain deferral as a promising preview intervention, particularly for
tool tasks, without promotion or a causal performance claim from this small,
separate-history sample. Next test the existing authenticated inline first-step
option together with deferral, verifying actual activation and preserving its
durability, continuation and review gates. Separately investigate the recurring
membership-service timeout; no tenant checks may be bypassed to meet the target.

Evidence roots: `/private/tmp/homa-eve-hosted-3945e90c/` and the sibling
`homa-eve-hosted-3945e90c-control/`. Frozen protocols, continuous observations,
manual prefix reviews, complete bounded runtime logs, source receipts, scoped
read-only fixture metadata and fresh Progress/sign-out snapshots are retained.
The candidate root's `analyze.mjs` verifies source/session/prompt/turn matching,
activation, saved messages, model usage and timing before writing `analysis.json`.
