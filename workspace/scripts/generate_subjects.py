#!/usr/bin/env python3
"""
Generate one Subjects/{Domain}.md file per domain.

Multi-child aware: shows each child's position side-by-side.

Source: ~/.openclaw/workspace/children/*.json + benchmarks/
Output: {VAULT}/Subjects/{DisplayName}.md (one per domain)
"""

import json
import datetime
import pathlib
import re
from collections import Counter

VAULT = pathlib.Path.home() / "Documents" / "Homeschool"
SUBJECTS_DIR = VAULT / "Subjects"
RESEARCH_DIR = VAULT / "Research"
CHILDREN_DIR = pathlib.Path.home() / ".openclaw" / "workspace" / "children"
BENCHMARKS_DIR = pathlib.Path.home() / ".openclaw" / "workspace" / "benchmarks"

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

DOMAIN_TO_BENCHMARK_FILE = {
    "math": "math.md", "literacy": "literacy.md", "phonics": "phonics.md",
    "writing_fine_motor": "writing-fine-motor.md", "spanish": "spanish.md",
    "science": "science.md", "social_studies": "social-studies.md",
    "art_creative": "art-creative.md", "gross_motor": "gross-motor.md",
    "fine_motor_general": "fine-motor-general.md", "social_emotional": "social-emotional.md",
    "self_care_independence": "self-care-independence.md", "executive_function": "executive-function.md",
    "language_oral_english": "language-oral-english.md", "music": "music.md",
}

POSITION_ICON = {
    "24mo_ahead": "🚀", "12mo_ahead": "✨", "at_age": "✅",
    "below_age": "⚠️", "unknown": "❓", "unknown_pending_measurement": "❓", "n/a": "—",
}

POSITION_LABEL = {
    "24mo_ahead": "24mo+", "12mo_ahead": "12mo+", "at_age": "at age",
    "below_age": "below", "unknown": "unknown", "unknown_pending_measurement": "unknown", "n/a": "n/a",
}

CONFIDENCE_LABEL = {
    "high": "recently verified", "medium": "medium",
    "stale": ">30d old", "expired": ">60d old", "unknown": "no observation",
}


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


def staleness_state(verified_str):
    if not verified_str:
        return "unknown"
    try:
        v = datetime.date.fromisoformat(verified_str)
        days = (datetime.date.today() - v).days
        if days < 14:
            return "fresh"
        elif days < 30:
            return "stale-soft"
        return "stale-hard"
    except Exception:
        return "unknown"


def freshness_banner(verified_str):
    s = staleness_state(verified_str)
    if s == "fresh":
        return f"> ✅ FRESH — last verified {verified_str}"
    elif s == "stale-soft":
        return f"> ⚠️ STALE-SOFT — last verified {verified_str}. Verify before acting."
    elif s == "stale-hard":
        return f"> 🛑 STALE-HARD — last verified {verified_str}. Treat as historical."
    return "> ❓ UNVERIFIED — no observation date on record."


def latest_research_for(domain_key):
    if not RESEARCH_DIR.exists():
        return None
    best = None
    for f in RESEARCH_DIR.glob("*.md"):
        if domain_key.replace("_", "-") in f.stem.lower():
            if not best or f.stat().st_mtime > best.stat().st_mtime:
                best = f
    return best


def domain_freshness_overall(children, dom_key):
    """Most recent verified date across all children for this domain."""
    dates = []
    for child in children:
        subs = child.get("domains", {}).get(dom_key, {}).get("subdomains", {})
        for sd in subs.values():
            v = sd.get("verified")
            if v:
                try:
                    dates.append(datetime.date.fromisoformat(v))
                except Exception:
                    pass
    return max(dates).isoformat() if dates else None


def main():
    children = load_children()
    today = datetime.date.today()
    SUBJECTS_DIR.mkdir(exist_ok=True)
    multi = len(children) > 1

    if not children:
        print("No child profiles found. Skipping subject generation.")
        return

    # Use first child's domain structure as the template (all children share the same 15 domains)
    domain_keys = list(children[0].get("domains", {}).keys())

    written = 0
    for dom_key in domain_keys:
        dom_name = DOMAIN_DISPLAY.get(dom_key, dom_key)
        bench_file = DOMAIN_TO_BENCHMARK_FILE.get(dom_key, dom_key + ".md")

        overall_verified = domain_freshness_overall(children, dom_key)
        latest_research = latest_research_for(dom_key)

        lines = []
        lines.append(f"# {dom_name}")
        lines.append("")
        lines.append(freshness_banner(overall_verified))
        lines.append("")
        lines.append(f"> 🤖 AUTO-GENERATED — last rebuilt {today.isoformat()}. Source: child profiles + `benchmarks/{bench_file}`. Don't hand-edit.")
        lines.append("")

        # Per-child subdomain breakdown
        for child in children:
            name = child.get("name", "Unknown")
            dom_data = child.get("domains", {}).get(dom_key, {})
            subdomains = dom_data.get("subdomains", {})
            interventions = [i for i in child.get("interventions_active", []) if i.get("domain") == dom_key]

            if multi:
                lines.append(f"## {name}")
                lines.append("")

            # Summary counts
            pos_counts = Counter(sd.get("story_position", "unknown") for sd in subdomains.values())
            unk = pos_counts.get("unknown", 0) + pos_counts.get("unknown_pending_measurement", 0)

            lines.append(f"**Subdomains:** {len(subdomains)} · "
                        f"🚀 {pos_counts.get('24mo_ahead', 0)} · ✨ {pos_counts.get('12mo_ahead', 0)} · "
                        f"✅ {pos_counts.get('at_age', 0)} · ⚠️ {pos_counts.get('below_age', 0)} · ❓ {unk}")
            lines.append("")

            # Interventions
            if interventions:
                lines.append("**Active interventions:**")
                for i in interventions:
                    sub = i.get("subdomain", "?").replace("_", " ")
                    text = i.get("intervention", "")
                    lines.append(f"- **{sub}:** {text}")
                lines.append("")

            # Subdomain details
            if not multi:
                lines.append("## Subdomains")
                lines.append("")

            for sub_key, sub_data in subdomains.items():
                sub_name = sub_key.replace("_", " ").title()
                pos = sub_data.get("story_position", "unknown")
                conf = sub_data.get("confidence", "unknown")
                verified = sub_data.get("verified")
                current = sub_data.get("current") or "_no observation yet_"

                icon = POSITION_ICON.get(pos, "❓")
                pos_label = POSITION_LABEL.get(pos, pos)
                conf_label = CONFIDENCE_LABEL.get(conf, conf)

                lines.append(f"### {icon} {sub_name} — *{pos_label}*")
                lines.append("")
                lines.append(f"- **Current:** {current}")
                lines.append(f"- **Confidence:** {conf_label}")
                if verified:
                    lines.append(f"- **Last verified:** {verified}")
                notes = sub_data.get("notes", [])
                if notes:
                    notes_str = notes if isinstance(notes, str) else "; ".join(notes)
                    lines.append(f"- **Notes:** {notes_str}")
                lines.append("")

        # Research link
        if latest_research:
            rel = latest_research.relative_to(VAULT).with_suffix("").as_posix()
            lines.append("## Latest research")
            lines.append("")
            lines.append(f"- [[{rel}|{latest_research.stem}]]")
            lines.append("")

        # Footer
        lines.append("## See also")
        lines.append("")
        for child in children:
            lines.append(f"- [[Children/{child.get('name', 'Unknown')}|{child.get('name', 'Unknown')}'s profile]]")
        lines.append(f"- [[Home]] — vault landing page")
        lines.append(f"- Benchmarks: `~/.openclaw/workspace/benchmarks/{bench_file}`")
        lines.append("")
        lines.append("---")
        lines.append("_Generated by `scripts/generate_subjects.py`._")
        lines.append("")

        out_path = SUBJECTS_DIR / f"{dom_name}.md"
        out_path.write_text("\n".join(lines))
        written += 1

    print(f"Wrote {written} Subjects/*.md files")


if __name__ == "__main__":
    main()
