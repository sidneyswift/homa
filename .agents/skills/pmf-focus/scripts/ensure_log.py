#!/usr/bin/env python3
"""Ensure the PMF limiting-factor log exists.

Copies the skill template to .context/pmf-focus/limiting-factor-log.yaml
when missing. Refuses to overwrite an existing log.

Usage (from repo root):
  python3 .agents/skills/pmf-focus/scripts/ensure_log.py
"""

from __future__ import annotations

import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path


def repo_root_from_script() -> Path:
    # scripts/ -> pmf-focus/ -> skills/ -> .agents/ -> repo
    return Path(__file__).resolve().parents[4]


def main() -> int:
    root = repo_root_from_script()
    template = (
        root
        / ".agents"
        / "skills"
        / "pmf-focus"
        / "assets"
        / "limiting-factor-log.template.yaml"
    )
    dest_dir = root / ".context" / "pmf-focus"
    dest = dest_dir / "limiting-factor-log.yaml"

    if not template.is_file():
        print(f"Template missing: {template}", file=sys.stderr)
        return 1

    if dest.is_file():
        print(f"Log already exists: {dest}")
        return 0

    dest_dir.mkdir(parents=True, exist_ok=True)
    text = template.read_text(encoding="utf-8")
    # Live log should not carry template header comments.
    text = "\n".join(
        line for line in text.splitlines() if not line.startswith("#")
    ).lstrip()
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    text = text.replace("updated_at: null", f'updated_at: "{stamp}"', 1)
    if not text.endswith("\n"):
        text += "\n"
    dest.write_text(text, encoding="utf-8")
    print(f"Created {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
