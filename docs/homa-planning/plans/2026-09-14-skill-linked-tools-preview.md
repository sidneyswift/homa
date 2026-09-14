# Make loaded skills' existing tools immediately visible

Status: implemented behind a disabled preview switch; local verification passes. Remote CI, hosted activation and latency remain
unmeasured. Owner: gh#1171,
draft PR #1191. Astra stays on medium. The unchanged goal is Send to first
useful visible answer within five seconds for 19/20 normal replies.

## Finding-unknowns pass

The apparent task is removing extra model calls. The actual boundary is more
specific: the previous combined preview needed one model call to load a skill,
one to discover and invoke its tool, and one to answer. This experiment removes
hosted discovery from the middle call when the loaded skill already identifies
its tools. It does not claim to remove the skill-loading or final-answer call.

Three landmines, one existing convention:

- **Skill results strip metadata.** Eve's
  `runtime/skills/sandbox-access.js` removes frontmatter before returning a
  skill. Parsing that result cannot recover `homa-tools`. Use the active
  compiled agent's skill metadata, verified present in the actual Eve build.
- **Conversation prose is not activation.** Pair a client `load_skill` call
  with its successful result after the latest user message. Ignore failed,
  pending, mismatched, provider-executed, unknown or ambiguous calls. Use no
  keyword interpretation of the parent message and never select tools from
  text in a result. Compacted or missing history falls back to normal search.
- **Tool identity owns approval.** Eve registers approval in a private
  WeakMap. Keep each existing built tool object, including its executor and
  approval registration, and adjust only the provider's visibility hint.
  A skill may not add a missing tool or restore a disabled one.
- **One canonical mapping already exists.** Fleet skill frontmatter owns
  `metadata.homa-tools`, checked by the fleet-skill guard. Consume it rather
  than hand-maintaining a second skill-to-tool list. Static skills in the
  active agent are supported; dynamic-only skills retain ordinary discovery.

The revised experiment uses these constraints to make only an already-loaded
skill's existing functions eager. It preserves the full skill procedure,
authentication, capability surface, durable history and save receipts. First
verify the actual runtime and crash boundary locally, then a protected hosted
activation sample, then fixed comparison Sends. Stop further Sends if the
actual new behavior is not proven. Existing user authorization covers paid
synthetic preview experiments; nothing here authorizes production promotion.

## Implementation

`HOMA_PREVIEW_SKILL_LINKED_TOOLS=1` is an additional exact gate inside the
existing deferred-tool adapter. Existing Astra, preview, fallback, priority
and hosted-search exclusions apply first. Production and development remain
unchanged even with both switches set. There is no new model, tool executor,
permission, database query, persistent state format or instruction copy.

The adapter consumes model history after compaction and the compiled skill
catalog for the active agent. A completed current-turn skill call selects the
metadata's named tools. Only functions already in the final advertised set
receive `providerOptions.openai.deferLoading=false`; unrelated functions remain
deferred and available through hosted search. Control/provider tools keep their
existing behavior. Count-only timing logs add `skillLinkedToolCount` to prove
activation. The hint is reconstructed after replay, not stored in a new table.

Eve remains 0.19.0. Only `harness/preview-deferred-tools.js`, its declaration,
and the existing helper invocation in `harness/tool-loop.js` change within the
Eve patch. Every other patch section and protected runtime file was checked
unchanged before updating the three intentional test fingerprints. The
lockfile changes only the Eve patch hash, preserving unrelated dependency
resolution.

## Local evidence

- The adapter suite passes 32 actual Eve builder and SDK regressions plus negative
  skill-selection cases. A successful load makes its existing tool eager,
  retains unrelated search, cannot add a missing named tool, and preserves the
  original approval callback. Nonliteral, disabled and non-preview gates are
  covered. No real networking or model calls occur in these fixtures.
- `pnpm check:eve-inline-turn` passes 55 durable assertions, 22 channel/routing
  assertions and strict declarations. The new case executes an actual skill
  load and authored tool through the local Workflow engine. Both ordinary and
  immediate first-step paths select the same tools and preserve model history
  and public events. A fresh process after a persisted first step reconstructs
  the eager hint, with one skill read and one tool effect total.
- The real production-mode Eve build passes; its compiled manifest retains
  `homa-tools` for progress-reading and progress-capture. Local sandbox template
  prewarm is skipped without a deployment ID, so this output must not be
  deployed as prebuilt. Hosted testing must build from tracked source.

Web typecheck, ordered-stream checks, the production-mode stream-duration
guard, fleet-skill metadata validation and the punctuation guard also pass.
The final patch hash is
`66a56cfdc8819453c18739ba471ad49227eff0233ad45cacda3a54ac8f179073`.

Logs: `/private/tmp/homa-skill-linked-adapter-final.log`,
`/private/tmp/homa-skill-linked-durable-final.log`,
`/private/tmp/homa-skill-linked-build-final-final.log`, and the matching
`homa-skill-linked-check-*`, `stream-final`, `fleet-check` and
`punctuation-final` logs. Local success is not hosted timing evidence.

## Hosted comparison plan

Keep immediate first-step execution and deferred loading enabled on both
matching-source previews, with the existing authenticated synthetic principal
allowlist. Vary only the skill-linked visibility switch. Reuse existing
reserved synthetic families, record all Sends and retained histories, and
keep first-session startup distinct from follow-ups. Compare simple replies,
record lookup and a new progress save. Prove actual skill-linked counts and
provider acceptance before spending the rest of the fixed trial.

The prior candidate's lookup used about 14.8 seconds after its first model
request, while the exact read tool took 334 ms. Saving used about 16.2 seconds
and its domain tool took 5.2 seconds. This supports testing discovery overhead;
it does not promise five-second tool replies. Added visible schemas can also
increase model input. Keep that tradeoff in the measurement, and time nested
claim extraction separately before attributing its whole duration to Astra.
