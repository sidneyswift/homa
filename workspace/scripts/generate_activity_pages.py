#!/usr/bin/env python3
"""
Generate per-(domain, subdomain) activity HTML pages for the Vercel-deployed dashboard.

For each subdomain in children/*.json:
  - If ~/.openclaw/workspace/activities/{domain}__{subdomain}.json exists → render rich activity page
  - Otherwise → render placeholder page with a copyable "draft this for me, Homa" prompt

Output:
  - dashboard-deploy/{domain-slug}/{subdomain-slug}.html

The flat URL pattern is /social-emotional/self-regulation.html etc.

Reads:
  - ~/.openclaw/workspace/children/*.json
  - ~/.openclaw/workspace/activities/*.json

Writes:
  - ~/.openclaw/workspace/dashboard-deploy/{domain-slug}/{subdomain-slug}.html

Idempotent. Run by regenerate_vault.py before deploy_dashboard.py.
"""

import json
import datetime
import pathlib

CHILDREN_DIR = pathlib.Path.home() / ".openclaw" / "workspace" / "children"


def load_first_child():
    """Load the first child profile. Multi-child dashboard views coming in a future update."""
    for f in sorted(CHILDREN_DIR.glob("*.json")):
        if f.name.startswith("_"):
            continue
        try:
            return json.loads(f.read_text())
        except (json.JSONDecodeError, OSError):
            continue
    return None


def load_all_children():
    """Load all child profiles."""
    children = []
    for f in sorted(CHILDREN_DIR.glob("*.json")):
        if f.name.startswith("_"):
            continue
        try:
            children.append(json.loads(f.read_text()))
        except (json.JSONDecodeError, OSError):
            continue
    return children
ACTIVITIES_DIR = pathlib.Path.home() / ".openclaw" / "workspace" / "activities"
DEPLOY_DIR = pathlib.Path.home() / ".openclaw" / "workspace" / "dashboard-deploy"

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

POSITION_LABEL = {
    "24mo_ahead": "🚀 24mo+ ahead",
    "12mo_ahead": "✨ 12mo+ ahead",
    "at_age": "✅ At age",
    "below_age": "⚠️ Below age",
    "unknown": "❓ Not yet observed",
    "unknown_pending_measurement": "❓ Not yet observed",
    "n/a": "— Not age-banded",
}


def domain_slug(d): return d.replace("_", "-")
def subdomain_slug(s): return s.replace("_", "-")


def friendly_subdomain(sub_key):
    return sub_key.replace("_", " ").title()


def activity_path(domain_key, subdomain_key):
    return ACTIVITIES_DIR / f"{domain_key}__{subdomain_key}.json"


def render_rich_page(profile, domain_key, subdomain_key, sub_data, activity):
    name = DOMAIN_DISPLAY.get(domain_key, domain_key)
    color = DOMAIN_COLORS.get(domain_key, "#6366f1")
    sub_name = friendly_subdomain(subdomain_key)
    today = datetime.date.today()

    instructions_html = "\n".join(
        f'<li><span class="step-num">{i + 1}</span>{step}</li>'
        for i, step in enumerate(activity.get("instructions", []))
    )
    what_you_need_html = "".join(
        f"<li>{item}</li>" for item in activity.get("what_you_need", [])
    )
    research_html = ""
    research = activity.get("research_basis", [])
    if research:
        items = "".join(f"<li>{r}</li>" for r in research)
        research_html = f'<details class="research-details"><summary>📚 Research basis ({len(research)})</summary><ul>{items}</ul></details>'

    next_activity = activity.get("next_activity", "")
    next_html = ""
    if next_activity:
        next_html = f"""<section class="card next-card">
  <h2>🎓 What's after this</h2>
  <p>{next_activity}</p>
  <p class="next-meta">Homa will swap this activity for the next one when the child graduates from this one (see "When you'll know it's working" above).</p>
</section>"""

    duration = activity.get("duration_minutes", 10)
    frequency = activity.get("frequency", "3x per week")
    title = activity.get("title", f"Activity for {sub_name}")
    impact = activity.get("expected_impact", "")
    why = activity.get("why_this_works", "")
    how_to_know = activity.get("how_to_know_its_working", "")
    graduate = activity.get("graduate_when", "")
    generated = activity.get("generated_date", "")
    regen_after = activity.get("regenerate_after", "")

    # Pre-build optional sections (avoid backslashes inside f-string expressions)
    impact_section = f'<div class="impact"><strong>Why do this?</strong> {impact}</div>' if impact else ''
    why_section = f'<section class="card why"><h2>💡 Why this works</h2><p>{why}</p></section>' if why else ''
    working_label = "👀 How you&apos;ll know it&apos;s working"
    working_section = f'<section class="card working"><h2>{working_label}</h2><p>{how_to_know}</p></section>' if how_to_know else ''
    grad_section = f'<section class="card grad"><h2>🎯 When to graduate</h2><p>{graduate}</p></section>' if graduate else ''

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} · {sub_name} · {name}</title>
<style>
:root {{
  --bg: #fafaf9; --card: #ffffff; --text: #1c1917;
  --text-dim: #57534e; --border: #e7e5e4;
  --accent: {color};
}}
* {{ box-sizing: border-box; }}
body {{
  margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  background: var(--bg); color: var(--text); line-height: 1.55;
  padding: 16px; max-width: 740px; margin: 0 auto;
}}
.breadcrumb {{
  font-size: 0.85rem; color: var(--text-dim); margin-bottom: 12px;
}}
.breadcrumb a {{ color: var(--text-dim); text-decoration: none; }}
.breadcrumb a:hover {{ color: var(--accent); }}
header {{
  margin-bottom: 24px; padding-bottom: 18px;
  border-bottom: 3px solid var(--accent);
}}
h1 {{
  margin: 0 0 6px 0; font-size: 1.6rem;
  letter-spacing: -0.02em; color: var(--text);
}}
.subtitle {{
  display: flex; gap: 10px; flex-wrap: wrap;
  align-items: center; color: var(--text-dim);
  font-size: 0.9rem; margin-top: 8px;
}}
.subtitle .pill {{
  background: var(--accent); color: white;
  padding: 3px 10px; border-radius: 999px;
  font-size: 0.78rem; font-weight: 600;
}}
.subtitle .duration {{
  font-weight: 600; color: var(--text);
}}
.impact {{
  margin: 14px 0 0 0; padding: 10px 14px;
  background: #ecfdf5; border-left: 3px solid #10b981;
  border-radius: 4px; font-size: 0.92rem; line-height: 1.5;
}}
.impact strong {{ color: #047857; }}
.card {{
  background: var(--card); border: 1px solid var(--border); border-radius: 12px;
  padding: 18px 20px; margin-bottom: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}}
.card h2 {{
  margin: 0 0 14px 0; font-size: 0.92rem; font-weight: 600;
  color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.04em;
}}
.what-you-need ul {{
  margin: 0; padding-left: 20px; font-size: 0.95rem;
}}
.what-you-need li {{ margin-bottom: 4px; }}
.instructions {{
  list-style: none; padding: 0; margin: 0;
}}
.instructions li {{
  display: flex; gap: 12px; align-items: flex-start;
  padding: 12px 0; border-bottom: 1px solid var(--border);
  font-size: 0.96rem;
}}
.instructions li:last-child {{ border-bottom: none; }}
.step-num {{
  flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 50%;
  background: var(--accent); color: white; font-weight: 700; font-size: 0.85rem;
}}
.why p, .working p, .grad p {{
  margin: 0; font-size: 0.95rem; line-height: 1.6;
}}
.next-card {{
  background: #fef3c7; border-color: #f59e0b;
}}
.next-card h2 {{ color: #92400e; }}
.next-meta {{
  font-size: 0.82rem; color: var(--text-dim); font-style: italic; margin-top: 8px !important;
}}
.research-details {{
  margin-top: 12px; font-size: 0.88rem;
}}
.research-details summary {{
  cursor: pointer; color: var(--text-dim); padding: 6px 0;
}}
.research-details ul {{
  margin: 6px 0 0 0; padding-left: 20px;
}}
.research-details li {{ color: var(--text-dim); margin-bottom: 3px; }}
footer {{
  margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border);
  color: var(--text-dim); font-size: 0.82rem;
}}
@media (max-width: 480px) {{
  body {{ padding: 12px; }}
  h1 {{ font-size: 1.3rem; }}
  .card {{ padding: 14px 16px; }}
  .step-num {{ width: 22px; height: 22px; font-size: 0.78rem; }}
}}
</style>
</head>
<body>

<div class="breadcrumb">
  <a href="/">Dashboard</a> · <a href="/{domain_slug(domain_key)}.html">{name}</a> · {sub_name}
</div>

<header>
  <h1>{title}</h1>
  <div class="subtitle">
    <span class="pill">{name}</span>
    <span class="duration">⏱ {duration} min</span>
    <span>·</span>
    <span>{frequency}</span>
  </div>
  {impact_section}
</header>

<section class="card what-you-need">
  <h2>🧰 What you'll need</h2>
  <ul>{what_you_need_html}</ul>
</section>

<section class="card">
  <h2>📋 Step by step</h2>
  <ol class="instructions">{instructions_html}</ol>
</section>

{why_section}

{working_section}

{grad_section}

{next_html}

{research_html}

<footer>
  Generated {generated or "—"} · Refresh due {regen_after or "—"} · <a href="/{domain_slug(domain_key)}.html">← Back to {name}</a>
</footer>

</body>
</html>
"""


def render_placeholder_page(profile, domain_key, subdomain_key, sub_data):
    """Render a placeholder page with a copyable Homa-prompt to draft this activity."""
    name = DOMAIN_DISPLAY.get(domain_key, domain_key)
    color = DOMAIN_COLORS.get(domain_key, "#6366f1")
    sub_name = friendly_subdomain(subdomain_key)
    pos = sub_data.get("story_position", "unknown")
    pos_label = POSITION_LABEL.get(pos, pos)
    current = sub_data.get("current") or "Not yet observed."

    # Build the Homa prompt
    if pos in ("unknown", "unknown_pending_measurement"):
        target_phrase = "first observe him on this so we know where he's at, then suggest the activity"
    elif pos == "below_age":
        target_phrase = "help close the gap to at-age"
    elif pos == "at_age":
        target_phrase = "push him from at-age to 12mo+ ahead"
    elif pos == "12mo_ahead":
        target_phrase = "push him from 12mo+ to 24mo+ ahead"
    elif pos == "24mo_ahead":
        target_phrase = "extend the lead toward stretch goals"
    else:
        target_phrase = "match his current level"

    prompt = (
        f"Hey Homa, draft a 10-minute activity the parent can do with the child for "
        f"{sub_name} (under {name}). His current level: {current.rstrip('.')}. "
        f"The goal is to {target_phrase}. Make it specific, fun, and follow the activity schema "
        f"in ~/.openclaw/workspace/activities/README.md. Save it as "
        f"~/.openclaw/workspace/activities/{domain_key}__{subdomain_key}.json."
    )
    js_safe = prompt.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\"", "&quot;")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{sub_name} · {name} · Activity (not drafted yet)</title>
<style>
:root {{
  --bg: #fafaf9; --card: #ffffff; --text: #1c1917;
  --text-dim: #57534e; --border: #e7e5e4;
  --accent: {color};
}}
* {{ box-sizing: border-box; }}
body {{
  margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  background: var(--bg); color: var(--text); line-height: 1.55;
  padding: 16px; max-width: 700px; margin: 0 auto;
}}
.breadcrumb {{
  font-size: 0.85rem; color: var(--text-dim); margin-bottom: 12px;
}}
.breadcrumb a {{ color: var(--text-dim); text-decoration: none; }}
.breadcrumb a:hover {{ color: var(--accent); }}
header {{
  margin-bottom: 24px; padding-bottom: 18px;
  border-bottom: 3px solid var(--accent);
}}
h1 {{
  margin: 0 0 6px 0; font-size: 1.5rem;
  letter-spacing: -0.02em; color: var(--text);
}}
.subtitle {{
  display: flex; gap: 10px; flex-wrap: wrap;
  align-items: center; color: var(--text-dim);
  font-size: 0.9rem; margin-top: 8px;
}}
.subtitle .pill {{
  background: var(--accent); color: white;
  padding: 3px 10px; border-radius: 999px;
  font-size: 0.78rem; font-weight: 600;
}}
.card {{
  background: var(--card); border: 1px solid var(--border); border-radius: 12px;
  padding: 18px 20px; margin-bottom: 14px;
}}
.card.draft-card {{
  border-left: 3px solid #6366f1; background: #eef2ff;
}}
.card.draft-card h2 {{ color: #4338ca; margin: 0 0 10px 0; font-size: 1rem; }}
.card.draft-card p {{ font-size: 0.93rem; line-height: 1.55; margin: 0 0 12px 0; }}
.prompt-box {{
  background: white; border: 1px solid #c7d2fe; border-radius: 6px;
  padding: 12px; margin-bottom: 12px;
  font-size: 0.86rem; line-height: 1.5; color: #312e81;
  user-select: all; -webkit-user-select: all;
}}
.copy-btn {{
  background: #6366f1; color: white; border: none; border-radius: 6px;
  padding: 11px 18px; font-size: 0.92rem; font-weight: 600;
  cursor: pointer; transition: background 0.15s ease;
  width: 100%; max-width: 340px;
}}
.copy-btn:hover {{ background: #4f46e5; }}
.copy-btn:active {{ background: #4338ca; }}
.context {{
  font-size: 0.92rem; line-height: 1.6;
}}
.context strong {{ color: var(--text); }}
.position-badge {{
  display: inline-block;
  padding: 3px 10px; border-radius: 999px;
  background: #f1f5f9; color: var(--text-dim);
  font-size: 0.82rem; font-weight: 600;
}}
footer {{
  margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border);
  color: var(--text-dim); font-size: 0.82rem;
}}
</style>
</head>
<body>

<div class="breadcrumb">
  <a href="/">Dashboard</a> · <a href="/{domain_slug(domain_key)}.html">{name}</a> · {sub_name}
</div>

<header>
  <h1>{sub_name} · activity not drafted yet</h1>
  <div class="subtitle">
    <span class="pill">{name}</span>
    <span class="position-badge">{pos_label}</span>
  </div>
</header>

<section class="card">
  <h2>📍 Right now</h2>
  <div class="context">{current}</div>
</section>

<section class="card draft-card">
  <h2>📝 Ask Homa to draft this activity</h2>
  <p>Tap the button to copy a prompt. Paste it into your Slack chat with Homa (the main channel). She'll draft a research-backed 10-minute activity tailored to where Story is right now. Once she saves it, this page will refresh with the activity.</p>
  <div class="prompt-box">{prompt}</div>
  <button class="copy-btn" onclick="navigator.clipboard.writeText('{js_safe}').then(() => {{ this.innerText = '✓ Copied — paste to Homa in Slack'; setTimeout(() => this.innerText = '📋 Copy prompt for Homa', 2500); }})">📋 Copy prompt for Homa</button>
</section>

<footer>
  Page auto-generated. When the activity exists at <code>~/.openclaw/workspace/activities/{domain_key}__{subdomain_key}.json</code>, this page will render the activity instead. · <a href="/{domain_slug(domain_key)}.html">← Back to {name}</a>
</footer>

</body>
</html>
"""


def main():
    profile = load_first_child()
    written = 0
    rich = 0
    placeholders = 0
    for domain_key, dom_data in profile.get("domains", {}).items():
        # Create the domain subfolder
        sub_dir = DEPLOY_DIR / domain_slug(domain_key)
        sub_dir.mkdir(parents=True, exist_ok=True)
        for subdomain_key, sub_data in dom_data.get("subdomains", {}).items():
            ap = activity_path(domain_key, subdomain_key)
            if ap.exists():
                try:
                    activity = json.loads(ap.read_text())
                    html = render_rich_page(profile, domain_key, subdomain_key, sub_data, activity)
                    rich += 1
                except Exception as e:
                    print(f"  ⚠️  Failed to parse {ap.name}: {e} — falling back to placeholder")
                    html = render_placeholder_page(profile, domain_key, subdomain_key, sub_data)
                    placeholders += 1
            else:
                html = render_placeholder_page(profile, domain_key, subdomain_key, sub_data)
                placeholders += 1
            out = sub_dir / f"{subdomain_slug(subdomain_key)}.html"
            out.write_text(html)
            written += 1
    print(f"Wrote {written} activity pages ({rich} rich, {placeholders} placeholder)")


if __name__ == "__main__":
    main()
