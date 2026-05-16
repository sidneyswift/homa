#!/usr/bin/env python3
"""
Generate Children/{name}.md for the Homeschool Obsidian vault.

Single source of truth: ~/.openclaw/workspace/children/*.json
Output: ~/Documents/Homeschool/Children/{name}.md

Designed to be idempotent. Safe to call after any profile.json write.
"""

import json
import datetime
import pathlib
import re

VAULT = pathlib.Path.home() / "Documents" / "Homeschool"
PROFILE = pathlib.Path.home() / ".openclaw" / "workspace" / "children/*.json"
RESEARCH_DIR = VAULT / "Research"

# Map machine domain names → human display names
DOMAIN_DISPLAY = {
    "math": "Math",
    "literacy": "Literacy",
    "phonics": "Phonics",
    "writing_fine_motor": "Writing & Fine Motor",
    "spanish": "Spanish",
    "science": "Science",
    "social_studies": "Social Studies",
    "art_creative": "Art & Creative",
    "gross_motor": "Gross Motor",
    "fine_motor_general": "Fine Motor (general)",
    "social_emotional": "Social-Emotional",
    "self_care_independence": "Self-Care & Independence",
    "executive_function": "Executive Function",
    "language_oral_english": "Language (Oral English)",
    "music": "Music",
}

POSITION_ICON = {
    "24mo_ahead": "🚀",
    "12mo_ahead": "✨",
    "at_age": "✅",
    "below_age": "⚠️",
    "unknown": "❓",
    "unknown_pending_measurement": "❓",
    "n/a": "—",
}

POSITION_LABEL = {
    "24mo_ahead": "24mo+",
    "12mo_ahead": "12mo+",
    "at_age": "at age",
    "below_age": "below",
    "unknown": "unknown",
    "unknown_pending_measurement": "unknown",
    "n/a": "n/a",
}


def fmt_age(age):
    return f"{age['years']}y {age['months']}m {age['days']}d ({age['decimal_years']:.2f} yrs)"


def main():
    profile = json.loads(PROFILE.read_text())
    today = datetime.date.today()

    age = profile["age"]
    domains = profile["domains"]
    philosophy = profile.get("philosophy", {})
    interventions = profile.get("interventions_active", [])

    # Latest research note (link)
    latest_research = None
    if RESEARCH_DIR.exists():
        files = list(RESEARCH_DIR.glob("*.md"))
        if files:
            latest_research = max(files, key=lambda f: f.stat().st_mtime)

    lines = []
    lines.append("# {Child} — Learner Profile")
    lines.append("")
    lines.append(f"> 🤖 AUTO-GENERATED — last rebuilt {today.isoformat()}. Source of truth: `~/.openclaw/workspace/children/*.json`. Don't hand-edit — changes here are overwritten on every profile update.")
    lines.append("")

    # Snapshot
    lines.append("## Snapshot")
    lines.append("")
    lines.append(f"- **Name:** Story · **Pronouns:** {profile.get('pronouns', 'he/him')}")
    lines.append(f"- **DOB:** {profile['dob']}")
    lines.append(f"- **Age today:** {fmt_age(age)}")
    target = philosophy.get("target", "unknown")
    rationale = philosophy.get("rationale", "")
    rationale_short = rationale.split(".")[0] + "." if rationale else ""
    lines.append(f"- **Philosophy:** `{target}` — {rationale_short}")
    if profile.get("last_full_rescore"):
        lines.append(f"- **Last full rescore:** {profile['last_full_rescore']}")
    if profile.get("last_research_run"):
        lines.append(f"- **Last research run:** {profile['last_research_run']}")
    if profile.get("next_measurement_protocol_due"):
        lines.append(f"- **Next measurement protocol due:** {profile['next_measurement_protocol_due']}")
    lines.append("")

    # Tier targets if present
    if "tiers" in philosophy:
        lines.append("**Tiered targets:**")
        for tier_name, tier in philosophy["tiers"].items():
            domain_list = ", ".join(DOMAIN_DISPLAY.get(d, d) for d in tier.get("domains", []))
            tgt = tier.get("target", "?")
            stretch = f" (stretch: {tier['stretch']})" if "stretch" in tier else ""
            lines.append(f"- **{tier_name.replace('_', ' ').title()}** → {tgt}{stretch}")
            lines.append(f"  - {domain_list}")
        lines.append("")

    # Position summary
    lines.append("## Current position")
    lines.append("")

    # Tally
    from collections import Counter
    all_positions = []
    for dom_data in domains.values():
        for sd in dom_data.get("subdomains", {}).values():
            all_positions.append(sd.get("story_position", "unknown"))
    counts = Counter(all_positions)
    total = sum(counts.values())

    lines.append(f"_{total} subdomains tracked_")
    lines.append("")
    lines.append(f"- 🚀 **{counts.get('24mo_ahead', 0)} at 24+ months ahead**")
    lines.append(f"- ✨ **{counts.get('12mo_ahead', 0)} at 12+ months ahead**")
    lines.append(f"- ✅ **{counts.get('at_age', 0)} at age**")
    if counts.get("below_age", 0):
        lines.append(f"- ⚠️ **{counts['below_age']} below age** (priority gaps)")
    unk = counts.get("unknown", 0) + counts.get("unknown_pending_measurement", 0)
    if unk:
        lines.append(f"- ❓ **{unk} unknown** (need measurement)")
    if counts.get("n/a", 0):
        lines.append(f"- — {counts['n/a']} n/a")
    lines.append("")

    # Per-domain table
    lines.append("## Position by domain")
    lines.append("")
    lines.append("| Domain | Subdomains | 🚀 24mo+ | ✨ 12mo+ | ✅ at age | ⚠️ below | ❓ unknown |")
    lines.append("|---|---|---|---|---|---|---|")
    for dom_key, dom_data in domains.items():
        dom_name = DOMAIN_DISPLAY.get(dom_key, dom_key)
        subs = dom_data.get("subdomains", {})
        dom_counts = Counter(sd.get("story_position", "unknown") for sd in subs.values())
        unk_dom = dom_counts.get("unknown", 0) + dom_counts.get("unknown_pending_measurement", 0)
        lines.append(
            f"| [[Subjects/{dom_name}\\|{dom_name}]] "
            f"| {len(subs)} "
            f"| {dom_counts.get('24mo_ahead', 0)} "
            f"| {dom_counts.get('12mo_ahead', 0)} "
            f"| {dom_counts.get('at_age', 0)} "
            f"| {dom_counts.get('below_age', 0)} "
            f"| {unk_dom} |"
        )
    lines.append("")
    lines.append("_Tap any domain for the full subdomain breakdown, current observations, and active interventions._")
    lines.append("")

    # Active interventions
    if interventions:
        lines.append("## Active interventions")
        lines.append("")
        for i in interventions:
            dom = DOMAIN_DISPLAY.get(i.get("domain", ""), i.get("domain", "?"))
            sub = i.get("subdomain", "?").replace("_", " ")
            text = i.get("intervention", "")
            status = i.get("status", "proposed")
            proposed = i.get("proposed_at", "")
            lines.append(f"### {dom} → {sub}")
            lines.append(f"- **Status:** {status} (proposed {proposed})")
            lines.append(f"- {text}")
            if i.get("source"):
                lines.append(f"- _Source: {i['source']}_")
            lines.append("")

    # What's freshest
    lines.append("## What's freshest")
    lines.append("")
    if latest_research:
        rel = latest_research.relative_to(VAULT).with_suffix("").as_posix()
        lines.append(f"- 🔬 Latest research: [[{rel}|{latest_research.stem}]]")
    lines.append(f"- 📅 [Latest weekly plan](Weekly-Plans/) · 📂 [[index]]")
    lines.append(f"- 📚 [Benchmarks](../../.openclaw/workspace/benchmarks/) · [Practice notes](../../.openclaw/workspace/practice/) _(in Homa's workspace)_")
    lines.append("")

    # Footer
    lines.append("---")
    lines.append(f"_Regenerated by `scripts/generate_story.py`. Profile age computed at {age['computed_at']}._")
    lines.append("")

    out = "\n".join(lines)
    (VAULT / "Children/{name}.md").write_text(out)
    print(f"Wrote Children/{name}.md ({len(out)} bytes)")


if __name__ == "__main__":
    main()
