# eve churn log

Feeds the eject tripwire in `12-roadmap-okrs.md` §Standing tripwires:
**">2 breaking eve changes costing >1 day each in any 4-week window before M1
ends ⇒ eject to custom harness; after M2 starts ⇒ never eject, fork/vendor."**

`eve` is pinned to an exact version in `apps/web/package.json` (no `^` range) so
upgrades are always a deliberate, dated, logged decision, never a silent
`pnpm install` surprise. Log every version bump and every breaking change
encountered here, whether or not it cost a full day, so the tripwire has real
data to count against. Newest entries first.

## 2026-07-05 · Decision: stay on eve; two more tests run, one clean, one new finding

Sidney decided: stay on eve (no eject to M0-02), given the mitigations
below already cover test (a)'s failure mode. Continued the spike with an
adapted test (e) and test (b) from `m0-01-adversarial-prototype-gate.md`
(full detail there):

- **Adapted (e), concurrent-session tenancy isolation: PASS.** 12 concurrent
  sessions, each with a unique secret, zero cross-session leakage across two
  runs. The single most safety-critical property, confirmed clean.
- **(b), deploy+rollback mid-turn: FAIL, with a caveat.** A step killed
  between `step.started` and `step.completed` never resumes — confirmed
  identically across a hard kill, a graceful stop with a drain window, and
  an explicit nudge POST after restart. Zero server-side error logged at
  all (worse than test (a) in that respect). **Caveat: this ran against the
  local disk-backed workflow world (`eve dev`), not real Vercel Workflow** —
  the docs describe these as different durability substrates, so this needs
  a retest against an actual Vercel preview before it's trusted as a
  production-relevant finding rather than a local-dev artifact.
- (c) and (d) remain deferred — they need app-level code (a schedule
  dispatcher, a rotation state machine) that doesn't exist yet. Not skipped,
  sequenced to run once that code is written.

Also relocated the harness guard from `apps/web/agent/harness/` to
`apps/web/lib/harness/` — eve's own discovery process warned on the
unrecognized `agent/harness/` subdirectory, since it's app code that calls
eve's API, not an eve-discovered capability.

## 2026-07-04 · Mitigations shipped (not a fix — eve's bug is still open)

Three defenses against the finding below, all in our own code/process, none
touching eve internals ("fix without diverging too much"):

1. **`apps/web/lib/harness/resume-session.ts`** — a narrow seed of M1-14.
   Wraps eve's resume endpoint and refuses to trust the synchronous `ok:
   true` response alone: it also watches the session's event stream for a
   real new turn (or an explicit failure event) before calling a resume
   successful, and throws a typed error (`SessionResumeMismatchError`,
   `SessionResumeUnconfirmedError`, `SessionResumeFailedError`) otherwise.
   Verified against the live bug 3 times (2 failures on the actual 0.18.2→
   0.19.0 corruption, correctly caught both; 1 healthy same-version control
   case, no false positive). Every future caller that resumes a session
   (chat UI send, schedule dispatcher wake) must go through this function.
2. **`scripts/eve-upgrade-check.mjs`** — automates the exact M0-01 test (a)
   repro against any candidate version pair. Exit code 0 = safe per this
   check, 1 = don't bump. Confirmed it correctly passes a same-version
   no-op and correctly fails the known-bad 0.18.2→0.19.0 pair (twice).
3. **`docs/homa-planning/runbooks/eve-version-bump.md`** — the operational
   procedure tying it together: read the changelog for tool/replay/workflow
   language, run the script above, check for live parked sessions before
   deploying (stubbed until M1-02's conversations table exists), deploy,
   smoke-test, log the outcome here either way.

None of this fixes eve's replay bug. It makes the bug survivable: the
harness guard turns silent corruption into a loud, typed failure our own
code can react to, and the script + runbook stop us from ever repeating the
exact trigger condition unknowingly. The bigger question (eject to a custom
harness, or stay on eve and report upstream) is still open — see the result
section in `m0-01-adversarial-prototype-gate.md`.

## 2026-07-04 · M0-01 test (a) — reproducible breaking change, 0.18.2 → 0.19.0

**Cost: well over a day equivalent if hit in production** (a stuck, silently
orphaned session with no error surfaced to the caller). First real entry
against the eject tripwire.

**What happened:** ran the M0-01 upgrade drill locally (`docs/homa-planning/m0-01-adversarial-prototype-gate.md`
test a). Started eve 0.18.2, parked a session at `input.requested` via the
built-in `ask_question` tool, stopped the server, bumped to 0.19.0 (today's
`latest`; no newer version exists yet to test a true forward upgrade, so this
substitutes the most recent real version transition), restarted, and sent the
pending answer back on the same `continuationToken`.

**Result:**
1. The server logs three `REPLAY_DIVERGENCE` recovery attempts, then a
   terminal `CorruptedEventLogError` for the original session
   (`wrun_01KWQYK3DZKNPA0S4XA1AD0DJY`). The parked session's workflow can
   never successfully replay again — confirmed by retrying with an identical
   result.
2. **The HTTP response never surfaces this — and this has two variants,
   confirmed across 4 repro attempts.** The first attempt: the resume POST
   returned `{"ok": true, "sessionId": "<a different id>"}` — eve silently
   started a brand-new session instead of resuming the intended one, with no
   error, no distinguishing field, nothing to tell the caller their resume
   attempt failed. Streaming the new session confirmed it: the agent had no
   memory of the original conversation and asked the user to clarify what
   "4" refers to. Three later attempts (2 via the automated script below, 1
   via the harness module below) instead returned `ok: true` with the
   *correct* matching sessionId, but the message was still silently never
   processed — no second turn ever appeared on that session's stream. Both
   variants share the same root failure: the synchronous POST response
   cannot be trusted as confirmation, only the stream can. The original
   pending question ("What is 2+2?") and its `ask_question` HITL pause are
   permanently lost either way.

**Likely root cause:** the 0.19.0 changelog lists (patch-level, not flagged as
breaking): *"Tool execution failures now return failed tool results to the
model instead of leaving streamed tool calls without matching result
history."* This is a change to the tool-call/result event shape in the
durable workflow log. A session parked exactly at a tool-call boundary under
0.18.2 recorded that boundary in the old shape; replaying it under 0.19.0's
new expectations diverges. If this diagnosis is right, the risk isn't
random, it's specifically: **any session parked at a tool call when a patch
release changes tool-call event handling.**

**Verdict against the gate's rule:** this is exactly the fail bar in the
gate doc ("resumes into a corrupted or wrong state without surfacing an
error, or the answer is lost") — actually both conditions at once, plus a
silent-new-session behavior worse than either. Per the gate's verdict rule,
one such failure is sufficient on its own: **NO-GO.** Full writeup in
`m0-01-adversarial-prototype-gate.md`.

**What this changes about attempt #2** (if a fallback/custom-harness spike or
a later eve-version retest happens): (1) check every eve changelog entry for
"tool" or "replay" language before bumping, even patch versions — semver
patch does not mean workflow-replay-safe here; (2) before any production
upgrade, drain or force-resolve every session parked in HITL first, don't
assume in-flight pauses survive a deploy; (3) if eve ships a fix, retest this
exact repro (park at `ask_question`, bump version, resume) before trusting
upgrades again; (4) treat "the API returned ok:true" as insufficient
confirmation that a resume actually resumed the intended session — worth a
guard in whatever harness we build next.

## 2026-07-04 · Log started

- Pinned `eve` to exact `0.19.0` in `apps/web/package.json` (was `^0.19.0`).
  No breaking changes encountered yet; M0-01 (the adversarial prototype spike
  that stress-tests eve upgrade/rollback/dispatcher-kill/HITL-rotation
  behavior) has not started. This entry is the log's zero point.
