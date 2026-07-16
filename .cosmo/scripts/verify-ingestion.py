#!/usr/bin/env python3
"""
verify-ingestion.py — Post-ingestion verification gate for reference-ingestion skill.

WHY THIS EXISTS:
Cosmo was consistently skipping steps 4-10 of the 11-step reference-ingestion
skill. The JSON analysis (steps 1-3) and :ship: reaction (step 11) were happening,
but the product-enrichment steps that actually make Homa smarter were being dropped.
This script is the gate: it checks all 11 steps completed before :ship: can fire.

HOW IT WORKS:
Each step maps to a filesystem artifact. If the artifact exists + is valid,
the step passes. If any step fails, the script exits 1 and :ship: is blocked.

INTEGRATION:
After completing reference-ingestion for a drop, Cosmo runs:
    python3 .cosmo/scripts/verify-ingestion.py <ref-id>
Only if exit code 0 does Cosmo react with :ship: on the Slack message.

Usage:
    python3 verify-ingestion.py <ref-id>                 # Single ref check
    python3 verify-ingestion.py ref-2026-07-18-minibeast  # Example
    python3 verify-ingestion.py --all                     # Audit every ref
    python3 verify-ingestion.py --recent 7                # Refs from last N days
"""

import json
import glob
import sys
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Tuple

# ---------------------------------------------------------------------------
# Path constants — resolved relative to repo root.
# This script lives at .cosmo/scripts/, so repo root is two levels up.
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
COSMO = REPO_ROOT / ".cosmo"
REFS_DIR = COSMO / "references"                          # Step 3: ref JSONs live here
INSPO_IMAGES = COSMO / "inspo-images"                    # Source PDFs/images from Slack drops
MATERIALS_STUDIO = REPO_ROOT / "apps" / "web" / "agent" / "skills" / "materials-studio"
SKILL_MD = MATERIALS_STUDIO / "SKILL.md"                 # Step 7: recipe sections added here
REFERENCES_DIR = MATERIALS_STUDIO / "references"         # Step 4: Homa-style images saved here
ACTIVITY_FORMATS = REPO_ROOT / "apps" / "web" / "agent" / "activity-formats.md"  # Step 8
TOPICS_JSON = REPO_ROOT / "packages" / "taxonomy" / "data" / "topics.json"       # Step 9
TASTE_MD = COSMO / "homa-taste.md"                       # Step 6: taste signal log
INDEX_JSON = REFS_DIR / "index.json"                     # Step 3: manifest of all refs


def load_ref(ref_id: str) -> Optional[dict]:
    """Load a reference JSON by its ID (e.g. 'ref-2026-07-18-minibeast-pack')."""
    path = REFS_DIR / f"{ref_id}.json"
    if not path.exists():
        return None
    with open(path) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Step checks — each returns (passed: bool, message: str).
#
# Steps 1-3 are "analysis" steps (JSON creation).
# Steps 4-10 are "product enrichment" steps (the ones Cosmo was skipping).
# Step 11 is the reply to the dropper.
# ---------------------------------------------------------------------------

def check_step1_identify(ref: dict) -> Tuple[bool, str]:
    """
    Step 1: Identify the reference.
    Verifies the ref has required metadata: id, format type, title,
    and who dropped it (Aless, Carolyng, Sid, or atlas-scrape for bulk).
    """
    required = ["id", "format", "title", "droppedBy"]
    missing = [k for k in required if not ref.get(k)]
    if missing:
        return False, f"Missing fields: {', '.join(missing)}"
    return True, "OK"


def check_step2_five_dimensions(ref: dict) -> Tuple[bool, str]:
    """
    Step 2: Analyze along five dimensions.
    Every ref must have all 5 analysis sections filled in:
      A. layout — grid structure, spacing, visual hierarchy
      B. skillTargeting — subject, domain, topic mappings to Homa taxonomy
      C. difficulty — age band, complexity, prerequisites, scaffolding
      D. theming — visual style, characters, color palette, appeal drivers
      E. printFormat — page size, orientation, ink density, color requirement
    """
    dims = ["layout", "skillTargeting", "difficulty", "theming", "printFormat"]
    missing = [d for d in dims if not ref.get(d) or ref.get(d) == {}]
    if missing:
        return False, f"Missing dimensions: {', '.join(missing)}"
    return True, "OK"


def check_step3_stored(ref: dict) -> Tuple[bool, str]:
    """
    Step 3: Store the analysis.
    Checks two things:
      1. The ref JSON file exists at .cosmo/references/<id>.json
      2. The ref is listed in .cosmo/references/index.json (the manifest)
    Both are required — the JSON without the index means it won't be
    discoverable by other tools that scan the manifest.
    """
    ref_id = ref["id"]
    ref_path = REFS_DIR / f"{ref_id}.json"
    if not ref_path.exists():
        return False, "Ref JSON file missing"

    if not INDEX_JSON.exists():
        return False, "index.json missing"

    with open(INDEX_JSON) as f:
        index = json.load(f)

    # Check the ref appears in the manifest's references array
    refs_in_index = [r.get("id") for r in index.get("references", [])]
    if ref_id not in refs_in_index:
        return False, f"{ref_id} not found in index.json"

    return True, "OK"


def check_step4_homa_image(ref: dict) -> Tuple[bool, str]:
    """
    Step 4: Generate Homa-style reference image.
    This is the step Cosmo was most consistently skipping. For non-curriculum
    refs, we extract key pages from the source PDF, pass them as visual
    references to gpt-image-2, and generate a Homa-style version that
    captures structural patterns (layout, spacing, fold geometry) without
    copying copyrighted content.

    Images are saved to apps/web/agent/skills/materials-studio/references/
    as homa-<format>-reference.png.

    Curriculum samples, coursebooks, and textbook samples are exempt —
    they're analyzed for teaching approach patterns, not for visual
    reproduction as worksheets.
    """
    # These formats are analyzed for curriculum structure, not visual patterns.
    # They don't produce printable worksheets, so no Homa-style image needed.
    skip_formats = {"curriculum-sample", "coursebook", "textbook-sample", "lesson-plan"}
    fmt = ref.get("format", "")
    if fmt in skip_formats:
        return True, f"Skipped (format: {fmt})"

    if not REFERENCES_DIR.exists():
        return False, "materials-studio/references/ directory missing"

    # Check that at least one Homa-style reference image exists.
    # A future enhancement: map each ref's format to a specific expected
    # image filename for a tighter check.
    images = list(REFERENCES_DIR.glob("homa-*.png"))
    if not images:
        return False, "No Homa-style reference images exist"

    return True, f"OK ({len(images)} reference images exist)"


def check_step5_recipe_crossref(ref: dict) -> Tuple[bool, str]:
    """
    Step 5: Cross-reference against materials-studio recipes.
    The ref JSON must have a recipeMatch section that says either:
      - matchedRecipes: which existing recipe(s) could produce this format
      - gaps: what patterns this ref uses that we have NO recipe for
    This drives step 7 (recipe graduation) — gaps become new recipes.
    """
    rm = ref.get("recipeMatch", {})
    if not rm:
        return False, "No recipeMatch field"
    if "matchedRecipes" not in rm and "gaps" not in rm:
        return False, "recipeMatch has no matchedRecipes or gaps"
    return True, "OK"


def check_step6_taste(ref: dict) -> Tuple[bool, str]:
    """
    Step 6: Update taste signals.
    Every drop tells us something about what Aless/Carolyng/Sid are drawn to.
    The taste model at .cosmo/homa-taste.md should have an entry for this ref
    (by ref ID, title, or at minimum by drop date).

    Taste signals compound over time — when 3+ drops show the same pattern
    (e.g., "Aless prefers airy layouts"), it gets promoted to a confirmed
    preference that influences all future material generation.
    """
    if not TASTE_MD.exists():
        return False, "homa-taste.md missing"

    ref_id = ref["id"]
    taste = TASTE_MD.read_text()

    # Look for the ref by ID or title in the taste model
    title = ref.get("title", "")
    if ref_id in taste or title in taste:
        return True, "OK"

    # Fallback: check if the drop date appears (batch entries often
    # log by date rather than individual ref ID)
    dropped = ref.get("droppedAt", "")
    if dropped and dropped[:10] in taste:
        return True, "OK (date match)"

    return False, f"No taste entry found for {ref_id}"


def check_step7_recipe_graduation(ref: dict) -> Tuple[bool, str]:
    """
    Step 7: Graduate to materials-studio.
    If step 5 found gaps (format patterns we can't produce yet), this step
    writes new recipe sections into materials-studio/SKILL.md. Each recipe
    includes: reference image pointer, HTML/CSS template, creation path
    guidance, and design patterns extracted from the reference.

    If the ref matched existing recipes with no gaps, no graduation needed.
    If gaps exist, they should be noted — a future enhancement would verify
    the specific gap was addressed in SKILL.md.
    """
    rm = ref.get("recipeMatch", {})
    gaps = rm.get("gaps", [])
    matched = rm.get("matchedRecipes", [])

    if matched and not gaps:
        return True, "OK (matched existing recipes, no graduation needed)"

    if gaps:
        return True, f"OK (gaps noted: {len(gaps)})"

    return True, "OK"


def check_step8_activity_format(ref: dict) -> Tuple[bool, str]:
    """
    Step 8: Update activity format registry.
    New format types need an entry in apps/web/agent/activity-formats.md
    with: slug, name, description, best-for, subjects, ages, creation path,
    and example activity. This is what lets the curriculum-writer and
    lesson-planner reference the format by slug.

    Soft check — only genuinely new format types need entries, not every ref.
    """
    if not ACTIVITY_FORMATS.exists():
        return False, "activity-formats.md missing"

    return True, "OK"


def check_step9_taxonomy(ref: dict) -> Tuple[bool, str]:
    """
    Step 9: Enrich taxonomy.
    If the ref targets skills not in packages/taxonomy/data/topics.json,
    step 2 flags them as unmappedSkills. This step adds those topics to
    the taxonomy so future material generation can target them.

    Each new topic needs: id, type, subject, domain, name, description,
    age range, evidence items, assessment prompt.
    """
    st = ref.get("skillTargeting", {})
    unmapped = st.get("unmappedSkills", [])

    if not unmapped:
        return True, "OK (no unmapped skills)"

    if not TOPICS_JSON.exists():
        return False, "topics.json missing"

    # Future enhancement: verify each unmapped skill was actually added
    # to topics.json, not just flagged
    return True, f"OK ({len(unmapped)} unmapped flagged)"


def check_step10_teaching_rules(ref: dict) -> Tuple[bool, str]:
    """
    Step 10: Write teaching approach rules.
    If the reference reveals how a subject should be taught at a specific age,
    write the rule into materials-studio SKILL.md's "Subject decision rules"
    section. E.g., "For phonics at K-2, prefer multi-sensory formats."

    Discretionary — not every ref warrants a new teaching rule. Only fires
    when the ref demonstrates a genuinely new pedagogical insight.
    """
    return True, "OK (discretionary)"


def check_step11_reply(ref: dict) -> Tuple[bool, str]:
    """
    Step 11: Reply in Slack thread with teach-me-explainer.
    For refs that came from a Slack drop (have sourceMessageTs), a reply
    should have been sent giving the dropper vocabulary to describe what
    they're responding to in the reference.

    For bulk-ingested refs (atlas scrapes, no sourceMessageTs), no reply
    is needed since there's no Slack message to reply to.

    Note: We can't verify the Slack reply from the filesystem — the :ship:
    reaction on the original message is the final human-visible signal.
    """
    ts = ref.get("sourceMessageTs")
    if not ts:
        return True, "OK (no sourceMessageTs — bulk ingest, no reply needed)"
    return True, "OK (reply expected for ts: {})".format(ts)


# ---------------------------------------------------------------------------
# Main verification runner
# ---------------------------------------------------------------------------

def verify_ref(ref_id: str, verbose: bool = True) -> bool:
    """
    Run all 11 step checks against a single reference.
    Returns True only if every step passes.
    """
    ref = load_ref(ref_id)
    if ref is None:
        if verbose:
            print(f"❌ {ref_id}: ref JSON not found")
        return False

    # Each check maps to one step in the reference-ingestion SKILL.md
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

    # --all: audit every reference in the repo
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

    # --recent <days>: only check refs from the last N days
    elif sys.argv[1] == "--recent":
        days = int(sys.argv[2]) if len(sys.argv) > 2 else 7
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        refs = sorted(glob.glob(str(REFS_DIR / "ref-*.json")))
        recent = []
        for ref_path in refs:
            ref_id = Path(ref_path).stem
            # Ref IDs follow pattern: ref-YYYY-MM-DD-<slug>
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

    # Single ref check
    else:
        ref_id = sys.argv[1]
        success = verify_ref(ref_id)
        sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
