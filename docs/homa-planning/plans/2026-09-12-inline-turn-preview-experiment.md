# Chat latency preview experiments

Owner and status: [#1171](https://github.com/sidneyswift/homa/issues/1171).
This change is a disabled protected-preview candidate. It does not change
production execution, enable an experiment, or establish a latency improvement.

## Separate chat-open warmup arm

The September 12 hosted screen's first standard admission request reported a
2.47-second cold start in `/eve/__server`. Its first parent Workflow request
separately reported a 2.57-second cold start. These are platform observations,
not additive guaranteed savings. The initial Priority admission also reported
a 2.40-second cold start. Exact requests and comparison results are recorded on
[#1171](https://github.com/sidneyswift/homa/issues/1171#issuecomment-5649430214).

This arm makes one bounded GET to the existing `/eve/v1/health` when chat mounts.
The installed generated handler loads the same admission entry without creating
a session, running authentication, dispatching a Workflow or calling a model.
Production GET returned 200 ready JSON. Local network-blocked handler probes
confirmed no external effects. A publicly routed Workflow health endpoint was
not established; both tested paths returned 404, so this experiment does not
warm the separate Workflow function or add a new route.

The server page enables the component only with `VERCEL_ENV=preview`, literal
`HOMA_PREVIEW_CHAT_WARMUP=1`, a present family and verified claims matching
`HOMA_PREVIEW_CHAT_WARMUP_USER_ID` exactly. The flag and fixture ID are deployment
environment values, not public variables or client-selected inputs. Production
remains excluded even with the flag set. Use a designated synthetic account.

For activation diagnosis only, explicitly set
`HOMA_PREVIEW_CHAT_WARMUP_DIAGNOSTICS=1` on a protected preview. The page logs
`[chat-open-warmup-gate]` with six Boolean eligibility checks and the final
`enabled` value. It emits no IDs, raw environment values, family information or
conversation content. Diagnostics are off by default and excluded outside
`VERCEL_ENV=preview`; a missing diagnostic record alone does not prove which
environment input is missing. Logging failure cannot change eligibility.

The request retains same-origin cookies for existing preview protection, bypasses
the browser cache, rejects redirects and has no body or custom headers. It has a
ten-second deadline, cancels on unmount and never retries. No request is made by
an effect canceled before its deferred start, including React's development
setup/cleanup/setup check. No Send or conversation code awaits the request.

Compare matched source previews with inline and Priority both disabled, changing
only this warmup gate and the corresponding synthetic account. Include immediate
sends and measured time spent entering the prompt. Do not wait for health before
Send or silently exclude users who send before warmup completes. Record actual
platform cold/warm state rather than assuming a new tab or deployment is cold.
Instance reuse and a hosted latency improvement remain unverified.

The focused lifecycle, eligibility and diagnostic checks run in `pnpm check:chat-ui`.
The September 12 implementation passed 329 chat checks, the existing two-tab
browser check, web typecheck and lint with five preexisting warnings. Independent
review accepted the final lifecycle correction. These are implementation checks,
not acceptance evidence for the five-second target.

The first three approved warmup-screen attempts missed five seconds; two exact
first-text measurements were censored by observation failures. The intended
treatment's first admission was still platform-confirmed cold at 2.31 seconds,
and no health request appeared in its bounded request log. Actual activation
remains unverified, so these attempts establish no warmup benefit. The diagnostic
and remaining allowance are tracked on
[#1171](https://github.com/sidneyswift/homa/issues/1171#issuecomment-5650114320).

## Separate Priority arm

The agent configuration requests Gateway `serviceTier: "priority"` only when
`VERCEL_ENV=preview` and literal `HOMA_PREVIEW_ASTRA_PRIORITY=1` are both present
at build time. Otherwise `modelOptions` remains absent, preserving the current
provider default, including production builds even when that flag is set.
The model stays Astra medium, with the same automatic tool selection, full tool
surface, Gateway Parallel search, prompt, caching and provider fallback.

Eve 0.19 captures provider options while compiling `agent.ts` into its manifest.
This string-model configuration is not reevaluated from runtime environment
values. Set the flag for the intended preview build; changing a runtime setting
cannot toggle a previously built deployment. Never promote the Priority preview
artifact directly to production. A normal production build excludes the tier.

Priority is a separate hosted arm after inline correctness is established.
Compare otherwise identical protected previews, with the same inline setting in
both arms, changing only the requested provider tier. Use the existing synthetic
fixture procedure and record the actual applied tier, provider, per-step token
and cache usage, cost, failures and first useful rendered answer. No new direct
provider batch is part of this experiment, and no speed or reliability claim is
made by adding the disabled gate.

Run `node --test scripts/astra-preview-priority.test.mjs` for the focused guard.
It compiles the actual agent configuration with the installed Eve compiler in
fresh, credential-free processes with network access blocked, and checks
default, preview, production and development settings. It also verifies model,
reasoning, search, auto-cache behavior and build-time capture. The earlier
offline full-manifest comparison preserved every compiled tool, skill, hook,
channel and instruction across enabled and disabled arms. Normal Eve build,
stream-duration, typecheck and lint checks still apply before pushing.

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
Send-to-first-visible-streaming-answer at or below five seconds, including app
overhead and hidden reasoning. Report first useful visible instruction as a
separate stricter measure; a lone word or title may pass first text without
proving usefulness. Failures and timeouts are misses. Headers, reasoning, status
notes, skill loads and tool calls do not count as answer text. Keep Astra medium
and normal tools, and do not
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
