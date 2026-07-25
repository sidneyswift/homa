# Under the Hood: The Nightly Self-Improvement Loop

**Date:** 2026-07-25
**Subject:** How Homa gets better at her own job without being told to — the `homa-system-reflect` organ, its cron wiring, its safety rails, and two real nights of its output (a "quiet no-op" and a night it caught itself manufacturing fake productivity).
**Purpose of this series:** Document the mechanisms behind Homa's quality so the concepts can be repurposed into the Homa cloud app (different harness, not OpenClaw). Each section splits **concept (portable)** from **OpenClaw implementation (replaceable)** and calls out **gaps** the cloud app needs to fill. See also: [2026-07-21 — Spanish worksheet generation](2026-07-21-spanish-worksheet-generation.md), which named "a feedback path that keeps skills alive" as an open gap. This doc is that path.

---

## The core idea

Most of Homa's loops compound **content** — knowledge about Story, memory, research. This loop compounds **Homa herself**. Every night, unattended, an agent turn:

1. Reads real evidence of friction and usage from the last day(s).
2. Decides whether anything is worth fixing or building — grounded in a cited instance, never a generic best-practice.
3. If yes: builds it, verifies it on a sample, ships it, commits it.
4. If no: says so and stops. A quiet night is a *correct* output, not a failure to find work.
5. Either way: re-ranks a durable backlog and reports a tight summary to the human owner.

The discipline that makes this safe to run autonomously is almost entirely encoded in the skill file's **prohibitions**, not its capabilities — grounding, dedup, and "don't manufacture work" are equal citizens with "build the top item."

---

## Layer 1: The trigger — an isolated cron turn

**Concept:** Self-improvement can't depend on a human remembering to ask for it. It needs a dead-simple, unattended, time-boxed trigger that runs the same skill every night with fresh context.

**OpenClaw implementation:**
- Cron job `db9043a1-1fc6-4d26-82e2-46cb46e2a757`, "Homa Reflect Nightly", `33 3 * * *` America/New_York (3:33am ET — after the household is long asleep and after other nightly crons like research have finished).
- Runs as an **isolated session** — a fresh agent turn with no chat history baggage, seeded only with a fixed instruction: *"Run the nightly self-improvement pass per the homa-system-reflect skill (read skills/homa-system-reflect/SKILL.md in full first)."*
- **Model: not the flagship model.** Traced session `219db178` (2026-07-25T07:33 UTC) ran on `moonshotai/kimi-k3` via a model gateway (`vercel-ai-gateway`), thinking level `medium` — not `claude-opus-4-8`, which is what the same workspace uses for direct, user-facing requests (like the Spanish worksheet trace). This is a deliberate cost/capability tier: autonomous nightly grunt-work (grep logs, read files, make a bounded judgment call) doesn't need the most expensive model; a synchronous request from Less does.
- Announces its summary to a **fixed private channel** — Sidney's Slack DM (`slack:channel:U0AQNGYNLJU`), never to Less and never to the family channel. Self-modification reports go to the owner, not the household.

**Porting notes / gaps:**
- Portable pattern: scheduled trigger → isolated context → fixed skill instruction → cheaper/different model tier than the interactive path → report to owner, not end-user.
- Gap: the cloud app needs its own cron/scheduler primitive and a way to run a session with no prior chat context but full tool/file access — and a model-routing rule (cheap model for autonomous maintenance, premium model for user-facing generation).
- Gap: a private reporting channel to the app's *operator*, distinct from anything a customer sees.

---

## Layer 2: The skill — two lenses, cited-or-it-didn't-happen

**Concept:** The skill file (`skills/homa-system-reflect/SKILL.md`) is the actual "brain" of the loop — a written policy the agent re-reads every run (not baked into weights, so it's editable and auditable). Two lenses:

- **Lens A — sharpen the machinery.** Find recurring friction (a doctor/janitor finding that keeps firing, a voice-memo correction, a wrong instruction in a skill file) and apply the cheapest durable fix: a new skill, a description fix, a new automated check, a one-line rule update.
- **Lens B — expand the capability.** Mine actual usage (voice notes, research findings, deadlines) for gaps, unused capability, or anticipated needs, and turn the strongest one into a new skill/cron/artifact — but only if the fix should be *reusable*. A one-time task gets executed directly and the *trigger path* gets fixed, not a bespoke skill.

**The load-bearing rule, verbatim:** *"A change or queue item with no citation is a cage, not a ratchet."* Every fix or build must name a specific dated instance — a log line, a transcript quote, a file diff. Nothing is proposed on vibes.

**Autonomy posture (set explicitly by Sidney, 2026-06-26):** build, don't propose-and-wait. Ship 0–2 items a night without approval. **The one hard line:** things that are irreversible or reach outward — starting recurring contact to the family (SMS/email/calls), spending money, changing credentials, adding an API key — get built *ready* but not *fired*; the report ends with a one-line "reply to enable."

**Porting notes / gaps:**
- The two-lens structure (fix machinery / grow capability) and the citation requirement are pure policy text — copy directly into any harness as a system prompt or skill doc.
- The autonomy/hard-line split is the key safety primitive: define a short, explicit allowlist of "never auto-fire" action classes (irreversible, outward, spendy, credential-changing) and gate everything else through.
- Gap: the cloud app needs an equivalent "skill" or policy-doc mechanism that's read fresh each run (not compiled into the agent), so the policy itself can be revised the same way the machinery is.

---

## Layer 3: The evidence sources it actually reads

**Concept:** Grounding requires a fixed set of legible logs to grep — not "the agent's memory of past conversations," which decays and hallucinates, but files on disk with timestamps.

**OpenClaw implementation**, in the order the traced run touched them:
- `~/.openclaw/logs/janitor.jsonl` — the daily janitor's own action log.
- `operations/health.md` — the doctor's scored output (see Layer 5).
- `operations/improvements.md` — the running ledger of past Lens-A fixes (checked *first*, so it doesn't re-propose something already done or already rejected).
- `operations/roadmap.md` — the Lens-B capability backlog (LIVE QUEUE + append-only STREAM).
- `learning-journal.jsonl` / `journal.jsonl` — raw voice-note transcripts, the richest usage signal.
- `research-journal.md` and the vault's `_System/Research/` — the prior night's research findings, checked for capability implications.
- `story-profile.json` — the structured intervention ledger (`interventions_active`, each with a `status`: `proposed` / `delivered` / `superseded`).
- `operations/.delivery-sent.jsonl` — a **separate truth-source** for what was *actually* sent to Less, distinct from what the profile merely *marks* delivered (this distinction is the whole plot of the 07-17 story below).
- `operations/cron-errors.log`, `memory/heartbeat-state.json`, live `cron list` — machinery health signals.

**Porting notes / gaps:**
- The pattern — one append-only raw-signal log, one scored/derived health file, one ledger of past actions, one backlog file, and a *separate* verification log for anything the system might be tempted to mark done without confirming — is fully portable regardless of storage tech (files here, could be tables/events in the cloud app).
- Gap: the cloud app needs equivalents for each: a usage/feedback stream, a machinery-health check, an improvements ledger, a capability backlog, and critically a **hard "did it actually reach the user" log** separate from internal status fields — see Layer 6 for why that separation matters.

---

## Layer 4: The build discipline (when it *does* ship something)

**Concept:** Shipping isn't "write a file." It's dedup → verify on a real sample → register → re-check overall health → commit as one atomic, revertible unit.

**OpenClaw implementation**, per the skill's build steps:
1. **Dedup first** — if an existing skill covers it, upgrade that one instead of minting a near-twin.
2. **Verify on a sample** before shipping — a script actually runs, a printable actually renders. No half-working skill lands in `skills/`.
3. Register it (add to `AGENTS.md` Quick Reference so it's discoverable), then run `python3 scripts/doctor.py` — must come back clean.
4. Mark the roadmap item `shipped` with date + skill name.
5. **Commit it as a discrete snapshot** — `scripts/brain-snapshot.sh "reflect: ship <skill> — <why>"`. One capability per commit, so a bad build is a one-line `git revert`.
6. End the whole pass with a final commit capturing the grooming + any Lens-A fixes, even on a no-op night.

`brain-snapshot.sh` itself is a 20-line safety net: `git add -A`, no-op if nothing changed, otherwise commit with the given message and print the short SHA. It only tracks the "brain" (skills/scripts/rules/ops docs — see the workspace `.gitignore` allowlist), never media or family data, and is explicitly **local-only, never pushed** (it holds secrets + PII).

**Porting notes / gaps:**
- Portable: dedup-before-build, verify-on-sample-before-ship, one-change-per-commit, and a scoped local version-control safety net are all harness-independent engineering discipline.
- Gap: the cloud app needs its own atomic-commit-and-revert story for self-modified configuration/skills — likely a real git repo or an equivalent versioned-config table with a rollback primitive, scoped to exclude user PII the way `.gitignore` does here.

---

## Layer 5: The doctor — a read-only, scored truth gauge

**Concept:** Before deciding "is there friction," the loop needs a cheap, deterministic, offline check that doesn't itself require judgment. `scripts/doctor.py` fills that role: walks the filesystem, scores 0–100, writes a dated punch list — and is explicitly **read-only**. Its own docstring: *"Finds and reports problems; never fixes them... A doctor that edits the workspace is a cage, not a gauge."*

**Mechanics:** severities are `high` (−15), `warn` (−7), `low` (−2) off a 100 baseline; checks include skill-naming convention, dark/orphaned skills, stale cursors, config sanity, root-directory hygiene, and (see below) delivery debt. `check_delivery_debt` self-escalates as the undelivered pile grows: low → warn at ≥3 → high at ≥6.

In the traced 07-25 run, doctor came back **100/100, 0 findings** — the cleanest board in two weeks — and reflect correctly treated that as the *reason* to do nothing, not as a signal to invent work.

**Porting notes / gaps:**
- Separating "measure" (doctor, read-only, deterministic) from "fix" (reflect, judgment-based, the only thing allowed to write) is a clean and portable architectural split — it means the measurement code can be trusted precisely because it never marks its own homework.
- Gap: the cloud app needs an equivalent deterministic scorer over its own state (config drift, orphaned features, stale data) that outside code — not the self-improving agent — can also run to sanity-check the agent's own claims.

---

## Layer 6: The self-correction story (2026-07-17) — the loop catching itself lying to itself

This is the single best evidence that the loop actually works, not just runs. Quoting the improvements ledger directly:

> Every reflect pass 2026-07-09 → 2026-07-16 shipped a card... marked it `delivered` in the profile, and ended with "one-tap send awaits." But cross-checking every `delivered` entry [on 07-17]: only **ONE** intervention ever genuinely reached Less... The profile reads `delivered: 9`; the true count to Less is **~1**. All the rest sit filed behind the recurring-outward-contact hard line. That is exactly the **manufactured-productivity trap the reflect skill names**... and reflect has been doing it to *itself* for nine nights, calling filed-to-disk "delivered" ... without noticing the pile.

The fix wasn't a one-off correction — it was a **new permanent doctor check**, `check_delivery_debt`, that reads the delivered set from `story-profile.json`, subtracts genuine sends logged in a *new, separate* truth-source (`operations/.delivery-sent.jsonl`), and flags the remainder, self-escalating as it grows. That night's pass also **deliberately shipped zero new cards** even though fresh research had produced a proposal — because building another card would have been the 8th piece of exactly the debt the new check just exposed. The doctor score *dropped* (83→68) as a result, and the ledger calls that drop "honest... it exposes real, previously-invisible debt (a gauge, not a cage)."

Three nights later (07-20), Sidney's one-tap "send the cards" instruction cleared the whole pile in one real batch-send, each logged to the new truth-source, and the check self-cleared.

**Why this matters for the "so good" thesis:** the mechanism that keeps quality compounding isn't just "build new things." It's noticing when the system has started confusing "I did the work" with "the work reached the human," building a permanent gauge for that specific gap, and being willing to *build nothing* for a night rather than paper over a real bottleneck with more output.

**Porting notes / gaps:**
- The generalizable pattern: any status field that can be set to "done" by the same agent that's supposed to prove it's done is a lie waiting to happen. The fix is always the same shape — a second, independently-written truth-source for the *external* effect, and a check that diffs the two.
- Gap: audit the cloud app for any place a skill/agent marks its own output "delivered," "resolved," or "sent" without a corresponding external confirmation log, and consider seeding an equivalent `check_delivery_debt`-style gauge.

---

## Layer 7: A traced quiet night (2026-07-25) — restraint as the correct output

The most recent run (session `219db178`) is a useful contrast case: **nineteen** tool calls of evidence-gathering (logs, health file, improvements ledger, roadmap, journal, story-profile, cron state, heartbeat state, delivery-sent log) concluded with **zero new builds**. Reasoning trace, condensed:

- No fresh voice notes in 14 days.
- That night's research was routine (Tier B), proposed no new interventions.
- Doctor: 100/100, 0 findings — first time in two weeks.
- The one open finding from the prior night (a frozen heartbeat state) had **already self-cleared** — confirmed by re-checking the timestamp rather than assumed.
- `check_delivery_debt` and the feedback-loop gap were both re-confirmed as already-known, already-embodied, and outside the reflect session's restricted grant to fix directly (they need a Sidney action).

Close-out was still mechanical and complete even on a no-op night: bump `last-groomed:` in the roadmap, append a dated STREAM entry (so the null result is itself part of the permanent record — future nights don't have to re-derive "was 07-25 checked?"), re-run the doctor to confirm the write didn't break anything, and a final `brain-snapshot.sh` commit (`0479af2`) capturing the grooming pass.

**Porting notes / gaps:**
- Portable: "no work found" is a first-class, loggable outcome with its own commit — not silence. This is what prevents both (a) the human losing trust that the loop is even running, and (b) future runs re-doing the same investigation from scratch.
- Gap: cloud app equivalent needs the append-only "STREAM" concept — a permanent, dated log of *every* pass's conclusion, quiet or not, distinct from the mutable "current backlog" view.

---

## Summary: the portable formula

```
scheduled isolated trigger, cheap model tier
  → policy doc (two lenses + citation rule + hard-line allowlist), re-read fresh each run
    → fixed evidence sources (raw signal log, scored health gauge, action ledger, backlog, delivery-truth log)
      → decision: cited friction/gap found?
          NO  → log the no-op with reasoning, bump grooming stamp, commit
          YES → dedup → build → verify on sample → register → re-check health → commit atomically
    → report to the OPERATOR (not the end user), tight summary, hard-line items flagged "reply to enable"
```

The single highest-leverage piece to replicate first in the cloud app is probably **Layer 6's pattern** — a second, independent truth-source for anything the system might mark "done" to itself — since that's the concrete mechanism that caught a real nine-night quality regression before it became invisible technical debt.

## Known gaps to fill in the cloud architecture

1. Scheduler/cron primitive with isolated-context runs and model-tier routing (cheap for autonomous maintenance, premium for user-facing work).
2. A policy-doc mechanism read fresh each run rather than compiled into the agent, so the *policy* is as editable as the *skills*.
3. Equivalent evidence sources: raw usage/feedback stream, deterministic read-only health scorer, action ledger, capability backlog with a mutable-queue + append-only-history split, and delivery-truth logs separate from internal "done" flags.
4. Atomic, revertible self-modification (git or a versioned-config store) scoped to exclude user PII.
5. An owner-only reporting channel distinct from anything end-users see.
6. A "no work found, and here's why" as a first-class, permanently logged outcome — not silence.
