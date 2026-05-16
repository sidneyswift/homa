#!/usr/bin/env python3
"""
Generate Home.md for the Homeschool Obsidian vault.

Pulls live state from:
  - ~/.openclaw/workspace/children/*.json (the child's age, positions, interventions)
  - ~/Documents/Homeschool/Research/ (latest research note)
  - ~/Documents/Homeschool/Weekly-Plans/ (latest weekly plan)

Writes:
  - ~/Documents/Homeschool/Home.md

Designed to be idempotent and called by:
  - Weekly Scoring cron (every Saturday)
  - Manual invocation when needed
"""

import json
import datetime
import pathlib
from collections import Counter

VAULT = pathlib.Path.home() / "Documents" / "Homeschool"
PROFILE = pathlib.Path.home() / ".openclaw" / "workspace" / "children/*.json"


def latest_file(folder: pathlib.Path, pattern: str = "*.md", exclude: set = None):
    exclude = exclude or {"README.md"}
    if not folder.exists():
        return None
    files = [f for f in folder.glob(pattern) if f.name not in exclude]
    if not files:
        return None
    return max(files, key=lambda f: f.stat().st_mtime)


def fmt_age(age):
    return f"{age['years']} years, {age['months']} months, {age['days']} days ({age['decimal_years']:.2f} years)"


def main():
    profile = json.loads(PROFILE.read_text())
    today = datetime.date.today()

    # Tally story positions
    positions = []
    by_pos = {"24mo_ahead": [], "12mo_ahead": [], "at_age": [], "below_age": [], "unknown": []}
    for dom, dd in profile["domains"].items():
        for sub, sd in dd.get("subdomains", {}).items():
            pos = sd.get("story_position", "unknown")
            positions.append(pos)
            label = f"{dom.replace('_', ' ')} — {sub.replace('_', ' ')}"
            if pos in by_pos:
                by_pos[pos].append(label)
            elif pos.startswith("unknown"):
                by_pos["unknown"].append(label)

    counts = Counter(positions)

    # Latest artifacts
    latest_research = latest_file(VAULT / "Research")
    latest_plan = latest_file(VAULT / "Weekly-Plans")

    # Pull TL;DR from latest research if present
    research_blurb = ""
    if latest_research:
        text = latest_research.read_text()
        for marker in ("## TL;DR for child", "## TL;DR"):
            if marker in text:
                section = text.split(marker, 1)[1].split("##", 1)[0].strip()
                # First sentence or up to ~140 chars
                blurb = section.split("\n")[0] if section else ""
                research_blurb = blurb[:200] + ("…" if len(blurb) > 200 else "")
                break

    # Active interventions
    interventions = profile.get("interventions_active", [])

    # Philosophy
    philosophy = profile.get("philosophy", {})

    # Build the page
    lines = []
    lines.append("# 📚 Homeschool")
    lines.append("")
    lines.append(f"> 🤖 AUTO-GENERATED — last updated {today.isoformat()}. Source: weekly scoring cron + `~/.openclaw/workspace/scripts/generate_home.py`. Don't hand-edit; updates here will be overwritten.")
    lines.append("")
    lines.append(f"## Today")
    lines.append(f"- **Date:** {today.strftime('%A, %B %-d, %Y')}")
    lines.append(f"- **Child is:** {fmt_age(profile['age'])}")
    rationale = philosophy.get("rationale", "").split(".")[0] + "."
    lines.append(f"- **Target:** {philosophy.get('target', 'unknown')} — {rationale}")
    lines.append("")

    lines.append("## 📊 Dashboard")
    lines.append("")
    lines.append("Open [Homa Dashboard.html](Story%20Dashboard.html) in your browser for charts of position by domain, trajectory over time, active interventions, and this week's action items. (On phone: tap the link, choose \"Open in Safari\" if Obsidian asks.)")
    lines.append("")

    lines.append("## What's freshest")
    lines.append("")
    if latest_research:
        rel = latest_research.relative_to(VAULT)
        link_label = latest_research.stem
        lines.append(f"🔬 **Latest research:** [[{rel.with_suffix('').as_posix()}|{link_label}]]")
        if research_blurb:
            lines.append(f"   > {research_blurb}")
    else:
        lines.append("🔬 **Latest research:** _(none yet — first run pending)_")
    lines.append("")
    if latest_plan:
        rel = latest_plan.relative_to(VAULT)
        lines.append(f"📋 **This week's plan:** [[{rel.with_suffix('').as_posix()}|{latest_plan.stem}]]")
    else:
        lines.append("📋 **This week's plan:** _(no plan drafted yet)_")
    lines.append("")
    next_due = profile.get("next_measurement_protocol_due")
    if next_due:
        lines.append(f"🎯 **Next measurement protocol due:** {next_due}")
    else:
        lines.append(f"🎯 **Next measurement protocol:** Homa drafts on the next weekly scoring run (Saturday).")
    lines.append("")

    lines.append("## Right now")
    lines.append("")
    lines.append(f"**Snapshot of {sum(counts.values())} subdomains tracked:**")
    lines.append(f"- 🚀 **{counts.get('24mo_ahead', 0)} at 24+ months ahead**")
    lines.append(f"- ✨ **{counts.get('12mo_ahead', 0)} at 12+ months ahead**")
    lines.append(f"- ✅ **{counts.get('at_age', 0)} at age**")
    if counts.get("below_age", 0):
        lines.append(f"- ⚠️ **{counts['below_age']} below age** (priority)")
    if counts.get("unknown", 0) or counts.get("unknown_pending_measurement", 0):
        unk = counts.get("unknown", 0) + counts.get("unknown_pending_measurement", 0)
        lines.append(f"- ❓ **{unk} unknown** (need measurement)")
    lines.append("")

    if by_pos["24mo_ahead"]:
        lines.append(f"**24+ months ahead** (lean in):")
        for s in by_pos["24mo_ahead"][:5]:
            lines.append(f"- {s}")
        if len(by_pos["24mo_ahead"]) > 5:
            lines.append(f"- _…and {len(by_pos['24mo_ahead']) - 5} more_")
        lines.append("")

    if by_pos["at_age"]:
        lines.append(f"**At age** (push gently):")
        for s in by_pos["at_age"][:5]:
            lines.append(f"- {s}")
        if len(by_pos["at_age"]) > 5:
            lines.append(f"- _…and {len(by_pos['at_age']) - 5} more_")
        lines.append("")

    if interventions:
        lines.append(f"**Active interventions** ({len(interventions)}):")
        for i in interventions:
            dom = i.get("domain", "?").replace("_", " ")
            sub = i.get("subdomain", "?").replace("_", " ")
            text = i.get("intervention", "")
            short = text[:120] + ("…" if len(text) > 120 else "")
            lines.append(f"- **{dom} / {sub}:** {short}")
        lines.append("")

    lines.append(f"**Full profile:** [[Story]]")
    lines.append("")

    lines.append("## Quick paths")
    lines.append("")
    lines.append("- 📖 [[Story]] — full learner profile")
    lines.append("- 🔬 [Research notes](Research/) — what Homa learned at night")
    lines.append("- 📅 [Weekly plans](Weekly-Plans/) — drafted plans by week")
    lines.append("- 📚 [Curriculum](Curriculum/) — what's in use")
    lines.append("- 📂 [[index]] — full vault catalog · [[log]] — what changed recently")
    lines.append("")

    lines.append("---")
    lines.append("_Homa rewrites this every Saturday night. Reply in the research channel or @-mention Homa in the main channel to update the child's profile in real time._")
    lines.append("")

    out = "\n".join(lines)
    (VAULT / "Home.md").write_text(out)
    print(f"Wrote Home.md ({len(out)} bytes) at {VAULT / 'Home.md'}")


if __name__ == "__main__":
    main()
