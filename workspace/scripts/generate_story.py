#!/usr/bin/env python3
"""
Generate Children/{name}.md for each child in the Homeschool Obsidian vault.

Source of truth: ~/.openclaw/workspace/children/{name}.json
Output: {VAULT}/Children/{name}.md (one per child)

Multi-child aware: iterates over all profiles in children/.
"""

import json
import datetime
import pathlib
from collections import Counter

VAULT = pathlib.Path.home() / "Documents" / "Homeschool"
CHILDREN_DIR = pathlib.Path.home() / ".openclaw" / "workspace" / "children"
RESEARCH_DIR = VAULT / "Research"

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
    "24mo_ahead": "🚀", "12mo_ahead": "✨", "at_age": "✅",
    "below_age": "⚠️", "unknown": "❓", "unknown_pending_measurement": "❓", "n/a": "—",
}

POSITION_LABEL = {
    "24mo_ahead": "24mo+ ahead", "12mo_ahead": "12mo+ ahead", "at_age": "at age",
    "below_age": "below age", "unknown": "unknown", "unknown_pending_measurement": "unknown", "n/a": "n/a",
}

CONFIDENCE_LABEL = {
    "high": "high (recently verified)", "medium": "medium",
    "stale": "stale (>30d old)", "expired": "expired (>60d old)", "unknown": "no observation yet",
}


def fmt_age(age):
    return f"{age['years']}y {age['months']}m {age['days']}d ({age['decimal_years']:.2f} yrs)"


def latest_research_for(domain_key):
    if not RESEARCH_DIR.exists():
        return None
    best = None
    for f in RESEARCH_DIR.glob("*.md"):
        if domain_key.replace("_", "-") in f.stem.lower() or domain_key in f.stem.lower():
            if not best or f.stat().st_mtime > best.stat().st_mtime:
                best = f
    return best


def generate_child_page(profile):
    name = profile.get("name", "Unknown")
    today = datetime.date.today()
    age = profile.get("age", {})
    domains = profile.get("domains", {})
    philosophy = profile.get("philosophy", {})
    interventions = profile.get("interventions_active", [])
    pronouns = profile.get("pronouns", "")

    lines = []
    lines.append(f"# {name} — Learner Profile")
    lines.append("")
    lines.append(f"> 🤖 AUTO-GENERATED — last rebuilt {today.isoformat()}. Source: `~/.openclaw/workspace/children/{name.lower()}.json`. Don't hand-edit.")
    lines.append("")

    # Snapshot
    lines.append("## Snapshot")
    lines.append("")
    lines.append(f"- **Name:** {name} · **Pronouns:** {pronouns}")
    lines.append(f"- **DOB:** {profile.get('dob', 'unknown')}")
    if age.get("years") is not None:
        lines.append(f"- **Age today:** {fmt_age(age)}")
    rationale = philosophy.get("rationale", "").split(".")[0] + "." if philosophy.get("rationale") else ""
    lines.append(f"- **Philosophy:** {philosophy.get('cognitive_academic_target', '?')} academic / {philosophy.get('motor_selfcare_social_target', '?')} motor-social — {rationale}")
    if profile.get("last_full_rescore"):
        lines.append(f"- **Last rescore:** {profile['last_full_rescore']}")
    if profile.get("last_research_run"):
        lines.append(f"- **Last research:** {profile['last_research_run']}")
    if profile.get("next_measurement_protocol_due"):
        lines.append(f"- **Next measurement:** {profile['next_measurement_protocol_due']}")
    lines.append("")

    # Interests
    interests = profile.get("interests", [])
    if interests:
        lines.append(f"**Interests:** {', '.join(interests)}")
        lines.append("")

    # Position summary
    all_positions = []
    for dom_data in domains.values():
        for sd in dom_data.get("subdomains", {}).values():
            all_positions.append(sd.get("story_position", "unknown"))
    counts = Counter(all_positions)
    total = sum(counts.values())

    lines.append("## Current position")
    lines.append("")
    lines.append(f"_{total} subdomains tracked_")
    lines.append("")
    lines.append(f"- 🚀 **{counts.get('24mo_ahead', 0)} at 24+ months ahead**")
    lines.append(f"- ✨ **{counts.get('12mo_ahead', 0)} at 12+ months ahead**")
    lines.append(f"- ✅ **{counts.get('at_age', 0)} at age**")
    if counts.get("below_age", 0):
        lines.append(f"- ⚠️ **{counts['below_age']} below age** (priority)")
    unk = counts.get("unknown", 0) + counts.get("unknown_pending_measurement", 0)
    if unk:
        lines.append(f"- ❓ **{unk} unknown** (need measurement)")
    lines.append("")

    # Per-domain table
    lines.append("## Position by domain")
    lines.append("")
    lines.append("| Domain | Subs | 🚀 24+ | ✨ 12+ | ✅ age | ⚠️ below | ❓ ? |")
    lines.append("|---|---|---|---|---|---|---|")
    for dom_key, dom_data in domains.items():
        dom_name = DOMAIN_DISPLAY.get(dom_key, dom_key)
        subs = dom_data.get("subdomains", {})
        dc = Counter(sd.get("story_position", "unknown") for sd in subs.values())
        unk_d = dc.get("unknown", 0) + dc.get("unknown_pending_measurement", 0)
        lines.append(
            f"| [[Subjects/{dom_name}\\|{dom_name}]] "
            f"| {len(subs)} | {dc.get('24mo_ahead', 0)} | {dc.get('12mo_ahead', 0)} "
            f"| {dc.get('at_age', 0)} | {dc.get('below_age', 0)} | {unk_d} |"
        )
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
            lines.append(f"- **{dom} → {sub}** ({status}): {text}")
        lines.append("")

    # Footer
    lines.append("---")
    lines.append(f"_Generated by `scripts/generate_story.py`. Age computed at {age.get('computed_at', 'unknown')}._")
    lines.append("")

    return "\n".join(lines)


def main():
    out_dir = VAULT / "Children"
    out_dir.mkdir(exist_ok=True)

    written = 0
    for f in sorted(CHILDREN_DIR.glob("*.json")):
        if f.name.startswith("_"):
            continue
        try:
            profile = json.loads(f.read_text())
        except (json.JSONDecodeError, OSError) as e:
            print(f"  ⚠️ Skipping {f.name}: {e}")
            continue

        name = profile.get("name", f.stem)
        content = generate_child_page(profile)
        out_path = out_dir / f"{name}.md"
        out_path.write_text(content)
        written += 1
        print(f"  Wrote Children/{name}.md ({len(content)} bytes)")

    print(f"Wrote {written} child profile page(s)")


if __name__ == "__main__":
    main()
