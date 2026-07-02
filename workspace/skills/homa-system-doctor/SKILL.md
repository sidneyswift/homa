---
name: homa-system-doctor
description: Read-only scored health check of the whole Homa OS. Use on "health check", "is everything consistent", "is anything stale", "audit the system", "run the doctor", before relying on a system claim, or as the verification surface the janitor and homa-system-reflect gate on. Reports a 0-100 score and a punch list to operations/health.md; fixes nothing.
---

# Homa System Doctor

Homa's **verification surface**: answer "is this OS consistent?" with checkable evidence, not a
feeling. **Read-only** — find and report problems, never fix them. The `scripts/janitor.py` cleanup
and `homa-system-reflect` are what fix; a doctor that edits the workspace is a cage, not a gauge.

"Consistent" is what this report says — not what a turn *felt* like. Any "left it clean" /
"everything's wired" claim should be backed by a doctor run.

## Run

**Fast path (mechanical, deterministic):**

```bash
python3 ~/.openclaw/workspace/scripts/doctor.py
```

It walks the filesystem, scores 0-100, and writes `operations/health.md` with a dated punch list
(exits non-zero if there are findings). It covers the checks a script can do offline:

1. **Naming convention** — every `skills/*/` matches `homa-<category>-<what>` with category in
   {system, make, google, track, capture}. (The enforced naming rule — see AGENTS.md.)
2. **Skill structure** — every skill has a `SKILL.md` whose frontmatter `name` matches its dir and has
   a description (no unroutable skills).
3. **Quick-reference parity (no dark skills)** — every skill dir is listed in the AGENTS.md "🧩 Skills
   (Quick Reference)", and no listed entry is a ghost. A built-but-unlisted skill is "a surgeon the
   hospital can't find."
4. **Stale cursors** — `learning-loop-state.json` / `email-triage-state.json` not advanced in >7d.
5. **Config sanity** — `openclaw.json` parses; a `.last-good` backup exists.
6. **Draft debt** — count of unresolved "draft — confirm" markers.
7. **Organs wired** — `operations/improvements.md` (the reflect ledger) exists.

## Then add the live checks the script can't do offline (judgment + CLI)

The script is the mechanical subset; this skill is the full contract. After the fast path, also check:

8. **Crons armed & green.** `openclaw cron list` — every expected loop is enabled and not failing
   (no `consecutiveErrors`, recent `Last`). Each weekly organ (janitor, homa-system-vault-audit, reaction retro,
   reflect, dashboard) is present and armed. (Note: `janitor.py`'s old cron check reads
   `cron/jobs.json`, which moved to the Gateway — treat the CLI as the source of truth.)
9. **Dashboard truth.** The Vercel `homa-dashboard` reflects current reality (the daily cron ran ok;
   counts on the dashboard match the workspace).
10. **CLI-command currency.** Spot-check that commands documented in `TOOLS.md` still exist (e.g. a
    `gog <x>` subcommand resolves under `gog <x> --help`). This is the class of bug that put a bogus
    `gog sheets create` in the docs — when you confirm one, propose a permanent lint via
    `homa-system-reflect`.
11. **Brain currency.** The AGENTS.md filing tree / "What Goes Where" still matches the real folders.

## Score + report

- The script records the score + punch list in `operations/health.md`. Add any live-check findings to
  the same report when you run the full contract.
- **Terminal states:** *Clean* — a genuine pass is a success. *Findings* — recorded for the janitor /
  reflect to act on. *Blocked* — a check couldn't run (missing tool/data); say so, don't guess a pass.

## Who fixes what
- Safe, mechanical drift → `scripts/janitor.py` / the Daily Janitor.
- A *recurring* finding → `homa-system-reflect` turns it into a permanent new check here so it stops
  recurring.
- Facts the family owns → flag, don't change.
