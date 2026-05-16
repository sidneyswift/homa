#!/usr/bin/env python3
"""
Save a dated snapshot of children/*.json for trajectory tracking.

Stores at: ~/.openclaw/workspace/profile-history/{YYYY-MM-DD}.json

Idempotent — running twice on the same day overwrites that day's snapshot
(captures latest state). Called by:
  - Weekly scoring cron (Saturday) — captures the post-rescore state
  - Manually whenever a meaningful state change happens

Snapshots are append-only across days; history grows by one file per
distinct day. Used by generate_dashboard.py to draw trajectories.
"""

import datetime
import pathlib
import shutil

PROFILE = pathlib.Path.home() / ".openclaw" / "workspace" / "children/*.json"
HISTORY_DIR = pathlib.Path.home() / ".openclaw" / "workspace" / "profile-history"


def main():
    if not PROFILE.exists():
        print(f"❌ Profile not found at {PROFILE}")
        return 1
    HISTORY_DIR.mkdir(exist_ok=True)
    today = datetime.date.today().isoformat()
    target = HISTORY_DIR / f"{today}.json"
    shutil.copy2(PROFILE, target)
    print(f"Snapshot: {target.name} ({target.stat().st_size} bytes)")

    # Trim history beyond 2 years of daily snapshots (~730 files)
    snapshots = sorted(HISTORY_DIR.glob("*.json"))
    if len(snapshots) > 730:
        for old in snapshots[:-730]:
            old.unlink()
            print(f"  Pruned old snapshot: {old.name}")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
