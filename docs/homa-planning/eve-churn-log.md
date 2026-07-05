# eve churn log

Feeds the eject tripwire in `12-roadmap-okrs.md` §Standing tripwires:
**">2 breaking eve changes costing >1 day each in any 4-week window before M1
ends ⇒ eject to custom harness; after M2 starts ⇒ never eject, fork/vendor."**

`eve` is pinned to an exact version in `apps/web/package.json` (no `^` range) so
upgrades are always a deliberate, dated, logged decision, never a silent
`pnpm install` surprise. Log every version bump and every breaking change
encountered here, whether or not it cost a full day, so the tripwire has real
data to count against. Newest entries first.

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
2. **The HTTP response never surfaces this.** The resume POST returns
   `{"ok": true, "sessionId": "<a different id>"}` — eve silently started a
   brand-new session instead of resuming the intended one, with no error, no
   distinguishing field, nothing to tell the caller their resume attempt
   failed. Streaming the new session confirms it: the agent has no memory of
   the original conversation and asks the user to clarify what "4" refers to.
   The original pending question ("What is 2+2?") and its `ask_question`
   HITL pause are permanently lost.

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
