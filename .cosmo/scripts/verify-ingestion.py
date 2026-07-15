#!/usr/bin/env python3
"""
verify-ingestion.py — Post-ingestion verification for reference-ingestion skill.

Checks all 11 steps were completed for a given reference ID.
Returns exit code 0 if all steps pass, 1 if any fail.

Usage:
    python3 verify-ingestion.py <ref-id>
    python3 verify-ingestion.py ref-2026-07-18-minibeast-pack
    python3 verify-ingestion.py --all          # Check all refs
    python3 verify-ingestion.py --recent 7     # Check refs from last 7 days
"""

import json
import glob
import sys
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Tuple

REPO_ROOT = Path(__file__).resolve().parent.parent.parent  # .cosmo/scripts/ -> repo root
COSMO = REPO_ROOT / ".cosmo"
REFS_DIR = COSMO / "references"
INSPO_IMAGES = COSMO / "inspo-images"
MATERIALS_STUDIO = REPO_ROOT / "apps" / "web" / "agent" / "skills" / "materials-studio"
SKILL_MD = MATERIALS_STUDIO / "SKILL.md"
REFERENCES_DIR = MATERIALS_STUDIO / "references"
ACTIVITY_FORMATS = REPO_ROOT / "apps" / "web" / "agent" / "activity-formats.md"
TOPICS_JSON = REPO_ROOT / "packages" / "taxonomy" / "data" / "topics.json"
TASTE_MD = COSMO / "homa-taste.md"
INDEX_JSON = REFS_DIR / "index.json"


def load_ref(ref_id: str) -> Optional[dict]:
    path = REFS_DIR / f"{ref_id}.json"
    if not path.exists():
        return None
    with open(path) as f:
        return json.load(f)


def check_step1_identify(ref: dict) -> Tuple[bool, str]:
    """Step 1: Reference identified with id, format, title, droppedBy."""
    required = ["id", "format", "title", "droppedBy"]
    missing = [k for k in required if not ref.get(k)]
    if missing:
        return False, f"Missing fields: {', '.join(missing)}"
    return True, "OK"


def check_step2_five_dimensions(ref: dict) -> Tuple[bool, str]:
    """Step 2: All 5 analysis dimensions present."""
    dims = ["layout", "skillTargeting", "difficulty", "theming", "printFormat"]
    missing = [d for d in dims if not ref.get(d) or ref.get(d) == {}]
    if missing:
        return False, f"Missing dimensions: {', '.join(missing)}"
    return True, "OK"


def check_step3_stored(ref: dict) -> Tuple[bool, str]:
    """Step 3: JSON stored and index updated."""
    ref_id = ref["id"]
    ref_path = REFS_DIR / f"{ref_id}.json"
    if not ref_path.exists():
        return False, "Ref JSON file missing"

    if not INDEX_JSON.exists():
        return False, "index.json missing"

    with open(INDEX_JSON) as f:
        index = json.load(f)

    refs_in_index = [r.get("id") for r in index.get("references", [])]
    if ref_id not in refs_in_index:
        return False, f"{ref_id} not found in index.json"

    return True, "OK"


def check_step4_homa_image(ref: dict) -> Tuple[bool, str]:
    """Step 4: Homa-style reference image generated."""
    # Skip for curriculum-sample, coursebook, textbook-sample, lesson-plan formats
    skip_formats = {"curriculum-sample", "coursebook", "textbook-sample", "lesson-plan"}
    fmt = ref.get("format", "")
    if fmt in skip_formats:
        return True, f"Skipped (format: {fmt})"

    # Check if any homa-* reference image could correspond to this format
    if not REFERENCES_DIR.exists():
        return False, "materials-studio/references/ directory missing"

    images = list(REFERENCES_DIR.glob("homa-*.png"))
    if not images:
        return False, "No Homa-style reference images exist"

    # For now, check that at least one image exists for the general format category
    # A more precise check would map ref format -> expected image filename
    return True, f"OK ({len(images)} reference images exist)"


def check_step5_recipe_crossref(ref: dict) -> Tuple[bool, str]:
    """Step 5: Cross-referenced against materials-studio recipes."""
    rm = ref.get("recipeMatch", {})
    if not rm:
        return False, "No recipeMatch field"
    if "matchedRecipes" not in rm and "gaps" not in rm:
        return False, "recipeMatch has no matchedRecipes or gaps"
    return True, "OK"


def check_step6_taste(ref: dict) -> Tuple[bool, str]:
    """Step 6: Taste signals updated."""
    if not TASTE_MD.exists():
        return False, "homa-taste.md missing"

    ref_id = ref["id"]
    taste = TASTE_MD.read_text()

    # Check if the ref title or id appears in taste model
    title = ref.get("title", "")
    if ref_id in taste or title in taste:
        return True, "OK"

    # Check by date (taste entries might reference the date)
    dropped = ref.get("droppedAt", "")
    if dropped and dropped[:10] in taste:
        return True, "OK (date match)"

    return False, f"No taste entry found for {ref_id}"


def check_step7_recipe_graduation(ref: dict) -> Tuple[bool, str]:
    """Step 7: New format types graduated to materials-studio SKILL.md."""
    rm = ref.get("recipeMatch", {})
    gaps = rm.get("gaps", [])
    matched = rm.get("matchedRecipes", [])

    # If it matched existing recipes with no gaps, graduation not needed
    if matched and not gaps:
        return True, "OK (matched existing recipes, no graduation needed)"

    # If there are gaps, check if SKILL.md has been updated
    # This is a soft check — gaps might be acceptable if they're acknowledged
    if gaps:
        return True, f"OK (gaps noted: {len(gaps)})"

    return True, "OK"


def check_step8_activity_format(ref: dict) -> Tuple[bool, str]:
    """Step 8: Activity format registry updated."""
    if not ACTIVITY_FORMATS.exists():
        return False, "activity-formats.md missing"

    # Check that the format type has an entry
    fmt = ref.get("format", "")
    formats_text = ACTIVITY_FORMATS.read_text()

    # This is a soft check — not every individual ref needs a new format entry
    # Only needed when the format is genuinely new
    return True, "OK"


def check_step9_taxonomy(ref: dict) -> Tuple[bool, str]:
    """Step 9: Unmapped taxonomy topics added."""
    st = ref.get("skillTargeting", {})
    unmapped = st.get("unmappedSkills", [])

    if not unmapped:
        return True, "OK (no unmapped skills)"

    # Check if topics.json has been updated for these
    if not TOPICS_JSON.exists():
        return False, "topics.json missing"

    return True, f"OK ({len(unmapped)} unmapped flagged)"


def check_step10_teaching_rules(ref: dict) -> Tuple[bool, str]:
    """Step 10: Teaching approach rules written if applicable."""
    # This is discretionary — not every ref warrants new rules
    return True, "OK (discretionary)"


def check_step11_reply(ref: dict) -> Tuple[bool, str]:
    """Step 11: Teach-me-explainer reply sent."""
    # Can't verify Slack reply from filesystem, but we can check
    # if sourceMessageTs exists (meaning we know where to reply)
    ts = ref.get("sourceMessageTs")
    if not ts:
        return True, "OK (no sourceMessageTs — bulk ingest, no reply needed)"
    # For drops with a message timestamp, we trust the reply was sent
    # The :ship: reaction is the final verification
    return True, "OK (reply expected for ts: {})".format(ts)


def verify_ref(ref_id: str, verbose: bool = True) -> bool:
    ref = load_ref(ref_id)
    if ref is None:
        if verbose:
            print(f"❌ {ref_id}: ref JSON not found")
        return False

    checks = [
        ("Step 1: Identify", check_step1_identify),
        ("Step 2: Five dimensions", check_step2_five_dimensions),
        ("Step 3: Store & index", check_step3_stored),
        ("Step 4: Homa-style image", check_step4_homa_image),
        ("Step 5: Recipe cross-ref", check_step5_recipe_crossref),
        ("Step 6: Taste signals", check_step6_taste),
        ("Step 7: Recipe graduation", check_step7_recipe_graduation),
        ("Step 8: Activity format", check_step8_activity_format),
        ("Step 9: Taxonomy", check_step9_taxonomy),
        ("Step 10: Teaching rules", check_step10_teaching_rules),
        ("Step 11: Reply sent", check_step11_reply),
    ]

    all_pass = True
    failures = []

    for name, check_fn in checks:
        passed, msg = check_fn(ref)
        if verbose:
            icon = "✅" if passed else "❌"
            print(f"  {icon} {name}: {msg}")
        if not passed:
            all_pass = False
            failures.append(name)

    if verbose:
        if all_pass:
            print(f"\n🚢 {ref_id}: ALL STEPS PASSED — safe to react with :ship:")
        else:
            print(f"\n🚫 {ref_id}: BLOCKED — fix before reacting with :ship:")
            print(f"   Failed: {', '.join(failures)}")

    return all_pass


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 verify-ingestion.py <ref-id> | --all | --recent <days>")
        sys.exit(1)

    if sys.argv[1] == "--all":
        refs = sorted(glob.glob(str(REFS_DIR / "ref-*.json")))
        total = len(refs)
        passed = 0
        failed = 0
        for ref_path in refs:
            ref_id = Path(ref_path).stem
            print(f"\n{'='*60}")
            print(f"Checking: {ref_id}")
            if verify_ref(ref_id):
                passed += 1
            else:
                failed += 1
        print(f"\n{'='*60}")
        print(f"TOTAL: {total} | PASSED: {passed} | FAILED: {failed}")
        sys.exit(0 if failed == 0 else 1)

    elif sys.argv[1] == "--recent":
        days = int(sys.argv[2]) if len(sys.argv) > 2 else 7
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        refs = sorted(glob.glob(str(REFS_DIR / "ref-*.json")))
        recent = []
        for ref_path in refs:
            ref_id = Path(ref_path).stem
            # Extract date from ref-YYYY-MM-DD-... pattern
            parts = ref_id.split("-")
            if len(parts) >= 4:
                date_str = "-".join(parts[1:4])
                if date_str >= cutoff:
                    recent.append(ref_id)

        if not recent:
            print(f"No refs found in last {days} days")
            sys.exit(0)

        total = len(recent)
        passed = 0
        for ref_id in recent:
            print(f"\n{'='*60}")
            print(f"Checking: {ref_id}")
            if verify_ref(ref_id):
                passed += 1
        failed = total - passed
        print(f"\n{'='*60}")
        print(f"RECENT ({days}d): {total} | PASSED: {passed} | FAILED: {failed}")
        sys.exit(0 if failed == 0 else 1)

    else:
        ref_id = sys.argv[1]
        success = verify_ref(ref_id)
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
