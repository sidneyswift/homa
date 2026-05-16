#!/usr/bin/env python3
"""
Generate Homa Dashboard.html — a self-contained, mobile-friendly HTML
dashboard showing where Story is vs benchmarks, trajectory over time,
active interventions, and this week's suggested action items.

Reads:
  - ~/.openclaw/workspace/children/*.json (current state)
  - ~/.openclaw/workspace/profile-history/*.json (trajectory)
  - ~/Documents/Homeschool/Research/* (latest research links)
  - ~/Documents/Homeschool/Weekly-Plans/* (latest plan)

Writes:
  - ~/Documents/Homeschool/Homa Dashboard.html

The output is a single self-contained HTML file with Chart.js loaded from
CDN. Open in any browser. the parent can double-click from Obsidian (it'll open
in Safari) or Sidney can bookmark the file:// URL.

Idempotent. Safe to run repeatedly. Called by regenerate_vault.py.
"""

import json
import datetime
import pathlib
import re
from collections import Counter

VAULT = pathlib.Path.home() / "Documents" / "Homeschool"
PROFILE = pathlib.Path.home() / ".openclaw" / "workspace" / "children/*.json"
HISTORY_DIR = pathlib.Path.home() / ".openclaw" / "workspace" / "profile-history"
RESEARCH_DIR = VAULT / "Research"
PLANS_DIR = VAULT / "Weekly-Plans"

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
    "self_care_independence": "Self-Care",
    "executive_function": "Executive Function",
    "language_oral_english": "Language",
    "music": "Music",
}

# Distinct colors per domain (Tailwind 500 family, picked for max visual separation)
DOMAIN_COLORS = {
    "math":                  "#3b82f6",  # blue
    "literacy":              "#8b5cf6",  # violet
    "phonics":               "#a855f7",  # purple
    "writing_fine_motor":    "#f97316",  # orange
    "spanish":               "#ec4899",  # pink
    "science":               "#10b981",  # emerald
    "social_studies":        "#14b8a6",  # teal
    "art_creative":          "#ef4444",  # red
    "gross_motor":           "#f59e0b",  # amber
    "fine_motor_general":    "#eab308",  # yellow
    "social_emotional":      "#d946ef",  # fuchsia
    "self_care_independence":"#06b6d4",  # cyan
    "executive_function":    "#6366f1",  # indigo
    "language_oral_english": "#22c55e",  # green
    "music":                 "#84cc16",  # lime
}

POSITION_COLORS = {
    "24mo_ahead": "#10b981",   # emerald
    "12mo_ahead": "#84cc16",   # lime
    "at_age": "#06b6d4",       # cyan
    "below_age": "#f59e0b",    # amber
    "unknown": "#94a3b8",      # slate
    "unknown_pending_measurement": "#94a3b8",
    "n/a": "#cbd5e1",          # slate-300
}

POSITION_LABEL = {
    "24mo_ahead": "24mo+ ahead",
    "12mo_ahead": "12mo+ ahead",
    "at_age": "At age",
    "below_age": "Below age",
    "unknown": "Unknown",
    "unknown_pending_measurement": "Unknown",
    "n/a": "N/A",
}


def count_positions(profile):
    """Return a Counter of position values across all subdomains."""
    c = Counter()
    for dom in profile.get("domains", {}).values():
        for sd in dom.get("subdomains", {}).values():
            pos = sd.get("story_position", "unknown")
            if pos == "unknown_pending_measurement":
                pos = "unknown"
            c[pos] += 1
    return c


def domain_position_table(profile):
    """For each domain, return position counts."""
    rows = []
    for dom_key, dom_data in profile.get("domains", {}).items():
        subs = dom_data.get("subdomains", {})
        c = Counter()
        for sd in subs.values():
            pos = sd.get("story_position", "unknown")
            if pos == "unknown_pending_measurement":
                pos = "unknown"
            c[pos] += 1
        rows.append({
            "domain": DOMAIN_DISPLAY.get(dom_key, dom_key),
            "domain_key": dom_key,
            "total": len(subs),
            "positions": dict(c),
        })
    return rows


def trajectory_data():
    """Read all snapshots, return ordered time series of position counts."""
    if not HISTORY_DIR.exists():
        return []
    snapshots = sorted(HISTORY_DIR.glob("*.json"))
    out = []
    for snap_file in snapshots:
        date = snap_file.stem  # YYYY-MM-DD
        try:
            snap = json.loads(snap_file.read_text())
            counts = count_positions(snap)
            out.append({
                "date": date,
                "ahead_24mo": counts.get("24mo_ahead", 0),
                "ahead_12mo": counts.get("12mo_ahead", 0),
                "at_age": counts.get("at_age", 0),
                "below_age": counts.get("below_age", 0),
                "unknown": counts.get("unknown", 0),
            })
        except Exception:
            continue
    return out


# Map story_position values to "months ahead" for graphing.
POSITION_MONTHS = {
    "24mo_ahead": 24,
    "12mo_ahead": 12,
    "at_age": 0,
    "below_age": -12,
    # unknown / unknown_pending_measurement / n/a → None (skip in average)
}


def domain_avg_months(snapshot, dom_key):
    """Return (avg_months, coverage_pct) for one domain in a snapshot.
    coverage_pct = fraction of subdomains that had a known position.
    Returns (None, 0.0) if no subdomains had data."""
    domain = snapshot.get("domains", {}).get(dom_key, {})
    subs = domain.get("subdomains", {})
    if not subs:
        return None, 0.0
    values = []
    for sd in subs.values():
        pos = sd.get("story_position", "unknown")
        if pos in POSITION_MONTHS:
            values.append(POSITION_MONTHS[pos])
    if not values:
        return None, 0.0
    avg = sum(values) / len(values)
    coverage = len(values) / len(subs)
    return avg, coverage


# Friendlier subdomain names (used in next-steps prose).
# Where the snake_case form already reads OK (e.g., "rote_counting" → "rote counting"),
# we leave it. Only override when the technical term would confuse Less.
SUBDOMAIN_FRIENDLY = {
    "rote_counting": "counting out loud",
    "cardinality": "counting objects accurately",
    "subitizing": "recognizing small quantities at a glance",
    "shapes_geometry": "naming shapes",
    "addition_concepts": "early addition (1+1, 2+1)",
    "letter_recognition_uppercase": "uppercase letters",
    "letter_recognition_lowercase": "lowercase letters",
    "letter_sound_knowledge": "letter sounds",
    "syllable_segmenting": "clapping out syllables",
    "blending": "blending sounds into words",
    "segmenting": "breaking words into sounds",
    "story_comprehension": "understanding stories you read aloud",
    "vocabulary_breadth": "vocabulary size",
    "letter_formation": "forming letters with a pencil",
    "name_writing": "writing his name",
    "drawing_representation": "drawing recognizable things (people, animals)",
    "scissors_use": "using scissors",
    "pencil_grip": "pencil grip",
    "vocabulary_count": "Spanish vocabulary size",
    "comprehension": "understanding spoken Spanish",
    "production": "speaking Spanish",
    "ball_skills": "catching and throwing",
    "single_leg_balance": "balancing on one foot",
    "balance_single_leg": "balancing on one foot",
    "stringing_beads": "stringing beads",
    "tower_building": "stacking blocks",
    "buttons_zippers": "buttons and zippers",
    "pouring_transferring": "pouring and transferring",
    "self_regulation": "handling frustration without crying",
    "emotion_recognition_self": "naming his own feelings",
    "emotion_recognition_others": "reading others' feelings",
    "peer_play": "cooperative play with other kids",
    "turn_taking_sharing": "taking turns and sharing",
    "feeding_utensils": "using a fork and spoon",
    "personal_hygiene": "washing hands, brushing teeth",
    "cleanup_routines": "cleaning up after himself",
    "attention_span": "focus and attention span",
    "working_memory": "remembering multi-step instructions",
    "inhibitory_control": "stopping himself mid-action",
    "cognitive_flexibility": "switching between tasks",
    "sentence_complexity": "sentence complexity",
    "narrative_skills": "telling stories about his day",
    "articulation": "clear pronunciation",
    "question_use": "asking who/what/why questions",
    "pitch_singing": "singing in tune",
    "instrument_exposure": "exposure to instruments",
    "music_appreciation": "listening to and recognizing music",
    "color_theory": "color recognition and use",
    "art_appreciation": "knowing artists and styles",
    "self_family": "knowing his name, age, family",
    "community_helpers": "knowing community helpers (firefighter, doctor)",
    "geography_basics": "knowing where he lives, basic geography",
    "cultures_traditions": "exposure to other cultures",
    "life_sciences": "plants, animals, the body",
    "physical_sciences": "how things move, push/pull",
    "earth_space": "weather, seasons, space",
    "scientific_inquiry": "asking science questions, observing",
    "running": "running",
    "jumping": "jumping",
    "climbing": "climbing",
}


def _friendly(sub_key):
    return SUBDOMAIN_FRIENDLY.get(sub_key, sub_key.replace("_", " "))


def _join_friendly(keys, max_n=3):
    """Comma-join up to max_n friendly names, with 'and' before the last."""
    names = [_friendly(k) for k in keys[:max_n]]
    if len(names) == 0: return ""
    if len(names) == 1: return names[0]
    if len(names) == 2: return f"{names[0]} and {names[1]}"
    return f"{', '.join(names[:-1])}, and {names[-1]}"


def next_steps_paragraph(profile, dom_key, dom_data, philosophy):
    """Build a plain-English next-steps paragraph for Less.
    Answers: 'if I have 5 minutes for this domain today, what do I do?'"""
    interventions = [i for i in profile.get("interventions_active", []) if i.get("domain") == dom_key]
    subs = dom_data.get("subdomains", {})
    if not subs:
        return "Nothing tracked for this area yet."

    # Bucket subdomains by position
    below, at_age, ahead_12, ahead_24, unknown, na = [], [], [], [], [], []
    for sub_key, sd in subs.items():
        pos = sd.get("story_position", "unknown")
        if pos == "below_age": below.append(sub_key)
        elif pos == "at_age": at_age.append(sub_key)
        elif pos == "12mo_ahead": ahead_12.append(sub_key)
        elif pos == "24mo_ahead": ahead_24.append(sub_key)
        elif pos == "n/a": na.append(sub_key)
        else: unknown.append(sub_key)

    total_known = len(below) + len(at_age) + len(ahead_12) + len(ahead_24)
    sentences = []

    # Active interventions take precedence — they're already what we're doing
    if interventions:
        for i in interventions:
            text = i.get("intervention", "").strip()
            if text:
                # Clean up trailing periods, source markers, etc.
                if not text.endswith("."):
                    text += "."
                sentences.append(f"<strong>Right now we're working on this:</strong> {text}")

    # Below-age — priority
    if below:
        names = _join_friendly(below)
        sentences.append(f"The biggest gap is {names}. Five minutes a day of focused practice here would help most.")

    # At-age — natural next push (highest priority after gaps; not already covered by intervention)
    intervention_subs = {i.get("subdomain") for i in interventions}
    at_age_uncovered = [s for s in at_age if s not in intervention_subs]
    pushed_at_age = False
    if at_age_uncovered:
        pushed_at_age = True
        if len(at_age_uncovered) <= 3:
            names = _join_friendly(at_age_uncovered)
            sentences.append(f"The next push is {names} — he's right at the edge of moving up.")
        else:
            names = _join_friendly(at_age_uncovered, max_n=3)
            more = len(at_age_uncovered) - 3
            sentences.append(f"The next push is {names} (and {more} other area{'s' if more > 1 else ''}) — he's right at the edge of moving up.")

    # Strengths — celebrate ONLY if there's nothing else actionable to mention
    # (avoids contradictory "keep doing what works" + "push him forward" in same paragraph)
    if ahead_24 and not below and not pushed_at_age and not interventions:
        names = _join_friendly(ahead_24)
        if len(ahead_24) >= 3:
            sentences.append(f"He's well ahead on {names} — keep doing what's working.")
        else:
            sentences.append(f"{names[0].upper()}{names[1:]} is a real strength.")

    # Ahead-12 only, no 24s — extension recipe (only if nothing else to cover)
    if ahead_12 and not ahead_24 and not at_age and not below and not interventions:
        names = _join_friendly(ahead_12, max_n=2)
        sentences.append(f"He's a year ahead on {names}. To stretch further, try slightly harder versions of the same activity — longer numbers, harder books, etc.")

    # Unknowns — measurement gap
    if unknown:
        names = _join_friendly(unknown)
        if len(unknown) == 1:
            sentences.append(f"We haven't seen Story do {names} yet — Homa will include it in the next check-in with the parent.")
        elif len(unknown) <= 3:
            sentences.append(f"We don't have data on {names} yet — these will come up in the next check-in.")
        else:
            sentences.append(f"There are {len(unknown)} areas in this domain we haven't observed yet. These will rotate into upcoming check-ins.")

    # Fallback for domains with no age-band benchmarks (n/a) and no other data
    if not sentences and na:
        sentences.append(f"This area doesn't have age-band benchmarks (it's tracked separately, not against age). Open the subject page for what we know so far.")

    # Fallback if no signals at all
    if not sentences:
        sentences.append("Mixed picture — open the subject page for per-area detail.")

    return " ".join(sentences)


def trajectory_by_domain():
    """Returns {domain_key: [{date, value, coverage}, ...]} ordered by date.
    value=None when domain has no measured subdomains in that snapshot.

    Visualization rule: leading None values (before the first measured value)
    are replaced with 0 (the "at age" baseline assumption — we hadn't
    measured yet, but the reasonable starting point is at-age). This makes
    the chart show lines starting at the at-age line rather than missing
    leading data."""
    if not HISTORY_DIR.exists():
        return {}
    snapshots = sorted(HISTORY_DIR.glob("*.json"))
    if not snapshots:
        return {}
    # Discover all domain keys from the latest snapshot
    latest = json.loads(snapshots[-1].read_text())
    domain_keys = list(latest.get("domains", {}).keys())
    series = {dk: [] for dk in domain_keys}
    for snap_file in snapshots:
        date = snap_file.stem
        try:
            snap = json.loads(snap_file.read_text())
        except Exception:
            continue
        for dk in domain_keys:
            avg, cov = domain_avg_months(snap, dk)
            series[dk].append({"date": date, "value": avg, "coverage": cov})

    # Replace leading None values with 0 (at-age baseline) per domain
    for dk, points in series.items():
        # Find first index with a real value
        first_real_idx = next((i for i, p in enumerate(points) if p["value"] is not None), None)
        if first_real_idx is not None and first_real_idx > 0:
            for i in range(first_real_idx):
                points[i]["value"] = 0
                points[i]["baseline_assumed"] = True
        elif first_real_idx is None:
            # Domain still has no data anywhere — leave all as None
            pass

    return series


def projected_x_max(snapshots):
    """Return ISO date string for chart's x-axis max: the upcoming Saturday
    (when the next weekly scoring cron runs). Keeps the chart tight to current
    data while leaving exactly one week of forward space — the next datapoint
    that will land naturally."""
    today = datetime.date.today()
    # Saturday = weekday 5. Days until next Saturday (today if Sat).
    days_until_sat = (5 - today.weekday()) % 7
    if days_until_sat == 0:
        days_until_sat = 7  # next Saturday, not today
    next_saturday = today + datetime.timedelta(days=days_until_sat)
    return next_saturday.isoformat()


def recent_research():
    """Return list of recent research notes."""
    if not RESEARCH_DIR.exists():
        return []
    files = sorted(RESEARCH_DIR.glob("*.md"), key=lambda f: f.stat().st_mtime, reverse=True)
    out = []
    for f in files[:5]:
        # Try to extract TL;DR
        text = f.read_text()
        tldr = ""
        for marker in ("## TL;DR for child", "## TL;DR", "**Finding:**"):
            if marker in text:
                section = text.split(marker, 1)[1].split("##", 1)[0].split("**", 1)[0].strip()
                tldr = section.split("\n")[0][:280]
                break
        out.append({
            "filename": f.stem,
            "tldr": tldr,
            "date": datetime.date.fromtimestamp(f.stat().st_mtime).isoformat(),
        })
    return out


def latest_plan():
    """Return latest weekly plan filename, if any."""
    if not PLANS_DIR.exists():
        return None
    files = [f for f in PLANS_DIR.glob("*.md") if f.name != "README.md"]
    if not files:
        return None
    latest = max(files, key=lambda f: f.stat().st_mtime)
    return latest.stem


def fmt_age(age):
    return f"{age['years']}y {age['months']}m {age['days']}d"


def main():
    today = datetime.date.today()
    profile = json.loads(PROFILE.read_text())

    age = profile["age"]
    philosophy = profile.get("philosophy", {})
    interventions = profile.get("interventions_active", [])
    counts = count_positions(profile)
    domain_rows = domain_position_table(profile)
    trajectory = trajectory_data()
    domain_traj = trajectory_by_domain()
    # Compute projected x-max for chart (today in middle, future on right)
    snapshots_sorted = sorted(HISTORY_DIR.glob("*.json")) if HISTORY_DIR.exists() else []
    projected_max = projected_x_max(snapshots_sorted)
    research = recent_research()
    plan = latest_plan()
    total_subdomains = sum(counts.values())

    # Compute current avg-months-ahead per domain (from current profile = last snapshot)
    # Sort domains by current avg desc — strengths at top, gaps at bottom
    domain_current = []
    for dom_key, dom_data in profile.get("domains", {}).items():
        avg, cov = domain_avg_months(profile, dom_key)
        domain_current.append({
            "key": dom_key,
            "name": DOMAIN_DISPLAY.get(dom_key, dom_key),
            "color": DOMAIN_COLORS.get(dom_key, "#94a3b8"),
            "avg_months": avg,
            "coverage": cov,
            "next_steps": next_steps_paragraph(profile, dom_key, dom_data, philosophy),
        })
    # Sort: known first (highest first), then unknown
    domain_current.sort(key=lambda d: (d["avg_months"] is None, -(d["avg_months"] or 0)))

    # Build the per-domain trajectory in the same sort order so the chart legend matches
    domain_traj_ordered = []
    for d in domain_current:
        series = domain_traj.get(d["key"], [])
        domain_traj_ordered.append({
            "key": d["key"],
            "name": d["name"],
            "color": d["color"],
            "current": d["avg_months"],
            "coverage": d["coverage"],
            "points": series,
        })

    # Tier targets for reference lines (pull each unique target from philosophy.tiers)
    # Friendly short labels for the chart annotations
    TIER_SHORT_LABEL = {
        "cognitive_academic": "Academic",
        "motor_selfcare_socioemotional": "Socioemotional",
    }
    tier_targets = []
    for t_name, t_data in philosophy.get("tiers", {}).items():
        target_str = t_data.get("target", "")
        m = None
        if target_str.startswith("24"):
            m = 24
        elif target_str.startswith("12"):
            m = 12
        elif target_str.startswith("36"):
            m = 36
        if m is not None:
            short_name = TIER_SHORT_LABEL.get(t_name, t_name.replace("_", " ").title())
            tier_targets.append({"name": short_name, "months": m})

    # JSON payload embedded into the HTML
    payload = {
        "today": today.isoformat(),
        "story": {
            "name": profile.get("name", "Child"),
            "dob": profile["dob"],
            "age": fmt_age(age),
            "age_decimal": age["decimal_years"],
            "philosophy": philosophy,
        },
        "counts": {
            "ahead_24mo": counts.get("24mo_ahead", 0),
            "ahead_12mo": counts.get("12mo_ahead", 0),
            "at_age": counts.get("at_age", 0),
            "below_age": counts.get("below_age", 0),
            "unknown": counts.get("unknown", 0),
            "na": counts.get("n/a", 0),
            "total": total_subdomains,
        },
        "domains": domain_rows,
        "domain_current": domain_current,
        "domain_traj": domain_traj_ordered,
        "tier_targets": tier_targets,
        "projected_x_max": projected_max,
        "trajectory": trajectory,
        "interventions": interventions,
        "research": research,
        "plan": plan,
        "last_research_run": profile.get("last_research_run"),
        "last_full_rescore": profile.get("last_full_rescore"),
        "next_protocol_due": profile.get("next_measurement_protocol_due"),
    }

    payload_json = json.dumps(payload, indent=2, default=str)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Homa Dashboard — {today.isoformat()}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js"></script>
<style>
:root {{
  --bg: #fafaf9;
  --card: #ffffff;
  --text: #1c1917;
  --text-dim: #57534e;
  --border: #e7e5e4;
  --ahead24: #10b981;
  --ahead12: #84cc16;
  --atage: #06b6d4;
  --below: #f59e0b;
  --unknown: #94a3b8;
  --na: #cbd5e1;
}}
* {{ box-sizing: border-box; }}
body {{
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
  padding: 16px;
  max-width: 1200px;
  margin: 0 auto;
}}
header {{
  margin-bottom: 24px;
}}
h1 {{
  margin: 0 0 4px 0;
  font-size: 1.6rem;
  letter-spacing: -0.02em;
}}
header .meta {{
  color: var(--text-dim);
  font-size: 0.9rem;
}}
.grid {{
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}}
.card {{
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}}
.card h2 {{
  margin: 0 0 12px 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}}
.big-number {{
  font-size: 2.4rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  margin: 0;
  line-height: 1;
}}
.big-number .unit {{
  font-size: 0.9rem;
  color: var(--text-dim);
  font-weight: 400;
  margin-left: 4px;
}}
.snapshot-row {{
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 6px 0;
  font-size: 0.95rem;
}}
.snapshot-row .label {{
  display: flex;
  align-items: center;
  gap: 8px;
}}
.swatch {{
  width: 12px;
  height: 12px;
  border-radius: 3px;
  display: inline-block;
}}
.snapshot-row .count {{
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}}
.full-width {{ grid-column: 1 / -1; }}
.chart-wrap {{
  position: relative;
  height: 260px;
}}
.chart-wrap-tall {{
  position: relative;
  height: 360px;
}}
table {{
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}}
th, td {{
  text-align: left;
  padding: 10px 8px;
  border-bottom: 1px solid var(--border);
}}
th {{
  font-weight: 600;
  color: var(--text-dim);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}}
.bar-group {{
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--border);
  min-width: 140px;
}}
.bar-seg {{ height: 100%; }}
.position-bar {{
  position: relative;
  height: 14px;
  background: linear-gradient(to right, #fee2e2 0%, #fee2e2 33%, #f1f5f9 33%, #f1f5f9 66%, #dbeafe 66%, #dbeafe 100%);
  border-radius: 7px;
  width: 100%;
  min-width: 0;
}}
.position-bar .at-age-tick {{
  position: absolute; left: 33%; top: -3px; width: 1px; height: 20px; background: #94a3b8;
}}
.position-bar .dot {{
  position: absolute; top: 1px; transform: translateX(-50%);
  width: 14px; height: 12px; border-radius: 50%;
  border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}}
/* Ranked card list — clickable <details> elements */
.rank-list {{ display: flex; flex-direction: column; gap: 4px; }}
.rank-item {{
  border-bottom: 1px solid var(--border);
  border-radius: 0;
  transition: background 0.15s ease;
}}
.rank-item:last-child {{ border-bottom: none; }}
.rank-item:hover {{ background: #f8fafc; }}
.rank-item[open] {{ background: #f8fafc; }}
.rank-item summary {{
  display: grid;
  grid-template-columns: 24px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 12px 8px;
  cursor: pointer;
  list-style: none;
  user-select: none;
}}
.rank-item summary::-webkit-details-marker {{ display: none; }}
.rank-item summary::marker {{ display: none; content: ''; }}
.rank-item .rank-num {{
  font-size: 0.78rem; color: var(--text-dim); font-weight: 600; text-align: center;
}}
.rank-item .rank-domain {{
  font-weight: 600; font-size: 0.95rem;
}}
.rank-item .rank-bar {{
  grid-column: 2 / 4;
  margin-top: 6px;
  position: relative; height: 12px;
  background: linear-gradient(to right, #fee2e2 0%, #fee2e2 33%, #f1f5f9 33%, #f1f5f9 66%, #dbeafe 66%, #dbeafe 100%);
  border-radius: 6px;
}}
.rank-item .rank-bar .at-age-tick {{
  position: absolute; left: 33%; top: -2px; width: 1px; height: 16px; background: #94a3b8;
}}
.rank-item .rank-bar .dot {{
  position: absolute; top: 0px; transform: translateX(-50%);
  width: 12px; height: 12px; border-radius: 50%;
  border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}}
.rank-item .rank-value {{
  font-weight: 700; font-size: 0.95rem; font-variant-numeric: tabular-nums;
  white-space: nowrap;
}}
.rank-item .rank-coverage {{
  grid-column: 2 / 4;
  font-size: 0.72rem; color: var(--text-dim);
  margin-top: 2px;
}}
.rank-tap {{
  color: #6366f1;
  font-weight: 500;
  margin-left: 4px;
}}
.rank-item[open] .rank-tap {{ display: none; }}
/* Expanded panel */
.rank-expand {{
  padding: 4px 16px 16px 42px;
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--text);
  animation: expandFade 0.2s ease;
}}
.rank-expand p {{ margin: 0 0 12px 0; }}
.rank-expand strong {{ color: var(--text); font-weight: 600; }}
.rank-link {{
  display: inline-block;
  font-size: 0.85rem;
  color: #6366f1;
  text-decoration: none;
  font-weight: 500;
}}
.rank-link:hover {{ text-decoration: underline; }}
@keyframes expandFade {{
  from {{ opacity: 0; transform: translateY(-4px); }}
  to {{ opacity: 1; transform: translateY(0); }}
}}
.intervention {{
  border-left: 3px solid var(--ahead12);
  padding: 8px 12px;
  margin-bottom: 12px;
  background: #f7fee7;
  border-radius: 4px;
}}
.intervention strong {{ display: block; margin-bottom: 4px; font-size: 0.95rem; }}
.intervention p {{ margin: 4px 0 0 0; font-size: 0.88rem; color: var(--text-dim); }}
.intervention .source {{ font-size: 0.78rem; color: var(--text-dim); font-style: italic; margin-top: 6px; }}
.research-item {{
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
}}
.research-item:last-child {{ border-bottom: none; }}
.research-item .name {{ font-weight: 600; font-size: 0.95rem; margin-bottom: 4px; }}
.research-item .tldr {{ color: var(--text-dim); font-size: 0.88rem; }}
.action-list li {{ margin-bottom: 8px; }}
.tier {{
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  margin-right: 6px;
}}
.tier-cog {{ background: #ddd6fe; color: #5b21b6; }}
.tier-mot {{ background: #fed7aa; color: #9a3412; }}
.empty {{ color: var(--text-dim); font-style: italic; font-size: 0.9rem; }}
.tooltip {{
  font-size: 0.78rem;
  color: var(--text-dim);
  margin-top: 4px;
}}
@media (max-width: 768px) {{
  body {{ padding: 10px; }}
  h1 {{ font-size: 1.25rem; }}
  header .meta {{ font-size: 0.8rem; }}
  .card {{ padding: 14px; }}
  .card h2 {{ font-size: 0.85rem; margin-bottom: 10px; }}
  .big-number {{ font-size: 1.9rem; }}
  .chart-wrap {{ height: 220px; }}
  .chart-wrap-tall {{ height: 480px; }}  /* taller on mobile so legend fits below */

  /* Tighter intervention cards */
  .intervention {{ padding: 8px 10px; }}
  .intervention p {{ font-size: 0.85rem; }}

  /* Header stats row stacks */
  header .meta .sep {{ display: block; height: 0; visibility: hidden; }}
}}
@media (max-width: 480px) {{
  body {{ padding: 8px; }}
  .chart-wrap-tall {{ height: 520px; }}
}}
</style>
</head>
<body>

<header>
  <h1>📊 Homa Dashboard</h1>
  <div class="meta">
    <strong>{fmt_age(age)}</strong> ({age['decimal_years']:.2f} yrs) · {total_subdomains} subdomains tracked
  </div>
  <div class="meta" style="margin-top:4px">
    🚀 {counts.get('24mo_ahead', 0)} · ✨ {counts.get('12mo_ahead', 0)} · ✅ {counts.get('at_age', 0)} · ❓ {counts.get('unknown', 0)} · <span style="opacity:.6">updated {today.isoformat()}</span>
  </div>
</header>

<!-- HERO: Per-domain trajectory -->
<div class="card full-width">
  <h2>📈 How ahead is Progress by domain (months)</h2>
  <div class="chart-wrap-tall"><canvas id="domainTrajectoryChart"></canvas></div>
</div>

<!-- Ranked: strengths → gaps. Click any row to expand next steps. -->
<div class="card full-width">
  <h2>🏆 Domains ranked — tap any row for next steps</h2>
  <div class="rank-list">
"""

    for i, d in enumerate(domain_current, 1):
        if d["avg_months"] is not None:
            avg = d["avg_months"]
            label = f"{avg:+.1f} mo" if avg != 0 else "0 mo (at age)"
            bar_pct_from_left = max(0, min(100, ((avg + 12) / 36) * 100))
            color = d["color"]
            bar_html = f'<div class="rank-bar"><div class="at-age-tick"></div><div class="dot" style="left:{bar_pct_from_left}%;background:{color}"></div></div>'
        else:
            label = "—"
            color = d["color"]
            bar_html = '<div class="rank-bar"></div>'
        cov = f"{d['coverage'] * 100:.0f}%" if d['coverage'] else "—"

        # next_steps is already HTML (uses inline <strong> tags directly)
        next_steps_html = d["next_steps"]

        html += f"""<details class="rank-item">
  <summary>
    <div class="rank-num">{i}</div>
    <div class="rank-domain" style="color:{color}">{d['name']}</div>
    <div class="rank-value">{label}</div>
    {bar_html}
    <div class="rank-coverage">{cov} measured · <span class="rank-tap">tap for next steps ↓</span></div>
  </summary>
  <div class="rank-expand">
    <p>{next_steps_html}</p>
    <a href="/{d['key'].replace('_', '-')}.html" class="rank-link">Open {d['name']} page →</a>
  </div>
</details>"""

    html += """
  </div>

  <div class="tooltip" style="margin-top:12px">
    Bar shows position: <span style="color:#dc2626">below age</span> ← at age → <span style="color:#2563eb">24mo+ ahead</span>
  </div>
</div>

<div class="grid">
"""

    # Active interventions
    if interventions:
        html += '<div class="card"><h2>🎯 Active interventions</h2>'
        for i in interventions:
            dom = DOMAIN_DISPLAY.get(i.get("domain", ""), i.get("domain", "?"))
            sub = i.get("subdomain", "?").replace("_", " ")
            text = i.get("intervention", "")
            status = i.get("status", "proposed")
            source = i.get("source", "")
            html += f"""<div class="intervention">
  <strong>{dom} → {sub}</strong>
  <span style="font-size:.78rem;color:var(--text-dim)">[{status}]</span>
  <p>{text}</p>
  {f'<div class="source">{source}</div>' if source else ""}
</div>"""
        html += '</div>'
    else:
        html += '<div class="card"><h2>🎯 Active interventions</h2><p class="empty">No active interventions. The next weekly scoring run will propose some.</p></div>'

    # This week's action items
    html += '<div class="card"><h2>📋 This week\'s action items</h2>'
    if plan:
        html += f'<p><strong>📅 Latest weekly plan:</strong> <a href="Weekly-Plans/{plan}.md">{plan}</a></p>'
    html += '<p><strong>🎯 Practice items (from interventions):</strong></p><ul class="action-list">'
    if interventions:
        for i in interventions:
            sub = i.get("subdomain", "?").replace("_", " ")
            short = i.get("intervention", "")[:140] + ("..." if len(i.get("intervention", "")) > 140 else "")
            html += f"<li><strong>{sub}:</strong> {short}</li>"
    else:
        html += "<li class='empty'>None yet — proposed by weekly scoring cron Saturdays.</li>"
    html += '</ul>'
    if profile.get("next_measurement_protocol_due"):
        html += f'<p style="margin-top:14px"><strong>📐 Next measurement check-in:</strong> {profile["next_measurement_protocol_due"]} <span class="tooltip">(Less\'s 5-question protocol from weekly scoring)</span></p>'
    html += '</div>'

    # Recent research
    html += '<div class="card"><h2>🔬 Recent research</h2>'
    if research:
        for r in research:
            html += f"""<div class="research-item">
  <div class="name">{r['date']} · {r['filename'].replace(r['date'] + '-', '').replace('-', ' ').title()}</div>
  {f'<div class="tldr">{r["tldr"]}</div>' if r['tldr'] else ''}
</div>"""
    else:
        html += '<p class="empty">No research notes yet.</p>'
    html += '</div>'

    html += '</div>\n'  # close grid

    # Footer + scripts
    html += f"""
<footer style="margin-top:32px; padding-top:16px; border-top:1px solid var(--border); color:var(--text-dim); font-size:0.85rem;">
  <p>🤖 Auto-generated by <code>scripts/generate_dashboard.py</code> · Reads <code>~/.openclaw/workspace/children/*.json</code> + snapshot history. Don't hand-edit; rebuilds every regeneration.</p>
  <p>Last research run: {profile.get('last_research_run', '—')} · Last full rescore: {profile.get('last_full_rescore', '—')}</p>
</footer>

<script>
const DATA = {payload_json};

// Position pie chart
const piePositions = ['24mo+ ahead', '12mo+ ahead', 'At age', 'Below age', 'Unknown'];
const pieCounts = [DATA.counts.ahead_24mo, DATA.counts.ahead_12mo, DATA.counts.at_age, DATA.counts.below_age, DATA.counts.unknown];
const pieColors = ['#10b981', '#84cc16', '#06b6d4', '#f59e0b', '#94a3b8'];
new Chart(document.getElementById('positionPie'), {{
  type: 'doughnut',
  data: {{
    labels: piePositions,
    datasets: [{{ data: pieCounts, backgroundColor: pieColors, borderWidth: 2, borderColor: '#fff' }}]
  }},
  options: {{
    responsive: true,
    maintainAspectRatio: false,
    plugins: {{
      legend: {{ position: 'bottom', labels: {{ font: {{ size: 11 }}, padding: 10 }} }}
    }}
  }}
}});

// Per-domain trajectory chart (HERO)
// Each domain is one line. Y = average months ahead/behind. X = date (time scale).
// Future dates are visible on the right so trajectory has room to extend.
const dt = DATA.domain_traj;
const tierTargets = DATA.tier_targets || [];
const projectedXMax = DATA.projected_x_max;
const targetAnnotations = tierTargets.map((t, idx) => ({{
  type: 'line', yMin: t.months, yMax: t.months,
  borderColor: idx === 0 ? '#a78bfa' : '#fb923c',
  borderDash: [6, 4], borderWidth: 1.5,
  label: {{
    display: true, content: `${{t.name}} target (${{t.months}}mo)`,
    position: 'end', backgroundColor: idx === 0 ? '#a78bfa' : '#fb923c',
    color: '#fff', font: {{ size: 10 }}, padding: 4
  }}
}}));
// Vertical line at "today" so past/future are visually separated
targetAnnotations.push({{
  type: 'line',
  xMin: '{today.isoformat()}', xMax: '{today.isoformat()}',
  borderColor: '#94a3b8', borderDash: [3, 3], borderWidth: 1,
  label: {{
    display: true, content: 'today',
    position: 'start', backgroundColor: '#fff',
    color: '#64748b', font: {{ size: 10, weight: 'bold' }}, padding: 3,
    yAdjust: -8
  }}
}});
const firstDate = dt[0] && dt[0].points && dt[0].points[0] ? dt[0].points[0].date : null;
new Chart(document.getElementById('domainTrajectoryChart'), {{
  type: 'line',
  data: {{
    datasets: dt.map(d => ({{
      label: d.name,
      data: d.points.map(p => ({{ x: p.date, y: p.value, coverage: p.coverage }})),
      borderColor: d.color,
      backgroundColor: d.color + '22',
      tension: 0.25,
      fill: false,
      spanGaps: true,
      pointRadius: 5,
      pointHoverRadius: 8,
      borderWidth: 2.5,
    }}))
  }},
  options: {{
    responsive: true, maintainAspectRatio: false,
    interaction: {{ mode: 'nearest', intersect: false }},
    plugins: {{
      legend: {{
        position: window.innerWidth < 768 ? 'bottom' : 'right',
        labels: {{ font: {{ size: 11 }}, padding: 8, boxWidth: 14, usePointStyle: true }}
      }},
      annotation: {{ annotations: targetAnnotations }},
      tooltip: {{
        callbacks: {{
          label: ctx => {{
            const v = ctx.parsed.y;
            const cov = ((ctx.raw.coverage || 0) * 100).toFixed(0);
            return v === null ? `${{ctx.dataset.label}}: no data (${{cov}}% measured)` : `${{ctx.dataset.label}}: ${{v >= 0 ? '+' : ''}}${{v.toFixed(1)}} mo (${{cov}}% coverage)`;
          }}
        }}
      }}
    }},
    scales: {{
      y: {{
        title: {{ display: true, text: 'Months ahead / behind age' }},
        suggestedMin: -6, suggestedMax: 30,
        ticks: {{
          callback: v => v === 0 ? 'At age' : (v > 0 ? `+${{v}} mo` : `${{v}} mo`)
        }},
        grid: {{
          color: ctx => ctx.tick.value === 0 ? '#94a3b8' : '#e7e5e4',
          lineWidth: ctx => ctx.tick.value === 0 ? 2 : 1,
        }}
      }},
      x: {{
        type: 'time',
        time: {{ unit: 'day', tooltipFormat: 'MMM d, yyyy', displayFormats: {{ day: 'MMM d' }} }},
        min: firstDate,
        max: projectedXMax,
        title: {{ display: true, text: 'Date (today is in the middle — future on the right)' }},
      }}
    }}
  }}
}});

// Subdomain-bucket trajectory (kept as a smaller secondary view, not rendered by default)
const traj = DATA.trajectory;
const trajLabels = traj.map(t => t.date);
const _legacyTrajChart = document.getElementById('trajectoryChart');
if (_legacyTrajChart) new Chart(_legacyTrajChart, {{
  type: 'line',
  data: {{
    labels: trajLabels,
    datasets: [
      {{ label: '24mo+ ahead', data: traj.map(t => t.ahead_24mo), borderColor: '#10b981', backgroundColor: '#10b98122', tension: 0.3, fill: false }},
      {{ label: '12mo+ ahead', data: traj.map(t => t.ahead_12mo), borderColor: '#84cc16', backgroundColor: '#84cc1622', tension: 0.3, fill: false }},
      {{ label: 'At age', data: traj.map(t => t.at_age), borderColor: '#06b6d4', backgroundColor: '#06b6d422', tension: 0.3, fill: false }},
      {{ label: 'Below age', data: traj.map(t => t.below_age), borderColor: '#f59e0b', backgroundColor: '#f59e0b22', tension: 0.3, fill: false }},
      {{ label: 'Unknown', data: traj.map(t => t.unknown), borderColor: '#94a3b8', backgroundColor: '#94a3b822', tension: 0.3, fill: false }},
    ]
  }},
  options: {{
    responsive: true,
    maintainAspectRatio: false,
    plugins: {{ legend: {{ position: 'bottom' }} }},
    scales: {{
      y: {{ beginAtZero: true, title: {{ display: true, text: '# of subdomains' }} }},
      x: {{ title: {{ display: true, text: 'Date' }} }}
    }}
  }}
}});
</script>
</body>
</html>
"""

    out_path = VAULT / "Homa Dashboard.html"
    out_path.write_text(html)
    print(f"Wrote Homa Dashboard.html ({len(html):,} bytes) · {len(trajectory)} trajectory points · {total_subdomains} subdomains")


if __name__ == "__main__":
    main()
