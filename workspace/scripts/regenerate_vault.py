#!/usr/bin/env python3
"""
Regenerate ALL auto-generated views in the Homeschool Obsidian vault.

This is the single entry point that should be called after ANY write to
~/.openclaw/workspace/children/*.json (or benchmarks/, or practice/).

Runs in sequence:
  1. generate_home.py     → Home.md (vault landing page)
  2. generate_story.py    → Children/{name}.md (master profile)
  3. generate_subjects.py → Subjects/{Domain}.md (15 files, one per domain)

Idempotent. Fast (under 2 seconds typical). Safe to call repeatedly.

Usage:
  python3 ~/.openclaw/workspace/scripts/regenerate_vault.py

Exit code:
  0 = all scripts succeeded
  1 = at least one script failed (stderr captured below)
"""

import subprocess
import sys
import pathlib
import time

SCRIPTS_DIR = pathlib.Path.home() / ".openclaw" / "workspace" / "scripts"
SCRIPTS = [
    "generate_home.py",
    "generate_story.py",
    "generate_subjects.py",
    "generate_index.py",
    "generate_log.py",
    "generate_dashboard.py",
    "generate_subject_pages_html.py",  # must run BEFORE deploy
    "generate_activity_pages.py",       # 76 activity pages — also BEFORE deploy
    "deploy_dashboard.py",
]


def main():
    start = time.time()
    results = []
    failed = False

    print(f"=== Regenerating vault — {time.strftime('%Y-%m-%d %H:%M:%S')} ===")
    for script in SCRIPTS:
        script_path = SCRIPTS_DIR / script
        if not script_path.exists():
            print(f"  ❌ {script} — script file missing!")
            results.append((script, False, "file missing"))
            failed = True
            continue

        t0 = time.time()
        proc = subprocess.run(
            ["python3", str(script_path)],
            capture_output=True,
            text=True,
        )
        elapsed = time.time() - t0
        if proc.returncode == 0:
            output = proc.stdout.strip()
            print(f"  ✅ {script} ({elapsed:.2f}s)")
            for line in output.split("\n"):
                if line.strip():
                    print(f"     {line}")
            results.append((script, True, output))
        else:
            print(f"  ❌ {script} ({elapsed:.2f}s) — exit {proc.returncode}")
            print(f"     STDOUT: {proc.stdout}")
            print(f"     STDERR: {proc.stderr}")
            results.append((script, False, proc.stderr))
            failed = True

    total = time.time() - start
    print(f"=== Done in {total:.2f}s — {sum(1 for _, ok, _ in results if ok)}/{len(results)} succeeded ===")

    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
