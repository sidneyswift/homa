#!/usr/bin/env python3
"""
verify-ingestion.py: post-ingestion verification gate for the ingestion skills.

WHY THIS EXISTS:
Cosmo was consistently skipping the product-enrichment steps of the
reference-ingestion skill, and the original version of this gate checked a
repo shape that no longer exists (PR #57 moved recipes out of SKILL.md into
references/recipes/*.md files and replaced loose reference PNGs with the
golden-anchor pipeline). This rewrite checks the post-Jul-20 contract.

HOW IT WORKS:
Each step maps to a filesystem artifact or a repo invariant. If every step
passes, exit 0 and the :ship: reaction may fire. Any failure exits 1.

PREFLIGHT:
A verdict from a stale checkout is worthless (the old script would happily
pass against deleted state). Before any check, this script confirms the
checkout contains origin/main, and refuses to run otherwise.

MODES:
    python3 verify-ingestion.py <ref-id>       # single reference (ref-...)
    python3 verify-ingestion.py <cur-id>       # single curriculum (cur-...)
    python3 verify-ingestion.py --all          # audit every ref and cur
    python3 verify-ingestion.py --recent 7     # refs and curs from last N days
    python3 verify-ingestion.py --regen-index  # rebuild both index.json files
                                               # from the individual JSONs
    Add --no-fetch to skip the network fetch in preflight (offline use).

OPEN GAPS:
Not every recorded gap has a shipped recipe yet, and that is fine as long as
the backlog is explicit. .cosmo/open-gaps.json is the machine-readable list
of acknowledged-open gaps. Step 7 fails only on a gap that is neither
shipped, aliased, registered, nor acknowledged there.
"""

import json
import glob
import re
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Tuple

# ---------------------------------------------------------------------------
# Path constants, resolved relative to repo root.
# This script lives at .cosmo/scripts/, so repo root is two levels up.
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
COSMO = REPO_ROOT / ".cosmo"
REFS_DIR = COSMO / "references"
CURS_DIR = COSMO / "curriculums"
OPEN_GAPS = COSMO / "open-gaps.json"
TASTE_MD = COSMO / "homa-taste.md"
INDEX_JSON = REFS_DIR / "index.json"
CUR_INDEX_JSON = CURS_DIR / "index.json"

MATERIALS_STUDIO = REPO_ROOT / "apps" / "web" / "agent" / "skills" / "materials-studio"
RECIPES_DIR = MATERIALS_STUDIO / "references" / "recipes"
SUBJECTS_DIR = MATERIALS_STUDIO / "references" / "subjects"
APPROACHES_DIR = MATERIALS_STUDIO / "references" / "approaches"
ACTIVITY_FORMATS = REPO_ROOT / "apps" / "web" / "agent" / "activity-formats.md"
TOPICS_JSON = REPO_ROOT / "packages" / "taxonomy" / "data" / "topics.json"
ANCHORS_TS = REPO_ROOT / "apps" / "web" / "lib" / "materials" / "anchors.ts"
ANCHOR_SOURCES = REPO_ROOT / "apps" / "web" / "lib" / "materials" / "anchor-sources"
COSMO_FUNNEL = REPO_ROOT / "apps" / "web" / "lib" / "materials" / "cosmo-funnel.ts"

# Gap names that are not printable-format asks (mirrors NON_FORMAT_GAPS in
# cosmo-funnel.ts): curriculum analyses record themselves as this synthetic
# gap and belong to the curriculum writer's funnel, not this one.
NON_FORMAT_GAPS = {"curriculum-sample"}

# Same slug shape the funnel's extractGapSlugs enforces. Anything else is
# silently invisible to coverage tracking, so we flag it here instead.
SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)+$")


# ---------------------------------------------------------------------------
# Repo-state readers. Parsed fresh per run so the verdict always reflects the
# actual tree, never a remembered list.
# ---------------------------------------------------------------------------

def recipe_slugs() -> set:
    """Filename slugs of every shipped recipe file."""
    if not RECIPES_DIR.exists():
        return set()
    return {p.stem for p in RECIPES_DIR.glob("*.md")}


def gap_aliases() -> dict:
    """Parse GAP_ALIASES out of cosmo-funnel.ts (key -> shipped slug)."""
    if not COSMO_FUNNEL.exists():
        return {}
    src = COSMO_FUNNEL.read_text()
    m = re.search(r"GAP_ALIASES[^=]*=\s*\{(.*?)\};", src, re.DOTALL)
    if not m:
        return {}
    return dict(re.findall(r'"([a-z0-9-]+)":\s*"([a-z0-9-]+)"', m.group(1)))


def registry_slugs() -> set:
    """Slugs registered in activity-formats.md via the exact Slug line."""
    if not ACTIVITY_FORMATS.exists():
        return set()
    return set(re.findall(r"- \*\*Slug:\*\* `\[([a-z0-9-]+)\]`", ACTIVITY_FORMATS.read_text()))


def anchor_ids() -> set:
    """Anchor ids present in both the registry and anchor-sources/."""
    ids = set()
    if ANCHORS_TS.exists():
        ids = set(re.findall(r'id:\s*"([a-z0-9-]+)"', ANCHORS_TS.read_text()))
    jpgs = {p.stem for p in ANCHOR_SOURCES.glob("*.jpg")} if ANCHOR_SOURCES.exists() else set()
    return ids & jpgs


def open_gaps() -> dict:
    """Acknowledged-open gap slugs -> their record. Empty dict if no file."""
    if not OPEN_GAPS.exists():
        return {}
    try:
        data = json.loads(OPEN_GAPS.read_text())
        return {g["slug"]: g for g in data.get("gaps", []) if g.get("slug")}
    except (json.JSONDecodeError, KeyError, TypeError):
        return {}


def load_json(path: Path) -> Optional[dict]:
    """Returns None for missing, unreadable, or malformed files. A truncated
    JSON (documented queue-overflow failure mode) must fail its own checks,
    never crash the whole audit."""
    if not path.exists():
        return None
    try:
        with open(path) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def load_ref(ref_id: str) -> Optional[dict]:
    return load_json(REFS_DIR / f"{ref_id}.json")


def load_cur(cur_id: str) -> Optional[dict]:
    return load_json(CURS_DIR / f"{cur_id}.json")


# ---------------------------------------------------------------------------
# Preflight: refuse verdicts from stale trees.
# ---------------------------------------------------------------------------

def preflight(no_fetch: bool = False) -> Tuple[bool, str]:
    """
    Confirms this checkout is safe to judge against:
      1. origin/main is an ancestor of HEAD (we contain current main).
         Cosmo's live checkout has been observed days behind main, where the
         old script would pass against a deleted repo shape.
      2. The post-restructure surfaces exist (references/recipes/).
    Network fetch is best-effort; --no-fetch skips it for offline runs.
    """
    if not no_fetch:
        try:
            subprocess.run(
                ["git", "fetch", "--quiet", "origin", "main"],
                cwd=REPO_ROOT, capture_output=True, timeout=30, check=False,
            )
        except subprocess.TimeoutExpired:
            print("  (git fetch timed out; judging against the last-known origin/main)")
    probe = subprocess.run(
        ["git", "merge-base", "--is-ancestor", "origin/main", "HEAD"],
        cwd=REPO_ROOT, capture_output=True, check=False,
    )
    if probe.returncode != 0:
        return False, (
            "Checkout does not contain origin/main. Sync first "
            "(git fetch && git merge origin/main); a verdict from a stale "
            "tree is worthless."
        )
    if not RECIPES_DIR.exists():
        return False, (
            f"{RECIPES_DIR} missing. This tree predates the fat-skill "
            "restructure (PR #57); sync to current main."
        )
    return True, "OK"


# ---------------------------------------------------------------------------
# Reference step checks. Each returns (passed, message).
#
# Legacy policy: refs written before the stages block existed soften on
# NEW-RULE checks (gap-name shape, taste date matching) but stay hard on
# artifact completeness (five dimensions, recipeMatch). An incomplete
# analysis is incomplete regardless of era; the --all failure matrix IS the
# re-analysis backlog and must not be flattered into green.
#
# Note: step 7 is deliberately stricter than cosmo-funnel's isCovered (which
# also does section-slug and containment matching). A gap the funnel counts
# covered can still need an open-gaps.json record here; that is intentional,
# so the acknowledged backlog stays explicit.
# ---------------------------------------------------------------------------

def check_step1_identify(ref: dict) -> Tuple[bool, str]:
    """Required metadata: id, format, title, droppedBy."""
    required = ["id", "format", "title", "droppedBy"]
    missing = [k for k in required if not ref.get(k)]
    if missing:
        return False, f"Missing fields: {', '.join(missing)}"
    return True, "OK"


def check_step2_five_dimensions(ref: dict) -> Tuple[bool, str]:
    """All five analysis dimensions present and nonempty."""
    dims = ["layout", "skillTargeting", "difficulty", "theming", "printFormat"]
    missing = [d for d in dims if not ref.get(d) or ref.get(d) == {}]
    if missing:
        return False, f"Missing dimensions: {', '.join(missing)}"
    return True, "OK"


def check_step3_stored(ref: dict) -> Tuple[bool, str]:
    """Ref JSON exists and appears in the (generated) index.json manifest."""
    ref_id = ref.get("id", "")
    if not ref_id:
        return False, "Ref has no id field"
    if not (REFS_DIR / f"{ref_id}.json").exists():
        return False, "Ref JSON file missing"
    if not INDEX_JSON.exists():
        return False, "index.json missing (run --regen-index)"
    index = load_json(INDEX_JSON) or {}
    if ref_id not in {r.get("id") for r in index.get("references", [])}:
        return False, f"{ref_id} not in index.json (run --regen-index)"
    return True, "OK"


def check_step4_anchor_claims(ref: dict) -> Tuple[bool, str]:
    """
    Replaces the old homa-*.png check. The skill package ships no images;
    visual exemplars live in the founder-gated anchor pipeline. A ref only
    interacts with that pipeline by CLAIMING an anchor (stages.graduation
    mentioning anchor ids) or proposing one (benchBrief). Verify any claimed
    anchor id actually exists in both anchors.ts and anchor-sources/.
    """
    stages = ref.get("stages") or {}
    graduation = stages.get("graduation") or {}
    claimed = graduation.get("anchorIds") or []
    if not claimed:
        return True, "OK (no anchor claims; anchors are founder-gated)"
    known = anchor_ids()
    missing = [a for a in claimed if a not in known]
    if missing:
        return False, f"Claimed anchors not in registry+sources: {', '.join(missing)}"
    return True, f"OK ({len(claimed)} anchor claim(s) verified)"


def check_step5_recipe_crossref(ref: dict) -> Tuple[bool, str]:
    """
    recipeMatch present, and gap names are funnel-visible slugs. A non-slug
    gap name is silently dropped by cosmo-funnel's extractGapSlugs, which
    means the gap never appears in coverage tracking: fail loudly here.
    """
    rm = ref.get("recipeMatch", {})
    if not rm:
        return False, "No recipeMatch field"
    if "matchedRecipes" not in rm and "gaps" not in rm:
        return False, "recipeMatch has no matchedRecipes or gaps"
    bad = []
    for gap in rm.get("gaps", []) or []:
        name = gap if isinstance(gap, str) else (gap.get("name") or gap.get("format") or "")
        if name and name not in NON_FORMAT_GAPS and not SLUG_RE.match(name):
            bad.append(name)
    if bad:
        # Refs written under the rewritten skill carry a stages block and
        # must name gaps in funnel-visible slugs. Legacy refs predate the
        # rule; surface the problem without flunking the whole corpus.
        if ref.get("stages"):
            return False, f"Gap names invisible to the funnel (not multi-word slugs): {bad}"
        return True, f"OK (legacy ref; funnel-invisible gap names noted: {bad})"
    return True, "OK"


def check_step6_taste(ref: dict) -> Tuple[bool, str]:
    """
    Taste entry exists for founder drops. Bulk/heuristic refs are exempt:
    their analysis is template-filled, not a founder's choice, and must not
    pollute the taste model.
    """
    if ref.get("analysisQuality") == "heuristic" or "atlas" in str(ref.get("droppedBy", "")):
        return True, "OK (bulk/heuristic ref, taste exempt)"
    if not TASTE_MD.exists():
        return False, "homa-taste.md missing"
    taste = TASTE_MD.read_text()
    ref_id = ref.get("id", "")
    title = ref.get("title", "")
    if ref_id in taste or (title and title in taste):
        return True, "OK"
    # Date-match fallback is legacy-only: batch entries logged by date, but a
    # bare calendar date appearing anywhere in the taste file is far too weak
    # a signal to accept for refs written under the rewritten skill.
    if not ref.get("stages"):
        dropped = ref.get("droppedAt", "")
        if dropped and dropped[:10] in taste:
            return True, "OK (legacy date match; weak evidence)"
    return False, f"No taste entry found for {ref_id}"


def check_step7_gap_resolution(ref: dict) -> Tuple[bool, str]:
    """
    The real graduation check. Every funnel-visible gap slug must resolve:
      shipped   -> references/recipes/<slug>.md exists
      aliased   -> GAP_ALIASES maps it to a shipped slug
      registered-> activity-formats.md carries its Slug line
      open      -> acknowledged in .cosmo/open-gaps.json
    Anything else is an untracked gap: it looks handled but nothing and
    nobody owns it, which is exactly how work went missing before.
    """
    rm = ref.get("recipeMatch", {})
    slugs = []
    for gap in rm.get("gaps", []) or []:
        name = gap if isinstance(gap, str) else (gap.get("name") or gap.get("format") or "")
        if name and SLUG_RE.match(name) and name not in NON_FORMAT_GAPS:
            slugs.append(name)
    if not slugs:
        return True, "OK (no format gaps)"
    recipes = recipe_slugs()
    aliases = gap_aliases()
    registry = registry_slugs()
    acknowledged = open_gaps()
    unresolved = []
    for slug in slugs:
        target = aliases.get(slug, slug)
        if target in recipes or slug in registry or target in registry:
            continue
        if slug in acknowledged or target in acknowledged:
            continue
        unresolved.append(slug)
    if unresolved:
        return False, (
            f"Untracked gaps (no recipe, alias, registry entry, or "
            f"open-gaps.json record): {unresolved}"
        )
    return True, f"OK ({len(slugs)} gap(s) all tracked)"


def check_step8_activity_format(ref: dict) -> Tuple[bool, str]:
    """
    For each gap that shipped as a recipe file, the format should also be in
    the activity-formats.md registry (that is what lets the curriculum writer
    and lesson planner reference it by slug). Missing registrations must be
    acknowledged in open-gaps.json as kind "registry-missing".
    """
    if not ACTIVITY_FORMATS.exists():
        return False, "activity-formats.md missing"
    rm = ref.get("recipeMatch", {})
    slugs = []
    for gap in rm.get("gaps", []) or []:
        name = gap if isinstance(gap, str) else (gap.get("name") or gap.get("format") or "")
        if name and SLUG_RE.match(name) and name not in NON_FORMAT_GAPS:
            slugs.append(name)
    if not slugs:
        return True, "OK"
    recipes = recipe_slugs()
    aliases = gap_aliases()
    registry = registry_slugs()
    acknowledged = open_gaps()
    unregistered = []
    for slug in slugs:
        target = aliases.get(slug, slug)
        if target not in recipes:
            continue  # not shipped as a recipe; step 7's concern, not ours
        if slug in registry or target in registry:
            continue
        if slug in acknowledged or target in acknowledged:
            continue
        unregistered.append(target)
    if unregistered:
        return False, f"Shipped recipes missing registry entries: {sorted(set(unregistered))}"
    return True, "OK"


def check_step9_taxonomy(ref: dict) -> Tuple[bool, str]:
    """
    Two protections, born from the 2026-07-18 incident where an ingest run
    claimed +8 topics and actually deleted 33:
      1. If the ref proposes topics (stages.taxonomy.proposedTopics), each
         must actually exist in topics.json by name or slug.
      2. If topics.json differs from HEAD in this working tree, the diff must
         be additive: the current topic count may never be lower than HEAD's.
    unmappedSkills without a stages block is a legacy proposal, reported but
    passing (the graduation session owns landing it).
    """
    if not TOPICS_JSON.exists():
        return False, "topics.json missing"

    stages = ref.get("stages") or {}
    proposed = (stages.get("taxonomy") or {}).get("proposedTopics") or []
    topics_raw = TOPICS_JSON.read_text()
    if proposed:
        missing = []
        for topic in proposed:
            name = topic if isinstance(topic, str) else (topic.get("name") or topic.get("slug") or "")
            if name and name not in topics_raw:
                missing.append(name)
        if missing:
            return False, f"Proposed topics not found in topics.json: {missing}"

    # Additive assertion: compare working-tree TOPIC counts against HEAD's.
    # topics.json is {version, topicCount, topics: [...]}; count the topics
    # array, never the dict (a dict-key count is always 3 and catches nothing).
    head = subprocess.run(
        ["git", "show", "HEAD:packages/taxonomy/data/topics.json"],
        cwd=REPO_ROOT, capture_output=True, text=True, check=False,
    )
    if head.returncode == 0:
        try:
            head_topics = json.loads(head.stdout)
            now_topics = json.loads(topics_raw)
            head_count = len(head_topics.get("topics", []))
            now_count = len(now_topics.get("topics", []))
            if now_count < head_count:
                return False, (
                    f"topics.json shrank: {head_count} topics at HEAD -> "
                    f"{now_count} in working tree. Taxonomy edits are append-only."
                )
            declared = now_topics.get("topicCount")
            if declared is not None and declared != now_count:
                return False, (
                    f"topics.json internally inconsistent: topicCount says "
                    f"{declared} but the array holds {now_count}"
                )
        except json.JSONDecodeError:
            return False, "topics.json is not valid JSON"

    unmapped = (ref.get("skillTargeting") or {}).get("unmappedSkills", [])
    if proposed:
        return True, f"OK ({len(proposed)} proposed topic(s) verified, count non-decreasing)"
    if unmapped:
        return True, f"OK ({len(unmapped)} unmapped flagged for graduation session)"
    return True, "OK (no taxonomy work)"


def check_step10_teaching_rules(ref: dict) -> Tuple[bool, str]:
    """
    If the ref graduated a teaching insight (stages.graduation.kind ==
    "subject"), the cited subjects/ or approaches/ file must exist. Otherwise
    discretionary, as before.
    """
    stages = ref.get("stages") or {}
    graduation = stages.get("graduation") or {}
    if graduation.get("kind") != "subject":
        return True, "OK (discretionary)"
    targets = graduation.get("targets") or []
    if not targets:
        return False, 'graduation.kind is "subject" but no targets listed'
    missing = []
    for target in targets:
        path = (REPO_ROOT / target) if not str(target).startswith("/") else Path(target)
        if not path.exists():
            missing.append(str(target))
    if missing:
        return False, f"Cited teaching-rule files missing: {missing}"
    return True, f"OK ({len(targets)} teaching-rule file(s) exist)"


def check_step11_reply(ref: dict) -> Tuple[bool, str]:
    """
    The Slack thread reply cannot be verified from the filesystem. For drops
    with a sourceMessageTs, the reply is expected and the human-visible
    :ship: reaction is the final signal; bulk refs have no message to reply to.
    """
    ts = ref.get("sourceMessageTs")
    if not ts:
        return True, "OK (no sourceMessageTs, bulk ingest, no reply needed)"
    return True, f"OK (reply expected for ts: {ts})"


# ---------------------------------------------------------------------------
# Curriculum checks (cur-*.json). The old script had no curriculum mode, so
# curriculum :ship: reactions were entirely self-attested.
# ---------------------------------------------------------------------------

CUR_LAYERS = ["layer1_philosophy", "layer2_scope", "layer3_structure", "layer4_activities"]


def check_cur_identity(cur: dict) -> Tuple[bool, str]:
    required = ["id", "name", "droppedBy"]
    missing = [k for k in required if not cur.get(k)]
    if missing:
        return False, f"Missing fields: {', '.join(missing)}"
    return True, "OK"


def check_cur_layers(cur: dict) -> Tuple[bool, str]:
    missing = [l for l in CUR_LAYERS if not cur.get(l)]
    if missing:
        return False, f"Empty layers: {', '.join(missing)}"
    return True, "OK (all four layers present)"


def check_cur_indexed(cur: dict) -> Tuple[bool, str]:
    if not CUR_INDEX_JSON.exists():
        return False, "curriculums/index.json missing (run --regen-index)"
    index = load_json(CUR_INDEX_JSON) or {}
    cur_id = cur.get("id", "")
    if cur_id not in {c.get("id") for c in index.get("curriculums", [])}:
        return False, f"{cur_id or '(missing id)'} not in curriculums/index.json (run --regen-index)"
    return True, "OK"


def check_cur_decisions(cur: dict) -> Tuple[bool, str]:
    if "decisionsNeeded" not in cur:
        return False, "decisionsNeeded missing (may be an empty list, never absent)"
    return True, f"OK ({len(cur.get('decisionsNeeded') or [])} decision(s) recorded)"


def check_cur_gap_slugs(cur: dict) -> Tuple[bool, str]:
    """Layer 4 no_recipe suggestions must use funnel-visible slug names."""
    bad = []
    layer4 = cur.get("layer4_activities") or {}
    for activity in layer4.get("activityTypes", []) or []:
        if activity.get("status") != "no_recipe":
            continue
        suggested = (activity.get("suggestedRecipe") or {}).get("name", "")
        if suggested and not SLUG_RE.match(suggested):
            bad.append(suggested)
    if bad:
        return False, f"Suggested recipe names are not multi-word slugs: {bad}"
    return True, "OK"


# ---------------------------------------------------------------------------
# Index regeneration. index.json files are generated views of the individual
# JSONs. Hand-editing them is how 37 refs silently vanished from the manifest.
# ---------------------------------------------------------------------------

def regen_index() -> None:
    refs = []
    for path in sorted(REFS_DIR.glob("ref-*.json")):
        ref = load_json(path)
        if not ref:
            continue
        st = ref.get("skillTargeting") or {}
        refs.append({
            "id": ref.get("id", path.stem),
            "title": ref.get("title", ""),
            "droppedBy": ref.get("droppedBy", ""),
            "droppedAt": ref.get("droppedAt", ""),
            "subject": st.get("subject", ""),
            "domain": st.get("domain", ""),
            "format": ref.get("format", ""),
        })
    INDEX_JSON.write_text(json.dumps({"references": refs}, indent=2) + "\n")
    print(f"index.json regenerated: {len(refs)} references")

    curs = []
    if CURS_DIR.exists():
        for path in sorted(CURS_DIR.glob("cur-*.json")):
            cur = load_json(path)
            if not cur:
                continue
            stats = (cur.get("layer2_scope") or {}).get("stats") or {}
            total = stats.get("totalCurriculumTopics") or 0
            mapped = stats.get("mapped") or 0
            layer4 = (cur.get("layer4_activities") or {}).get("stats") or {}
            curs.append({
                "id": cur.get("id", path.stem),
                "name": cur.get("name", ""),
                "droppedBy": cur.get("droppedBy", ""),
                "droppedAt": cur.get("droppedAt", ""),
                "methodology": (cur.get("layer1_philosophy") or {}).get("methodology", ""),
                "mappedPct": round(100 * mapped / total) if total else None,
                "gapCount": layer4.get("noRecipe", 0),
                "decisionsCount": len(cur.get("decisionsNeeded") or []),
            })
        CUR_INDEX_JSON.write_text(json.dumps({"curriculums": curs}, indent=2) + "\n")
        print(f"curriculums/index.json regenerated: {len(curs)} curriculums")


# ---------------------------------------------------------------------------
# Runners
# ---------------------------------------------------------------------------

REF_CHECKS = [
    ("Step 1: Identify", check_step1_identify),
    ("Step 2: Five dimensions", check_step2_five_dimensions),
    ("Step 3: Store & index", check_step3_stored),
    ("Step 4: Anchor claims", check_step4_anchor_claims),
    ("Step 5: Recipe cross-ref", check_step5_recipe_crossref),
    ("Step 6: Taste signals", check_step6_taste),
    ("Step 7: Gap resolution", check_step7_gap_resolution),
    ("Step 8: Format registry", check_step8_activity_format),
    ("Step 9: Taxonomy", check_step9_taxonomy),
    ("Step 10: Teaching rules", check_step10_teaching_rules),
    ("Step 11: Reply sent", check_step11_reply),
]

CUR_CHECKS = [
    ("Cur 1: Identity", check_cur_identity),
    ("Cur 2: Four layers", check_cur_layers),
    ("Cur 3: Indexed", check_cur_indexed),
    ("Cur 4: Decisions recorded", check_cur_decisions),
    ("Cur 5: Gap slug shape", check_cur_gap_slugs),
]


def verify_one(item_id: str, verbose: bool = True, fail_counts: Optional[dict] = None) -> bool:
    if item_id.startswith("cur-"):
        item, checks = load_cur(item_id), CUR_CHECKS
    else:
        item, checks = load_ref(item_id), REF_CHECKS
    if item is None:
        if verbose:
            print(f"❌ {item_id}: JSON not found")
        return False

    all_pass = True
    failures = []
    for name, fn in checks:
        try:
            passed, msg = fn(item)
        except Exception as exc:  # a malformed corpus file fails its check, never the audit
            passed, msg = False, f"check crashed: {type(exc).__name__}: {exc}"
        if verbose:
            print(f"  {'✅' if passed else '❌'} {name}: {msg}")
        if not passed:
            all_pass = False
            failures.append(name)
            if fail_counts is not None:
                fail_counts[name] = fail_counts.get(name, 0) + 1

    if verbose:
        if all_pass:
            print(f"\n🚢 {item_id}: ALL STEPS PASSED, safe to react with :ship:")
        else:
            print(f"\n🚫 {item_id}: BLOCKED, fix before reacting with :ship:")
            print(f"   Failed: {', '.join(failures)}")
    return all_pass


def all_ids() -> list:
    ids = [Path(p).stem for p in sorted(glob.glob(str(REFS_DIR / "ref-*.json")))]
    if CURS_DIR.exists():
        ids += [Path(p).stem for p in sorted(glob.glob(str(CURS_DIR / "cur-*.json")))]
    return ids


def main():
    args = [a for a in sys.argv[1:] if a != "--no-fetch"]
    no_fetch = "--no-fetch" in sys.argv
    if not args:
        print("Usage: verify-ingestion.py <ref-id|cur-id> | --all | --recent <days> | --regen-index [--no-fetch]")
        sys.exit(1)

    if args[0] == "--regen-index":
        regen_index()
        sys.exit(0)

    ok, msg = preflight(no_fetch=no_fetch)
    if not ok:
        print(f"🚫 PREFLIGHT FAILED: {msg}")
        sys.exit(1)

    if args[0] == "--all":
        ids = all_ids()
        fail_counts: dict = {}
        passed = 0
        for item_id in ids:
            print(f"\n{'=' * 60}\nChecking: {item_id}")
            if verify_one(item_id, fail_counts=fail_counts):
                passed += 1
        print(f"\n{'=' * 60}")
        print(f"TOTAL: {len(ids)} | PASSED: {passed} | FAILED: {len(ids) - passed}")
        if fail_counts:
            print("Failure matrix (step -> count):")
            for name, count in sorted(fail_counts.items(), key=lambda kv: -kv[1]):
                print(f"  {name}: {count}")
        sys.exit(0 if passed == len(ids) else 1)

    if args[0] == "--recent":
        days = int(args[1]) if len(args) > 1 else 7
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        recent = []
        for item_id in all_ids():
            parts = item_id.split("-")
            if len(parts) >= 4 and "-".join(parts[1:4]) >= cutoff:
                recent.append(item_id)
        if not recent:
            print(f"No refs or curriculums found in last {days} days")
            sys.exit(0)
        passed = 0
        for item_id in recent:
            print(f"\n{'=' * 60}\nChecking: {item_id}")
            if verify_one(item_id):
                passed += 1
        print(f"\n{'=' * 60}")
        print(f"RECENT ({days}d): {len(recent)} | PASSED: {passed} | FAILED: {len(recent) - passed}")
        sys.exit(0 if passed == len(recent) else 1)

    sys.exit(0 if verify_one(args[0]) else 1)


if __name__ == "__main__":
    main()
