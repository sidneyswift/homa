#!/usr/bin/env python3
"""
score_observation.py — same-day re-scoring of ONE subdomain.

This is what lets Homa update a single subdomain the MOMENT the parent reports
something, instead of waiting for the Saturday batch rescore. It:

  1. Loads the child's children/<child>.json profile
  2. Validates the domain + subdomain exist (clear error + closest matches)
  3. Updates that subdomain's: current (required), months_ahead, confidence,
     verified (= today), optionally story_position and notes
  4. Writes the JSON back (indent=2, ensure_ascii=False, sort_keys=False,
     trailing newline — preserves formatting + key order)
  5. Runs snapshot_profile.py  → refreshes today's dated snapshot
  6. Runs regenerate_vault.py  → rebuilds the parent's Obsidian views + dashboard
  7. Prints a clear success summary

Usage:
  python3 score_observation.py \
      --child NAME \
      --domain math --subdomain rote_counting \
      --current "Counts to 30 now" \
      --months-ahead 14 --confidence high \
      [--position 12mo_ahead] [--note "..."]

Required: --domain, --subdomain, --current
Optional: --child (which children/<child>.json; may be omitted when exactly one exists),
          --months-ahead (float), --position, --confidence (default "high"),
          --note  (sets the subdomain's `notes` field)

--confidence defaults to "high" because a direct fresh observation from the parent
is the strongest signal we get.
"""

import argparse
import datetime
import difflib
import json
import pathlib
import subprocess
import sys

WORKSPACE = pathlib.Path.home() / ".openclaw" / "workspace"
CHILDREN_DIR = WORKSPACE / "children"
SCRIPTS = WORKSPACE / "scripts"

VALID_POSITIONS = {
    "below_age", "at_age", "12mo_ahead", "24mo_ahead",
    "unknown", "unknown_pending_measurement", "n/a",
}
VALID_CONFIDENCE = {"high", "medium", "stale", "expired", "unknown"}


def _insert_after(d, after_key, new_key, value):
    """Insert new_key:value into dict d right after after_key (preserve order).
    If new_key already present, just update value in place. If after_key absent,
    append at end."""
    if new_key in d:
        d[new_key] = value
        return
    if after_key not in d:
        d[new_key] = value
        return
    items = list(d.items())
    d.clear()
    for k, v in items:
        d[k] = v
        if k == after_key:
            d[new_key] = value


def resolve_child(name):
    """Resolve the child profile path from a --child NAME.

    - If name given: use children/<name>.json.
    - If omitted and exactly ONE children/*.json exists (ignoring _-prefixed like
      _schema.json): use it.
    - If omitted and multiple exist: error listing the choices.
    Returns (path, error_msg). On error, path is None.
    """
    if name:
        return CHILDREN_DIR / f"{name}.json", None
    children = sorted(p for p in CHILDREN_DIR.glob("*.json") if not p.name.startswith("_"))
    if len(children) == 1:
        return children[0], None
    if not children:
        return None, f"No children/*.json profiles found in {CHILDREN_DIR}"
    choices = ", ".join(p.stem for p in children)
    return None, ("Multiple children found — pass --child NAME. "
                  f"Choices: {choices}")


def _closest(name, candidates, n=5):
    matches = difflib.get_close_matches(name, candidates, n=n, cutoff=0.3)
    if not matches:
        # fall back to substring matches
        matches = [c for c in candidates if name.lower() in c.lower()][:n]
    return matches


def main():
    p = argparse.ArgumentParser(description="Re-score one subdomain from a fresh observation.")
    p.add_argument("--child", default=None,
                   help="Which child (children/<child>.json). Optional when exactly one exists.")
    p.add_argument("--domain", required=True)
    p.add_argument("--subdomain", required=True)
    p.add_argument("--current", required=True, help="New current-state observation text (required).")
    p.add_argument("--months-ahead", type=float, default=None,
                   help="Continuous months-ahead score, e.g. 14.0. Optional.")
    p.add_argument("--position", default=None, choices=sorted(VALID_POSITIONS),
                   help="story_position band. Optional (left unchanged if omitted).")
    p.add_argument("--confidence", default="high", choices=sorted(VALID_CONFIDENCE),
                   help="Confidence. Default 'high' (direct fresh observation).")
    p.add_argument("--note", default=None, help="Sets the subdomain's `notes` field. Optional.")
    p.add_argument("--no-regenerate", action="store_true",
                   help="Skip snapshot + vault regeneration (for testing only).")
    args = p.parse_args()

    profile_path, err = resolve_child(args.child)
    if err:
        print(f"❌ {err}")
        return 1
    if not profile_path.exists():
        print(f"❌ Profile not found at {profile_path}")
        return 1

    profile = json.loads(profile_path.read_text())
    domains = profile.get("domains", {})

    # Validate domain
    if args.domain not in domains:
        print(f"❌ Domain '{args.domain}' not found.")
        close = _closest(args.domain, list(domains.keys()))
        if close:
            print(f"   Closest domains: {', '.join(close)}")
        else:
            print(f"   Available domains: {', '.join(domains.keys())}")
        return 2

    subs = domains[args.domain].get("subdomains", {})
    if args.subdomain not in subs:
        print(f"❌ Subdomain '{args.subdomain}' not found in domain '{args.domain}'.")
        close = _closest(args.subdomain, list(subs.keys()))
        if close:
            print(f"   Closest subdomains in {args.domain}: {', '.join(close)}")
        else:
            print(f"   Available subdomains in {args.domain}: {', '.join(subs.keys())}")
        return 2

    sd = subs[args.subdomain]
    today = datetime.date.today().isoformat()

    # Capture before-state for the summary
    before = {
        "current": sd.get("current"),
        "months_ahead": sd.get("months_ahead"),
        "story_position": sd.get("story_position"),
        "confidence": sd.get("confidence"),
        "verified": sd.get("verified"),
    }

    # --- Apply updates ---
    sd["current"] = args.current

    if args.months_ahead is not None:
        _insert_after(sd, "story_position", "months_ahead", float(args.months_ahead))

    if args.position is not None:
        sd["story_position"] = args.position

    sd["confidence"] = args.confidence
    sd["verified"] = today

    if args.note is not None:
        sd["notes"] = args.note

    # --- Write back (preserve formatting + key order) ---
    profile_path.write_text(
        json.dumps(profile, indent=2, ensure_ascii=False, sort_keys=False) + "\n"
    )

    # --- Run snapshot + regenerate ---
    snapshot_rc = 0
    vault_rc = 0
    if not args.no_regenerate:
        print("→ Snapshotting profile (snapshot_profile.py)…")
        snapshot_rc = subprocess.run(
            ["python3", str(SCRIPTS / "snapshot_profile.py")]
        ).returncode
        print("→ Regenerating vault (regenerate_vault.py)…")
        vault_rc = subprocess.run(
            ["python3", str(SCRIPTS / "regenerate_vault.py")]
        ).returncode

    # --- Summary ---
    print("\n" + "=" * 60)
    print(f"✅ Scored {args.domain}/{args.subdomain}  (verified {today})")
    print("=" * 60)

    def line(label, b, a):
        if b != a:
            print(f"  {label:14} {b!r}  →  {a!r}")
        else:
            print(f"  {label:14} {a!r}  (unchanged)")

    line("current", _trunc(before["current"]), _trunc(sd.get("current")))
    line("months_ahead", before["months_ahead"], sd.get("months_ahead"))
    line("story_position", before["story_position"], sd.get("story_position"))
    line("confidence", before["confidence"], sd.get("confidence"))
    line("verified", before["verified"], sd.get("verified"))
    if args.note is not None:
        print(f"  {'notes':14} (set)")

    if not args.no_regenerate:
        print("-" * 60)
        print(f"  snapshot_profile.py exit: {snapshot_rc}")
        print(f"  regenerate_vault.py  exit: {vault_rc}")
        if snapshot_rc != 0 or vault_rc != 0:
            print("  ⚠️  A downstream script returned non-zero — check output above.")
            return 3

    return 0


def _trunc(s, n=60):
    if not isinstance(s, str):
        return s
    return s if len(s) <= n else s[: n - 1] + "…"


if __name__ == "__main__":
    sys.exit(main())
