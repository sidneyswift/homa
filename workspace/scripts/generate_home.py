#!/usr/bin/env python3
"""
Generate Home.md for the Homeschool Obsidian vault.

Pulls live state from:
  - ~/.openclaw/workspace/children/*.json (all child profiles)
  - Obsidian vault Research/ (latest research note)
  - Obsidian vault Weekly-Plans/ (latest weekly plan)

Writes:
  - {VAULT}/Home.md

Multi-child aware: aggregates across all children.
"""

import json
import datetime
import pathlib
import glob
from collections import Counter

VAULT = pathlib.Path.home() / "Documents" / "Homeschool"
CHILDREN_DIR = pathlib.Path.home() / ".openclaw" / "workspace" / "children"


def load_children():
    """Load all child profile JSONs, skip schema/readme."""
    children = []
    for f in sorted(CHILDREN_DIR.glob("*.json")):
        if f.name.startswith("_"):
            continue
        try:
            children.append(json.loads(f.read_text()))
        except (json.JSONDecodeError, OSError):
            continue
    return children


def latest_file(folder, pattern="*.md", exclude=None):
    exclude = exclude or {"README.md"}
    if not folder.exists():
        return None
    files = [f for f in folder.glob(pattern) if f.name not in exclude]
    return max(files, key=lambda f: f.stat().st_mtime) if files else None


def fmt_age(age):
    return f"{age['years']}y {age['months']}m {age['days']}d ({age['decimal_years']:.2f} yrs)"


def child_position_counts(profile):
    positions = []
    for dom_data in profile.get("domains", {}).values():
        for sd in dom_data.get("subdomains", {}).values():
            positions.append(sd.get("story_position", "unknown"))
    return Counter(positions)


def main():
    children = load_children()
    today = datetime.date.today()

    latest_research = latest_file(VAULT / "Research")
    latest_plan = latest_file(VAULT / "Weekly-Plans")

    # Pull TL;DR from latest research
    research_blurb = ""
    if latest_research:
        text = latest_research.read_text()
        for marker in ("## TL;DR for child", "## TL;DR"):
            if marker in text:
                section = text.split(marker, 1)[1].split("##", 1)[0].strip()
                blurb = section.split("\n")[0] if section else ""
                research_blurb = blurb[:200] + ("…" if len(blurb) > 200 else "")
                break

    lines = []
    lines.append("# 📚 Homeschool")
    lines.append("")
    lines.append(f"> 🤖 AUTO-GENERATED — last updated {today.isoformat()}. Source: `scripts/generate_home.py`. Don't hand-edit.")
    lines.append("")

    if not children:
        lines.append("_No child profiles found yet. Complete onboarding to populate this page._")
        lines.append("")
        (VAULT / "Home.md").write_text("\n".join(lines))
        print("Wrote Home.md (no children yet)")
        return

    # Per-child snapshot
    lines.append("## Children")
    lines.append("")
    for child in children:
        name = child.get("name", "Unknown")
        pronouns = child.get("pronouns", "")
        age = child.get("age", {})
        counts = child_position_counts(child)
        total = sum(counts.values())
        philosophy = child.get("philosophy", {})

        lines.append(f"### [[Children/{name}|{name}]]")
        if age.get("years") is not None:
            lines.append(f"- **Age:** {fmt_age(age)} · {pronouns}")
        ahead = counts.get("24mo_ahead", 0) + counts.get("12mo_ahead", 0)
        at = counts.get("at_age", 0)
        below = counts.get("below_age", 0)
        unk = counts.get("unknown", 0) + counts.get("unknown_pending_measurement", 0)
        lines.append(f"- **Position:** 🚀✨ {ahead} ahead · ✅ {at} at age · ⚠️ {below} below · ❓ {unk} unknown — of {total} subdomains")

        interventions = child.get("interventions_active", [])
        if interventions:
            lines.append(f"- **Active interventions:** {len(interventions)}")

        next_due = child.get("next_measurement_protocol_due")
        if next_due:
            lines.append(f"- **Next measurement:** {next_due}")
        lines.append("")

    # Dashboard link
    lines.append("## 📊 Dashboard")
    lines.append("")
    lines.append("Open [Homa Dashboard.html](Homa%20Dashboard.html) in your browser for charts, trajectory, and action items.")
    lines.append("")

    # What's freshest
    lines.append("## What's freshest")
    lines.append("")
    if latest_research:
        rel = latest_research.relative_to(VAULT).with_suffix("").as_posix()
        lines.append(f"🔬 **Latest research:** [[{rel}|{latest_research.stem}]]")
        if research_blurb:
            lines.append(f"   > {research_blurb}")
    else:
        lines.append("🔬 **Latest research:** _(none yet — first nightly run pending)_")
    lines.append("")
    if latest_plan:
        rel = latest_plan.relative_to(VAULT).with_suffix("").as_posix()
        lines.append(f"📋 **This week's plan:** [[{rel}|{latest_plan.stem}]]")
    else:
        lines.append("📋 **This week's plan:** _(no plan drafted yet)_")
    lines.append("")

    # Quick paths
    lines.append("## Quick paths")
    lines.append("")
    for child in children:
        name = child.get("name", "Unknown")
        lines.append(f"- 📖 [[Children/{name}|{name}'s profile]]")
    lines.append("- 🔬 [Research notes](Research/) — what Homa learned at night")
    lines.append("- 📅 [Weekly plans](Weekly-Plans/) — drafted plans by week")
    lines.append("- 📚 [Curriculum](Curriculum/) — what's in use")
    lines.append("- 📂 [[index]] — full vault catalog · [[log]] — what changed recently")
    lines.append("")

    lines.append("---")
    lines.append("_Rebuilt every Saturday night by the weekly scoring cron._")
    lines.append("")

    out = "\n".join(lines)
    (VAULT / "Home.md").write_text(out)
    print(f"Wrote Home.md ({len(out)} bytes)")


if __name__ == "__main__":
    main()
