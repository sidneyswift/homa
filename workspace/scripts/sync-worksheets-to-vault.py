#!/usr/bin/env python3
"""Sync deliverable worksheet PDFs into the parent's Obsidian vault binder so she can find + print
them from her phone (her #1 pain: "I don't know where Homa keeps my worksheets").

Design constraints (why it's conservative):
- The vault syncs to her phone via Obsidian Sync. Free tier caps individual files (~5MB) and total
  vault size (~1GB). Dumping all 268MB of worksheet history (incl. 21 files >5MB) would blow her
  quota / fail to sync. So we sync ONLY: deliverable *.pdf, ≤ MAX_MB, modified within DAYS (the
  active window). Everything else stays in the workspace, surfaceable on request.
- Idempotent: copies only when the vault copy is missing or older. Safe to run every vault regen.
- Never touches her hand-authored Curriculum pages — only writes under `<tab>/Worksheets/`.

Maps each content/curriculum/<subject>/ to the vault Curriculum tab the parent actually opens. Run standalone
or as the last step of regenerate_vault.py.

Usage: python3 scripts/sync-worksheets-to-vault.py [--days 90] [--max-mb 5]
"""
import argparse, pathlib, shutil, time

WS = pathlib.Path.home() / ".openclaw" / "workspace"
VAULT = pathlib.Path.home() / "Documents" / "the Obsidian vault"
CUR = WS / "content" / "curriculum"

# subject-slug (backend) → vault Curriculum tab (her binder). Created if missing.
TAB = {
    "art-creative": "Art-Everywhere",
    "math": "Dimensions-Math-PKA",
    "writing-fine-motor": "HWT",
    "science": "Science-Fusion",
    "social-studies": "Social-Studies",
    "phonics": "Hegg-Phonics",
    "spanish": "Spanish",
    "literacy": "Literacy",
    "self-care-independence": "Health",
}
# intermediate/build dirs to skip (not deliverables)
SKIP_DIRS = {"images", "images_jpg", "hirst-images", "reference-images", "__pycache__"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=90, help="only sync worksheets modified within N days")
    ap.add_argument("--max-mb", type=float, default=5.0, help="skip files larger than this (Sync limit)")
    args = ap.parse_args()
    cutoff = time.time() - args.days * 86400
    max_bytes = args.max_mb * 1024 * 1024

    synced = skipped_big = skipped_old = 0
    synced_bytes = 0
    if not VAULT.is_dir():
        print(f"vault not found: {VAULT}"); return

    for subj, tab in TAB.items():
        wdir = CUR / subj / "worksheets"
        if not wdir.is_dir():
            continue
        dst_root = VAULT / "Curriculum" / tab / "Worksheets"
        index = []
        for pdf in wdir.rglob("*.pdf"):
            if any(part in SKIP_DIRS for part in pdf.relative_to(wdir).parts):
                continue
            st = pdf.stat()
            if st.st_size > max_bytes:
                skipped_big += 1; continue
            if st.st_mtime < cutoff:
                skipped_old += 1; continue
            # flatten nested paths into a browsable filename
            rel = pdf.relative_to(wdir)
            flat = "-".join(rel.parts)
            dst = dst_root / flat
            if dst.exists() and dst.stat().st_mtime >= st.st_mtime:
                index.append(flat); continue
            dst_root.mkdir(parents=True, exist_ok=True)
            shutil.copy2(pdf, dst)
            synced += 1; synced_bytes += st.st_size; index.append(flat)
        # write/refresh a small index note so the tab is self-describing
        if index:
            note = dst_root / "_index.md"
            lines = [f"# {tab} — Worksheets", "",
                     f"_Auto-synced from Homa's workspace ({len(index)} sheets ≤{args.max_mb:.0f}MB, "
                     f"last {args.days}d). Full archive lives in Homa's workspace — ask her for older ones._", ""]
            lines += [f"- [[{f}]]" for f in sorted(index)]
            note.write_text("\n".join(lines) + "\n")

    print(f"worksheet-sync: {synced} copied ({synced_bytes/1048576:.1f}MB), "
          f"{skipped_big} skipped >{args.max_mb:.0f}MB, {skipped_old} skipped >{args.days}d old")


if __name__ == "__main__":
    main()
