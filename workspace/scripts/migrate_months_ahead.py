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

Writes each children/<child>.json back with indent=2, ensure_ascii=False,
sort_keys=False, trailing newline (preserves formatting + key order).

Multi-child: with --child NAME, migrates that one child; omitted, migrates
every children/*.json in turn.

Run once. Safe to re-run.
"""

import argparse
import json
import pathlib
import sys

CHILDREN_DIR = pathlib.Path.home() / ".openclaw" / "workspace" / "children"

POSITION_TO_MONTHS = {
    "below_age": -12,
    "at_age": 0,
    "12mo_ahead": 12,
    "24mo_ahead": 24,
}


def resolve_children(name):
    """Resolve which children/<child>.json files to migrate.

    - If name given: just children/<name>.json.
    - If omitted and exactly ONE children/*.json exists: use it.
    - If omitted and multiple exist: use ALL of them (this is a batch migration).
    Files starting with _ (e.g. _schema.json) are always ignored.
    Returns (paths, error_msg). On error, paths is None.
    """
    if name:
        return [CHILDREN_DIR / f"{name}.json"], None
    children = sorted(p for p in CHILDREN_DIR.glob("*.json") if not p.name.startswith("_"))
    if not children:
        return None, f"No children/*.json profiles found in {CHILDREN_DIR}"
    return children, None


def migrate_one(profile_path):
    """Seed months_ahead on one child profile. Returns (seeded, skipped_existing,
    skipped_no_map) or None if the file is missing."""
    if not profile_path.exists():
        print(f"❌ Profile not found at {profile_path}")
        return None

    profile = json.loads(profile_path.read_text())

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
                print(f"  + {profile_path.stem}: {dom_key}/{sub_key}: {pos} → months_ahead={float(POSITION_TO_MONTHS[pos])}")
            else:
                skipped_no_map += 1

    profile_path.write_text(
        json.dumps(profile, indent=2, ensure_ascii=False, sort_keys=False) + "\n"
    )
    print(f"Wrote {profile_path}")
    return seeded, skipped_existing, skipped_no_map


def main():
    ap = argparse.ArgumentParser(description="Seed months_ahead from story_position on child profiles.")
    ap.add_argument("--child", default=None,
                    help="Which child (children/<child>.json). Omit to migrate ALL children.")
    args = ap.parse_args()

    paths, err = resolve_children(args.child)
    if err:
        print(f"❌ {err}")
        return 1

    seeded = skipped_existing = skipped_no_map = 0
    any_missing = False
    for path in paths:
        result = migrate_one(path)
        if result is None:
            any_missing = True
            continue
        s, se, sn = result
        seeded += s
        skipped_existing += se
        skipped_no_map += sn

    print("---")
    print(f"Children migrated: {len([p for p in paths if p.exists()])}")
    print(f"Seeded:            {seeded}")
    print(f"Skipped (had one): {skipped_existing}")
    print(f"Skipped (no map):  {skipped_no_map}  (unknown / n/a — left null)")
    return 1 if any_missing else 0


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
