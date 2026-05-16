#!/usr/bin/env python3
"""
Generate one Subjects/{Domain}.md file per domain in children/*.json.

Each subject page surfaces:
- the child's current state per subdomain (with verified date + confidence)
- the child's position vs target band
- Active interventions touching this domain
- Frameworks the benchmarks anchor to
- Link to the benchmarks file (in Homa's workspace) and recent research

Single source of truth: ~/.openclaw/workspace/children/*.json + ~/.openclaw/workspace/benchmarks/
Output: ~/Documents/Homeschool/Subjects/{DisplayName}.md (one per domain)

Idempotent. Safe to call after any profile.json or benchmarks/ write.
"""

import json
import datetime
import pathlib
import re

VAULT = pathlib.Path.home() / "Documents" / "Homeschool"
SUBJECTS_DIR = VAULT / "Subjects"
RESEARCH_DIR = VAULT / "Research"
PROFILE = pathlib.Path.home() / ".openclaw" / "workspace" / "children/*.json"
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

# benchmarks/ file naming differs from JSON keys
DOMAIN_TO_BENCHMARK_FILE = {
    "math": "math.md",
    "literacy": "literacy.md",
    "phonics": "phonics.md",
    "writing_fine_motor": "writing-fine-motor.md",
    "spanish": "spanish.md",
    "science": "science.md",
    "social_studies": "social-studies.md",
    "art_creative": "art-creative.md",
    "gross_motor": "gross-motor.md",
    "fine_motor_general": "fine-motor-general.md",
    "social_emotional": "social-emotional.md",
    "self_care_independence": "self-care-independence.md",
    "executive_function": "executive-function.md",
    "language_oral_english": "language-oral-english.md",
    "music": "music.md",
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
    "24mo_ahead": "24mo+ ahead",
    "12mo_ahead": "12mo+ ahead",
    "at_age": "at age",
    "below_age": "below age",
    "unknown": "unknown — needs measurement",
    "unknown_pending_measurement": "unknown — needs measurement",
    "n/a": "n/a",
}

CONFIDENCE_LABEL = {
    "high": "high (recently verified)",
    "medium": "medium",
    "stale": "stale (>30d old)",
    "expired": "expired (>60d old)",
    "unknown": "no observation yet",
}


def staleness_state(verified_str):
    """Return 'fresh' / 'stale-soft' / 'stale-hard' / 'unknown' based on age."""
    if not verified_str:
        return "unknown"
    try:
        v = datetime.date.fromisoformat(verified_str)
        days = (datetime.date.today() - v).days
        if days < 14:
            return "fresh"
        elif days < 30:
            return "stale-soft"
        else:
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
    else:
        return "> ❓ UNVERIFIED — no observation date on record."


def latest_research_for(domain_key):
    """Find the most recent research note in Research/ that mentions this domain."""
    if not RESEARCH_DIR.exists():
        return None
    pat = re.compile(rf"\b{re.escape(domain_key.replace('_', '[-_ ]'))}\b", re.IGNORECASE)
    best = None
    for f in RESEARCH_DIR.glob("*.md"):
        # Match domain name in filename or headers
        if domain_key.replace("_", "-") in f.stem.lower() or domain_key in f.stem.lower():
            if not best or f.stat().st_mtime > best.stat().st_mtime:
                best = f
    return best


def benchmarks_excerpt(domain_key):
    """Pull a short excerpt from the benchmarks file (frameworks + age band table if present)."""
    fname = DOMAIN_TO_BENCHMARK_FILE.get(domain_key)
    if not fname:
        return None, None
    fpath = BENCHMARKS_DIR / fname
    if not fpath.exists():
        return None, None
    text = fpath.read_text()
    last_researched = None
    m = re.search(r"## Last researched\s*\n\s*\*?(\S+)\*?", text)
    if m:
        last_researched = m.group(1).strip("*").strip()
    return text, last_researched


def render_subdomain(sub_key, sub_data):
    """Render one subdomain block."""
    sub_name = sub_key.replace("_", " ").title()
    pos = sub_data.get("story_position", "unknown")
    conf = sub_data.get("confidence", "unknown")
    verified = sub_data.get("verified")
    current = sub_data.get("current") or "_no observation yet_"
    target = sub_data.get("target_band", "?")
    notes = sub_data.get("notes", "")

    icon = POSITION_ICON.get(pos, "❓")
    pos_label = POSITION_LABEL.get(pos, pos)
    conf_label = CONFIDENCE_LABEL.get(conf, conf)

    out = []
    out.append(f"### {icon} {sub_name} — *{pos_label}*")
    out.append(f"")
    out.append(f"- **Current:** {current}")
    out.append(f"- **Target band:** {target}")
    out.append(f"- **Confidence:** {conf_label}")
    if verified:
        out.append(f"- **Last verified:** {verified}")
    if notes:
        out.append(f"- **Notes:** {notes}")
    out.append(f"")
    return "\n".join(out)


def domain_freshness_overall(subdomains):
    """Pick the most-recent verified date across subdomains."""
    dates = []
    for sd in subdomains.values():
        v = sd.get("verified")
        if v:
            try:
                dates.append(datetime.date.fromisoformat(v))
            except Exception:
                pass
    if not dates:
        return None
    return max(dates).isoformat()


def main():
    profile = json.loads(PROFILE.read_text())
    today = datetime.date.today()
    interventions = profile.get("interventions_active", [])
    SUBJECTS_DIR.mkdir(exist_ok=True)

    written = 0
    for dom_key, dom_data in profile["domains"].items():
        dom_name = DOMAIN_DISPLAY.get(dom_key, dom_key)
        subdomains = dom_data.get("subdomains", {})
        frameworks = dom_data.get("frameworks", [])

        # Compute most-recent verified date across this domain's subdomains
        overall_verified = domain_freshness_overall(subdomains)

        # Pull benchmarks excerpt
        bench_text, bench_last_researched = benchmarks_excerpt(dom_key)

        # Find domain interventions
        dom_interventions = [i for i in interventions if i.get("domain") == dom_key]

        # Find latest research note
        latest_research = latest_research_for(dom_key)

        # Build the page
        lines = []
        lines.append(f"# {dom_name}")
        lines.append("")
        lines.append(freshness_banner(overall_verified))
        lines.append("")
        lines.append(f"> 🤖 AUTO-GENERATED — last rebuilt {today.isoformat()}. Source: `~/.openclaw/workspace/children/*.json` + `benchmarks/{DOMAIN_TO_BENCHMARK_FILE.get(dom_key, dom_key + '.md')}`. Don't hand-edit.")
        lines.append("")

        # Snapshot
        from collections import Counter
        pos_counts = Counter(sd.get("story_position", "unknown") for sd in subdomains.values())
        unk = pos_counts.get("unknown", 0) + pos_counts.get("unknown_pending_measurement", 0)

        lines.append("## Snapshot")
        lines.append("")
        lines.append(f"- **Subdomains tracked:** {len(subdomains)}")
        lines.append(f"- **Strengths:** 🚀 {pos_counts.get('24mo_ahead', 0)} at 24mo+ · ✨ {pos_counts.get('12mo_ahead', 0)} at 12mo+")
        lines.append(f"- **At age:** ✅ {pos_counts.get('at_age', 0)}")
        if pos_counts.get("below_age", 0):
            lines.append(f"- **Below age:** ⚠️ {pos_counts['below_age']}")
        if unk:
            lines.append(f"- **Unknown / unmeasured:** ❓ {unk}")
        if frameworks:
            lines.append(f"- **Frameworks:** {', '.join(frameworks)}")
        if bench_last_researched and bench_last_researched != "never":
            lines.append(f"- **Benchmarks last researched:** {bench_last_researched}")
        else:
            lines.append(f"- **Benchmarks:** stub — not yet researched by the nightly cron")
        lines.append("")

        # Active interventions for this domain
        if dom_interventions:
            lines.append("## Active interventions")
            lines.append("")
            for i in dom_interventions:
                sub = i.get("subdomain", "?").replace("_", " ")
                text = i.get("intervention", "")
                status = i.get("status", "proposed")
                lines.append(f"- **{sub}** ({status}): {text}")
            lines.append("")

        # Subdomains
        lines.append("## Subdomains")
        lines.append("")
        for sub_key, sub_data in subdomains.items():
            lines.append(render_subdomain(sub_key, sub_data))

        # Latest research link
        if latest_research:
            rel = latest_research.relative_to(VAULT).with_suffix("").as_posix()
            lines.append("## Latest research")
            lines.append("")
            lines.append(f"- [[{rel}|{latest_research.stem}]]")
            lines.append("")

        # Footer / pointers
        lines.append("## See also")
        lines.append("")
        lines.append(f"- [[Story]] — full profile across all domains")
        lines.append(f"- [[Home]] — vault landing page")
        lines.append(f"- Benchmarks file (Homa's workspace): `~/.openclaw/workspace/benchmarks/{DOMAIN_TO_BENCHMARK_FILE.get(dom_key, dom_key + '.md')}`")
        lines.append("")
        lines.append("---")
        lines.append(f"_Regenerated by `scripts/generate_subjects.py`._")
        lines.append("")

        out_path = SUBJECTS_DIR / f"{dom_name}.md"
        out_path.write_text("\n".join(lines))
        written += 1

    # Clean up old subject files that don't match current domain set
    expected_names = {f"{DOMAIN_DISPLAY[k]}.md" for k in profile["domains"].keys()}
    for old in SUBJECTS_DIR.glob("*.md"):
        if old.name not in expected_names:
            print(f"  ⚠️  Found orphan subject file: {old.name} (not in current domain set; leaving in place — delete manually if obsolete)")

    print(f"Wrote {written} Subjects/*.md files")


if __name__ == "__main__":
    main()
