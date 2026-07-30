#!/usr/bin/env python3
"""
ingestion-spreadsheet.py: the ledger as a workbook a founder can actually read.

The CSV is for machines and the CI check; this is for the person deciding
what to re-ingest next. Same data, no second source of truth: it reads
.cosmo/ingestion-ledger.json and nothing else, so it can never disagree with
the ledger.

    python3 .cosmo/scripts/ingestion-ledger.py --refresh
    python3 .cosmo/scripts/ingestion-spreadsheet.py

Sheets:
  Summary    what the corpus holds, and the queue, in one screen
  Drops      one row per Slack drop, filterable, colour-coded by status
  Queue      only what needs doing, so it can be worked top to bottom
"""

import json
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

COSMO = Path(__file__).resolve().parent.parent
LEDGER = COSMO / "ingestion-ledger.json"
OUT = COSMO / "ingestion-ledger.xlsx"

STATUS_FILL = {
    "complete": "C6E0B4",      # green
    "legacy": "FFE699",        # amber: analysed, predates the content rules
    "partial": "F8CBAD",       # orange: a record exists and something is missing
    "not-ingested": "FF9999",  # red: no record at all
    "excluded": "D9D9D9",      # grey: the bot's own output
}

HEADER_FILL = PatternFill("solid", fgColor="2F5233")
HEADER_FONT = Font(color="FFFFFF", bold=True, size=10)

GROUPS = [
    ("Where it came from", ["date", "dropper", "file_name", "file_mb", "file_type",
                            "ship_reaction", "message_note", "slack_ts"]),
    ("What it is", ["status", "record_kind", "what_is_it", "title", "publisher",
                    "grade_level", "record_id", "analysis_quality"]),
    ("Do we still have it", ["original_local", "blob_url", "intake_run", "master_pages",
                             "text_chars", "vision_pages", "rotated_pages", "gate_findings"]),
    ("What we extracted", ["dim_layout", "dim_skills", "dim_difficulty", "dim_theming",
                           "dim_print", "dim_aboutness", "aboutness_claims",
                           "aboutness_roles", "subjects", "entities",
                           "cur_layers", "cur_units"]),
    ("What it changed in Homa", ["subject", "domain", "age_band_months", "topics_mapped",
                                 "topics_unmapped", "recipes_matched", "gap_slugs",
                                 "gaps_recorded", "taste_logged"]),
    ("Is it right", ["verifier", "problems"]),
]

FRIENDLY = {
    "file_mb": "size MB", "ship_reaction": "ship emoji", "message_note": "what they said",
    "slack_ts": "slack id", "record_kind": "record type", "what_is_it": "kind",
    "analysis_quality": "analysis", "original_local": "raw file", "blob_url": "in blob",
    "intake_run": "new intake", "master_pages": "pages", "text_chars": "text chars",
    "vision_pages": "model-read pages", "rotated_pages": "rotated pages",
    "gate_findings": "capture problems", "dim_layout": "layout/L1",
    "dim_skills": "skills/L2", "dim_difficulty": "difficulty/L3",
    "dim_theming": "theming/L4", "dim_print": "print", "dim_aboutness": "aboutness",
    "aboutness_claims": "claims", "aboutness_roles": "roles", "cur_layers": "layers",
    "cur_units": "units", "topics_mapped": "topics mapped",
    "topics_unmapped": "topics missing", "age_band_months": "age (months)",
    "recipes_matched": "recipes", "gap_slugs": "gaps found", "gaps_recorded": "# gaps",
    "taste_logged": "taste", "problems": "what is missing",
}


def style_header(ws, headers, row=1):
    for i, h in enumerate(headers, 1):
        c = ws.cell(row=row, column=i, value=FRIENDLY.get(h, h.replace("_", " ")))
        c.fill, c.font = HEADER_FILL, HEADER_FONT
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)


def autosize(ws, headers, rows, cap=42):
    for i, h in enumerate(headers, 1):
        longest = max([len(FRIENDLY.get(h, h))] +
                      [len(str(r.get(h, ""))) for r in rows[:400]] or [8])
        ws.column_dimensions[get_column_letter(i)].width = min(max(longest + 2, 9), cap)


def build():
    if not LEDGER.exists():
        print(f"ERROR: no ledger at {LEDGER}. Run ingestion-ledger.py first.", file=sys.stderr)
        return 2
    data = json.loads(LEDGER.read_text())
    rows = data["rows"]
    headers = [h for _, cols in GROUPS for h in cols]

    wb = Workbook()

    # ---- Summary -----------------------------------------------------
    ws = wb.active
    ws.title = "Summary"
    counts = {}
    for r in rows:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    real = [r for r in rows if r["status"] != "excluded"]

    ws["A1"] = "Homa ingestion ledger"
    ws["A1"].font = Font(size=16, bold=True)
    ws["A2"] = f"generated {data['generatedAt']}  ·  #homa-inspo  ·  one row per drop, joined on the Slack message id"
    ws["A2"].font = Font(size=10, italic=True, color="666666")

    lines = [
        ("", ""),
        ("Drops in the channel", len(rows)),
        ("  of which are the bot's own output (not drops)", counts.get("excluded", 0)),
        ("Real drops to account for", len(real)),
        ("", ""),
        ("complete: analysed, verified, carries aboutness", counts.get("complete", 0)),
        ("legacy: analysed before the 2026-07-28 content rules", counts.get("legacy", 0)),
        ("partial: a record exists, something required is missing", counts.get("partial", 0)),
        ("NOT INGESTED: no record at all", counts.get("not-ingested", 0)),
        ("", ""),
        ("Pages captured by the new intake", sum(int(r["master_pages"] or 0) for r in rows)),
        ("Pages re-read by a vision model", sum(int(r["vision_pages"] or 0) for r in rows)),
        ("Pages found shot rotated", sum(int(r["rotated_pages"] or 0) for r in rows)),
        ("Aboutness claims recorded", sum(int(r["aboutness_claims"] or 0) for r in rows)),
        ("", ""),
        ("Drops with a ship emoji but NO record", sum(
            1 for r in rows if r["ship_reaction"] and r["status"] == "not-ingested")),
        ("Records whose gaps are untracked in open-gaps.json", sum(
            1 for r in rows if "not in open-gaps" in r["problems"])),
    ]
    for i, (label, value) in enumerate(lines, start=4):
        ws.cell(row=i, column=1, value=label)
        c = ws.cell(row=i, column=2, value=value)
        c.font = Font(bold=True)
        if label.startswith("NOT INGESTED") and value:
            c.fill = PatternFill("solid", fgColor=STATUS_FILL["not-ingested"])
    ws.column_dimensions["A"].width = 56
    ws.column_dimensions["B"].width = 14

    # ---- Drops -------------------------------------------------------
    ws = wb.create_sheet("Drops")
    # group banner above the header row
    col = 1
    for name, cols in GROUPS:
        ws.merge_cells(start_row=1, start_column=col, end_row=1, end_column=col + len(cols) - 1)
        c = ws.cell(row=1, column=col, value=name)
        c.fill = PatternFill("solid", fgColor="8FAF9B")
        c.font = Font(bold=True, size=10)
        c.alignment = Alignment(horizontal="center")
        col += len(cols)
    style_header(ws, headers, row=2)
    for r_i, r in enumerate(rows, start=3):
        fill = PatternFill("solid", fgColor=STATUS_FILL.get(r["status"], "FFFFFF"))
        for c_i, h in enumerate(headers, 1):
            cell = ws.cell(row=r_i, column=c_i, value=r.get(h, ""))
            cell.alignment = Alignment(vertical="top", wrap_text=(h in ("problems", "subjects",
                                                                       "entities", "message_note",
                                                                       "title", "gap_slugs")))
            if h == "status":
                cell.fill = fill
                cell.font = Font(bold=True)
    ws.freeze_panes = "D3"
    ws.auto_filter.ref = f"A2:{get_column_letter(len(headers))}{len(rows) + 2}"
    autosize(ws, headers, rows)

    # ---- Queue -------------------------------------------------------
    ws = wb.create_sheet("Queue")
    queue = [r for r in rows if r["status"] in ("not-ingested", "partial")]
    queue.sort(key=lambda r: (r["status"] != "not-ingested", r["date"]))
    qcols = ["status", "date", "dropper", "file_name", "file_mb", "record_id",
             "ship_reaction", "problems"]
    ws["A1"] = "What still needs doing, most urgent first"
    ws["A1"].font = Font(size=13, bold=True)
    style_header(ws, qcols, row=2)
    for r_i, r in enumerate(queue, start=3):
        for c_i, h in enumerate(qcols, 1):
            cell = ws.cell(row=r_i, column=c_i, value=r.get(h, ""))
            cell.alignment = Alignment(vertical="top", wrap_text=(h == "problems"))
            if h == "status":
                cell.fill = PatternFill("solid", fgColor=STATUS_FILL.get(r["status"], "FFFFFF"))
    ws.freeze_panes = "A3"
    autosize(ws, qcols, queue, cap=70)

    wb.save(OUT)
    print(f"{OUT}  ({len(rows)} drops, {len(queue)} in the queue)")
    return 0


if __name__ == "__main__":
    sys.exit(build())
