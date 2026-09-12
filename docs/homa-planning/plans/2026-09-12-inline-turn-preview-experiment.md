# Inline first-step preview experiment

Owner and status: [#1171](https://github.com/sidneyswift/homa/issues/1171).
This change is a disabled protected-preview candidate. It does not change
production execution, enable an experiment, or establish a latency improvement.

## Hypothesis and bounded change

An ordinary Homa answer can avoid the child-workflow dispatch interval by running
one existing durable Eve step in the session driver. A tool continuation still
uses the existing child runner, carrying the completed first-step result so its
model, tool and hooks do not run again. The model remains GPT-6 Astra with medium
reasoning and the normal tool surface.

This adapts the checkpoint idea from official Eve commit
[`e219a6a`](https://github.com/vercel/eve/commit/e219a6a71d2bf619241084a7f02d2fd838cb14db)
onto the installed 0.19 package. Eve stays at 0.19, the client protocol and command inbox remain unchanged,
and there is no database schema migration. All nine preexisting package patch sections,
including empty-delivery recovery, ordered streaming and stream duration, remain
byte-for-byte unchanged.

Eligibility is stamped only by authenticated server acceptance when all of these
are true:

- `VERCEL_ENV=preview` and literal `EVE_EXPERIMENT_INLINE_TURN=1`.
- `EVE_EXPERIMENT_INLINE_PRINCIPAL_ID` is one canonical UUID matching the current
  authenticated `user` principal exactly.
- The server has an immutable `VERCEL_DEPLOYMENT_ID`.
- Recorded session state is an interactive root conversation, with request-input
  capability, no parent lineage and no delegated depth.

Production is always excluded in this trial design. Clients cannot opt in by
sending a body, context or model setting. The actual web route's conversation and
request-input defaults are exercised offline, and the Homa source contract checks
that the principal comes from verified Supabase `user.id`.

The step compares its actual deployment with the recorded accepting deployment
before any context load or effect. Missing eligibility uses the existing child
path immediately. A mismatch runs one effect-free guard step and then falls back;
this can cost more than the baseline. Old pinned drivers retain their old code
and receive no inline benefit, so a new driver on the exact candidate deployment
is required for the experiment.

A continuation checkpoint uses internal child input version 2 and is pinned to
the same immutable patched deployment. The normal writer retains version 1,
readable by the original 0.19 runner. The checkpoint is consumed once; the next
step receives the recorded post-step state and retains the old cursor, hook,
principal, approval and stream behavior.

## Offline evidence and remaining gates

`pnpm check:eve-inline-turn` exercises the installed package with the actual
Workflow compiler, VM, local event store and encrypted serialization. A mock
model, synthetic channel and read-only skill workspace replace external effects;
network access is blocked. It reconstructs the previous patched runtime from
only the new patch sections, verifies all source hashes, and compares both paths.

The durable cases cover ordinary answers, a real skill load followed by another
model round, approve and deny with a different authenticated responder, empty
input, provider failure, explicit administrative cancellation, deployment
mismatch, and a fresh process replay after the first durable step is committed.
The replay case proves no repeated recorded model/skill/hook effects. It does not
provide exactly-once effects for a crash before `step_completed`.

The same guard checks the default-off/authenticated-preview gate, old/new child
input compatibility, recorded task/delegated exclusions, flag removal after
checkpointing, the actual Eve web route defaults, and strict declaration usage.
The existing CI ordered-stream command also runs this guard. No CI workflow or
Android audit-hash exception changes are needed.

Before a hosted experiment: require normal CI and the actual production-mode Eve
build plus stream-duration guard; obtain root review of the integrated bytes;
then provision one approved synthetic fixture on a protected READY preview.
Configuration, fixture creation and paid trials are separate actions, not part
of this implementation. The shared lockfile changes require mobile release-rail,
client and native-fingerprint checks before any eventual main-branch release.

## Hosted measurement and acceptance

The user target remains 19 of 20 representative hosted synthetic turns with
Send-to-first-useful-visible-answer at or below five seconds. Failures and
timeouts are misses. Headers, reasoning, status notes, skill loads and tool calls
do not count as a useful answer. Keep Astra medium and normal tools, and do not
change the prompt after seeing a result. Read/advice/planning prompts cover the
existing frozen acceptance set, including fresh and returning conversations.

Record the exact source/deployment, verified synthetic principal, driver and
child run IDs, submission timestamp and the current turn's first useful DOM
text. Locate the answer after its matching user bubble, never by counting all
assistant containers because recovery can prepend older messages. Compare
matched fresh-driver cohorts with stable context and record cold/warm ordering;
old pinned drivers are a separate observation cohort. Preserve all failures.

Start with hosted correctness probes for ordinary answer, skill continuation,
approval/denial and reconnect, then run the frozen representative set. A source
change, timing-header improvement or local test is not acceptance evidence.
Recent traces suggest about 1.3 seconds of removable dispatch overhead, which
alone would still leave the cited fresh turns above five seconds. No measured
speed claim is made here.

## Stop and rollback

The existing web/native Stop aborts the local reader; it does not cancel durable
work. This behavior is unchanged. The separate `Run.cancel()` test represents an
administrative operation and does not prove that an in-flight provider request
stops immediately.

Remove the admission flag or principal to prevent new trial admissions at the
accepting deployment with that configuration. Vercel configuration normally
requires a new deployment; stop traffic to an old protected preview URL because
it may retain its previous flag. This is not an instantaneous kill switch.
Already accepted turns and saved checkpoints keep their recorded eligibility
and immutable-deployment pin. Retain that deployment until they finish. Never
send a version-2 checkpoint to an original version-1 reader during rollback.

Unverified hosted paths include queue scheduling, protected cross-deployment
access and retention, real run-key services, mid-step failure, OAuth callbacks,
proxy/subagent HITL and browser reconnect through the new parent step. The trial
stays limited until that evidence exists. The issue remains open until its
user-visible acceptance target is demonstrated or the founder changes it.
