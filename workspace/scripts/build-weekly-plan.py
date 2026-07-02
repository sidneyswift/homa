#!/usr/bin/env python3
"""
build-weekly-plan.py — emit a follow-able Mon–Fri weekly homeschool plan PDF for the parent.

The vehicle that turns story-coach's scoring + proposed interventions into a do-this-this-week
plan the parent can actually follow. Reads the child's children/<child>.json profile: current
levels per domain + the active (proposed, unconsumed) interventions, maps them onto the parent's real
weekly rhythm (Tue–Fri 9–11am school time; Spanish Tue PM, Art Wed, Pool Thu, Gymnastics Fri),
and weaves in time-sensitive opportunities + the day's research findings.

Design notes:
- reportlab (the workspace's proven toolchain — weasyprint's native libs don't load here).
- Phone-friendly single-column layout; the parent reads it on her phone via the PDF.
- Interventions are picked by leverage: prioritize the freshest proposed interventions and the
  domains where the child is at_age (the growth edges), not where he's already months ahead.
- Opportunities + spanish/communicative layer are pulled from a small editable OPPORTUNITIES block
  so the next reflect pass can refresh them without touching layout code.

Usage:
  python3 scripts/build-weekly-plan.py                 # auto week (next Mon), single child
  python3 scripts/build-weekly-plan.py --child NAME    # pick which children/<child>.json
  python3 scripts/build-weekly-plan.py --week 2026-06-29
  python3 scripts/build-weekly-plan.py --out content/curriculum/weekly-plans/2026-06-29.pdf
"""
import argparse
import datetime as dt
import json
import os
import sys
import textwrap

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHILDREN_DIR = os.path.join(ROOT, "children")
FONTS = os.path.join(ROOT, "fonts")

# the parent's real weekly rhythm (USER.md). School time Tue–Fri 9–11am; Mon open.
SCHEDULE = {
    "Monday":    {"theme": "Open / catch-up", "anchor": "No co-op (off until fall 2026) — flex day or rest"},
    "Tuesday":   {"theme": "Spanish", "anchor": "School 9–11am · Spanish tutor (Care.com) in the afternoon"},
    "Wednesday": {"theme": "Art", "anchor": "School 9–11am · Art focus"},
    "Thursday":  {"theme": "Pool / Science", "anchor": "School 9–11am · Pool day"},
    "Friday":    {"theme": "Gross motor", "anchor": "School 9–11am · Gymnastics"},
}
DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

# Editable layer — reflect refreshes these from research-journal each pass. Keep short.
# (Cited so the plan never drifts into generic best-practice.)
OPPORTUNITIES = [
    "DCPL Discover Summer 2026 — Beanstack reading bingo (he reads 10–20 books/day; prize: Nationals tickets). Free.",
    "Kenilworth Aquatic Gardens — lotus peaks all July; live frogs + dragonflies (feeds his frog-life-cycle interest). Free.",
    "U.S. Botanic Garden Butterfly Garden — free, no tickets, callback to the butterfly release.",
]
# A standing parent-facing note, refreshed by reflect when the dominant Spanish lever changes.
SPANISH_LAYER = ("Spanish this week: keep adding communicative phrases in daily family use "
                 "('pásame la pelota', 'es hora de comer', 'recoge tus juguetes') — the child is label-rich "
                 "but his real gap is following connected speech. Phrases > flash cards.")


def resolve_child(name):
    """Resolve the child profile path from a --child NAME.

    - If name given: use children/<name>.json.
    - If omitted and exactly ONE children/*.json exists (ignoring _-prefixed like
      _schema.json): use it.
    - If omitted and multiple exist: error listing the choices.
    Returns (path, error_msg). On error, path is None.
    """
    import glob
    if name:
        return os.path.join(CHILDREN_DIR, f"{name}.json"), None
    children = sorted(
        p for p in glob.glob(os.path.join(CHILDREN_DIR, "*.json"))
        if not os.path.basename(p).startswith("_")
    )
    if len(children) == 1:
        return children[0], None
    if not children:
        return None, f"No children/*.json profiles found in {CHILDREN_DIR}"
    choices = ", ".join(os.path.splitext(os.path.basename(p))[0] for p in children)
    return None, f"Multiple children found — pass --child NAME. Choices: {choices}"


def load_profile(profile_path):
    with open(profile_path) as f:
        return json.load(f)


def register_fonts():
    """Use Quicksand if present, else default Helvetica."""
    try:
        pdfmetrics.registerFont(TTFont("Body", os.path.join(FONTS, "Quicksand.ttf")))
        pdfmetrics.registerFont(TTFont("Head", os.path.join(FONTS, "FredokaOne-Regular.ttf")))
        return "Body", "Head"
    except Exception:
        return "Helvetica", "Helvetica-Bold"


def next_monday(ref=None):
    ref = ref or dt.date.today()
    # If today is the Mon-of run (Sat/Sun reflect), aim for the upcoming Mon.
    days = (0 - ref.weekday()) % 7
    if days == 0 and ref.weekday() != 0:
        days = 7
    # On Sat(5)/Sun(6) the upcoming Monday is 2/1 days out — handled by %7.
    return ref + dt.timedelta(days=days)


def pick_interventions(profile, n=5):
    """Pick the highest-leverage proposed interventions: newest first, and bias toward
    at_age growth edges over already-ahead domains. Returns list of dicts."""
    acts = [a for a in profile.get("interventions_active", []) if a.get("status") == "proposed"]
    domains = profile.get("domains", {})

    def edge_score(a):
        dom = domains.get(a["domain"], {})
        sub = dom.get("subdomains", {}).get(a.get("subdomain"), {}) if isinstance(dom, dict) else {}
        pos = sub.get("story_position", "")
        # at_age / behind = growth edge (high), ahead = lower priority for a weekly nudge
        if pos in ("at_age", "emerging", "behind"):
            return 2
        if "ahead" in str(pos):
            return 0
        return 1

    def recency(a):
        try:
            return a.get("proposed_at", "0000-00-00")
        except Exception:
            return "0000-00-00"

    acts.sort(key=lambda a: (edge_score(a), recency(a)), reverse=True)
    # de-dup by domain/subdomain so one week isn't all one area
    seen, picked = set(), []
    for a in acts:
        key = (a["domain"], a.get("subdomain"))
        if key in seen:
            continue
        seen.add(key)
        picked.append(a)
        if len(picked) >= n:
            break
    return picked


def short(intervention, limit=240):
    txt = intervention.get("intervention", "")
    # take the lead clause (before the first em-dash detail dump) + trim
    txt = txt.replace("—", "—")
    if len(txt) > limit:
        txt = txt[:limit].rsplit(" ", 1)[0] + "…"
    return txt


def domain_label(d):
    return d.replace("_", " ").replace("-", " ").title()


def build(profile, week_start, out_path):
    body, head = register_fonts()
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Title"], fontName=head, fontSize=22,
                        textColor=colors.HexColor("#2E5E4E"), spaceAfter=4, leading=26)
    sub = ParagraphStyle("sub", parent=styles["Normal"], fontName=body, fontSize=10,
                         textColor=colors.HexColor("#666666"), spaceAfter=10)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName=head, fontSize=13,
                        textColor=colors.HexColor("#2E5E4E"), spaceBefore=10, spaceAfter=4)
    p = ParagraphStyle("p", parent=styles["Normal"], fontName=body, fontSize=10.5, leading=14,
                       spaceAfter=3)
    daytitle = ParagraphStyle("daytitle", parent=styles["Heading3"], fontName=head, fontSize=12,
                              textColor=colors.HexColor("#C2410C"), spaceAfter=2)
    small = ParagraphStyle("small", parent=styles["Normal"], fontName=body, fontSize=9,
                          textColor=colors.HexColor("#444444"), leading=12)

    doc = SimpleDocTemplate(out_path, pagesize=letter,
                            leftMargin=0.7 * inch, rightMargin=0.7 * inch,
                            topMargin=0.6 * inch, bottomMargin=0.6 * inch)
    flow = []
    wk_end = week_start + dt.timedelta(days=4)
    age = profile.get("age", {})
    flow.append(Paragraph("the child's Week", h1))
    flow.append(Paragraph(
        f"{week_start.strftime('%B %-d')} – {wk_end.strftime('%B %-d, %Y')} &nbsp;·&nbsp; "
        f"the child is {age.get('years','?')}y{age.get('months','?')}m &nbsp;·&nbsp; "
        f"built {dt.date.today().isoformat()} from children/&lt;child&gt;.json", sub))
    flow.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#DDDDDD")))

    # --- This week's focus (the unconsumed interventions, finally delivered) ---
    flow.append(Paragraph("This week's focus", h2))
    flow.append(Paragraph("Small, high-leverage nudges from the child's current profile — woven into what "
                          "you already do. Pick what fits; skip what doesn't.", small))
    picks = pick_interventions(profile, n=5)
    # if a domain appears twice, append the subdomain so labels stay distinct
    from collections import Counter
    dom_counts = Counter(a["domain"] for a in picks)
    rows = []
    for a in picks:
        lbl = domain_label(a["domain"])
        if dom_counts[a["domain"]] > 1 and a.get("subdomain"):
            lbl += f" · {a['subdomain'].replace('_',' ')}"
        rows.append([Paragraph(f"<b>{lbl}</b>", p), Paragraph(short(a), p)])
    if rows:
        t = Table(rows, colWidths=[1.5 * inch, 5.3 * inch])
        t.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW", (0, 0), (-1, -2), 0.4, colors.HexColor("#EEEEEE")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        flow.append(t)
    flow.append(Spacer(1, 6))

    # --- Day by day ---
    flow.append(Paragraph("Day by day", h2))
    for i, day in enumerate(DAY_ORDER):
        d = week_start + dt.timedelta(days=i)
        info = SCHEDULE[day]
        flow.append(Paragraph(f"{day} {d.strftime('%-m/%-d')} — {info['theme']}", daytitle))
        flow.append(Paragraph(info["anchor"], small))
        # attach one focus nudge per day, rotating through picks
        if picks:
            a = picks[i % len(picks)]
            flow.append(Paragraph(f"• {domain_label(a['domain'])}: {short(a, 160)}", p))
        flow.append(Spacer(1, 4))

    # --- Spanish layer ---
    flow.append(Paragraph("Spanish layer", h2))
    flow.append(Paragraph(SPANISH_LAYER, p))

    # --- Out & about (time-sensitive, cited from research) ---
    if OPPORTUNITIES:
        flow.append(Paragraph("Out &amp; about this week", h2))
        for o in OPPORTUNITIES:
            flow.append(Paragraph(f"• {o}", p))

    flow.append(Spacer(1, 8))
    flow.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#DDDDDD")))
    flow.append(Paragraph(
        "Generated by Homa from the child's live profile. Reply with how a block went and it updates "
        "next week's plan. Not a checklist — a menu.", small))

    doc.build(flow)
    return out_path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--child", default=None,
                    help="Which child (children/<child>.json). Optional when exactly one exists.")
    ap.add_argument("--week", help="week-start date YYYY-MM-DD (defaults to upcoming Monday)")
    ap.add_argument("--out", help="output PDF path")
    args = ap.parse_args()

    profile_path, err = resolve_child(args.child)
    if err:
        print(f"❌ {err}")
        sys.exit(1)

    if args.week:
        week_start = dt.date.fromisoformat(args.week)
    else:
        week_start = next_monday()

    out = args.out
    if not out:
        child_slug = os.path.splitext(os.path.basename(profile_path))[0]
        out_dir = os.path.join(ROOT, "content", "curriculum", "weekly-plans")
        os.makedirs(out_dir, exist_ok=True)
        out = os.path.join(out_dir, f"{week_start.isoformat()}-{child_slug}.pdf")
    os.makedirs(os.path.dirname(out), exist_ok=True)

    profile = load_profile(profile_path)
    path = build(profile, week_start, out)
    print(f"weekly plan → {path}")


if __name__ == "__main__":
    main()
