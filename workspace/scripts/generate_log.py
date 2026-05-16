#!/usr/bin/env python3
"""
Maintain log.md — append today's auto-detected vault changes without
overwriting historical hand-written entries.

Strategy: log.md has two zones separated by a sentinel:

    [hand-written entries above this line — preserved verbatim]

    <!-- AUTO-LOG-START -->

    [today's auto-detected changes — rewritten on every regen]

    <!-- AUTO-LOG-END -->

The script:
  1. Reads existing log.md
  2. Strips out the AUTO-LOG zone (everything between the sentinels)
  3. Detects today's vault changes (new Research notes, profile.json mtime,
     last full rescore, last research run, freshly regenerated views)
  4. Writes a new AUTO-LOG zone for today's date
  5. Writes the file back

Hand-written content (above the sentinels) is never touched. Sidney/Less
can still add narrative entries above the sentinels and they'll be
preserved through every regen.

Output: ~/Documents/Homeschool/log.md

Idempotent. Safe to run repeatedly. Re-running the same day overwrites
only that day's auto-detected entries.
"""

import datetime
import json
import pathlib
import re

VAULT = pathlib.Path.home() / "Documents" / "Homeschool"
PROFILE = pathlib.Path.home() / ".openclaw" / "workspace" / "children/*.json"
LOG_FILE = VAULT / "log.md"

AUTO_START = "<!-- AUTO-LOG-START -->"
AUTO_END = "<!-- AUTO-LOG-END -->"

# Default header used when log.md doesn't exist yet
DEFAULT_HEADER = """# Log

> 🟡 PARTIALLY AUTO-GENERATED — Hand-written narrative entries above the AUTO-LOG sentinel are preserved verbatim. The AUTO-LOG section is rewritten on every vault regeneration.

_Chronological record of significant vault events._

"""


def read_existing():
    """Return (preserved_content, has_sentinels)."""
    if not LOG_FILE.exists():
        return DEFAULT_HEADER, False

    text = LOG_FILE.read_text()
    if AUTO_START in text and AUTO_END in text:
        # Strip the auto-zone (everything from AUTO_START through AUTO_END inclusive)
        before = text.split(AUTO_START)[0].rstrip() + "\n"
        return before, True
    elif AUTO_START in text:
        # Malformed — has start but no end. Truncate at start.
        before = text.split(AUTO_START)[0].rstrip() + "\n"
        return before, True
    else:
        # No sentinels yet — preserve all existing content, append sentinels below
        return text.rstrip() + "\n", False


def detect_today_changes():
    """Walk the vault and gather signals about what changed today."""
    today = datetime.date.today()
    today_iso = today.isoformat()
    changes = []

    # 1. children/*.json signals
    if PROFILE.exists():
        try:
            profile = json.loads(PROFILE.read_text())
            last_rescore = profile.get("last_full_rescore")
            last_research = profile.get("last_research_run")
            if last_rescore == today_iso:
                changes.append(f"**Full rescore** — `children/*.json` rescored against benchmarks. All Subjects/* and Children/{name}.md regenerated.")
            if last_research == today_iso:
                # Find which domain
                research_today = list((VAULT / "Research").glob(f"{today_iso}-*.md")) if (VAULT / "Research").exists() else []
                if research_today:
                    domains = ", ".join(f.stem.replace(today_iso + "-", "") for f in research_today)
                    changes.append(f"**Research run** — domain(s): {domains}. See [[Research/{research_today[0].stem}]].")
                else:
                    changes.append(f"**Research run** — completed today (research note pending).")

            # Active interventions count
            interventions = profile.get("interventions_active", [])
            if interventions:
                proposed_today = [i for i in interventions if i.get("proposed_at") == today_iso]
                if proposed_today:
                    for i in proposed_today:
                        dom = i.get("domain", "?")
                        sub = i.get("subdomain", "?")
                        changes.append(f"**Intervention proposed** — {dom}/{sub}: {i.get('intervention', '')[:120]}")
        except Exception as e:
            changes.append(f"_(profile.json read error: {e})_")

    # 2. Research notes created today
    research_dir = VAULT / "Research"
    if research_dir.exists():
        today_research = [f for f in research_dir.glob("*.md") if f.stem.startswith(today_iso)]
        for f in today_research:
            # Avoid duplicating if already mentioned above
            already = any(f.stem in c for c in changes)
            if not already:
                changes.append(f"**Research note saved** — [[Research/{f.stem}]]")

    # 3. Lessons logged today
    lessons_dir = VAULT / "Lessons"
    if lessons_dir.exists():
        today_lessons = [f for f in lessons_dir.rglob("*.md") if datetime.date.fromtimestamp(f.stat().st_mtime) == today]
        for f in today_lessons:
            rel = f.relative_to(VAULT).with_suffix("").as_posix()
            changes.append(f"**Lesson logged** — [[{rel}]]")

    # 4. Weekly plans created today
    plans_dir = VAULT / "Weekly-Plans"
    if plans_dir.exists():
        today_plans = [f for f in plans_dir.glob("*.md") if datetime.date.fromtimestamp(f.stat().st_mtime) == today and f.name != "README.md"]
        for f in today_plans:
            rel = f.relative_to(VAULT).with_suffix("").as_posix()
            changes.append(f"**Weekly plan drafted** — [[{rel}]]")

    return changes


def main():
    today = datetime.date.today()
    today_iso = today.isoformat()

    preserved, had_sentinels = read_existing()
    changes = detect_today_changes()

    # Build the new auto-zone
    auto_zone = []
    auto_zone.append(AUTO_START)
    auto_zone.append("")
    auto_zone.append(f"_Auto-detected vault changes — last refreshed {today_iso} via `scripts/generate_log.py`. Re-runs the same day overwrite this section only._")
    auto_zone.append("")
    auto_zone.append(f"## {today_iso} (auto-detected)")
    auto_zone.append("")
    if changes:
        for c in changes:
            auto_zone.append(f"- {c}")
    else:
        auto_zone.append("- _No significant vault changes detected today._")
    auto_zone.append("")
    auto_zone.append(AUTO_END)
    auto_zone.append("")

    # Write
    out = preserved.rstrip() + "\n\n" + "\n".join(auto_zone)
    LOG_FILE.write_text(out)
    print(f"Wrote log.md ({len(out)} bytes, {len(changes)} auto-detected changes)")
    if not had_sentinels:
        print("  ℹ️  Added AUTO-LOG sentinels for the first time. Hand-written content above them is preserved.")


if __name__ == "__main__":
    main()
