#!/usr/bin/env python3
"""
Snapshot all child profiles to profile-history/{date}/{name}.json.

Used by the weekly scoring cron for trajectory tracking.
Multi-child aware: snapshots each child separately.
"""

import json
import datetime
import pathlib
import shutil

CHILDREN_DIR = pathlib.Path.home() / ".openclaw" / "workspace" / "children"
HISTORY_DIR = pathlib.Path.home() / ".openclaw" / "workspace" / "profile-history"


def main():
    today = datetime.date.today().isoformat()
    day_dir = HISTORY_DIR / today
    day_dir.mkdir(parents=True, exist_ok=True)

    count = 0
    for f in sorted(CHILDREN_DIR.glob("*.json")):
        if f.name.startswith("_"):
            continue
        dst = day_dir / f.name
        shutil.copy2(f, dst)
        count += 1
        print(f"  Snapshot: {f.name} → profile-history/{today}/{f.name}")

    print(f"Snapshotted {count} profile(s) to {day_dir}")


if __name__ == "__main__":
    main()
