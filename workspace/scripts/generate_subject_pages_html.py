#!/usr/bin/env python3
"""
Generate per-domain HTML pages for the Vercel-deployed dashboard.

For each of the 15 domains, builds a self-contained HTML page showing:
- Domain header with current avg-months-ahead
- Each subdomain with: current observation, position, target band, last verified
- Active interventions touching this domain
- Latest research note TL;DR (if any)
- Back link to the main dashboard

Reads:
  - ~/.openclaw/workspace/children/*.json
  - ~/Documents/Homeschool/Research/*.md (for TL;DRs)

Writes:
  - ~/.openclaw/workspace/dashboard-deploy/{slug}.html  (one per domain)

These get deployed alongside index.html on the next vercel push, so the
"Open {Domain} page" links from the main dashboard route to a real page.

Idempotent. Called by regenerate_vault.py before deploy_dashboard.py.
"""

import json
import datetime
import pathlib
import re

PROFILE = pathlib.Path.home() / ".openclaw" / "workspace" / "children/*.json"
DEPLOY_DIR = pathlib.Path.home() / ".openclaw" / "workspace" / "dashboard-deploy"
RESEARCH_DIR = pathlib.Path.home() / "Documents" / "Homeschool" / "Research"

DOMAIN_DISPLAY = {
    "math": "Math", "literacy": "Literacy", "phonics": "Phonics",
    "writing_fine_motor": "Writing & Fine Motor", "spanish": "Spanish",
    "science": "Science", "social_studies": "Social Studies",
    "art_creative": "Art & Creative", "gross_motor": "Gross Motor",
    "fine_motor_general": "Fine Motor (general)", "social_emotional": "Social-Emotional",
    "self_care_independence": "Self-Care", "executive_function": "Executive Function",
    "language_oral_english": "Language", "music": "Music",
}

DOMAIN_COLORS = {
    "math": "#3b82f6", "literacy": "#8b5cf6", "phonics": "#a855f7",
    "writing_fine_motor": "#f97316", "spanish": "#ec4899",
    "science": "#10b981", "social_studies": "#14b8a6",
    "art_creative": "#ef4444", "gross_motor": "#f59e0b",
    "fine_motor_general": "#eab308", "social_emotional": "#d946ef",
    "self_care_independence": "#06b6d4", "executive_function": "#6366f1",
    "language_oral_english": "#22c55e", "music": "#84cc16",
}

POSITION_MONTHS = {"24mo_ahead": 24, "12mo_ahead": 12, "at_age": 0, "below_age": -12}

POSITION_LABEL = {
    "24mo_ahead": "🚀 24mo+ ahead",
    "12mo_ahead": "✨ 12mo+ ahead",
    "at_age": "✅ At age",
    "below_age": "⚠️ Below age",
    "unknown": "❓ Not yet observed",
    "unknown_pending_measurement": "❓ Not yet observed",
    "n/a": "— Not age-banded",
}

POSITION_COLOR = {
    "24mo_ahead": "#10b981",
    "12mo_ahead": "#84cc16",
    "at_age": "#06b6d4",
    "below_age": "#f59e0b",
    "unknown": "#94a3b8",
    "unknown_pending_measurement": "#94a3b8",
    "n/a": "#cbd5e1",
}


def slug(domain_key):
    """Convert domain_key → URL slug, e.g. social_emotional → social-emotional"""
    return domain_key.replace("_", "-")


def domain_avg_months(dom_data):
    subs = dom_data.get("subdomains", {})
    if not subs: return None, 0.0
    values = [POSITION_MONTHS[sd["story_position"]] for sd in subs.values()
              if sd.get("story_position") in POSITION_MONTHS]
    if not values: return None, 0.0
    return sum(values) / len(values), len(values) / len(subs)


# Subdomain key → friendly name (mirrors generate_dashboard.py for consistency)
SUBDOMAIN_FRIENDLY = {
    "rote_counting": "counting out loud",
    "cardinality": "counting objects accurately",
    "subitizing": "recognizing small quantities at a glance",
    "shapes_geometry": "naming shapes",
    "addition_concepts": "early addition",
    "letter_recognition_uppercase": "uppercase letters",
    "letter_recognition_lowercase": "lowercase letters",
    "letter_sound_knowledge": "letter sounds",
    "syllable_segmenting": "clapping out syllables",
    "blending": "blending sounds into words",
    "segmenting": "breaking words into sounds",
    "story_comprehension": "story comprehension",
    "vocabulary_breadth": "vocabulary",
    "letter_formation": "forming letters",
    "name_writing": "writing his name",
    "drawing_representation": "representational drawing",
    "scissors_use": "scissors",
    "vocabulary_count": "Spanish vocabulary",
    "comprehension": "Spanish comprehension",
    "production": "speaking Spanish",
    "ball_skills": "catching and throwing",
    "balance_single_leg": "balancing on one foot",
    "self_regulation": "handling frustration",
    "emotion_recognition_self": "naming his own feelings",
    "emotion_recognition_others": "reading others' feelings",
    "peer_play": "cooperative play",
    "turn_taking_sharing": "taking turns",
    "feeding_utensils": "using utensils",
    "personal_hygiene": "hygiene routines",
    "cleanup_routines": "cleaning up",
    "attention_span": "focus",
    "working_memory": "remembering instructions",
    "inhibitory_control": "self-control",
    "cognitive_flexibility": "switching tasks",
    "narrative_skills": "telling stories",
    "articulation": "clear pronunciation",
    "question_use": "asking questions",
    "pitch_singing": "singing in tune",
    "music_appreciation": "listening to music",
    "color_theory": "color recognition",
    "art_appreciation": "art appreciation",
    "self_family": "knowing his family",
    "community_helpers": "community helpers",
    "geography_basics": "basic geography",
    "life_sciences": "plants and animals",
    "earth_space": "weather and space",
    "scientific_inquiry": "asking science questions",
}


def _friendly(sub_key):
    return SUBDOMAIN_FRIENDLY.get(sub_key, sub_key.replace("_", " "))


def lever_sentence(dom_data, current_avg):
    """Build a one-sentence explanation of what's pulling the score down (or up)
    and what the score would become if the lowest subdomain moved up one tier.

    Returns None if there's no useful lever to surface (e.g., all subs at same
    level, or no measured subs)."""
    subs = dom_data.get("subdomains", {})
    measured = []
    unmeasured = []
    for sub_key, sd in subs.items():
        pos = sd.get("story_position", "unknown")
        if pos in POSITION_MONTHS:
            measured.append((sub_key, POSITION_MONTHS[pos]))
        elif pos in ("unknown", "unknown_pending_measurement"):
            unmeasured.append(sub_key)

    if not measured or current_avg is None:
        return None

    n = len(measured)
    min_val = min(v for _, v in measured)
    max_val = max(v for _, v in measured)

    # Case 1: all subdomains at same level — no internal lever
    if min_val == max_val:
        # If there are unmeasured subs, mention them as upside
        if unmeasured:
            count_str = f"{len(unmeasured)} {'subdomain' if len(unmeasured) == 1 else 'subdomains'} not yet observed"
            return f"All measured areas are at the same level. Once we observe {count_str}, the score may rise."
        return None  # truly nothing to say

    # Case 2: there's spread — find the lowest subdomains and compute uplift
    laggards = [k for k, v in measured if v == min_val]
    next_tier = next((m for m in [12, 24, 0] if m > min_val), None)
    # Pick the smallest tier strictly above min_val from the canonical set [-12, 0, 12, 24]
    canonical = [-12, 0, 12, 24]
    next_tier = next((m for m in canonical if m > min_val), None)
    if next_tier is None:
        return None

    # New avg if those laggards all moved up to next_tier
    delta_per_laggard = next_tier - min_val
    new_total = sum(v for _, v in measured) + len(laggards) * delta_per_laggard
    new_avg = new_total / n

    # Phrase the new tier
    tier_phrase = {
        -12: "still below age",
        0: "at age",
        12: "12mo+ ahead",
        24: "24mo+ ahead",
    }[next_tier]

    # Phrase the laggard names
    if len(laggards) == 1:
        laggard_str = _friendly(laggards[0])
        pronoun = "it"
    elif len(laggards) == 2:
        laggard_str = f"{_friendly(laggards[0])} and {_friendly(laggards[1])}"
        pronoun = "they"
    else:
        laggard_str = f"{_friendly(laggards[0])} and {len(laggards) - 1} others"
        pronoun = "they"

    laggard_str = laggard_str[0].upper() + laggard_str[1:]

    def fmt(v):
        if v == 0: return "at age"
        sign = "+" if v > 0 else ""
        return f"{sign}{v:.1f}mo"

    return (f"<strong>{laggard_str}</strong> is pulling the score down. "
            f"If {pronoun} moved up to {tier_phrase}, the score would rise from "
            f"{fmt(current_avg)} to {fmt(new_avg)}.")


def latest_research_for(dom_key):
    """Find the most recent research note that mentions this domain."""
    if not RESEARCH_DIR.exists(): return None
    candidates = []
    for f in RESEARCH_DIR.glob("*.md"):
        # File names look like 2026-05-05-gross-motor.md
        name_lower = f.stem.lower()
        if dom_key.replace("_", "-") in name_lower or dom_key.replace("_", "") in name_lower.replace("-", ""):
            candidates.append(f)
    if not candidates:
        return None
    return max(candidates, key=lambda f: f.stat().st_mtime)


def extract_tldr(research_file):
    """Pull the TL;DR section from a research markdown file."""
    if not research_file or not research_file.exists():
        return None
    text = research_file.read_text()
    for marker in ("## TL;DR for child", "## TL;DR", "**Finding:**"):
        if marker in text:
            section = text.split(marker, 1)[1]
            # Stop at next ## section
            section = re.split(r"\n##\s", section, 1)[0]
            # Stop at next **Bold:** marker
            section = re.split(r"\n\*\*[A-Z]", section, 1)[0]
            cleaned = section.strip()
            # Cap length
            if len(cleaned) > 1200:
                cleaned = cleaned[:1200] + "…"
            return cleaned
    return None


def build_page(profile, dom_key, dom_data):
    name = DOMAIN_DISPLAY.get(dom_key, dom_key)
    color = DOMAIN_COLORS.get(dom_key, "#6366f1")
    avg, coverage = domain_avg_months(dom_data)
    interventions = [i for i in profile.get("interventions_active", [])
                     if i.get("domain") == dom_key]
    today = datetime.date.today()

    # Avg label
    if avg is None:
        avg_label = "—"
        avg_sublabel = "no data yet"
    elif avg == 0:
        avg_label = "At age"
        avg_sublabel = f"{coverage*100:.0f}% measured"
    else:
        sign = "+" if avg > 0 else ""
        avg_label = f"{sign}{avg:.1f} mo"
        avg_sublabel = f"{coverage*100:.0f}% measured · ahead of age" if avg > 0 else f"{coverage*100:.0f}% measured · below age"

    # The lever — what would move the score
    lever = lever_sentence(dom_data, avg)

    # Gap-fill prompt — for subdomains with truly unknown position (not n/a)
    unknowns = [
        sub_key for sub_key, sd in dom_data.get("subdomains", {}).items()
        if sd.get("story_position") in ("unknown", "unknown_pending_measurement")
    ]
    gap_prompt = None
    if unknowns:
        friendly_list = ", ".join(_friendly(k) for k in unknowns)
        gap_prompt = (
            f"Hey Homa, let's fill in the child's missing data for {name} — specifically: "
            f"{friendly_list}. Make a questionnaire I can answer that gives you everything "
            f"you need to know about the child's progress in these areas. Keep the questions "
            f"simple — yes/no or one short sentence each."
        )

    # Latest research
    research_file = latest_research_for(dom_key)
    tldr = extract_tldr(research_file)
    research_filename = research_file.stem if research_file else None

    subs_html = []
    activities_dir = pathlib.Path.home() / ".openclaw" / "workspace" / "activities"
    for sub_key, sd in dom_data.get("subdomains", {}).items():
        sub_name = sub_key.replace("_", " ").title()
        pos = sd.get("story_position", "unknown")
        pos_label = POSITION_LABEL.get(pos, pos)
        pos_color = POSITION_COLOR.get(pos, "#94a3b8")
        current = sd.get("current") or "Not yet observed."
        verified = sd.get("verified") or "—"
        target_band = sd.get("target_band", "?")
        notes = sd.get("notes", "")

        # Activity page link — exists for every subdomain (placeholder or rich)
        activity_slug = f"{dom_key.replace('_', '-')}/{sub_key.replace('_', '-')}.html"
        activity_exists = (activities_dir / f"{dom_key}__{sub_key}.json").exists()
        activity_label = "→ 10-minute activity" if activity_exists else "→ Activity (draft prompt)"
        activity_link = f'<a class="sub-activity-link" href="/{activity_slug}">{activity_label}</a>'

        notes_html = f'<div class="sub-notes">{notes}</div>' if notes else ""
        subs_html.append(f"""<div class="sub-card">
  <div class="sub-header">
    <strong class="sub-name">{sub_name}</strong>
    <span class="sub-pos" style="background:{pos_color}22;color:{pos_color}">{pos_label}</span>
  </div>
  <div class="sub-current">{current}</div>
  {notes_html}
  <div class="sub-meta">
    <span>Last seen: {verified}</span>
    <span>·</span>
    <span>Target by {target_band}</span>
  </div>
  {activity_link}
</div>""")

    gap_html = ""
    if gap_prompt:
        # Escape for embedding in JS string
        js_safe = gap_prompt.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")
        gap_html = f"""<section class="card gap-card">
  <h2>📝 Fill in the gaps</h2>
  <p class="gap-intro">We don't have data on {len(unknowns)} {'area' if len(unknowns) == 1 else 'areas'} in this domain yet ({", ".join(_friendly(k) for k in unknowns)}). Paste this to Homa in Slack and she'll send you a quick questionnaire:</p>
  <div class="gap-prompt-box">
    <code id="gap-prompt-text">{gap_prompt}</code>
  </div>
  <button class="gap-copy-btn" onclick="navigator.clipboard.writeText('{js_safe}').then(() => {{ this.innerText = '✓ Copied — paste to Homa in Slack'; setTimeout(() => this.innerText = '📋 Copy prompt', 2500); }})">📋 Copy prompt</button>
</section>"""

    interventions_html = ""
    if interventions:
        items = []
        for i in interventions:
            sub = i.get("subdomain", "?").replace("_", " ")
            text = i.get("intervention", "")
            items.append(f"""<div class="intervention">
  <strong>{sub}</strong>
  <p>{text}</p>
</div>""")
        interventions_html = f"""<section class="card">
  <h2>🎯 What we're working on</h2>
  {"".join(items)}
</section>"""

    research_html = ""
    if tldr:
        research_html = f"""<section class="card">
  <h2>🔬 Latest research</h2>
  <div class="research-tldr">{tldr}</div>
  {f'<a class="research-link" href="https://homa-dashboard-recoup.vercel.app/" >Full note in Obsidian: {research_filename}</a>' if research_filename else ''}
</section>"""

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{name} — Homa Dashboard</title>
<style>
:root {{
  --bg: #fafaf9; --card: #ffffff; --text: #1c1917;
  --text-dim: #57534e; --border: #e7e5e4;
}}
* {{ box-sizing: border-box; }}
body {{
  margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  background: var(--bg); color: var(--text); line-height: 1.5;
  padding: 16px; max-width: 800px; margin: 0 auto;
}}
.back-link {{
  display: inline-block; color: var(--text-dim); text-decoration: none;
  font-size: 0.9rem; margin-bottom: 12px;
}}
.back-link:hover {{ color: {color}; }}
header {{
  margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid {color};
}}
h1 {{
  margin: 0 0 8px 0; font-size: 1.8rem; letter-spacing: -0.02em; color: {color};
}}
.avg-display {{
  display: flex; align-items: baseline; gap: 12px;
}}
.avg-big {{
  font-size: 2.2rem; font-weight: 700; color: var(--text); letter-spacing: -0.02em;
}}
.avg-small {{ color: var(--text-dim); font-size: 0.9rem; }}
.lever {{
  margin: 14px 0 0 0; padding: 10px 14px;
  background: #fef3c7; border-left: 3px solid #f59e0b;
  border-radius: 4px; font-size: 0.92rem; line-height: 1.5;
}}
.lever strong {{ color: #92400e; }}
.gap-card {{
  border-left: 3px solid #6366f1;
  background: #eef2ff;
}}
.gap-card h2 {{ color: #4338ca; }}
.gap-intro {{ font-size: 0.92rem; line-height: 1.5; margin: 0 0 12px 0; }}
.gap-prompt-box {{
  background: white; border: 1px solid #c7d2fe; border-radius: 6px;
  padding: 12px; margin-bottom: 10px;
  font-size: 0.88rem; line-height: 1.5;
  user-select: all;
}}
.gap-prompt-box code {{
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  white-space: normal; color: #312e81;
}}
.gap-copy-btn {{
  background: #6366f1; color: white; border: none; border-radius: 6px;
  padding: 10px 16px; font-size: 0.9rem; font-weight: 600;
  cursor: pointer; transition: background 0.15s ease;
  width: 100%; max-width: 320px;
}}
.gap-copy-btn:hover {{ background: #4f46e5; }}
.gap-copy-btn:active {{ background: #4338ca; }}
.card {{
  background: var(--card); border: 1px solid var(--border); border-radius: 12px;
  padding: 18px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}}
.card h2 {{
  margin: 0 0 14px 0; font-size: 0.95rem; font-weight: 600;
  color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.04em;
}}
.sub-card {{
  padding: 14px 0; border-bottom: 1px solid var(--border);
}}
.sub-card:last-child {{ border-bottom: none; }}
.sub-header {{
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; flex-wrap: wrap; margin-bottom: 8px;
}}
.sub-name {{ font-size: 1rem; }}
.sub-pos {{
  font-size: 0.78rem; padding: 3px 10px; border-radius: 999px; font-weight: 600;
  white-space: nowrap;
}}
.sub-current {{ font-size: 0.95rem; color: var(--text); margin-bottom: 6px; }}
.sub-notes {{ font-size: 0.85rem; color: var(--text-dim); font-style: italic; margin-bottom: 6px; }}
.sub-meta {{
  font-size: 0.78rem; color: var(--text-dim); display: flex; gap: 6px; flex-wrap: wrap;
}}
.sub-activity-link {{
  display: inline-block; margin-top: 10px;
  background: {color}; color: white; text-decoration: none;
  padding: 7px 14px; border-radius: 6px;
  font-size: 0.86rem; font-weight: 600;
  transition: opacity 0.15s ease;
}}
.sub-activity-link:hover {{ opacity: 0.85; }}
.intervention {{
  border-left: 3px solid #84cc16; padding: 8px 12px; margin-bottom: 12px;
  background: #f7fee7; border-radius: 4px;
}}
.intervention:last-child {{ margin-bottom: 0; }}
.intervention strong {{ display: block; margin-bottom: 4px; font-size: 0.95rem; }}
.intervention p {{ margin: 0; font-size: 0.9rem; color: var(--text-dim); }}
.research-tldr {{
  font-size: 0.95rem; line-height: 1.6;
}}
.research-link {{
  display: inline-block; margin-top: 10px;
  color: {color}; text-decoration: none; font-size: 0.85rem; font-weight: 500;
}}
footer {{
  margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border);
  color: var(--text-dim); font-size: 0.82rem;
}}
@media (max-width: 480px) {{
  body {{ padding: 12px; }}
  h1 {{ font-size: 1.4rem; }}
  .avg-big {{ font-size: 1.7rem; }}
}}
</style>
</head>
<body>
<a href="/" class="back-link">← Back to dashboard</a>
<header>
  <h1>{name}</h1>
  <div class="avg-display">
    <span class="avg-big">{avg_label}</span>
    <span class="avg-small">{avg_sublabel}</span>
  </div>
  {f'<p class="lever">{lever}</p>' if lever else ''}
</header>

{gap_html}

{interventions_html}

<section class="card">
  <h2>📋 Subdomains ({len(dom_data.get("subdomains", {}))})</h2>
  {"".join(subs_html)}
</section>

{research_html}

<footer>
  Generated {today.isoformat()} · Source: <code>~/.openclaw/workspace/children/*.json</code> · <a href="/" style="color:{color}">Back to dashboard</a>
</footer>
</body>
</html>
"""
    return html


def main():
    profile = json.loads(PROFILE.read_text())
    DEPLOY_DIR.mkdir(parents=True, exist_ok=True)
    written = 0
    for dom_key, dom_data in profile.get("domains", {}).items():
        html = build_page(profile, dom_key, dom_data)
        out_path = DEPLOY_DIR / f"{slug(dom_key)}.html"
        out_path.write_text(html)
        written += 1
    print(f"Wrote {written} subject pages to {DEPLOY_DIR}/")


if __name__ == "__main__":
    main()
