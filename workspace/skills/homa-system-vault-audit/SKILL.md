---
name: homa-system-vault-audit
description: Audit the Obsidian homeschool vault for staleness, drift, and missing capture. Use when running the weekly homa-system-vault-audit cron, when the partner asks "is the vault current?", or when Homa needs to know how confident she is in a vault claim before acting on it.
---

# Vault Audit

The vault is supposed to mirror reality (the child's actual progress, current curriculum state, what works). When the mirror cracks, Homa stops being useful. This skill keeps the mirror clean.

## What "Stale" Means

A file is stale when its content claims to describe *current* state but hasn't been verified in 14+ days. Two flavors:

- **Stale-soft (14–29 days):** content may still be true; verify before acting on it
- **Stale-hard (30+ days):** content is almost certainly drifted; don't trust without re-verification

`Last updated: YYYY-MM-DD` at the top of a page is the verification signal. File mtime is the fallback.

## File classes — three kinds of pages

The vault contains three different kinds of files. The audit treats each differently:

### 1. AUTO-GENERATED (most files)

Pages rebuilt by `~/.openclaw/workspace/scripts/regenerate_vault.py` from `story-profile.json`:
- `Home.md`
- `the-child.md`
- `Subjects/{Domain}.md` (all 15)

**Audit behavior:** These files are always fresh by definition (they get rewritten on every profile change). The audit skill should NOT apply staleness banners to them — they manage their own banners via the regen scripts. If an auto-gen file's mtime is unexpectedly old (>2 days, say), that's a signal the regen pipeline broke — flag it as a critical capture-gap finding, not a staleness issue.

**How to detect:** the file contains `🤖 AUTO-GENERATED` in its banner.

### 2. HAND-MAINTAINED (a few setup files)

Pages humans (the partner/parent) own and update manually:
- `Curriculum Overview.md`
- `Weekly Schedule.md`
- `What Homa Can Do.md`
- (others added in the future, marked similarly)

**Audit behavior:** SKIP these entirely. They're not derived views, they're human reference docs. The audit should NEITHER apply staleness banners NOR flag them as drift.

**How to detect:** the file contains `🖐️ HAND-MAINTAINED` in its banner.

### 3. CAPTURE / RAW (the rest)

Everything else — lesson logs, weekly plans, research notes, daily logs, etc. These accumulate over time and have natural staleness curves.

**Audit behavior:** Apply staleness banners normally (✅ fresh / ⚠️ stale-soft / 🛑 stale-hard) per the rules in "What 'Stale' Means" above.

## Freshness Banner (for class 3 — capture/raw files)

Format:

```markdown
> ✅ FRESH — verified 2026-04-25 (3 days ago)
```

```markdown
> ⚠️ STALE-SOFT — last verified 2026-04-08 (17 days ago). Verify claims before acting on them.
```

```markdown
> 🛑 STALE-HARD — last verified 2026-03-31 (25 days ago). Treat content as historical until refreshed.
```

When Homa updates a page (after a lesson log, reality-check answer, or sync), she also updates the banner timestamp.

## Auditing the Vault

Run from the Obsidian vault (`~/Documents/<vault>/`):

```python
import os, datetime, pathlib, subprocess
vault = pathlib.Path.home() / "Documents" / "<vault>"
now = datetime.datetime.now()
results = []
for f in vault.rglob("*.md"):
    if any(p in f.parts for p in (".obsidian", ".trash", "Sources", "_Archive", "_System")):
        continue
    mtime = datetime.datetime.fromtimestamp(f.stat().st_mtime)
    age_days = (now - mtime).days
    state = "fresh" if age_days < 14 else ("stale-soft" if age_days < 30 else "stale-hard")
    results.append({
        "path": str(f.relative_to(vault)),
        "age_days": age_days,
        "state": state,
        "mtime": mtime.date().isoformat(),
        "size": f.stat().st_size,
    })
results.sort(key=lambda x: -x["age_days"])
```

## Audit Digest Format

```
🔍 Vault audit — {date}

Health: {n_fresh} fresh · {n_soft} stale-soft · {n_hard} stale-hard
Empty folders: {list — these are capture loops not running}

🛑 Most stale (top 5):
• {path} — {age}d, {1-line on what claims this page makes}
• ...

⚠️ Capture gaps:
• Lessons/ has {n} files (expected ≥{X} for last 30 days)
• Daily Log/ has {n} files
• the-child.md last updated {age}d ago

🎯 #1 verification priority this week:
{single most important thing for the partner to ask the parent to verify}
```

Keep under 30 lines.

## Drift Detection (deeper signal)

Beyond mtime, also flag:

1. **"This week" sections that name a past week.** A page saying "This Week (April 6–10)" when today is April 25 is masquerading as current state. Suggest moving to a `## Progression` section dated by week.
2. **Empty capture folders** (`Lessons/`, `Daily Log/`). These mean a capture loop is dead. Highest-priority finding.
3. **Cross-link rot.** A page that mentions a curriculum/subject not linked anywhere else in the vault — orphan claim, likely abandoned.
4. **Conflicting facts.** the-child.md says "Spanish: 18 emotion words in progress"; Subjects/Spanish.md says "completed 18 emotion words." One of them is wrong.

## When Homa Acts on Vault Content

Before using a vault claim to make a decision (e.g., "the child struggles with groups of 9, so I'll suggest reinforcement activities"):

1. Check the banner. If 🛑 STALE-HARD, **don't act on it without verification**. Ask the parent first.
2. If ⚠️ STALE-SOFT, mention the staleness in the suggestion: *"Last we noted, the child was working on groups of 9 — that was 17 days ago, still where he's at?"*
3. If ✅ FRESH, act with confidence.

## Restructuring Stale "This Week" Sections

When a Subject page has a "This Week" section that's dated past:

1. Cut the section.
2. Append it under `## Progression` with a `### Week of YYYY-MM-DD` header.
3. Replace the top section with the latest known current state (not the historical week).

Don't delete content — relocate. History matters.
