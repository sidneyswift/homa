# Under the Hood: Ambient Coverage: Email Triage & the Heartbeat

**Date:** 2026-07-25
**Subject:** How Homa watches Alessa's inbox and the household's loose ends without being asked, and the two genuinely different mechanisms that do it, an isolated hourly cron (email triage) and a runtime heartbeat embedded in the main session (everything else). Traced from `skills/homa-capture-email-triage/SKILL.md`, `HEARTBEAT.md`, a real traced triage run (session `41856cef`, 2026-07-25 16:47 UTC), `scripts/heartbeat-touch.py`, and the improvements ledger's recurring "heartbeat frozen" saga.
**Purpose of this series:** Documenting Homa's mechanisms to port the concepts into the Homa cloud app (different harness). Same structure as prior entries: **concept (portable)** / **OpenClaw implementation (replaceable)** / **porting notes & gaps**. Related: [2026-07-25, Nightly self-improvement loop](2026-07-25-nightly-self-improvement-loop.md) (the isolated-cron pattern this doc's triage loop shares); [2026-07-25, Story-coach benchmarking system](2026-07-25-story-coach-benchmarking-system.md) (its Ambient Learning loop is a sibling of the heartbeat, scoped to one topic).

---

## The core idea

Two different problems that look similar but need different mechanisms:

1. **"Did anything happen in a specific, well-defined feed that needs a response?"**, email. This has a clean signal source (Gmail), a clean state machine (pinged / skipped / drafted), and a predictable cadence works fine. → an **isolated hourly cron**.
2. **"Is anything generally slipping through the cracks, an unanswered message, an approaching deadline, stale memory, a messy vault, across surfaces that don't have a clean single API to poll?"**, everything else. This needs judgment and rotation, not a fixed checklist, and it turns out to need to live *inside* the persistent main session rather than as an isolated job, with real consequences, below. → a **runtime heartbeat**.

Both exist specifically to solve the same named failure mode: something needing attention sits unseen because no one was looking at the right moment. Both are explicitly restrained by the same instinct: **the cost of a miss is low (the human still has the raw feed); the cost of noise is high (they mute the channel).** Default to silence when uncertain.

---

## Layer 1: Email triage: an isolated cron with a strict signal filter

**Concept:** A hostile-to-false-positives filter, deduped against a persistent seen-set, delivering privately to the one person it's about.

**OpenClaw implementation:** `Email Triage Hourly` cron (`75a0afe7`, `47 7-22 * * *` ET, hourly during waking hours). Loop per the skill: read state → search Gmail for unread/recent → filter to "important & unanswered" → subtract already-pinged/already-skipped IDs → post a Slack triage card **as a DM to Alessa only** (never the family channel, "email triage is private to Less") → update state.

**The importance filter is a real AND-chain, not a vibe:** from a real human (not `noreply@`/`notifications@`) **AND** sent specifically to her (To:/Cc:, not bcc-blasted) **AND** at least one of: known relationship (named co-op coordinators, Spanish teacher, family, doctor/dentist), time-sensitive language ("tomorrow," "deadline," "RSVP," a date within 14 days), a direct question, or an implied-reply context (interview, scheduling). Explicit negative list: newsletters, app notifications, receipts, bulk/unsubscribe-link mail, already-replied threads, threads *she* started, anything already in Spam/Promotions/Updates, anything older than 14 days ("lost cause"). **When uncertain, default to NOT important.**

**The completion-state check is the single most important safety rule in this skill**, and it exists because of a real incident (2026-06-27): a co-op syllabus reminder was flagged as an open deadline, but Alessa's tabs were already fully filled in, acting on the flag would have overwritten finished work and told her to redo a done task. The rule now: **before pinging or acting on any deadline-shaped email, open the actual linked artifact and confirm it's still blank.** "A deadline that only gets noticed is a half-miss, but acting without checking completion state is a worse miss."

**State file** (`email-triage-state.json`): three ID sets, `pinged_message_ids`, `skipped_message_ids` (Alessa reacted 👎/🤷 → permanent suppression for that thread), `drafted_reply_for`, plus `last_run`. Pruned to 90 days per run, capped ~5MB.

**Delivery format:** a phone-friendly DM card (sender, subject, relative time, one-line reason flagged, a body excerpt) with three reaction affordances, 👍 draft a reply, 👎 skip forever, 🤷 "I'll handle it." The reactions *are* the reply mechanism; no typing required from a phone.

**Traced run** (session `41856cef`, 2026-07-25 16:47 UTC): searched Gmail (`gog gmail messages search 'in:inbox newer_than:7d -from:me -category:promotions...'`), found 7 threads, checked every single one against the two ID sets, found **all 7 already pinged or skipped**, updated `last_run`, and concluded correctly: *"No new important emails... Silence is correct, no DM sent."* No message was sent. The loop ran, did real work (a full dedup pass), and correctly produced nothing observable, which is the intended steady-state, not a failure to find something to say.

**Porting notes / gaps:**
- Directly portable: the AND-chain importance filter, the three-way ID-set state machine (pinged/skipped/drafted) as permanent memory of what's already been surfaced, the reaction-as-reply UI pattern, and above all **the completion-check-before-acting rule**, grounded in a real incident where skipping it would have destroyed a parent's finished work.
- Gap: cloud app needs an email/inbox integration with equivalent thread-level state (who sent it, has the owner replied, is it already actioned) and a persistent per-thread suppression list keyed off explicit user dismissal (👎), not just time-based decay.

---

## Layer 2: The heartbeat: a runtime tick, not a cron job

**Concept:** For the broad, unstructured "is anything slipping" sweep, OpenClaw uses a fundamentally different mechanism than a scheduled job: a **heartbeat interval on the live main agent session itself**.

**OpenClaw implementation:** `agents.defaults.heartbeat.every = "30m"` in `openclaw.json`, a runtime config on the *main* agent, not an entry in the cron system at all. Every 30 minutes, if the main session is alive, it fires a heartbeat turn. Per `HEARTBEAT.md`, each beat **rotates** through a checklist rather than doing everything every time: unanswered messages in the family channel, email/deadline scanning (feeding off the same email-triage signal and the *same* completion-check rule from Layer 1), calendar events in the next 24–48h, distilling the day's memory file into MEMORY.md, and periodic vault-lint (stale Subjects pages, orphan pages).

**Why this is architecturally different from a cron, and why it matters:** a cron spins up a fresh isolated session on a timer regardless of anything else. The heartbeat only fires *as a tick inside the already-running main session*. That means its reliability is coupled to the main session's uptime in a way cron jobs aren't, and this coupling caused a real, repeated, multi-week production bug.

**Every heartbeat must call `scripts/heartbeat-touch.py --checks <list> --note "..."`**, a script whose entire job is stamping epoch-ms timestamps into `memory/heartbeat-state.json`'s `lastChecks` map (keyed per check type: messages/email/calendar/memoryReview/vaultLint) plus a one-line `notes` field. This exists because of a documented failure: on 2026-07-04 the beat updated `notes` (prose) but not the `lastChecks` timestamps, so the doctor's freshness check, which keys strictly off the *newest epoch-ms in `lastChecks`*, not the presence of prose, falsely reported "heartbeat running blind" for **five consecutive nights** even though the beat prose looked fine to a human skimming it. `heartbeat-touch.py`'s docstring states the fix directly: make stamping the timestamp *and* the note a single atomic call, so a notes-only write becomes structurally impossible.

**This bug recurred anyway, for a different reason, for weeks after the fix.** The improvements ledger shows the *same* "heartbeat-state frozen" finding firing repeatedly through mid-July (07-18 through 07-24), and each time `homa-system-reflect`, which runs in an **isolated cron session**, correctly diagnosed it as *"un-fixable from this restricted reflect grant"* because `cron list` from inside an isolated session returns only reflect's own job; the heartbeat isn't a cron job reflect can see or touch at all. It's main-session runtime state. Reflect explicitly refused to fake a stamp via `heartbeat-touch.py` to clear the gauge, calling that "the surface-and-rationalize anti-pattern", the finding stayed open, honestly, until the actual main-session beat resumed stamping on its own.

**Porting notes / gaps:**
- The core reusable idea: **not every recurring check belongs in the scheduler.** Some things (broad, judgment-heavy, rotating checklists) are cheaper and more contextually aware as a tick inside a long-lived session than as a fresh isolated job, but that trades away the isolation/observability that makes crons easy to monitor externally.
- The **atomic timestamp+note stamp** pattern (never let "I wrote something" silently substitute for "I wrote the specific field the health check reads") is directly portable and cheap insurance against an entire class of false-positive/false-negative health-check bugs.
- Real, still-relevant gap this system has today: **a health check that only an in-process actor can clear, but an out-of-process actor (reflect) is the one auditing it, is a structural blind spot**, the auditor correctly *can't* fix what it finds, every time, for weeks. Before porting this pattern, decide whether the cloud app's equivalent "ambient sweep" belongs in a monitorable scheduled job instead of a long-lived-process tick, trading some contextual richness for actual fixability by the system's own self-improvement loop.
- Gap: cloud app needs its own rotating (not exhaustive-every-time) checklist mechanism for broad ambient coverage, plus whatever health-check surface reads it needs to key off a value that's structurally impossible to update by accident (a single atomic stamp call, not a free-text field).

---

## Summary: the portable formula

```
narrow, structured feed (email) → isolated scheduled cron
    strict AND-chain importance filter, default to silence when uncertain
    → dedup against a persistent seen/skipped/drafted state
      → completion-check the actual artifact before ever acting on a "deadline"
        → deliver privately, reaction-as-reply

broad, unstructured coverage (everything else) → runtime heartbeat tick, NOT a cron
    rotate through a checklist rather than exhaustive-every-time
    → atomic timestamp+note stamp so a health check can't be silently starved
      → accept the tradeoff: richer context, but only as reliable as the host session's uptime
        → an external auditor (reflect) may correctly diagnose but be unable to fix this class of gap
```

## Known gaps to fill in the cloud architecture

1. An inbox/thread integration with per-thread state (pinged/skipped/drafted) and a strict, mostly-negative importance filter that defaults to silence.
2. The completion-check-before-acting rule for anything deadline-shaped, grounded in a real incident, not hypothetical caution.
3. A decision, made deliberately rather than by default, about whether broad ambient coverage lives in a scheduled job (monitorable, fixable by the self-improvement loop) or a long-lived-process tick (richer context, coupled to that process's uptime), this system picked the latter and paid for it in a multi-week recurring false-health-check bug.
4. An atomic "stamp what you checked" primitive so a health/freshness check can never be silently starved by a partial write.
