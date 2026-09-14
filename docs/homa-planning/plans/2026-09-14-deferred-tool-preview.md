# Deferred tool-loading preview

Status: integrated behind a disabled preview gate and locally verified; hosted
provider acceptance and latency remain unproven. Owner: gh#1171. The target is
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
