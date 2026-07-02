#!/usr/bin/env python3
"""Build a combined co-op syllabus PDF from per-subject markdown files.

Reads every `output/syllabus/*.md` (one per subject, assembled by the
homa-track-syllabus workflow) and renders them into a single styled,
print-ready PDF — one subject per page-break, CM-flavored.

Uses reportlab (the workspace's proven PDF toolchain — same as the
art-supply-labels / chompsaw-patterns builders). Parses a practical
markdown subset: # / ## / ### headings, GFM tables, - bullets, and
paragraphs with **bold** / *italic*.

Usage:
    python3 build-syllabus-pdf.py [--term "Fall 2026"] [--src DIR] [--out PATH]
"""
import argparse
import html
import pathlib
import re
import sys

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                    TableStyle, PageBreak, ListFlowable, ListItem)
except ImportError as e:
    sys.exit(f"Missing dependency: {e}. Need `reportlab` (already in this env).")

WORKSPACE = pathlib.Path.home() / ".openclaw" / "workspace"

GREEN = colors.HexColor("#3a5a40")
GREEN2 = colors.HexColor("#588157")
SAGE = colors.HexColor("#a3b18a")
HEADBG = colors.HexColor("#eaf0e4")


def styles():
    ss = getSampleStyleSheet()
    out = {
        "h1": ParagraphStyle("h1", parent=ss["Heading1"], fontName="Helvetica-Bold",
                             fontSize=20, textColor=GREEN, spaceAfter=8, spaceBefore=4),
        "h2": ParagraphStyle("h2", parent=ss["Heading2"], fontName="Helvetica-Bold",
                             fontSize=14, textColor=GREEN2, spaceBefore=12, spaceAfter=4),
        "h3": ParagraphStyle("h3", parent=ss["Heading3"], fontName="Helvetica-Bold",
                             fontSize=11.5, textColor=colors.HexColor("#6a6a6a"),
                             spaceBefore=8, spaceAfter=2),
        "body": ParagraphStyle("body", parent=ss["BodyText"], fontName="Helvetica",
                               fontSize=10.5, leading=15, spaceAfter=4),
        "cell": ParagraphStyle("cell", parent=ss["BodyText"], fontName="Helvetica",
                               fontSize=8.5, leading=11),
        "cellh": ParagraphStyle("cellh", parent=ss["BodyText"], fontName="Helvetica-Bold",
                                fontSize=8.5, leading=11),
    }
    return out


def inline(text):
    """Minimal inline markdown → reportlab markup."""
    text = html.escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", text)
    text = re.sub(r"`(.+?)`", r"<font face='Courier'>\1</font>", text)
    return text


def inline_break(text):
    """Like inline() but preserves intended <br/> separators."""
    parts = text.split("<br/>")
    return "<br/>".join(inline(p) for p in parts)


def parse_table(lines, st):
    rows = []
    for ln in lines:
        cells = [c.strip() for c in ln.strip().strip("|").split("|")]
        rows.append(cells)
    # drop the |---|---| separator row
    rows = [r for r in rows if not all(re.fullmatch(r":?-+:?", c or "-") for c in r)]
    if not rows:
        return None
    data = []
    for i, r in enumerate(rows):
        style = st["cellh"] if i == 0 else st["cell"]
        data.append([Paragraph(inline(c), style) for c in r])
    ncol = max(len(r) for r in data)
    for r in data:
        while len(r) < ncol:
            r.append(Paragraph("", st["cell"]))
    avail = letter[0] - 2 * inch
    t = Table(data, colWidths=[avail / ncol] * ncol, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEADBG),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def md_to_flow(md, st):
    flow = []
    lines = md.splitlines()
    i = 0
    bullets = []
    para = []  # coalesce consecutive plain-text lines into one paragraph

    def flush_bullets():
        nonlocal bullets
        if bullets:
            items = [ListItem(Paragraph(inline(b), st["body"]), leftIndent=10) for b in bullets]
            flow.append(ListFlowable(items, bulletType="bullet", start="•",
                                     bulletColor=GREEN2, leftIndent=14))
            bullets = []

    def flush_para():
        nonlocal para
        if para:
            # honor explicit hard breaks (two trailing spaces) else join with a space
            text = ""
            for j, p in enumerate(para):
                text += p["t"]
                if j < len(para) - 1:
                    text += "<br/>" if p["br"] else " "
            flow.append(Paragraph(inline_break(text), st["body"]))
            para = []

    def flush():
        flush_bullets(); flush_para()

    while i < len(lines):
        ln = lines[i]
        s = ln.strip()
        if not s:
            flush()
            i += 1
            continue
        if s.startswith("### "):
            flush(); h = Paragraph(inline(s[4:]), st["h3"]); h.keepWithNext = True; flow.append(h)
        elif s.startswith("## "):
            flush(); h = Paragraph(inline(s[3:]), st["h2"]); h.keepWithNext = True; flow.append(h)
        elif s.startswith("# "):
            flush(); flow.append(Paragraph(inline(s[2:]), st["h1"]))
            flow.append(Spacer(1, 2))
        elif s.startswith("|") and "|" in s[1:]:
            flush()
            tbl_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                tbl_lines.append(lines[i]); i += 1
            t = parse_table(tbl_lines, st)
            if t:
                flow.append(t); flow.append(Spacer(1, 4))
            continue
        elif s.startswith("- ") or s.startswith("* "):
            flush_para(); bullets.append(s[2:])
        else:
            flush_bullets()
            para.append({"t": s, "br": ln.endswith("  ")})
        i += 1
    flush()
    return flow


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--term", default="Fall 2026")
    ap.add_argument("--src", default=str(WORKSPACE / "content" / "curriculum" / "co-op" / "syllabus"))
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    src = pathlib.Path(args.src)
    if not src.is_dir():
        sys.exit(f"No source dir: {src}. Assemble per-subject .md files there first.")
    mds = sorted(p for p in src.glob("*.md"))
    if not mds:
        sys.exit(f"No *.md files in {src}. Nothing to build.")

    term_slug = re.sub(r"[^a-z0-9]+", "-", args.term.lower()).strip("-")
    out = pathlib.Path(args.out) if args.out else src / f"coop-syllabus-{term_slug}.pdf"
    out.parent.mkdir(parents=True, exist_ok=True)

    st = styles()
    story = []
    for idx, md in enumerate(mds):
        if idx:
            story.append(PageBreak())
        story.extend(md_to_flow(md.read_text(), st))

    doc = SimpleDocTemplate(str(out), pagesize=letter,
                            topMargin=1 * inch, bottomMargin=1 * inch,
                            leftMargin=1 * inch, rightMargin=1 * inch,
                            title=f"Charlotte Mason Co-op Syllabus — {args.term}")
    doc.build(story)
    print(f"✅ Built {out} from {len(mds)} subject file(s): "
          f"{', '.join(m.stem for m in mds)}")


if __name__ == "__main__":
    main()
