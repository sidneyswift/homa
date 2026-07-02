---
name: homa-system-reflect
description: Make Homa better at her own job every night — fix recurring machinery friction AND expand what she's capable of by mining the parent's actual usage for gaps, patterns, and opportunities, then building or proposing new skills, crons, and artifacts. Use on the nightly "Homa Reflect" cron, after a batch of work, when the same friction recurs, or when the partner says "improve the system", "what should we automate", "what are we missing", or "reflect". The self-improvement organ — the half that makes Homa grow, not just stay current.
---

# Homa Reflect

Most of Homa's loops compound **content**: `homa-track-story-coach` deepens what we know about the child,
the learning loop captures what the parent says, MEMORY holds durable facts. `homa-system-skillify` turns
proven work into a skill. This skill compounds **Homa herself** — both *sharper* (fewer recurring
bugs) and *bigger* (more she can do).

**Premise (the partner):** the parent is using ~10% of Homa's capability. As the child ages into real, customized
schooling, Homa should be actively expanding — finding what the parent needs but doesn't ask for, and
building toward it. Don't wait to be told. But stay grounded: every move cites real signal, never
generic best-practice.

Run two lenses every pass.

## Lens A — Sharpen the machinery (fix recurring friction)

1. **Find repetition from real evidence**, newest first:
   - `~/.openclaw/logs/janitor.jsonl` + `operations/health.md` — recurring doctor/janitor findings.
   - `feedback.jsonl` + the reaction retro — clusters of 👎/🤷 (friction in Homa's behavior).
   - recent `memory/` dailies + `learning-journal.jsonl` — where the parent/partner corrected or re-explained.
   - `operations/improvements.md` — don't re-propose what's done or rejected.
2. **Cite the specific instance.** No fix without a real friction ("TOOLS.md said `gog sheets create`,
   which doesn't exist — 2026-06-26").
3. **Cheapest durable fix:** recurring task → new skill (`homa-system-skillify`); dark/mis-firing
   skill → description or quick-ref fix; recurring bug-class → a new check in `scripts/doctor.py` or
   `homa-system-vault-audit`; rebuilt deliverable → a `scripts/` template; missed rule → one line in
   `AGENTS.md` / `TOOLS.md` / `SOUL.md`.

## Lens B — Expand the capability (grow what Homa can do)

This is the new half. Read what the parent is **actually doing** and find where Homa could do more.

1. **Mine the parent's real usage**, last ~7–14 days:
   - `journal.jsonl` + `learning-journal.jsonl` `raw_message` fields (mostly **voice notes**) + recent
     `memory/` dailies + the Obsidian Daily Logs — what is the parent doing, asking for, struggling with,
     repeating by hand, or mentioning that Homa never picks up on?
   - `feedback.jsonl` — what does she value (👍) vs. not.
   - The fresh `research-journal.md` from that night's `homa-track-story-coach` run — does a finding
     imply a capability Homa lacks?
   - Deadlines / life events in the signal (e.g. a program asking for a syllabus, an upcoming class).
   - **The loops themselves.** Did a heartbeat, triage pass, or cron *miss* something it should have
     caught (a deadline email that sat, a stale state file, a dead channel reference)? A missed catch is
     Lens-A friction — fix the catcher, don't paper over it with a new skill.
2. **Name the gap/pattern/opportunity, with its citation.** Three kinds count:
   - **Gap** — the parent does X manually or asks for something Homa can't do (cite the instance).
   - **Unused power** — a capability/key already in hand sits idle and would clearly help (e.g. Twilio
     SMS, ElevenLabs audio, FAL video). "Unused but obviously useful for an observed need" qualifies.
   - **Anticipated need** — the child aging up, a season/deadline approaching. Allowed *if* tied to a
     concrete upcoming marker, not vague futurism.
3. **Turn it into the cheapest durable capability:** a new **skill** (`homa-<category>-<what>`), a new
   **cron** (a recurring run), a new **artifact** type, an **integration** (wire an existing key, or
   request a new one in the roadmap), or an **upgrade to an existing skill**.

   **A skill is for work that recurs.** Before minting one, ask: *will this run more than once?* If it's
   a **one-shot deadline or single task** (a program asks for a syllabus once, a form is due, a one-time
   email needs a reply), the right move is almost never a new skill — it's to **execute it E2E for the parent
   now** and **wire the trigger into an existing loop** (email-triage, heartbeat, a cron) so the *next*
   one gets noticed and handled automatically. Building a single-purpose skill for a once-a-year task is
   bloat, and worse, it lets you *feel* productive while the real gap — "why didn't a loop catch this?" —
   goes unfixed. (Grounded: 2026-06-27, reflect minted `homa-track-syllabus` for a once-a-year CM DC
   submission instead of fixing the heartbeat/email path that should have caught the deadline. The partner
   flagged it.) When the signal is a missed catch, **fixing the catcher is the higher-leverage build.**
4. **Groom `operations/roadmap.md`** — the capability backlog. Add new ideas with their citation;
   move ripe ones to `building`/`shipped`; mark dead ones `parked`. The roadmap is the durable memory
   of Lens B so good ideas aren't re-discovered.

## Build autonomously — don't wait for approval (the partner, 2026-06-26)

The posture is **build, then let the output be judged** — not propose and wait (output validates,
plans don't). Each night, after grooming the queue:

1. **Re-validate + re-rank the LIVE QUEUE** in `operations/roadmap.md` against *today's* signal: drop
   items whose need evaporated or whose citation went stale (>~30d with no fresh echo), re-score by the
   priority formula, dedup. Bump `last-groomed:`.
2. **Build the top grounded item(s)** — typically 0–2 a night; a quiet night builds nothing. For each:
   - **Dedup first** — if an existing skill (or a near-twin) covers it, *upgrade that one* instead.
   - **Verify on a sample** before shipping — a printable renders, a script runs, a skill does its
     thing on real input. No half-working skill lands in `skills/`.
   - Add it to the AGENTS.md Quick Reference, run `python3 scripts/doctor.py` (must stay clean), mark
     the queue item `shipped` with the date + the skill name.
   - **Commit it** as a discrete snapshot: `scripts/brain-snapshot.sh "reflect: ship <skill> — <why>"`.
     One capability per commit, so a bad build is a one-line `git revert`.
3. **Re-log + re-prioritize** — append the outcome to the STREAM, and the *next* night re-ranks from
   the new reality. The loop is build → observe → re-rank, continuously. End the pass with a final
   `scripts/brain-snapshot.sh "reflect: nightly pass <date>"` so the grooming + Lens-A fixes are
   captured too.

**The only hard line** (build it *ready*, but don't auto-*fire* it): starting **recurring outward
contact to the family** (SMS/email/calls), **spending money**, **changing credentials**, or **adding a
new API key** (those need the partner's accounts anyway). For those, build the capability ready and leave a
one-line "reply to enable" in the report. Everything else — skills, artifacts, internal/research
scripts and crons, upgrades, checks — just ship.

## Guard against the second-order failure modes

The autonomy is only safe if it also *prunes and measures*. Every pass, also:

- **Fight bloat.** More skills is not the goal — adoption is. If a shipped capability shows no sign of
  use after a fair window (no 👍, no journal mention, no cron fires), flag it to `parked` and propose
  merging/deleting it. A graveyard of unused skills is drift, not progress. (Until a usage log exists —
  itself a queue item — judge use from `feedback.jsonl`, journal mentions, and cron run history.)
- **Don't let the queue rot.** It's mutable and rewritten nightly; an item sitting untouched for weeks
  is a signal it was never real — park it.
- **Watch sprawl.** Creating a cron is rare and deduped; don't spawn near-duplicate crons or skills.
- **Stay reversible.** The brain is under local git (`~/.openclaw/workspace/.git`, brain-only — see
  `.gitignore`). Commit each build via `scripts/brain-snapshot.sh` so a bad night reverts cleanly
  (`git -C ~/.openclaw/workspace revert <sha>`). Never `git push` — the repo holds secrets + PII.

## Log + report

- Lens A → `operations/improvements.md` (change + friction + status).
- Lens B → `operations/roadmap.md` (queue re-ranked; STREAM appended; `last-groomed:` bumped).
- **Report to the partner** (main session, not Slack, not the parent): friction fixed, what you **shipped**
  tonight, anything **parked/pruned**, and the short list of build-ready items awaiting a "reply to
  enable" (the outward/spendy few). Keep it tight. A genuinely quiet night is a clean no-op — say so.

## Don't
- Don't manufacture work. A change or queue item with no citation is a cage, not a ratchet.
- Don't auto-*fire* the outward/spendy/credential few — build them ready and surface the one-tap enable.
- Don't ship an unverified or duplicate skill; don't let unused skills accumulate.
- Don't edit homeschool *content* or owned facts here — surface and ask.

## Relationship to the other organs
- `homa-system-skillify` extracts a proven process into a skill; reflect *decides what's worth* building.
- `scripts/doctor.py` / `homa-system-vault-audit` find drift; reflect turns a *recurring* finding into
  a permanent check.
- `homa-track-story-coach` compounds knowledge *about the child*; reflect turns that knowledge into new
  *capabilities* (an activity generator, a weekly-plan builder, an audiobook of a reader).

Added 2026-06-26 (Lens A). Lens B + nightly cadence + roadmap added 2026-06-26 so Homa expands her own
abilities, not just maintains them.
