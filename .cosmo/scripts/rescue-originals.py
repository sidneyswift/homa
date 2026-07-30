#!/usr/bin/env python3
"""
rescue-originals.py: pull every drop's original out of Slack and into Blob.

WHY THIS EXISTS:
The ingestion ledger measured it on 2026-07-30: 60 analysed drops, roughly
1.3 GB, had no durable copy of their original recorded anywhere. The analysis
survived and the book did not. Those files exist in Slack, which has a
retention window, and on one laptop, which has no backup. That is the one
piece of this corpus with a clock on it (gh#444, and founder action 3 on
gh#328).

This does one thing: for a drop whose record does not name a Blob copy, it
downloads the file from Slack, uploads it through blob-upload.sh (which pins
Homa's store and refuses a token for any other), and writes the returned URL
into the record's sourceFiles. It never re-analyses, never edits an analysis
field, and never deletes anything.

It is idempotent. A record that already names a Blob URL is skipped, so it is
safe to run repeatedly and safe to interrupt.

USAGE:
    SLACK_BOT_TOKEN=... BLOB_READ_WRITE_TOKEN=... \\
      python3 .cosmo/scripts/rescue-originals.py [--limit N] [--dry-run]

Both tokens are required and neither is stored: BLOB_READ_WRITE_TOKEN comes
from `vercel env pull` inside apps/web, SLACK_BOT_TOKEN from the committed
.env.example via 1Password or the Cosmo env.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

COSMO = Path(__file__).resolve().parent.parent
REPO = COSMO.parent
SNAPSHOT = COSMO / "inspo-snapshot.json"
LEDGER = COSMO / "ingestion-ledger.json"
REFS_DIR = COSMO / "references"
CURS_DIR = COSMO / "curriculums"
UPLOAD = COSMO / "scripts" / "blob-upload.sh"


def record_path(item_id: str) -> Path:
    return (CURS_DIR if item_id.startswith("cur-") else REFS_DIR) / f"{item_id}.json"


def slack_files_by_ts() -> dict:
    """ts -> the Slack file objects, straight from a fresh history call. The
    snapshot deliberately does not store download URLs (they are credentialed
    and expire), so this re-fetches them at rescue time."""
    token = os.environ["SLACK_BOT_TOKEN"]
    out = subprocess.run(
        ["curl", "-s", "-H", f"Authorization: Bearer {token}",
         "https://slack.com/api/conversations.history?channel=C0BHQDC033M&limit=200"],
        capture_output=True, text=True, timeout=120,
    )
    data = json.loads(out.stdout or "{}")
    by_ts = {}
    for m in data.get("messages", []):
        if m.get("files"):
            by_ts[m["ts"]] = m["files"]
    return by_ts


def download(url: str, dest: Path) -> bool:
    token = os.environ["SLACK_BOT_TOKEN"]
    done = subprocess.run(
        ["curl", "-sL", "--retry", "3", "--retry-delay", "2", "-m", "900",
         "-H", f"Authorization: Bearer {token}", url, "-o", str(dest)],
        capture_output=True, text=True,
    )
    # A truncated download opens as a valid but empty PDF, which is how a
    # 114MB book once became a 13MB stub that nothing complained about.
    return done.returncode == 0 and dest.exists() and dest.stat().st_size > 1024


def upload(item_id: str, path: Path) -> str:
    done = subprocess.run(
        ["bash", str(UPLOAD), item_id, str(path), "application/pdf"],
        capture_output=True, text=True, cwd=REPO, timeout=1800,
    )
    line = done.stdout.strip().splitlines()[-1] if done.stdout.strip() else ""
    return line if line.startswith("https://") else ""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="stop after N drops")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    for var in ("SLACK_BOT_TOKEN", "BLOB_READ_WRITE_TOKEN"):
        if not os.environ.get(var):
            print(f"ERROR: {var} is required.", file=sys.stderr)
            return 2
    if not LEDGER.exists():
        print("ERROR: run ingestion-ledger.py first.", file=sys.stderr)
        return 2

    rows = json.loads(LEDGER.read_text())["rows"]
    todo = [r for r in rows
            if r.get("record_id") and r.get("blob_url") != "yes"
            and r.get("status") != "excluded"]
    if args.limit:
        todo = todo[:args.limit]
    print(f"{len(todo)} drop(s) with an analysed record and no durable copy")
    if args.dry_run:
        for r in todo:
            print(f"  {r['date']}  {r['file_mb']:>6}MB  {r['record_id']}")
        return 0

    files_by_ts = slack_files_by_ts()
    rescued = failed = skipped = 0

    for row in todo:
        item_id, ts = row["record_id"], row["slack_ts"]
        path = record_path(item_id)
        if not path.exists():
            print(f"  SKIP {item_id}: no record file")
            skipped += 1
            continue
        files = files_by_ts.get(ts)
        if not files:
            print(f"  SKIP {item_id}: message {ts} no longer carries files in Slack")
            skipped += 1
            continue

        record = json.loads(path.read_text())
        source_files = record.get("sourceFiles") or []
        existing = {(f.get("filename") or "") for f in source_files}
        added = []

        for f in files:
            name = f.get("name") or "file.pdf"
            url = f.get("url_private_download") or f.get("url_private")
            if not url:
                continue
            if any(s.get("filename") == name and s.get("blobUrl") for s in source_files):
                continue
            with tempfile.TemporaryDirectory() as tmp:
                local = Path(tmp) / name.replace("/", "_")
                if not download(url, local):
                    print(f"  FAIL {item_id}: download of {name!r} failed or truncated")
                    failed += 1
                    continue
                blob = upload(item_id, local)
            if not blob:
                print(f"  FAIL {item_id}: upload of {name!r} returned no URL")
                failed += 1
                continue
            entry = next((s for s in source_files if s.get("filename") == name), None)
            if entry is None:
                entry = {"filename": name}
                source_files.append(entry)
            entry["blobUrl"] = blob
            entry["blobUploadedAt"] = "2026-07-30"
            entry["rescuedFromSlack"] = True
            added.append(name)

        if added:
            record["sourceFiles"] = source_files
            record.setdefault(
                "sourceFilesNote",
                "Originals rescued from Slack into Blob on 2026-07-30 by "
                "rescue-originals.py. Before that this record named no durable "
                "copy: the analysis existed and the file did not.")
            path.write_text(json.dumps(record, indent=2) + "\n")
            rescued += 1
            print(f"  ok   {item_id}: {len(added)} file(s)")

    print(f"\nrescued {rescued}, failed {failed}, skipped {skipped}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
