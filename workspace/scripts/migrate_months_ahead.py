#!/usr/bin/env python3
"""
Migration: seed an OPTIONAL numeric `months_ahead` field on every subdomain
that has a discrete `story_position` we can map to an integer baseline.

Mapping:
  below_age   → -12
  at_age      →   0
  12mo_ahead  →  12
  24mo_ahead  →  24
  (unknown / unknown_pending_measurement / n/a → leave months_ahead absent)

Rationale: `story_position` is a STEP FUNCTION (4 discrete buckets). It makes
the dashboard trajectory look flat — the child can grow within "12mo_ahead" for
weeks and the graph never moves. `months_ahead` is the continuous companion
field. The dashboard prefers it when present, falling back to the step mapping.

Idempotent + non-destructive:
  - Only ADDS months_ahead where it is ABSENT.
  - NEVER overwrites an existing months_ahead (so later fine-grained scores
    from score_observation.py survive re-runs).
  - Never touches story_position, current, notes, or any other field.

Writes story-profile.json back with indent=2, ensure_ascii=False,
sort_keys=False, trailing newline (preserves formatting + key order).

Run once. Safe to re-run.
"""

import json
import pathlib
import sys

PROFILE = pathlib.Path.home() / ".openclaw" / "workspace" / "story-profile.json"

POSITION_TO_MONTHS = {
    "below_age": -12,
    "at_age": 0,
    "12mo_ahead": 12,
    "24mo_ahead": 24,
}


def main():
    if not PROFILE.exists():
        print(f"❌ Profile not found at {PROFILE}")
        return 1

    profile = json.loads(PROFILE.read_text())

    seeded = 0
    skipped_existing = 0
    skipped_no_map = 0

    for dom_key, dom in profile.get("domains", {}).items():
        for sub_key, sd in dom.get("subdomains", {}).items():
            if "months_ahead" in sd and sd["months_ahead"] is not None:
                skipped_existing += 1
                continue
            pos = sd.get("story_position")
            if pos in POSITION_TO_MONTHS:
                # Insert months_ahead right after story_position for readability,
                # but only if story_position key exists; otherwise just set it.
                _insert_after(sd, "story_position", "months_ahead",
                              float(POSITION_TO_MONTHS[pos]))
                seeded += 1
                print(f"  + {dom_key}/{sub_key}: {pos} → months_ahead={float(POSITION_TO_MONTHS[pos])}")
            else:
                skipped_no_map += 1

    PROFILE.write_text(
        json.dumps(profile, indent=2, ensure_ascii=False, sort_keys=False) + "\n"
    )

    print("---")
    print(f"Seeded:            {seeded}")
    print(f"Skipped (had one): {skipped_existing}")
    print(f"Skipped (no map):  {skipped_no_map}  (unknown / n/a — left null)")
    print(f"Wrote {PROFILE}")
    return 0


def _insert_after(d, after_key, new_key, value):
    """Insert new_key:value into dict d immediately after after_key, preserving
    overall key order. If after_key absent, append at end. Mutates d in place."""
    if new_key in d:
        return
    if after_key not in d:
        d[new_key] = value
        return
    items = list(d.items())
    out = []
    for k, v in items:
        out.append((k, v))
        if k == after_key:
            out.append((new_key, value))
    d.clear()
    d.update(out)


if __name__ == "__main__":
    sys.exit(main())
