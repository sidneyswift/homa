# Make loaded skills' existing tools immediately visible

Status: local checks and exact-source CI pass. Two protected previews verified
activation and completed eight hosted Sends. The experiment does not establish
a consistent improvement or meet the five-second target. Owner: gh#1171,
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

## Hosted results, September 14

Measured source: `2f2fb4cd29aae20f42366211491c6173eb83f680`.
[CI run 34816533551](https://github.com/sidneyswift/homa/actions/runs/34816533551)
completed successfully, including build-and-check. The mobile job was skipped
by classification. Both source-only protected deployments reached READY with
the same source tree and archive digest:

- Linked: `dpl_H7sgGW3pT6kUXT77CLyNE8sy6ubF`,
  <https://homa-px4c699g6-homa-1d878b0e.vercel.app>.
- Control: `dpl_EMqQqDvny8R7ddshiqHttEhNpHBW`,
  <https://homa-lyz8q41jp-homa-1d878b0e.vercel.app>.

Both kept Astra medium, immediate first-step execution, deferred tools and
deferred user indexing enabled. Priority, model racing and chat-open warmup
remained off. Each used its own existing reserved synthetic family and exact
authenticated principal allowlist. The skill-linked switch was the treatment.
Family and conversation histories differ, and prior discovery persists in
model history, so this small sequential screen cannot isolate a causal effect.

The first lookup on each deployment was retained as startup evidence. The
comparison protocol was frozen before its seven remaining Sends: control
startup, control/linked simple reply, linked/control lookup, control/linked
save. No Send was retried or excluded. Times below are upper bounds for first
visible answer text, measured from Send through the real hosted browser app.

| Request | Control | Linked | Linked preparation | Linked model and tools |
| --- | ---: | ---: | ---: | ---: |
| Startup saved-counting lookup | 27.707 s | 22.622 s | 4.016 s | 18.471 s |
| Repeated simple syllable explanation | 4.683 s | 9.970 s | 7.597 s | 2.200 s |
| Repeated saved-counting lookup | 22.069 s | 13.528 s | 1.553 s | 11.886 s |
| Save ten-button counting observation | 20.018 s | 22.428 s | 6.256 s | 15.987 s |

Only the control simple reply reached a manually reviewed useful prefix
within five seconds, between 4.740 and 4.814 seconds. Its first text was
"A syllable is a"; the useful prefix explained a beat in a word. The other
seven first-text intervals were already beyond five seconds. All eight
recordings remained visible with no observation gap over one second; the
largest gap was 353 ms. This measures sampled visible DOM, not physical paint.

### Activation and truthful effects

Official Workflow step metadata proves four completed root `turnStep` steps
and three ordinary continuations on each preview. Linked tool counts were
zero before skill loading, one after progress-reading and two after
progress-capture. Control counts stayed zero. Model usage records confirm
Astra for all 22 main chat calls. Each family has eight stored and indexed
messages, with completed tool receipts and no failed Send.

Both startup lookups loaded progress-reading, read the math map and recalled
the original nine-toy-car note before answering. Linked skipped discovery for
the map; control also searched for an unused progress-writing tool before
discovering recall. Both required four main model calls. Both repeated reads
used only load_skill and already-discovered recall, needing three calls.
Thus the repeated lookup difference is not proof that making the map eager
caused the improvement. Neither repeated read used that map tool.

Both saves called record_journal_evidence once and returned a visible Progress
updated receipt plus the ten-button confirmation. The progress tool took
5.499 s linked and 5.863 s control, already exceeding the entire target on its
own. These totals include its internal work; the chat-only usage query does
not separately time nested claim extraction. The experiment added no save
procedure, changed no tenancy rule and did not grant a new execution ability.

Fresh Progress screens showed September 14 direct journal evidence for
one-to-one counting in both families. Linked displayed Easily; control
displayed Getting there. The families have different retained histories, so
do not claim identical skill ratings or attribute this difference to the
visibility switch. The screens do not show the exact source sentence; that
sentence and confirmation were checked in the stored conversation and tool
receipt. No separate domain-row duplicate census was performed.

### Remaining delay and next investigation

Model-first-text to browser-first-text upper bounds were 89 to 218 ms. The
slow simple linked reply spent 7.597 s before its first model request, then
2.200 s waiting for answer text. The treatment was inactive for that reply,
which loaded no skill. It therefore supplies no evidence that eager tool
visibility caused the slow simple answer.

The three preparation outliers have distinct observed gaps:

- Linked simple reply: the Workflow request reached Vercel at Send +1.750 s;
  family context began at +6.629 s. The 4.879 s interval is not browser wait.
- Linked save: session POST arrived at +1.010 s; its authentication marker
  began at +4.725 s, a 3.715 s interval within the hosted request boundary.
- Control repeated read: session POST arrived at +0.424 s; authentication
  began at +4.745 s, a 4.321 s interval within the hosted request boundary.

These intervals narrow the next investigation to admission and Workflow
startup/resumption. They do not establish that every millisecond is a cold
start, queue delay or import cost. Preserve actual request/step timestamps and
instrument or verify platform startup evidence before choosing the next fix.
The older chat-open warmup screen did not prove activation and cannot be
cited as a successful or failed warmup treatment. It only warms admission,
not the Workflow function; see the September 12 preview experiment plan.

Do not promote this experiment as a five-second solution. Both main-model
round trips and intermittent preparation remain limiting. The unchanged
19/20 target is still open on #1171.

Private synthetic evidence roots are
`/private/tmp/homa-eve-hosted-2f2fb4cd-linked` and
`/private/tmp/homa-eve-hosted-2f2fb4cd-control`: source/deployment verification,
frozen protocols, continuous samples and prefix reviews, full answer snapshots,
scoped fixture metadata, runtime logs, parsed timing marks, official step
metadata and `analysis.json`. No credentials or raw logs belong in Git.

Evidence-update validation: `git diff --check` passes. The optional repository
documentation reconciliation audit with `--allow-open` fails on its stale
immutable baseline, coverage, migration-count and claim-ledger records. It
reports 251 open manifest rows and 43 open claims. Do not describe that audit
as green or confuse it with the successful exact-source application CI above.
