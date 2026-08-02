#!/usr/bin/env python3
"""
ingestion-ledger.py: one row per drop, so nothing can go missing quietly.

WHY THIS EXISTS:
On 2026-07-29 an audit of this channel matched drops by FILENAME text instead
of by Slack message ts. The record was titled "Social Studies: All Together"
and the file was "Social Studies All together", so three fully analysed books
read as un-ingested, three duplicate records got written, and four taste
signals were credited to the wrong founder. Every one of those errors is a
join done by hand, badly. This script does the join once, correctly, and
keeps the answer.

It is also the thing that has to survive scale. Hundreds of books are coming,
and "did we ingest that one" cannot be a question answered by grepping.

IDENTITY IS THE SLACK MESSAGE TS. Never the filename, never the title. A file
can be re-uploaded under a new name, two books can share a title, and a book
can arrive in parts under one message. The ts is the only stable key.

TWO MODES, on purpose:

    --refresh    pulls the channel from Slack and rewrites the snapshot.
                 Needs SLACK_BOT_TOKEN. Run it locally or from Cosmo.
    --check      validates records against the committed snapshot and exits
                 non-zero on a regression. Needs no network and no token, so
                 CI can run it.

    (default)    writes the ledger to .cosmo/ingestion-ledger.{json,csv}

A row's `status` is the roll-up a human reads:

    complete      analysed, verifier-green, and carrying dimension F
    legacy        analysed before the 2026-07-28 content rules; no aboutness
                  expected, but a re-ingest would add it
    partial       a record exists and something required is missing
    not-ingested  a drop with no record at all: the queue

Nothing here judges quality. It reports what exists, and the verifier decides
whether what exists is correct.
"""

import argparse
import csv
import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

COSMO = Path(__file__).resolve().parent.parent
REPO = COSMO.parent
REFS_DIR = COSMO / "references"
CURS_DIR = COSMO / "curriculums"
TEXT_DIR = COSMO / "text"
MASTERS_DIR = COSMO / "masters"
INSPO_FILES = COSMO / "inspo-files"
INSPO_IMAGES = COSMO / "inspo-images"
TASTE_MD = COSMO / "homa-taste.md"
OPEN_GAPS = COSMO / "open-gaps.json"

SNAPSHOT = COSMO / "inspo-snapshot.json"
LEDGER_JSON = COSMO / "ingestion-ledger.json"
LEDGER_CSV = COSMO / "ingestion-ledger.csv"

CHANNEL = "C0BHQDC033M"

# Drops before this date predate the aboutness and Layer 5 rules
# (verify-ingestion.py CONTENT_RULES_FROM). They are "legacy", not "broken".
CONTENT_RULES_FROM = "2026-07-28"

COLUMNS = [
    # identity
    "slack_ts", "date", "dropper", "file_name", "file_mb", "file_type",
    "message_note", "ship_reaction",
    # record
    "status", "record_id", "record_kind", "what_is_it", "title", "publisher",
    "grade_level", "analysis_quality",
    # capture, the new engine
    "original_local", "blob_url", "intake_run", "master_pages", "text_chars",
    "vision_pages", "rotated_pages", "gate_findings",
    # analysis dimensions
    "dim_layout", "dim_skills", "dim_difficulty", "dim_theming", "dim_print",
    "dim_aboutness", "aboutness_claims", "aboutness_roles", "subjects",
    "entities", "cur_layers", "cur_units",
    # product graduation
    "subject", "domain", "topics_mapped", "topics_unmapped", "age_band_months",
    "recipes_matched", "gap_slugs", "gaps_recorded", "taste_logged",
    "graduation_kind", "graduation_shipped",
    # validation
    "verifier", "problems",
]


def slack_api(method, token, **params):
    url = f"https://slack.com/api/{method}?" + urllib.parse.urlencode(params)
    out = subprocess.run(
        ["curl", "-s", "-H", f"Authorization: Bearer {token}", url],
        capture_output=True, text=True, timeout=90,
    )
    return json.loads(out.stdout or "{}")


def refresh_snapshot() -> int:
    """Pull the channel and rewrite the committed snapshot."""
    token = os.environ.get("SLACK_BOT_TOKEN")
    if not token:
        for env in (REPO / ".cosmo" / ".env", REPO / ".env"):
            if env.exists():
                for line in env.read_text().splitlines():
                    if line.startswith("SLACK_BOT_TOKEN="):
                        token = line.split("=", 1)[1].strip().strip('"')
    if not token:
        print("ERROR: no SLACK_BOT_TOKEN. --refresh needs it; --check does not.",
              file=sys.stderr)
        return 2

    messages, cursor = [], None
    while True:
        kw = dict(channel=CHANNEL, limit=200)
        if cursor:
            kw["cursor"] = cursor
        data = slack_api("conversations.history", token, **kw)
        if not data.get("ok"):
            print(f"ERROR: slack said {data.get('error')}", file=sys.stderr)
            return 2
        messages += data.get("messages", [])
        cursor = (data.get("response_metadata") or {}).get("next_cursor")
        if not cursor:
            break
        time.sleep(1.2)

    # A file dropped in a thread is still a drop.
    for parent in list(messages):
        if parent.get("reply_count"):
            replies = slack_api("conversations.replies", token,
                                channel=CHANNEL, ts=parent["ts"], limit=200)
            for reply in replies.get("messages", [])[1:]:
                if reply.get("files"):
                    messages.append(reply)
            time.sleep(1.2)

    users = {}
    people = slack_api("users.list", token)
    for u in people.get("members", []):
        users[u["id"]] = (u.get("profile", {}).get("display_name")
                          or u.get("real_name") or u.get("name") or u["id"])

    drops = []
    for m in messages:
        if not m.get("files"):
            continue
        drops.append({
            "ts": m["ts"],
            "user": users.get(m.get("user"), m.get("user", "unknown")),
            "text": (m.get("text") or "").replace("\n", " ")[:300],
            "ship": any(r.get("name") == "ship" for r in (m.get("reactions") or [])),
            "files": [{"name": f.get("name"), "size": f.get("size", 0),
                       "type": f.get("filetype")} for f in m["files"]],
        })
    drops.sort(key=lambda d: float(d["ts"]))
    SNAPSHOT.write_text(json.dumps(
        {"channel": CHANNEL,
         "refreshedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
         "drops": drops}, indent=2) + "\n")
    print(f"snapshot: {len(drops)} drop(s), "
          f"{sum(len(d['files']) for d in drops)} file(s) -> {SNAPSHOT}")
    return 0


def load_records() -> list:
    out = []
    for path in sorted(REFS_DIR.glob("ref-*.json")) + sorted(CURS_DIR.glob("cur-*.json")):
        try:
            out.append((path, json.loads(path.read_text())))
        except (json.JSONDecodeError, OSError):
            out.append((path, None))
    return out


def ts_key(value) -> str:
    """Slack ts values drift in precision between fields. Compare on seconds."""
    return str(value or "").split(".")[0]


def index_records(records) -> dict:
    """Slack ts (seconds) -> record. The ONLY correct join key."""
    by_ts = {}
    for path, rec in records:
        if not rec:
            continue
        keys = set()
        # EXPLICIT fields only. A first pass scanned the whole record for
        # ts-shaped tokens to catch multi-message coverage, and that
        # over-matched: a ts quoted inside a prose note made two records look
        # like duplicates of one drop. A join key has to be declared, never
        # inferred from prose.
        for field in ("sourceMessageTs", "priorFailedDropTs"):
            if rec.get(field):
                keys.add(ts_key(rec[field]))
        # A book dropped in parts declares every message it covers.
        for extra in (rec.get("coversMessageTs") or []):
            keys.add(ts_key(extra))
        for k in keys:
            by_ts.setdefault(k, []).append((path, rec))
    return by_ts


def taste_blob() -> str:
    return TASTE_MD.read_text() if TASTE_MD.exists() else ""


def open_gap_slugs() -> set:
    if not OPEN_GAPS.exists():
        return set()
    try:
        return {g["slug"] for g in json.loads(OPEN_GAPS.read_text()).get("gaps", [])}
    except (json.JSONDecodeError, KeyError, TypeError):
        return set()


def describe_kind(rec) -> str:
    """What the thing IS, in the founder's words, not the record's filename."""
    if not rec:
        return ""
    if str(rec.get("id", "")).startswith("cur-"):
        return "curriculum"
    fmt = (rec.get("format") or "").lower()
    for needle, label in (("workbook", "workbook"), ("worksheet", "worksheet"),
                          ("book", "book"), ("card", "flash cards"),
                          ("poster", "poster"), ("activity", "activity book"),
                          ("guide", "teacher guide"), ("reader", "reader")):
        if needle in fmt:
            return label
    return fmt or "reference"


def run_verifier(item_id: str) -> tuple:
    try:
        done = subprocess.run(
            [sys.executable, str(COSMO / "scripts" / "verify-ingestion.py"),
             item_id, "--no-fetch"],
            capture_output=True, text=True, timeout=180, cwd=REPO, check=False,
        )
    except (subprocess.TimeoutExpired, OSError):
        return "unknown", ""
    if "PREFLIGHT FAILED" in done.stdout:
        return "unknown (stale checkout)", ""
    failed = re.findall(r"❌ ([^:]+):", done.stdout)
    return ("pass" if done.returncode == 0 else "FAIL"), "; ".join(failed)


def build_rows(verify: bool) -> list:
    if not SNAPSHOT.exists():
        print(f"ERROR: no snapshot at {SNAPSHOT}. Run --refresh first.", file=sys.stderr)
        sys.exit(2)
    snap = json.loads(SNAPSHOT.read_text())
    by_ts = index_records(load_records())
    taste = taste_blob()
    gaps_open = open_gap_slugs()

    rows = []
    for drop in snap["drops"]:
        ts = drop["ts"]
        # Cosmo posts its own generated demos into this channel. They are
        # output, not inbound reference material, and counting them as
        # un-ingested drops would put permanent noise in the queue.
        if (drop.get("user") or "").lower() == "cosmo":
            row = {c: "" for c in COLUMNS}
            row.update({
                "slack_ts": ts,
                "date": datetime.fromtimestamp(float(ts)).strftime("%Y-%m-%d"),
                "dropper": drop.get("user", ""),
                "file_name": " + ".join(f.get("name") or "?" for f in (drop.get("files") or [])),
                "status": "excluded",
                "problems": "posted by the bot itself: its own generated output, not a drop",
            })
            rows.append(row)
            continue
        date = datetime.fromtimestamp(float(ts)).strftime("%Y-%m-%d")
        matches = by_ts.get(ts_key(ts), [])
        path, rec = matches[0] if matches else (None, None)
        files = drop.get("files") or [{}]
        problems = []

        row = {c: "" for c in COLUMNS}
        row.update({
            "slack_ts": ts,
            "date": date,
            "dropper": drop.get("user", ""),
            "file_name": " + ".join(f.get("name") or "?" for f in files),
            "file_mb": round(sum(f.get("size", 0) for f in files) / 1048576, 1),
            "file_type": files[0].get("type") or "",
            "message_note": drop.get("text", "")[:120],
            "ship_reaction": "yes" if drop.get("ship") else "",
        })

        if len(matches) > 1:
            # One message carrying several files can legitimately produce
            # several records, one per artifact. One message carrying ONE
            # file cannot: that is the same thing analysed twice, and it
            # double-counts in every coverage number downstream.
            ids = ", ".join(r.get("id", "?") for _, r in matches)
            if len(files) > 1:
                problems.append(f"shared-drop: {len(matches)} records split this "
                                f"multi-file drop ({ids})")
            else:
                problems.append(f"DUPLICATE: {len(matches)} records claim this "
                                f"single-file drop ({ids})")

        if not rec:
            row["status"] = "not-ingested"
            row["problems"] = "; ".join(problems) or "no analysis record for this drop"
            rows.append(row)
            continue

        item_id = rec.get("id", "")
        is_cur = item_id.startswith("cur-")
        about = rec.get("aboutness") or {}
        claims = {k: (about.get(k) or []) for k in
                  ("subjects", "entities", "themes", "keyTerms", "referencedWorks")}
        n_claims = sum(len(v) for v in claims.values())
        roles = sorted({c.get("role") for c in claims["subjects"] + claims["entities"]
                        if c.get("role")})

        manifest_path = MASTERS_DIR / item_id / "manifest.json"
        manifest = {}
        if manifest_path.exists():
            try:
                manifest = json.loads(manifest_path.read_text())
            except (json.JSONDecodeError, OSError):
                problems.append("manifest unreadable")
        text_path = TEXT_DIR / f"{item_id}.txt"

        src_files = rec.get("sourceFiles") or []
        local = any((REPO / (f.get("localPath") or "")).exists()
                    for f in src_files if f.get("localPath"))
        blob = next((f.get("blobUrl") for f in src_files if f.get("blobUrl")), "")
        if not blob and rec.get("blobUrl"):
            blob = rec["blobUrl"]

        st = rec.get("skillTargeting") or {}
        topics = [t for t in (st.get("topics") or []) if isinstance(t, dict)]
        recipe = rec.get("recipeMatch") or {}
        # The corpus is heterogeneous: gaps appear as bare slugs in most
        # records and as objects in some older ones. Normalise rather than
        # crash, because a ledger that dies on one odd row is useless for
        # exactly the audit it exists to do.
        gaps = []
        for g in (recipe.get("gaps") or []):
            if isinstance(g, str):
                gaps.append(g)
            elif isinstance(g, dict):
                slug = g.get("slug") or g.get("name") or g.get("gap")
                if slug:
                    gaps.append(str(slug))
        untracked = [g for g in gaps if g not in gaps_open]
        if untracked:
            problems.append(f"gap(s) not in open-gaps.json: {untracked}")

        # Graduation, checked against the filesystem rather than believed.
        # A record can claim it shipped a recipe and be wrong in either
        # direction: the PEMDAS foldable and the essay outline had BOTH a
        # shipped recipe and a golden anchor and no analysis record at all,
        # while a record that names a target file proves nothing until the
        # file exists.
        grad = (rec.get("stages") or {}).get("graduation") or {}
        grad_kind = grad.get("kind", "")
        targets = [t for t in (grad.get("targets") or []) if isinstance(t, str)]
        shipped = [t for t in targets if (REPO / t).exists()]
        missing_targets = [t for t in targets if not (REPO / t).exists()]
        # An INTENDED target that does not exist yet is correct, not a defect:
        # the skill's `kind: "recipe"` means a recipe is NEEDED, and `commit`
        # is what records shipping. A first version of this check flagged every
        # honest proposal, which is precisely the cry-wolf failure the gates in
        # book-intake.py were rewritten twice to avoid. Only a record that
        # claims it SHIPPED (a non-null commit) while its target is absent is
        # making a false claim.
        if grad.get("commit") and missing_targets:
            problems.append(f"graduation records commit {grad['commit']} but "
                            f"{len(missing_targets)} target(s) are absent: {missing_targets[:2]}")

        layers = [k for k in rec if k.startswith("layer")]
        units = ((rec.get("layer5_lessons") or {}).get("units") or [])

        # A curriculum is not a reference with missing fields. It carries
        # four layers where a reference carries five dimensions, and judging
        # one by the other's schema reported every curriculum in the corpus
        # as incomplete.
        if is_cur:
            dims = {
                "dim_layout": bool(rec.get("layer1_philosophy")),
                "dim_skills": bool(rec.get("layer2_scope")),
                "dim_difficulty": bool(rec.get("layer3_structure")),
                "dim_theming": bool(rec.get("layer4_activities")),
                "dim_print": True,  # not a curriculum concept
                "dim_aboutness": bool(about.get("subjects")),
            }
            dim_names = {"dim_layout": "layer1 philosophy", "dim_skills": "layer2 scope",
                         "dim_difficulty": "layer3 structure", "dim_theming": "layer4 activities"}
        else:
            dims = {
                "dim_layout": bool(rec.get("layout") or rec.get("overallLayout")),
                "dim_skills": bool(st or rec.get("overallSkillTargeting")),
                "dim_difficulty": bool(rec.get("difficulty")),
                "dim_theming": bool(rec.get("theming")),
                "dim_print": bool(rec.get("printFormat")),
                "dim_aboutness": bool(about.get("subjects")),
            }
            dim_names = {k: k.replace("dim_", "") for k in dims}

        legacy = date < CONTENT_RULES_FROM
        tasted = bool(item_id and item_id in taste) or bool(
            rec.get("title") and rec["title"] in taste)

        row.update({
            "record_id": item_id,
            "record_kind": "curriculum" if is_cur else "reference",
            "what_is_it": describe_kind(rec),
            "title": (rec.get("title") or rec.get("name") or "")[:90],
            "publisher": (rec.get("publisher") or "")[:60],
            "grade_level": (str(rec.get("gradeLevel") or ""))[:60],
            "analysis_quality": rec.get("analysisQuality", ""),
            "original_local": "yes" if local else "",
            "blob_url": "yes" if blob else "",
            "intake_run": "yes" if manifest else "",
            "master_pages": manifest.get("pageCount", ""),
            "text_chars": len(text_path.read_text()) if text_path.exists() else "",
            "vision_pages": len((manifest.get("textExtraction") or {}).get("visionPages") or []),
            "rotated_pages": sum(1 for p in manifest.get("pages", []) if p.get("rotation")),
            "gate_findings": len(manifest.get("gateFindings") or []),
            "aboutness_claims": n_claims or "",
            "aboutness_roles": ",".join(roles),
            "subjects": "; ".join(s.get("name", "") for s in claims["subjects"])[:120],
            "entities": "; ".join(e.get("name", "") for e in claims["entities"])[:120],
            "cur_layers": len(layers) if is_cur else "",
            "cur_units": len(units) if is_cur else "",
            "subject": st.get("subject", ""),
            "domain": st.get("domain", ""),
            "topics_mapped": len([t for t in topics if t.get("mapped", True)]),
            "topics_unmapped": len(st.get("unmappedSkills") or []),
            "age_band_months": "-".join(str(x) for x in
                                        ((rec.get("difficulty") or {}).get("ageBand") or [])),
            "recipes_matched": len(recipe.get("matchedRecipes") or []),
            "gap_slugs": "; ".join(gaps)[:100],
            "gaps_recorded": len(gaps),
            "taste_logged": "yes" if tasted else "",
            "graduation_kind": grad_kind,
            "graduation_shipped": (f"{len(shipped)}/{len(targets)}" if targets else
                                   ("already shipped" if rec.get("graduationAlreadyShipped") else "")),
        })
        row.update({k: ("yes" if v else "") for k, v in dims.items()})

        if verify and item_id:
            verdict, failed = run_verifier(item_id)
            row["verifier"] = verdict
            if failed:
                problems.append(f"verifier: {failed}")

        missing_dims = [dim_names.get(k, k.replace("dim_", ""))
                        for k, v in dims.items()
                        if not v and k != "dim_aboutness"]
        if missing_dims:
            problems.append(f"missing dimension(s): {', '.join(missing_dims)}")
        if not dims["dim_aboutness"]:
            problems.append("no aboutness" + (" (legacy)" if legacy else " (REQUIRED)"))
        if not manifest:
            problems.append("no book-intake run" + (" (legacy)" if legacy else ""))

        hard = [p for p in problems if "legacy" not in p]
        if not problems:
            row["status"] = "complete"
        elif legacy and not hard:
            row["status"] = "legacy"
        else:
            row["status"] = "partial"
        row["problems"] = "; ".join(problems)
        rows.append(row)
    return rows


def write_outputs(rows) -> None:
    LEDGER_JSON.write_text(json.dumps(
        {"generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
         "rows": rows}, indent=2) + "\n")
    with open(LEDGER_CSV, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


def summarize(rows) -> dict:
    counts = {}
    for r in rows:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    return counts


def main():
    ap = argparse.ArgumentParser(description="One row per #homa-inspo drop.")
    ap.add_argument("--refresh", action="store_true",
                    help="pull the channel from Slack and rewrite the snapshot")
    ap.add_argument("--check", action="store_true",
                    help="CI mode: exit non-zero on an un-ingested drop or a duplicate")
    ap.add_argument("--verify", action="store_true",
                    help="run verify-ingestion.py per record (slow, adds the verifier column)")
    args = ap.parse_args()

    if args.refresh:
        code = refresh_snapshot()
        if code or not (args.check or True):
            return code

    rows = build_rows(verify=args.verify)
    write_outputs(rows)
    counts = summarize(rows)
    total = len(rows)
    print(f"{total} drop(s): " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))
    print(f"  {LEDGER_CSV}")
    print(f"  {LEDGER_JSON}")

    if args.check:
        missing = [r for r in rows if r["status"] == "not-ingested"]
        dupes = [r for r in rows if "DUPLICATE" in r["problems"]]
        partial = [r for r in rows if r["status"] == "partial"]
        for r in missing:
            print(f"  NOT INGESTED  {r['date']}  {r['file_name'][:60]}")
        for r in dupes:
            print(f"  DUPLICATE     {r['date']}  {r['record_id']}")
        for r in partial:
            print(f"  PARTIAL       {r['date']}  {r['record_id']}: {r['problems'][:100]}")
        if missing or dupes:
            print(f"\nFAIL: {len(missing)} un-ingested, {len(dupes)} duplicated.")
            return 1
        print("\nOK: every drop has exactly one record.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
