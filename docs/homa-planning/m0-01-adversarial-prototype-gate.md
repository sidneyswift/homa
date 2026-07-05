# M0-01 — Adversarial eve prototype: GO/NO-GO gate

> Written before starting, per the council re-scope in `03-backlog.md` ("strict
> timebox... GO/NO-GO criteria written BEFORE starting"). `13-mr-prd.md` line 3:
> the PRD is "APPROVED FOR BUILD once M0-01 gate passes" — nothing in Phase B
> starts until this gate resolves GO. Do not add scope to this spike beyond the
> five tests below; that is what makes it throwaway.

## Purpose

`01-architecture.md`'s tenancy model is "resolved on paper" from eve's
documented patterns. This spike does not re-derive the design, it **verifies
behavior** the docs can't settle by reading: session longevity across a crash,
dispatcher fan-out under failure, and whether the never-rotate-while-parked
law actually holds when eve is pushed. If eve buckles here, we eject to
**M0-02** (same architecture, custom harness on AI SDK + Workflow + Sandbox)
before any real schema or product code depends on it.

## Timebox

**Strict cap: 2 focused work-sessions, target ≤2 elapsed days.** This is a
risk-control cap for a throwaway spike, distinct from BUILD.md's "no calendar
estimates" stance for the overall roadmap (that's about sequencing, not about
letting a spike run indefinitely). If a test can't be forced to resolve inside
the timebox, that inconclusiveness is itself logged as a data point, not a
reason to extend the clock. Code written for this spike is throwaway: it is
not the walking-skeleton implementation, and none of it should survive into
Phase B verbatim.

## Environment (contained blast radius)

- Deploy to a **Vercel preview** on a feature branch (`spike/m0-01`), never to
  `thankshoma.com` / production.
- Reuse the real **homa-prod** Supabase schema (families/family_members/
  children, deny-by-default RLS, already live per M0-05) rather than standing
  up a throwaway project — the whole point is testing eve against the *real*
  tenancy shape, not a toy one.
- Every synthetic row this spike creates is tagged so it's unambiguous and
  disposable: family name prefix `spike-m0-01-`, a dedicated
  `is_synthetic_spike boolean` column (add via a migration scoped to this
  spike, dropped or nulled-out after), no real email addresses.
- **Cleanup is part of done**, not an afterthought: a script that deletes every
  `is_synthetic_spike = true` row, run and verified before this doc is marked
  resolved.
- "Fake work" per the backlog: schedule-fanned-out sessions call a trivial stub
  tool, not real LLM generation or real sandbox jobs, to keep this spike's
  Gateway/Sandbox cost near zero.

## The five tests

Each test gets a pass bar and a fail bar. **Recoverable-but-imperfect counts
as pass, with the workaround logged.** Silent data loss, cross-family
leakage, or an unrecoverable stuck state is an automatic fail on that test,
full stop, given the data involved.

### (a) Eve upgrade drill — version bump with a session parked in HITL

**Do:** Park a durable session in HITL (via `ask_question` or an
approval-gated tool call). Bump the pinned `eve` version in
`apps/web/package.json` by one release (patch or minor, whichever is
current), redeploy the preview, then resume the parked session with its
answer.

**Pass:** The session resumes correctly on the new version, the parked
question's answer routes back into the same conversation, and no state is
lost. A documented required change (a config rename, a new required field)
is fine, as long as it's a change we make deliberately, not a silent break.

**Fail:** The parked session cannot resume, resumes into a corrupted or wrong
state without surfacing an error, or the answer is lost.

**Feeds:** `eve-churn-log.md` gets a real entry either way — this is the
log's first data point beyond the zero-point.

### (b) Deploy + rollback with an in-flight workflow run

**Do:** Start a multi-turn durable session mid-conversation. While it's
in-flight, trigger a new preview deploy (even a no-op env var bump), then roll
back to the prior deployment while the run is still active.

**Pass:** The run either completes cleanly on the new deployment, or on
rollback resumes correctly on the prior one, with no duplicated side effect
(a tool call that has a real-world effect must not fire twice) and no
corrupted session state.

**Fail:** The run enters a stuck/unrecoverable state, or any side-effecting
tool call executes more than once across the deploy/rollback.

### (c) Kill the dispatcher mid-fan-out — lease recovery

**Do:** Seed 20 synthetic schedule rows all due at the same instant. Start the
dispatcher's fan-out, then force-kill the dispatcher process partway through
(a rough crash, not a graceful shutdown). Let a fresh dispatcher instance pick
up afterward.

**Pass:** Every leased-but-incomplete row is recovered once its lease expires
(no row silently and permanently stuck), and no row's real-world side effect
fires twice.

**Fail:** Any row is never recovered, or any row's side effect double-fires
in a way that would be user-visible (e.g. a duplicate email in the real
M1-08 world).

### (d) Rotate a session parked in HITL

**Do:** Park a session in HITL, then attempt to force the session-rotation
path while it's still parked (the architecture doc's law: "rotate only at
idle, never while parked" — this test tries to break that law on purpose).

**Pass:** The rotation attempt is safely rejected or deferred; the parked
state (the pending question, its context) survives untouched until it's
actually resolved.

**Fail:** The parked state is lost, corrupted, or silently rotated out from
under the waiting answer.

### (e) Synthetic 100-family fan-out with fake work

**Do:** Seed 100 tagged synthetic family rows, each with a due schedule row.
Dispatch the fan-out with the stub tool (no real generation). Specifically
check, across all 100: does any family's synthetic data ever appear inside
another family's session or response.

**Pass:** All 100 rows get processed (at-least-once holds), fan-out completes
in a reasonable window, and **zero cross-family leakage** — this is the
cheapest, earliest point to catch a tenancy bug, well before M1-07's full
adversarial suite exists.

**Fail:** Any row is dropped with no recovery path, or any leakage occurs
(automatic NO-GO regardless of the other four tests — this is the one
non-negotiable bar given the audience).

## Verdict rule

- **Any single test shows silent data loss, cross-family leakage, or an
  unrecoverable stuck state → NO-GO.** Eject to M0-02 (custom harness on AI
  SDK + Workflow + Sandbox per the architecture doc's fallback plan). This
  applies even if the other four tests pass; leakage in particular is a hard
  stop, not a majority vote.
- **All five recoverable, with workarounds logged where needed → GO.** Phase B
  (walking skeleton) may start. Every workaround gets one line in
  `eve-churn-log.md` so the pattern is visible if it recurs.
- **Inconclusive after one retry with tighter instrumentation → treat as
  NO-GO** pending deeper investigation. Do not extend the timebox to chase an
  ambiguous result; log what's known, stop the clock, and escalate to Sidney
  rather than guessing with children's data on the line.

## Result (2026-07-04): NO-GO

**Test (a) failed decisively, which settles the gate on its own per the
verdict rule above.** Tests (b)–(e) were not run: once (a) hits the automatic
NO-GO bar, running the rest doesn't change the verdict, and burning more of
the timebox on them wasn't worth it today. They remain open if a
custom-harness spike (M0-02) or an eve fix wants the full five-test suite
re-run.

**What happened, precisely:** ran locally (not the Vercel preview originally
planned — test (a) alone doesn't need Vercel-specific infra, and local is
cheaper/faster for a pure session-durability check; tests (c)/(e) genuinely
need the dispatcher/fan-out environment described above and should use it).
Started eve **0.18.2**, parked a session at `input.requested` via the
built-in `ask_question` tool, stopped the server, bumped to **0.19.0**
(today's actual `latest`; no newer release exists yet, so this substitutes
the most recent real version transition for a true forward-upgrade test),
restarted, and sent the pending answer back on the saved `continuationToken`.

**Outcome:**
- Server logs: 3 `REPLAY_DIVERGENCE` recovery attempts, then a terminal
  `CorruptedEventLogError`. Confirmed reproducible on retry, not a fluke.
- **Worse than an error: the resume call returned `{"ok": true}` with a
  different `sessionId`.** eve silently opened a brand-new, memoryless
  session instead of resuming the corrupted one, or reporting that it
  couldn't. The original parked question and its answer are permanently
  lost, and nothing in the HTTP response would tell a caller that happened.
- Likely cause: 0.19.0 changed how tool-call results get recorded in the
  durable event log (a *patch-level* changelog entry, not flagged breaking).
  A session parked exactly at a tool-call boundary under the old shape can't
  replay under the new one. Full detail, evidence, and the retest in
  `eve-churn-log.md`.

**Against the fail bars written above, before any of this ran:** test (a)'s
fail bar was "the parked session cannot resume, resumes into a corrupted or
wrong state without surfacing an error, **or** the answer is lost." All three
happened at once. This was not a close call.

**Decision needed from Sidney:** per the verdict rule, NO-GO means ejecting
to M0-02 (custom harness on AI SDK + Workflow SDK + Sandbox + AI Gateway, per
`01-architecture.md`'s fallback plan) before any Phase B code depends on eve.
This is a real architectural fork, not something to decide unilaterally.
Options on the table: (1) eject now per the rule as written; (2) treat this
as a narrower, patchable risk (e.g. "drain HITL-parked sessions before every
upgrade" as an operational rule) and re-run the full five-test suite before
deciding; (3) report upstream and wait for a fix, re-testing this exact repro
before trusting upgrades again. Logged as an open decision, not resolved by
this document.

## After the gate

1. Record the verdict and each test's outcome in `docs/homa-planning/build-log.md`.
2. Log every eve behavior encountered (expected or not) in `eve-churn-log.md`.
3. Run the cleanup script; confirm zero `is_synthetic_spike` rows remain in
   homa-prod.
4. Delete the `spike/m0-01` branch and its preview deployment.
5. If GO: Phase B starts (`BUILD.md`). If NO-GO: open `M0-02` re-scoped for the
   custom-harness path, same five tests re-run against it before it's trusted
   either.
