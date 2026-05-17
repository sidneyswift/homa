#!/usr/bin/env python3
"""
Maintain log.md — append today's auto-detected vault changes without
overwriting historical hand-written entries.

Multi-child aware: reads all children/*.json profiles.

Output: {VAULT}/log.md
"""

import datetime
import json
import pathlib

VAULT = pathlib.Path.home() / "Documents" / "Homeschool"
CHILDREN_DIR = pathlib.Path.home() / ".openclaw" / "workspace" / "children"
LOG_FILE = VAULT / "log.md"

AUTO_START = "<!-- AUTO-LOG-START -->"
AUTO_END = "<!-- AUTO-LOG-END -->"

DEFAULT_HEADER = """# Log

> 🟡 PARTIALLY AUTO-GENERATED — Hand-written narrative entries above the AUTO-LOG sentinel are preserved verbatim. The AUTO-LOG section is rewritten on every vault regeneration.

_Chronological record of significant vault events._

"""


def read_existing():
    if not LOG_FILE.exists():
        return DEFAULT_HEADER, False
    text = LOG_FILE.read_text()
    if AUTO_START in text and AUTO_END in text:
        before = text.split(AUTO_START)[0].rstrip() + "\n"
        return before, True
    elif AUTO_START in text:
        before = text.split(AUTO_START)[0].rstrip() + "\n"
        return before, True
    return text.rstrip() + "\n", False


def load_children():
    children = []
    for f in sorted(CHILDREN_DIR.glob("*.json")):
        if f.name.startswith("_"):
            continue
        try:
            children.append(json.loads(f.read_text()))
        except (json.JSONDecodeError, OSError):
            continue
    return children


def detect_today_changes():
    today = datetime.date.today()
    today_iso = today.isoformat()
    changes = []

    # 1. Child profile signals
    for profile in load_children():
        name = profile.get("name", "Unknown")
        last_rescore = profile.get("last_full_rescore")
        last_research = profile.get("last_research_run")

        if last_rescore == today_iso:
            changes.append(f"**Full rescore** — {name}'s profile rescored against benchmarks.")

        if last_research == today_iso:
            research_today = list((VAULT / "Research").glob(f"{today_iso}-*.md")) if (VAULT / "Research").exists() else []
            if research_today:
                domains = ", ".join(f.stem.replace(today_iso + "-", "") for f in research_today)
                changes.append(f"**Research run** — domain(s): {domains}. See [[Research/{research_today[0].stem}]].")
            else:
                changes.append(f"**Research run** — completed today (research note pending).")

        interventions = profile.get("interventions_active", [])
        proposed_today = [i for i in interventions if i.get("proposed_at") == today_iso]
        for i in proposed_today:
            dom = i.get("domain", "?")
            sub = i.get("subdomain", "?")
            changes.append(f"**Intervention proposed** ({name}) — {dom}/{sub}: {i.get('intervention', '')[:120]}")

    # 2. Research notes created today
    research_dir = VAULT / "Research"
    if research_dir.exists():
        for f in research_dir.glob("*.md"):
            if f.stem.startswith(today_iso):
                already = any(f.stem in c for c in changes)
                if not already:
                    changes.append(f"**Research note saved** — [[Research/{f.stem}]]")

    # 3. Lessons logged today
    lessons_dir = VAULT / "Lessons"
    if lessons_dir.exists():
        for f in lessons_dir.rglob("*.md"):
            if datetime.date.fromtimestamp(f.stat().st_mtime) == today:
                rel = f.relative_to(VAULT).with_suffix("").as_posix()
                changes.append(f"**Lesson logged** — [[{rel}]]")

    # 4. Weekly plans created today
    plans_dir = VAULT / "Weekly-Plans"
    if plans_dir.exists():
        for f in plans_dir.glob("*.md"):
            if f.name != "README.md" and datetime.date.fromtimestamp(f.stat().st_mtime) == today:
                rel = f.relative_to(VAULT).with_suffix("").as_posix()
                changes.append(f"**Weekly plan drafted** — [[{rel}]]")

    return changes


def main():
    today_iso = datetime.date.today().isoformat()
    preserved, had_sentinels = read_existing()
    changes = detect_today_changes()

    auto_zone = [
        AUTO_START, "",
        f"_Auto-detected vault changes — last refreshed {today_iso} via `scripts/generate_log.py`._", "",
        f"## {today_iso} (auto-detected)", "",
    ]
    if changes:
        for c in changes:
            auto_zone.append(f"- {c}")
    else:
        auto_zone.append("- _No significant vault changes detected today._")
    auto_zone.extend(["", AUTO_END, ""])

    out = preserved.rstrip() + "\n\n" + "\n".join(auto_zone)
    LOG_FILE.write_text(out)
    print(f"Wrote log.md ({len(out)} bytes, {len(changes)} auto-detected changes)")


if __name__ == "__main__":
    main()
