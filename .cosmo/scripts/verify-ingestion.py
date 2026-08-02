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
    python3 verify-ingestion.py <ref-id>       # analysis, before Slack closeout
    python3 verify-ingestion.py <cur-id>       # analysis, before Slack closeout
    python3 verify-ingestion.py <id> --require-closeout
                                               # require finalizer receipts too
    python3 verify-ingestion.py <id> --require-portable-source
                                               # reject local-only source proof
    python3 verify-ingestion.py --all          # audit every ref and cur
    python3 verify-ingestion.py --recent 7     # refs and curs from last N days
    python3 verify-ingestion.py --regen-index  # rebuild both index.json files
                                               # from the individual JSONs
    Add --no-fetch to skip the network fetch in preflight (offline use).

The default verdict is deliberately pre-closeout because the finalizer runs
this verifier before it posts or reacts in Slack. It never calls that result
fully complete. Use --require-closeout after finalization to require the
persisted reply, reaction, and curriculum-summary readback receipts.

OPEN GAPS:
Not every recorded gap has a shipped recipe yet, and that is fine as long as
the backlog is explicit. .cosmo/open-gaps.json is the machine-readable list
of acknowledged-open gaps. Step 7 fails only on a gap that is neither
shipped, aliased, registered, nor acknowledged there.
"""

import glob
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Tuple
from urllib.parse import urlparse

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
TEXT_DIR = COSMO / "text"
MASTERS_DIR = COSMO / "masters"
SOURCE_FILES_DIR = COSMO / "inspo-files"

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

# Aboutness (dimension F, gh#366) and lesson decomposition (Layer 5, gh#367)
# are required for drops from this date on. Earlier drops predate the rule and
# soften, per the legacy policy below: their backfill is blocked on originals
# that live only on Cosmo's laptop, and the --all matrix is where that debt
# stays visible. Do not move this date to turn a red run green.
CONTENT_RULES_FROM = "2026-07-28"

ENTITY_KINDS = {"person", "character", "place", "organization", "animal", "event", "object"}
GATE_REVIEW_DISPOSITIONS = {
    "accepted-source-artifact",
    "excluded-from-analysis",
    "re-share-requested",
    "mixed-reviewed",
}

# What part a claim plays, which is what decides whether it may answer a
# content search. A span proves a thing is present; it cannot tell you the
# item is about it. The scar: the Fast Forward cover is a photograph of a
# swan, perfectly quotable and perfectly wrong to tag, because "books about
# swans for a six-year-old" must never return a phonics workbook.
CONTENT_ROLES = {"teaches", "about"}
CLAIM_ROLES = CONTENT_ROLES | {"cast", "identity", "decoration"}
WORK_KINDS = {"book", "poem", "song", "film", "artwork", "game", "website", "curriculum"}
EXTRACTION_QUALITY = {"full", "partial", "unavailable"}
DECOMPOSITION_QUALITY = {"full", "partial", "unavailable"}
BLOB_READ_BACK_RECEIPT_VERSION = "sha256-content-type-v1"
EXPECTED_BLOB_HOST = "pkvvudjdhxk33dig.public.blob.vercel-storage.com"


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


def check_step11_reply(item: dict) -> Tuple[bool, str]:
    """Require the receipts written only after finalizer Slack readback."""
    ts = item.get("sourceMessageTs")
    if not ts:
        return True, "OK (no sourceMessageTs, bulk ingest, no reply needed)"
    stages = item.get("stages") or {}
    if not isinstance(stages.get("slackReplyTs"), str) or not stages.get(
        "slackReplyTs", ""
    ).strip():
        return False, f"Slack reply receipt is missing for source ts {ts}"
    if stages.get("shipReaction") is not True:
        return False, f":ship: readback receipt is missing for source ts {ts}"
    if item.get("id", "").startswith("cur-"):
        if not isinstance(stages.get("devSummaryTs"), str) or not stages.get(
            "devSummaryTs", ""
        ).strip():
            return False, "curriculum developer-summary receipt is missing"
    return True, f"OK (Slack reply and :ship: readback receipts persisted for {ts})"


def _positive_page_count(value) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def validate_capture_page_counts(
    receipt: dict, *, allow_legacy: bool
) -> Tuple[bool, str]:
    observed = receipt.get("pageCount")
    expected = receipt.get("expectedPageCount")
    if expected is None and allow_legacy:
        if observed is None or _positive_page_count(observed):
            return True, "OK (legacy capture predates portable page-count assertion)"
    if not _positive_page_count(observed):
        return False, "capture pageCount must be a positive integer"
    if not _positive_page_count(expected):
        return False, "capture expectedPageCount must be a positive independent assertion"
    if observed != expected:
        return False, f"capture has {observed} page(s), independently expected {expected}"
    return True, f"OK ({observed} observed page(s) match the independent assertion)"


def _review_source_receipt(item_id: str, receipt: dict) -> Optional[dict]:
    raw = receipt.get("sourceReceipt")
    if raw is None:
        source = receipt.get("source") or {}
        raw = {
            "version": 1,
            "recordId": receipt.get("id", item_id),
            "kind": receipt.get(
                "kind", "curriculum" if item_id.startswith("cur-") else "reference"
            ),
            "parts": source.get("parts"),
        }
    if not isinstance(raw, dict) or not isinstance(raw.get("parts"), list):
        return None
    parts = []
    for part in raw["parts"]:
        if not isinstance(part, dict):
            return None
        parts.append({
            "file": part.get("file"),
            "sha256": part.get("sha256"),
            "bytes": part.get("bytes"),
        })
    return {
        "version": raw.get("version"),
        "recordId": raw.get("recordId"),
        "kind": raw.get("kind"),
        "parts": parts,
    }


def capture_review_binding(item_id: str, receipt: dict) -> Optional[dict]:
    observed = receipt.get("pageCount")
    expected = receipt.get("expectedPageCount")
    source = _review_source_receipt(item_id, receipt)
    if (
        not item_id
        or not _positive_page_count(observed)
        or not _positive_page_count(expected)
        or source is None
        or not source["parts"]
    ):
        return None
    encoded = json.dumps(
        source, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    return {
        "version": 1,
        "recordId": item_id,
        "sourceReceiptSha256": hashlib.sha256(encoded).hexdigest(),
        "pageCount": observed,
        "expectedPageCount": expected,
    }


def _valid_reviewed_at(value) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    try:
        datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


def validate_capture_gate_receipt(
    receipt: dict,
    review: Optional[dict],
    *,
    allow_legacy: bool,
    item_id: str = "",
) -> Tuple[bool, str]:
    status = receipt.get("gateStatus")
    if status is None:
        if allow_legacy:
            return True, "OK (legacy capture predates explicit gate status)"
        return False, "portable capture gate receipt is missing; rerun book-intake.py --check"
    findings = receipt.get("gateFindings")
    if not isinstance(findings, list) or any(not isinstance(row, str) for row in findings):
        return False, "book-intake gateFindings is not a string array"
    encoded = json.dumps(
        findings, ensure_ascii=False, separators=(",", ":")
    ).encode("utf-8")
    digest = hashlib.sha256(encoded).hexdigest()
    if receipt.get("gateFindingCount") != len(findings):
        return False, "book-intake gate finding count does not match its findings"
    if receipt.get("gateFindingsSha256") != digest:
        return False, "book-intake gate finding digest does not match its findings"
    if status == "complete":
        if findings:
            return False, "book-intake says complete but still has unresolved findings"
        return True, "OK (portable deterministic capture receipt has no findings)"
    if status != "findings":
        return False, f"book-intake gateStatus is {status!r}; rerun book-intake.py --check"
    if not findings:
        return False, "book-intake says findings but its finding set is empty"
    review = review or {}
    binding = capture_review_binding(item_id, receipt)
    required = (
        review.get("status") == "reviewed",
        review.get("findingsSha256") == digest,
        review.get("findingCount") == len(findings),
        review.get("disposition") in GATE_REVIEW_DISPOSITIONS,
        _valid_reviewed_at(review.get("reviewedAt")),
        isinstance(review.get("note"), str) and bool(review.get("note", "").strip()),
    )
    if not all(required):
        return False, "book-intake findings lack an exact reviewed disposition"
    unresolved = review.get("unresolvedFindingCount")
    if (
        not isinstance(unresolved, int)
        or isinstance(unresolved, bool)
        or unresolved < 0
    ):
        return False, "book-intake review must state a nonnegative unresolvedFindingCount"
    if review.get("disposition") == "re-share-requested":
        return False, "re-share-requested is not a terminal capture disposition"
    if unresolved != 0:
        return False, (
            f"book-intake review still has {unresolved} unresolved finding(s)"
        )
    if not allow_legacy:
        if binding is None:
            return False, "book-intake review cannot bind to malformed capture identity"
        if receipt.get("sourceReceipt") is not None and receipt.get(
            "reviewBinding"
        ) != binding:
            return False, "portable capture reviewBinding differs from capture identity"
        if review.get("captureBinding") != binding:
            return False, "book-intake review is not bound to this source and page assertion"
    return True, (
        f"OK ({len(findings)} capture finding(s) reviewed as "
        f"{review['disposition']})"
    )


def _source_receipt_core(receipt: dict) -> Optional[dict]:
    """Validated source receipt fields used for both portable and local checks."""
    if not isinstance(receipt, dict):
        return None
    parts = receipt.get("parts")
    if (
        receipt.get("version") != 1
        or not isinstance(receipt.get("recordId"), str)
        or receipt.get("kind") not in {"reference", "curriculum"}
        or not isinstance(parts, list)
        or not parts
    ):
        return None
    normalized = []
    for part in parts:
        if not isinstance(part, dict):
            return None
        filename = part.get("file")
        digest = part.get("sha256")
        byte_count = part.get("bytes")
        if (
            not isinstance(filename, str)
            or not filename
            or not isinstance(digest, str)
            or re.fullmatch(r"[0-9a-f]{64}", digest) is None
            or not isinstance(byte_count, int)
            or isinstance(byte_count, bool)
            or byte_count <= 0
        ):
            return None
        normalized.append({
            "file": filename,
            "sha256": digest,
            "bytes": byte_count,
        })
    return {
        "version": 1,
        "recordId": receipt["recordId"],
        "kind": receipt["kind"],
        "parts": normalized,
    }


def _source_file_identity(source_file: dict) -> Optional[tuple[str, int]]:
    if not isinstance(source_file, dict):
        return None
    digest = source_file.get("sha256")
    size = source_file.get("size", source_file.get("bytes"))
    if (
        not isinstance(digest, str)
        or re.fullmatch(r"[0-9a-f]{64}", digest) is None
        or not isinstance(size, int)
        or isinstance(size, bool)
        or size <= 0
    ):
        return None
    return digest, size


def _normalized_content_type(value) -> str:
    if not isinstance(value, str):
        return ""
    return value.split(";", 1)[0].strip().lower()


def _has_exact_homa_blob_url(item_id: str, source_file: dict) -> bool:
    url = source_file.get("blobUrl") if isinstance(source_file, dict) else None
    if not isinstance(url, str) or not url:
        return False
    parsed = urlparse(url)
    expected_prefix = f"/inspo/{item_id}/"
    return all((
        parsed.scheme == "https",
        parsed.netloc == EXPECTED_BLOB_HOST,
        parsed.path.startswith(expected_prefix),
        parsed.path != expected_prefix,
        not parsed.params,
        not parsed.query,
        not parsed.fragment,
    ))


def _has_bound_blob_readback(item_id: str, source_file: dict) -> bool:
    identity = _source_file_identity(source_file)
    if identity is None:
        return False
    digest, size = identity
    content_type = _normalized_content_type(source_file.get("contentType"))
    receipt_identity = f"{digest}:{content_type}"
    return all((
        _has_exact_homa_blob_url(item_id, source_file),
        source_file.get("blobReadBackVerified") is True,
        isinstance(source_file.get("blobReadBackVerifiedAt"), str),
        bool(source_file.get("blobReadBackVerifiedAt", "").strip()),
        source_file.get("blobReadBackSize") == size,
        source_file.get("blobReadBackSha256") == digest,
        bool(content_type),
        _normalized_content_type(source_file.get("blobReadBackContentType"))
        == content_type,
        source_file.get("blobReadBackReceiptVersion")
        == BLOB_READ_BACK_RECEIPT_VERSION,
        source_file.get("blobReadBackIdentity") == receipt_identity,
    ))


def _sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _has_safe_local_source_proof(source_file: dict) -> bool:
    identity = _source_file_identity(source_file)
    local_value = source_file.get("localPath") if isinstance(source_file, dict) else None
    if identity is None or not isinstance(local_value, str) or not local_value:
        return False
    candidate = Path(local_value)
    if not candidate.is_absolute():
        candidate = REPO_ROOT / candidate
    try:
        if candidate.is_symlink():
            return False
        resolved = candidate.resolve(strict=True)
        resolved.relative_to(SOURCE_FILES_DIR.resolve(strict=True))
        if not resolved.is_file() or resolved.stat().st_size != identity[1]:
            return False
        return _sha256_path(resolved) == identity[0]
    except (OSError, ValueError):
        return False


def _source_file_has_byte_proof(item_id: str, source_file: dict) -> bool:
    return _has_bound_blob_readback(
        item_id, source_file
    ) or _has_safe_local_source_proof(source_file)


def _manifest_source_receipt(item_id: str, manifest: dict) -> Optional[dict]:
    source = manifest.get("source") or {}
    parts = source.get("parts")
    if not parts and manifest.get("captureMethod") == "manual-local-image-review":
        parts = []
        for expected_page, page in enumerate(manifest.get("pages") or [], 1):
            if not isinstance(page, dict) or page.get("page") != expected_page:
                return None
            local_value = page.get("sourceLocalPath")
            if not isinstance(local_value, str) or not local_value:
                return None
            source_path = Path(local_value)
            if not source_path.is_absolute():
                source_path = REPO_ROOT / source_path
            byte_count = page.get("bytes")
            if byte_count is None:
                try:
                    source_path.resolve().relative_to(REPO_ROOT.resolve())
                    byte_count = source_path.stat().st_size
                except (OSError, ValueError):
                    return None
            parts.append({
                "file": Path(local_value).name,
                "sha256": page.get("sha256"),
                "bytes": byte_count,
            })
    return _source_receipt_core({
        "version": 1,
        "recordId": manifest.get("id"),
        "kind": manifest.get("kind"),
        "parts": parts,
    })


def validate_capture_source_receipt(
    item: dict,
    manifest: Optional[dict],
    *,
    allow_legacy: bool,
    require_portable_source: bool = False,
) -> Tuple[bool, str]:
    """Bind committed source identity to retained files and a local manifest."""
    item_id = item.get("id", "")
    capture = item.get("capture") or {}
    raw_receipt = capture.get("sourceReceipt")
    if raw_receipt is None and allow_legacy and not require_portable_source:
        return True, "OK (legacy capture predates portable source identity)"
    receipt = _source_receipt_core(raw_receipt)
    if receipt is None:
        return False, "portable sourceReceipt is missing or malformed"
    expected_kind = "curriculum" if item_id.startswith("cur-") else "reference"
    if receipt["recordId"] != item_id or receipt["kind"] != expected_kind:
        return False, "portable sourceReceipt is bound to a different record id or kind"

    retained = item.get("sourceFiles")
    if not isinstance(retained, list) or not retained:
        return False, "portable sourceReceipt has no retained sourceFiles to verify"
    invalid_canonical = []
    for index, source_file in enumerate(retained):
        identity = _source_file_identity(source_file)
        if identity is None:
            if require_portable_source or not allow_legacy:
                invalid_canonical.append(index)
            continue
    if invalid_canonical:
        return False, (
            "retained sourceFiles lack a valid sha256 and positive size: "
            f"{invalid_canonical[:12]}"
        )

    used = set()
    receipt_identities = set()
    for part in receipt["parts"]:
        identity = (part["sha256"], part["bytes"])
        receipt_identities.add(identity)
        match = None
        for index, source_file in enumerate(retained):
            if index in used or not isinstance(source_file, dict):
                continue
            local_name = Path(str(source_file.get("localPath") or "")).name
            source_names = {source_file.get("filename"), local_name}
            size = source_file.get("size", source_file.get("bytes"))
            if (
                source_file.get("sha256") == part["sha256"]
                and size == part["bytes"]
                and part["file"] in source_names
            ):
                match = index
                break
        if match is None:
            return False, (
                "portable sourceReceipt part is not retained with the same "
                f"name, hash, and size: {part['file']}"
            )
        used.add(match)

    uncovered_occurrences = []
    for index, source_file in enumerate(retained):
        if index in used or _source_file_identity(source_file) is None:
            continue
        duplicate_of = source_file.get("duplicateOf")
        if not isinstance(duplicate_of, dict):
            uncovered_occurrences.append(index)
            continue
        duplicate_name = duplicate_of.get("filename")
        duplicate_ts = duplicate_of.get("slackMessageTs")
        canonical_matches = [
            canonical_index
            for canonical_index in used
            if retained[canonical_index].get("filename") == duplicate_name
            and retained[canonical_index].get("slackMessageTs") == duplicate_ts
            and _source_file_identity(retained[canonical_index])
            == _source_file_identity(source_file)
        ]
        if len(canonical_matches) != 1:
            uncovered_occurrences.append(index)
    if uncovered_occurrences:
        return False, (
            "portable sourceReceipt does not directly cover, or bind through "
            "a byte-identical duplicateOf, retained source occurrence(s): "
            f"{uncovered_occurrences[:12]}"
        )

    unproved = [
        index
        for index, source_file in enumerate(retained)
        if _source_file_identity(source_file) in receipt_identities
        and not (
            _has_bound_blob_readback(item_id, source_file)
            if require_portable_source
            else _source_file_has_byte_proof(item_id, source_file)
        )
    ]
    if unproved and (require_portable_source or not allow_legacy):
        proof_requirement = (
            "an exact bound Homa Blob readback receipt"
            if require_portable_source
            else "an exact bound Homa Blob readback receipt or safe local hash proof"
        )
        return False, (
            f"{len(unproved)} retained source occurrence(s) lack "
            f"{proof_requirement}"
        )

    if manifest is not None:
        local_receipt = _manifest_source_receipt(item_id, manifest)
        if local_receipt is None:
            return False, "local manifest source identity is missing or malformed"
        if receipt != local_receipt:
            return False, "portable sourceReceipt differs from the local manifest"
    proof_note = "legacy metadata" if unproved else "byte proof"
    return True, (
        f"OK ({len(receipt['parts'])} retained source part(s) verified with "
        f"{proof_note})"
    )


def validate_source_completion(item: dict) -> Tuple[bool, str]:
    source_status = (item.get("sourceCompleteness") or {}).get("status")
    if source_status in {"requested", "awaiting-source"}:
        return False, f"source completeness is still {source_status}"
    recovery_status = (item.get("originalRecovery") or {}).get("status")
    if recovery_status == "requested":
        return False, "original source recovery is still requested"
    return True, "OK (no source request remains open)"


def check_capture_gates(
    item: dict, *, require_portable_source: bool = False
) -> Tuple[bool, str]:
    """A committed portable gate receipt must survive without ignored masters."""
    completion_passed, completion_message = validate_source_completion(item)
    if not completion_passed:
        return completion_passed, completion_message
    item_id = item.get("id", "")
    capture = item.get("capture") or {}
    allow_legacy = _predates_content_rules(item)
    manifest_path = MASTERS_DIR / item_id / "manifest.json"
    if not manifest_path.exists():
        counts_passed, counts_message = validate_capture_page_counts(
            capture, allow_legacy=allow_legacy
        )
        if not counts_passed:
            return counts_passed, counts_message
        source_passed, source_message = validate_capture_source_receipt(
            item,
            None,
            allow_legacy=allow_legacy,
            require_portable_source=require_portable_source,
        )
        if not source_passed:
            return source_passed, source_message
        passed, message = validate_capture_gate_receipt(
            capture,
            capture.get("gateReview"),
            allow_legacy=allow_legacy,
            item_id=item_id,
        )
        if not passed:
            return passed, message
        return True, f"{counts_message}; {message}; {source_message}"

    manifest = load_json(manifest_path)
    if not manifest:
        return False, "book-intake manifest is unreadable"
    counts_passed, counts_message = validate_capture_page_counts(
        manifest, allow_legacy=allow_legacy
    )
    if not counts_passed:
        return counts_passed, counts_message
    pages = manifest.get("pages")
    if not isinstance(pages, list) or len(pages) != manifest.get("pageCount"):
        return False, "book-intake manifest pageCount differs from its page rows"
    source_passed, source_message = validate_capture_source_receipt(
        item,
        manifest,
        allow_legacy=allow_legacy,
        require_portable_source=require_portable_source,
    )
    if not source_passed:
        return source_passed, source_message
    passed, message = validate_capture_gate_receipt(
        manifest,
        capture.get("gateReview"),
        allow_legacy=allow_legacy,
        item_id=item_id,
    )
    if not passed or manifest.get("gateStatus") is None:
        return passed, message

    portable_fields = (
        "gateStatus",
        "gateFindings",
        "gateFindingCount",
        "gateFindingsSha256",
        "pageCount",
        "expectedPageCount",
    )
    drifted = [field for field in portable_fields if capture.get(field) != manifest.get(field)]
    if drifted:
        return False, f"portable capture receipt differs from local manifest: {drifted}"
    return True, f"{counts_message}; {message}; {source_message}"


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
# Content checks: aboutness (dimension F, gh#366) and lesson decomposition
# (Layer 5, gh#367).
#
# Dimensions A-E describe form. These describe content, and they exist because
# the corpus could not answer "what do we have about insects for a
# three-year-old". The enforcement idea is the models-judge-code-verifies law:
# the model proposes claims, each claim carries a verbatim span, and this gate
# re-checks the span against the extracted-text sidecar. A claim the source
# does not support is dropped, never softened.
#
# Legacy: pre-CONTENT_RULES_FROM drops soften (new-rule policy above). Their
# backfill is blocked on originals that exist only on Cosmo's laptop, so the
# --all matrix is the honest place for that debt to sit.
# ---------------------------------------------------------------------------

def _dropped_on(item: dict) -> str:
    """Canonical YYYY-MM-DD from the record id, with legacy fallback only."""
    item_id = item.get("id", "") or ""
    m = re.search(r"(?:ref|cur)-(\d{4}-\d{2}-\d{2})-", item_id)
    if m:
        return m.group(1)
    raw = (item.get("droppedAt") or "")[:10]
    if re.match(r"^\d{4}-\d{2}-\d{2}$", raw):
        return raw
    return ""


def _predates_content_rules(item: dict) -> bool:
    dropped = _dropped_on(item)
    return bool(dropped) and dropped < CONTENT_RULES_FROM


def _normalize(text: str) -> str:
    """Whitespace-normalized comparison form. Verbatim means the words, not
    the line wrapping a PDF happened to use."""
    return re.sub(r"\s+", " ", text or "").strip()


def text_sidecar(item_id: str) -> Optional[str]:
    """Normalized extracted text for an item, or None when it was not kept.
    The directory is gitignored: extracted text of a copyrighted book is the
    copyrighted work (founder ruling inspo-originals-offrepo)."""
    path = TEXT_DIR / f"{item_id}.txt"
    if not path.exists():
        return None
    try:
        return _normalize(path.read_text(errors="replace"))
    except OSError:
        return None


def _aboutness_claims(about: dict) -> list:
    """(label, name, span) for every aboutness claim that must carry a span."""
    out = []
    for s in about.get("subjects") or []:
        out.append(("subject", s.get("name", ""), s.get("quote", "")))
    for e in about.get("entities") or []:
        out.append(("entity", e.get("name", ""), e.get("quote", "")))
    for t in about.get("themes") or []:
        out.append(("theme", t.get("name", ""), t.get("evidence", "")))
    for k in about.get("keyTerms") or []:
        out.append(("key term", k.get("term", ""), k.get("quote", "")))
    for w in about.get("referencedWorks") or []:
        out.append(("work", w.get("title", ""), w.get("quote", "")))
    return out


def _unit_claims(unit: dict) -> list:
    """(label, name, span) for every claim inside one decomposed unit."""
    out = []
    topic = unit.get("topic")
    if isinstance(topic, dict):
        out.append(("topic", topic.get("name", ""), topic.get("quote", "")))
    for w in unit.get("referencedWorks") or []:
        out.append(("work", w.get("title", ""), w.get("quote", "")))
    for q in unit.get("questions") or []:
        out.append(("question", (q.get("text") or "")[:40], q.get("quote", "")))
    for t in unit.get("themes") or []:
        out.append(("theme", t.get("name", ""), t.get("evidence", "")))
    for a in unit.get("activities") or []:
        out.append(("activity", (a.get("description") or "")[:40], a.get("quote", "")))
    for m in unit.get("materials") or []:
        out.append(("material", m.get("name", ""), m.get("quote", "")))
    return out


def _verify_spans(claims: list, source: Optional[str]) -> Tuple[list, list]:
    """Splits claims into (spanless, unsupported). A None source means the
    text was never kept, so nothing can be verified and that is reported
    rather than assumed fine."""
    spanless = [f"{label} {name!r}" for label, name, span in claims if not (span or "").strip()]
    if source is None:
        return spanless, []
    unsupported = [
        f"{label} {name!r}"
        for label, name, span in claims
        if (span or "").strip() and _normalize(span) not in source
    ]
    return spanless, unsupported


def check_aboutness(item: dict) -> Tuple[bool, str]:
    """Dimension F. Applies to references and curriculums alike."""
    about = item.get("aboutness")
    if not about:
        if _predates_content_rules(item):
            return True, f"legacy drop (pre-{CONTENT_RULES_FROM}), backfill tracked in gh#366"
        return False, ("aboutness missing; dimension F is required "
                       "(.agents/skills/reference-ingestion/references/aboutness.md)")
    if not isinstance(about, dict):
        return False, "aboutness must be an object"

    quality = about.get("extractionQuality")
    if quality not in EXTRACTION_QUALITY:
        return False, f"extractionQuality must be one of {sorted(EXTRACTION_QUALITY)}, got {quality!r}"

    problems = []
    subjects = about.get("subjects") or []
    if not subjects:
        problems.append("subjects is empty (what is this item about?)")
    for e in about.get("entities") or []:
        if e.get("kind") not in ENTITY_KINDS:
            problems.append(f"entity {e.get('name', '?')!r} has kind {e.get('kind')!r}")
    for w in about.get("referencedWorks") or []:
        if w.get("kind") not in WORK_KINDS:
            problems.append(f"work {w.get('title', '?')!r} has kind {w.get('kind')!r}")

    # Roles decide what may answer a content search, so a missing role is not
    # a cosmetic omission: it is an unlabelled claim that search has to guess
    # about, and guessing is how a swan on a cover ends up answering "books
    # about swans".
    for claim in subjects + (about.get("entities") or []):
        role = claim.get("role")
        label = claim.get("name", "?")
        if role is None:
            problems.append(f"claim {label!r} has no role (one of {sorted(CLAIM_ROLES)})")
        elif role not in CLAIM_ROLES:
            problems.append(f"claim {label!r} has role {role!r}, not one of {sorted(CLAIM_ROLES)}")
    if subjects and not any(s.get("role") in CONTENT_ROLES for s in subjects):
        problems.append(
            "no subject carries a content role (teaches/about), so this item can never "
            "answer a content question. If that is genuinely true, say why in aboutness.notes"
        )

    if quality == "unavailable":
        if not about.get("reason"):
            problems.append("extractionQuality 'unavailable' requires a reason")
        if problems:
            return False, "; ".join(problems)
        return True, "OK (no readable text; subjects recorded, spans not required)"

    claims = _aboutness_claims(about)
    source = text_sidecar(item.get("id", ""))
    spanless, unsupported = _verify_spans(claims, source)
    if spanless:
        problems.append(f"claims with no verbatim span: {', '.join(spanless[:5])}")
    if unsupported:
        problems.append(
            f"{len(unsupported)} span(s) absent from the text sidecar, drop those claims: "
            + ", ".join(unsupported[:5])
        )
    if problems:
        return False, "; ".join(problems)

    if source is None:
        return True, (f"OK shape, {len(claims)} claim(s); spans UNVERIFIED, no text sidecar at "
                      f".cosmo/text/{item.get('id', '')}.txt")
    return True, f"OK ({len(claims)} claim(s), every span verified against the text sidecar)"


def check_cur_lesson_decomposition(cur: dict) -> Tuple[bool, str]:
    """Layer 5. The counts are load-bearing: a padded 'full' over a sampled
    pass is a lie the index cannot detect later."""
    layer5 = cur.get("layer5_lessons")
    if not layer5:
        if _predates_content_rules(cur):
            return True, f"legacy curriculum (pre-{CONTENT_RULES_FROM}), backfill tracked in gh#367"
        return False, ("layer5_lessons missing "
                       "(.agents/skills/curriculum-ingestion/references/lesson-decomposition.md)")
    if not isinstance(layer5, dict):
        return False, "layer5_lessons must be an object"

    quality = layer5.get("decompositionQuality")
    if quality not in DECOMPOSITION_QUALITY:
        return False, (f"decompositionQuality must be one of {sorted(DECOMPOSITION_QUALITY)}, "
                       f"got {quality!r}")
    if quality == "unavailable":
        if not layer5.get("reason"):
            return False, "decompositionQuality 'unavailable' requires a reason"
        return True, "OK (curriculum declares no unit structure, reason recorded)"

    units = layer5.get("units")
    if not isinstance(units, list) or not units:
        return False, "units must be a nonempty list when decomposition is full or partial"

    found, done = layer5.get("unitsFound"), layer5.get("unitsDecomposed")
    problems = []
    if not isinstance(found, int) or not isinstance(done, int):
        problems.append("unitsFound and unitsDecomposed must both be integers")
    else:
        if done > found:
            problems.append(f"unitsDecomposed ({done}) exceeds unitsFound ({found})")
        if len(units) != done:
            problems.append(f"unitsDecomposed says {done} but units carries {len(units)} row(s)")
        if quality == "full" and done != found:
            problems.append(f"'full' requires every unit decomposed ({done} of {found}); use 'partial'")

    ordinals = []
    for i, unit in enumerate(units):
        if not isinstance(unit, dict):
            problems.append(f"unit {i} is not an object")
            continue
        if not isinstance(unit.get("ordinal"), int):
            problems.append(f"unit {i} has no integer ordinal")
        else:
            ordinals.append(unit["ordinal"])
        if not unit.get("unitLabel"):
            problems.append(f"unit {i} has no unitLabel")
        topic = unit.get("topic")
        if not isinstance(topic, dict) or not topic.get("name"):
            problems.append(f"unit {i} has no topic.name")
    dupes = {o for o in ordinals if ordinals.count(o) > 1}
    if dupes:
        problems.append(f"duplicate ordinals: {sorted(dupes)}")

    claims = [c for unit in units if isinstance(unit, dict) for c in _unit_claims(unit)]
    source = text_sidecar(cur.get("id", ""))
    spanless, unsupported = _verify_spans(claims, source)
    if spanless:
        problems.append(f"claims with no verbatim span: {', '.join(spanless[:5])}")
    if unsupported:
        problems.append(
            f"{len(unsupported)} span(s) absent from the text sidecar, drop those claims: "
            + ", ".join(unsupported[:5])
        )
    if problems:
        return False, "; ".join(problems)

    works = sum(len(u.get("referencedWorks") or []) for u in units if isinstance(u, dict))
    verified = "spans UNVERIFIED (no text sidecar)" if source is None else "every span verified"
    return True, f"OK ({len(units)} unit(s), {works} referenced work(s), {verified})"


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
        about = ref.get("aboutness") or {}
        refs.append({
            "id": ref.get("id", path.stem),
            "title": ref.get("title", ""),
            "droppedBy": ref.get("droppedBy", ""),
            "droppedAt": ref.get("droppedAt", ""),
            "subject": st.get("subject", ""),
            "domain": st.get("domain", ""),
            "format": ref.get("format", ""),
            # Aboutness projection (gh#366): what the item is about, so the
            # manifest answers content questions without opening 188 files.
            "about": [s.get("name", "") for s in about.get("subjects") or []],
            "entities": [e.get("name", "") for e in about.get("entities") or []],
            "themes": [t.get("name", "") for t in about.get("themes") or []],
            "works": [w.get("title", "") for w in about.get("referencedWorks") or []],
            "ageBand": (ref.get("difficulty") or {}).get("ageBand"),
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
            about = cur.get("aboutness") or {}
            layer5 = cur.get("layer5_lessons") or {}
            units = layer5.get("units") or []
            curs.append({
                "id": cur.get("id", path.stem),
                "name": cur.get("name", ""),
                "droppedBy": cur.get("droppedBy", ""),
                "droppedAt": cur.get("droppedAt", ""),
                "methodology": (cur.get("layer1_philosophy") or {}).get("methodology", ""),
                "mappedPct": round(100 * mapped / total) if total else None,
                "gapCount": layer4.get("noRecipe", 0),
                "decisionsCount": len(cur.get("decisionsNeeded") or []),
                # Aboutness (gh#366) and decomposition reach (gh#367).
                "about": [s.get("name", "") for s in about.get("subjects") or []],
                "themes": [t.get("name", "") for t in about.get("themes") or []],
                "unitsDecomposed": layer5.get("unitsDecomposed", 0),
                "unitTopics": [
                    (u.get("topic") or {}).get("name", "")
                    for u in units if isinstance(u, dict)
                ],
                "works": sorted({
                    w.get("title", "")
                    for u in units if isinstance(u, dict)
                    for w in u.get("referencedWorks") or []
                } | {w.get("title", "") for w in about.get("referencedWorks") or []}),
            })
        CUR_INDEX_JSON.write_text(json.dumps({"curriculums": curs}, indent=2) + "\n")
        print(f"curriculums/index.json regenerated: {len(curs)} curriculums")


# ---------------------------------------------------------------------------
# Runners
# ---------------------------------------------------------------------------

REF_CHECKS = [
    ("Step 0: Capture gates", check_capture_gates),
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
    ("Step 12: Aboutness", check_aboutness),
]

CUR_CHECKS = [
    ("Cur 0: Capture gates", check_capture_gates),
    ("Cur 1: Identity", check_cur_identity),
    ("Cur 2: Four layers", check_cur_layers),
    ("Cur 3: Indexed", check_cur_indexed),
    ("Cur 4: Decisions recorded", check_cur_decisions),
    ("Cur 5: Gap slug shape", check_cur_gap_slugs),
    ("Cur 6: Aboutness", check_aboutness),
    ("Cur 7: Lesson decomposition", check_cur_lesson_decomposition),
]


def check_capture_gates_portable(item: dict) -> Tuple[bool, str]:
    return check_capture_gates(item, require_portable_source=True)


def verification_checks(
    item_id: str,
    *,
    require_closeout: bool,
    require_portable_source: bool = False,
) -> list:
    checks = list(CUR_CHECKS if item_id.startswith("cur-") else REF_CHECKS)
    if require_portable_source:
        capture_name, _capture_check = checks[0]
        checks[0] = (capture_name, check_capture_gates_portable)
    if require_closeout:
        checks.append(("Closeout: Slack receipts", check_step11_reply))
    return checks


def verify_one(
    item_id: str,
    verbose: bool = True,
    fail_counts: Optional[dict] = None,
    *,
    require_closeout: bool = False,
    require_portable_source: bool = False,
) -> bool:
    if item_id.startswith("cur-"):
        item = load_cur(item_id)
    else:
        item = load_ref(item_id)
    if item is None:
        if verbose:
            print(f"❌ {item_id}: JSON not found")
        return False
    checks = verification_checks(
        item_id,
        require_closeout=require_closeout,
        require_portable_source=require_portable_source,
    )

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
            if require_closeout:
                print(f"\n🚢 {item_id}: ANALYSIS AND SLACK CLOSEOUT VERIFIED")
            else:
                print(
                    f"\n✅ {item_id}: ANALYSIS PASSED; Slack closeout was not checked. "
                    "Run with --require-closeout after finalization."
                )
        else:
            print(f"\n🚫 {item_id}: BLOCKED, fix before reacting with :ship:")
            print(f"   Failed: {', '.join(failures)}")
    return all_pass


def all_ids() -> list:
    ids = [Path(p).stem for p in sorted(glob.glob(str(REFS_DIR / "ref-*.json")))]
    if CURS_DIR.exists():
        ids += [Path(p).stem for p in sorted(glob.glob(str(CURS_DIR / "cur-*.json")))]
    return ids


def self_test() -> int:
    """
    Regression net for the content checks (gh#366, gh#367). CI runs no Python,
    so the gate carries its own fixtures: a check that silently stops catching
    fabricated spans is worse than no check, because it reads as green.

    Run: python3 .cosmo/scripts/verify-ingestion.py --self-test
    """
    sidecar_id = "ref-9999-01-01-selftest"
    sidecar = TEXT_DIR / f"{sidecar_id}.txt"
    TEXT_DIR.mkdir(parents=True, exist_ok=True)
    sidecar.write_text(
        "Christopher Columbus was born in Genoa.\nThey landed on Hispaniola in 1492.\n"
    )
    pending_gate_id = "ref-9999-01-01-pending-gate-selftest"
    complete_gate_id = "ref-9999-01-01-complete-gate-selftest"
    unreviewed_gate_id = "ref-9999-01-01-unreviewed-gate-selftest"
    reviewed_gate_id = "ref-9999-01-01-reviewed-gate-selftest"
    false_complete_gate_id = "ref-9999-01-01-false-complete-gate-selftest"
    drifted_source_gate_id = "ref-9999-01-01-drifted-source-gate-selftest"
    manual_source_gate_id = "ref-9999-01-01-manual-source-gate-selftest"
    flagged = ["page 1: looks blank"]
    flagged_digest = hashlib.sha256(
        json.dumps(flagged, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    empty_digest = hashlib.sha256(b"[]").hexdigest()
    first_source_part = {
        "file": "part-1.pdf",
        "sha256": "a" * 64,
        "bytes": 101,
    }
    second_source_part = {
        "file": "part-2.pdf",
        "sha256": "b" * 64,
        "bytes": 202,
    }
    manual_source_part = {
        "file": "page-1.jpg",
        "sha256": "c" * 64,
        "bytes": 303,
    }

    def portable_source_receipt(item_id, parts=None, kind="reference"):
        return {
            "version": 1,
            "recordId": item_id,
            "kind": kind,
            "parts": parts or [first_source_part],
        }

    def retained_source_files(item_id, parts=None, *, proved=True):
        return [
            {
                "filename": part["file"],
                "slackMessageTs": f"1.{index + 1:06d}",
                "localPath": (
                    f".cosmo/inspo-files/{part['file']}" if proved else None
                ),
                "sha256": part["sha256"],
                "size": part["bytes"],
                **({
                    "contentType": (
                        "image/jpeg" if part["file"].endswith(".jpg")
                        else "application/pdf"
                    ),
                    "blobUrl": (
                        f"https://{EXPECTED_BLOB_HOST}/inspo/{item_id}/"
                        f"{part['file']}"
                    ),
                    "blobReadBackVerified": True,
                    "blobReadBackVerifiedAt": "2026-08-02T00:00:00Z",
                    "blobReadBackSize": part["bytes"],
                    "blobReadBackSha256": part["sha256"],
                    "blobReadBackContentType": (
                        "image/jpeg" if part["file"].endswith(".jpg")
                        else "application/pdf"
                    ),
                    "blobReadBackReceiptVersion": BLOB_READ_BACK_RECEIPT_VERSION,
                    "blobReadBackIdentity": (
                        f"{part['sha256']}:"
                        + (
                            "image/jpeg" if part["file"].endswith(".jpg")
                            else "application/pdf"
                        )
                    ),
                } if proved else {}),
            }
            for index, part in enumerate(parts or [first_source_part])
        ]

    def capture_receipt(
        item_id,
        gate,
        review=None,
        parts=None,
        page_count=1,
        expected_page_count=1,
    ):
        capture = {
            **gate,
            "pageCount": page_count,
            "expectedPageCount": expected_page_count,
            "sourceReceipt": portable_source_receipt(item_id, parts),
        }
        binding = capture_review_binding(item_id, capture)
        capture["reviewBinding"] = binding
        if review is not None:
            bound_review = dict(review)
            bound_review.setdefault("captureBinding", binding)
            capture["gateReview"] = bound_review
        return capture

    def reviewed(disposition, unresolved, *, bound_to=None, **overrides):
        review = {
            "status": "reviewed",
            "findingCount": 1,
            "findingsSha256": flagged_digest,
            "disposition": disposition,
            "unresolvedFindingCount": unresolved,
            "reviewedAt": "2026-08-02",
            "note": "The exact finding set was reviewed.",
        }
        if bound_to is not None:
            review["captureBinding"] = capture_review_binding(
                bound_to.get("id", ""), bound_to
            )
        review.update(overrides)
        return review

    gate_payloads = {
        pending_gate_id: {"gateStatus": "pending"},
        complete_gate_id: {
            "gateStatus": "complete",
            "gateFindings": [],
            "gateFindingCount": 0,
            "gateFindingsSha256": empty_digest,
        },
        unreviewed_gate_id: {
            "gateStatus": "findings",
            "gateFindings": flagged,
            "gateFindingCount": 1,
            "gateFindingsSha256": flagged_digest,
        },
        reviewed_gate_id: {
            "gateStatus": "findings",
            "gateFindings": flagged,
            "gateFindingCount": 1,
            "gateFindingsSha256": flagged_digest,
        },
        false_complete_gate_id: {
            "gateStatus": "complete",
            "gateFindings": flagged,
        },
        drifted_source_gate_id: {
            "gateStatus": "complete",
            "gateFindings": [],
            "gateFindingCount": 0,
            "gateFindingsSha256": empty_digest,
        },
        manual_source_gate_id: {
            "gateStatus": "complete",
            "gateFindings": [],
            "gateFindingCount": 0,
            "gateFindingsSha256": empty_digest,
        },
    }
    for gate_id, payload in gate_payloads.items():
        parts = (
            [first_source_part, second_source_part]
            if gate_id == drifted_source_gate_id
            else [first_source_part]
        )
        payload.update({
            "id": gate_id,
            "kind": "reference",
            "pageCount": 1,
            "expectedPageCount": 1,
            "pages": [{"page": 1}],
            "source": {
                "file": parts[0]["file"],
                "sha256": parts[0]["sha256"],
                "bytes": parts[0]["bytes"],
                "parts": parts,
            },
        })
    gate_payloads[manual_source_gate_id].pop("source")
    gate_payloads[manual_source_gate_id].update({
        "captureMethod": "manual-local-image-review",
        "pages": [{
            "page": 1,
            "sourceLocalPath": f".cosmo/inspo-files/{manual_source_part['file']}",
            "sha256": manual_source_part["sha256"],
            "bytes": manual_source_part["bytes"],
        }],
    })
    gate_dirs = [MASTERS_DIR / item_id for item_id in gate_payloads]
    for gate_dir in gate_dirs:
        gate_dir.mkdir(parents=True, exist_ok=True)
        (gate_dir / "manifest.json").write_text(
            json.dumps(gate_payloads[gate_dir.name]) + "\n"
        )

    def about(**over):
        base = {
            "extractionQuality": "full",
            "subjects": [{"name": "christopher columbus", "role": "about",
                          "quote": "Christopher Columbus was born"}],
            "entities": [{"name": "Hispaniola", "kind": "place", "role": "about",
                          "quote": "They landed on Hispaniola"}],
        }
        base.update(over)
        return base

    def ref(rid, dropped, **over):
        item = {"id": rid, "droppedAt": dropped}
        item.update(over)
        return item

    new, old = "2026-08-01", "2026-07-01"
    wrong_binding_capture = capture_receipt(
        reviewed_gate_id,
        gate_payloads[reviewed_gate_id],
        reviewed("accepted-source-artifact", 0),
    )
    wrong_binding_capture["gateReview"]["captureBinding"] = {
        **wrong_binding_capture["gateReview"]["captureBinding"],
        "sourceReceiptSha256": "f" * 64,
    }
    invalid_date_capture = capture_receipt(
        reviewed_gate_id,
        gate_payloads[reviewed_gate_id],
        reviewed("accepted-source-artifact", 0, reviewedAt="not-a-date"),
    )
    unversioned_readback_sources = retained_source_files(
        "ref-9999-01-01-unversioned-readback"
    )
    unversioned_readback_sources[0].pop("blobReadBackReceiptVersion")
    unversioned_readback_sources[0].pop("blobReadBackIdentity")
    missing_blob_url_sources = retained_source_files(
        "ref-9999-01-01-missing-blob-url"
    )
    missing_blob_url_sources[0].pop("blobUrl")
    local_only_id = "ref-9999-01-01-local-only-source"
    local_only_item = ref(
        local_only_id,
        new,
        capture={"sourceReceipt": portable_source_receipt(local_only_id)},
        sourceFiles=retained_source_files(local_only_id, proved=False),
    )

    def portable_mode_rejects_local_only_source(_item):
        local_proof = globals()["_has_safe_local_source_proof"]
        globals()["_has_safe_local_source_proof"] = lambda _source: True
        try:
            default_passed, _default_message = validate_capture_source_receipt(
                local_only_item,
                None,
                allow_legacy=False,
            )
            portable_passed, portable_message = validate_capture_source_receipt(
                local_only_item,
                None,
                allow_legacy=False,
                require_portable_source=True,
            )
        finally:
            globals()["_has_safe_local_source_proof"] = local_proof
        return (
            default_passed and not portable_passed,
            portable_message,
        )

    cases = [
        ("a source-completeness request blocks closeout",
         check_capture_gates, ref(
             "ref-9999-01-01-source-requested",
             new,
             sourceCompleteness={"status": "requested"},
         ), False),
        ("an original-recovery request blocks closeout",
         check_capture_gates, ref(
             "ref-9999-01-01-original-requested",
             new,
             originalRecovery={"status": "requested"},
         ), False),
        ("a pending capture checkpoint fails",
         check_capture_gates, ref(pending_gate_id, new), False),
        ("a completed capture gate passes",
         check_capture_gates, ref(
             complete_gate_id,
             new,
             capture=capture_receipt(
                 complete_gate_id, gate_payloads[complete_gate_id]
             ),
             sourceFiles=retained_source_files(complete_gate_id),
         ), True),
        ("a completed gate cannot hide findings",
         check_capture_gates, ref(false_complete_gate_id, new), False),
        ("capture findings without a reviewed disposition fail",
         check_capture_gates, ref(unreviewed_gate_id, new, capture={
             "gateFindingCount": 1,
             "gateFindingsSha256": flagged_digest,
         }), False),
        ("an exact reviewed capture-finding set passes",
         check_capture_gates, ref(
             reviewed_gate_id,
             new,
             capture=capture_receipt(
                 reviewed_gate_id,
                 gate_payloads[reviewed_gate_id],
                 reviewed("accepted-source-artifact", 0),
             ),
             sourceFiles=retained_source_files(reviewed_gate_id),
         ), True),
        ("a review bound to different source bytes fails",
         check_capture_gates, ref(
             reviewed_gate_id,
             new,
             capture=wrong_binding_capture,
             sourceFiles=retained_source_files(reviewed_gate_id),
         ), False),
        ("a review timestamp must be an ISO date or datetime",
         check_capture_gates, ref(
             reviewed_gate_id,
             new,
             capture=invalid_date_capture,
             sourceFiles=retained_source_files(reviewed_gate_id),
         ), False),
        ("a new item without a portable gate receipt fails in a clean checkout",
         check_capture_gates, ref("ref-9999-01-01-no-manifest", new), False),
        ("a legacy item without a gate receipt stays compatible",
         check_capture_gates, ref("ref-2026-07-01-no-manifest", old), True),
        ("portable source mode refuses the legacy source-receipt bypass",
         check_capture_gates_portable,
         ref("ref-2026-07-01-no-manifest-portable", old), False),
        ("a legacy observed count without an independent assertion stays compatible",
         lambda _item: validate_capture_page_counts(
             {"pageCount": 12}, allow_legacy=True
         ), {}, True),
        ("a portable complete receipt passes without local masters",
         check_capture_gates, ref(
             "ref-9999-01-01-portable",
             new,
             capture=capture_receipt(
                 "ref-9999-01-01-portable",
                 {
                     "gateStatus": "complete",
                     "gateFindings": [],
                     "gateFindingCount": 0,
                     "gateFindingsSha256": empty_digest,
                 },
             ),
             sourceFiles=retained_source_files("ref-9999-01-01-portable"),
         ), True),
        ("portable page counts must agree in a clean checkout",
         check_capture_gates, ref(
             "ref-9999-01-01-portable-count-mismatch",
             new,
             capture=capture_receipt(
                 "ref-9999-01-01-portable-count-mismatch",
                 {
                     "gateStatus": "complete",
                     "gateFindings": [],
                     "gateFindingCount": 0,
                     "gateFindingsSha256": empty_digest,
                 },
                 page_count=1,
                 expected_page_count=999,
             ),
             sourceFiles=retained_source_files(
                 "ref-9999-01-01-portable-count-mismatch"
             ),
         ), False),
        ("portable page counts cannot be omitted in a clean checkout",
         check_capture_gates, ref(
             "ref-9999-01-01-portable-count-missing",
             new,
             capture={
                 key: value
                 for key, value in capture_receipt(
                     "ref-9999-01-01-portable-count-missing",
                     {
                         "gateStatus": "complete",
                         "gateFindings": [],
                         "gateFindingCount": 0,
                         "gateFindingsSha256": empty_digest,
                     },
                 ).items()
                 if key not in {"pageCount", "expectedPageCount"}
             },
             sourceFiles=retained_source_files(
                 "ref-9999-01-01-portable-count-missing"
             ),
         ), False),
        ("a clean-checkout receipt is bound to retained source size and hash",
         check_capture_gates, ref(
             "ref-9999-01-01-portable-mismatch",
             new,
             capture=capture_receipt(
                 "ref-9999-01-01-portable-mismatch",
                 {
                     "gateStatus": "complete",
                     "gateFindings": [],
                     "gateFindingCount": 0,
                     "gateFindingsSha256": empty_digest,
                 },
             ),
             sourceFiles=[{
                 **retained_source_files(
                     "ref-9999-01-01-portable-mismatch"
                 )[0],
                 "size": first_source_part["bytes"] + 1,
             }],
         ), False),
        ("every distinct retained source identity must be receipted",
         check_capture_gates, ref(
             "ref-9999-01-01-extra-source",
             new,
             capture=capture_receipt(
                 "ref-9999-01-01-extra-source",
                 {
                     "gateStatus": "complete",
                     "gateFindings": [],
                     "gateFindingCount": 0,
                     "gateFindingsSha256": empty_digest,
                 },
             ),
             sourceFiles=retained_source_files(
                 "ref-9999-01-01-extra-source",
                 [first_source_part, second_source_part]
             ),
         ), False),
        ("a byte-identical duplicate occurrence needs no second receipt part",
         check_capture_gates, ref(
             "ref-9999-01-01-duplicate-source",
             new,
             capture=capture_receipt(
                 "ref-9999-01-01-duplicate-source",
                 {
                     "gateStatus": "complete",
                     "gateFindings": [],
                     "gateFindingCount": 0,
                     "gateFindingsSha256": empty_digest,
                 },
             ),
             sourceFiles=[
                 *retained_source_files("ref-9999-01-01-duplicate-source"),
                 {
                     **retained_source_files(
                         "ref-9999-01-01-duplicate-source"
                     )[0],
                     "filename": "part-1-copy.pdf",
                     "slackMessageTs": "1.000002",
                     "duplicateOf": {
                         "slackMessageTs": "1.000001",
                         "filename": "part-1.pdf",
                     },
                 },
             ],
         ), True),
        ("an unmarked byte-identical source occurrence cannot be omitted",
         check_capture_gates, ref(
             "ref-9999-01-01-unmarked-duplicate-source",
             new,
             capture=capture_receipt(
                 "ref-9999-01-01-unmarked-duplicate-source",
                 {
                     "gateStatus": "complete",
                     "gateFindings": [],
                     "gateFindingCount": 0,
                     "gateFindingsSha256": empty_digest,
                 },
             ),
             sourceFiles=[
                 *retained_source_files(
                     "ref-9999-01-01-unmarked-duplicate-source"
                 ),
                 {
                     **retained_source_files(
                         "ref-9999-01-01-unmarked-duplicate-source"
                     )[0],
                     "filename": "part-1-copy.pdf",
                     "slackMessageTs": "1.000002",
                 },
             ],
         ), False),
        ("matching metadata without readback or safe local bytes is not proof",
         check_capture_gates, ref(
             "ref-9999-01-01-self-attested-source",
             new,
             capture=capture_receipt(
                 "ref-9999-01-01-self-attested-source",
                 {
                     "gateStatus": "complete",
                     "gateFindings": [],
                     "gateFindingCount": 0,
                     "gateFindingsSha256": empty_digest,
                 },
             ),
             sourceFiles=retained_source_files(
                 "ref-9999-01-01-self-attested-source", proved=False
             ),
         ), False),
        ("portable source mode rejects otherwise safe local-only bytes",
         portable_mode_rejects_local_only_source, {}, True),
        ("unversioned readback metadata is not a bound byte receipt",
         check_capture_gates, ref(
             "ref-9999-01-01-unversioned-readback",
             new,
             capture=capture_receipt(
                 "ref-9999-01-01-unversioned-readback",
                 {
                     "gateStatus": "complete",
                     "gateFindings": [],
                     "gateFindingCount": 0,
                     "gateFindingsSha256": empty_digest,
                 },
             ),
             sourceFiles=unversioned_readback_sources,
         ), False),
        ("readback metadata without the exact Homa Blob URL is not proof",
         check_capture_gates, ref(
             "ref-9999-01-01-missing-blob-url",
             new,
             capture=capture_receipt(
                 "ref-9999-01-01-missing-blob-url",
                 {
                     "gateStatus": "complete",
                     "gateFindings": [],
                     "gateFindingCount": 0,
                     "gateFindingsSha256": empty_digest,
                 },
             ),
             sourceFiles=missing_blob_url_sources,
         ), False),
        ("a local manifest catches reordered portable source parts",
         check_capture_gates, ref(
             drifted_source_gate_id,
             new,
             capture=capture_receipt(
                 drifted_source_gate_id,
                 gate_payloads[drifted_source_gate_id],
                 parts=[second_source_part, first_source_part],
             ),
             sourceFiles=retained_source_files(
                 drifted_source_gate_id,
                 [first_source_part, second_source_part]
             ),
         ), False),
        ("a direct-image manifest verifies the same portable source contract",
         check_capture_gates, ref(
             manual_source_gate_id,
             new,
             capture=capture_receipt(
                 manual_source_gate_id,
                 gate_payloads[manual_source_gate_id],
                 parts=[manual_source_part],
             ),
             sourceFiles=retained_source_files(
                 manual_source_gate_id, [manual_source_part]
             ),
         ), True),
        ("a falsey non-array finding set fails closed",
         check_capture_gates, ref("ref-9999-01-01-malformed-findings", new, capture={
             "gateStatus": "complete",
             "gateFindings": "",
             "gateFindingCount": 0,
             "gateFindingsSha256": empty_digest,
         }), False),
        ("findings status cannot carry an empty reviewed set",
         check_capture_gates, ref("ref-9999-01-01-empty-findings", new, capture={
             "gateStatus": "findings",
             "gateFindings": [],
             "gateFindingCount": 0,
             "gateFindingsSha256": empty_digest,
             "gateReview": {
                 "status": "reviewed",
                 "findingCount": 0,
                 "findingsSha256": empty_digest,
                 "disposition": "accepted-source-artifact",
                 "reviewedAt": "2026-08-02",
                 "note": "No findings were present.",
             },
         }), False),
        ("a reviewed finding set must state zero unresolved findings",
         lambda _item: validate_capture_gate_receipt(
             gate_payloads[reviewed_gate_id],
             reviewed(
                 "accepted-source-artifact",
                 0,
                 bound_to=gate_payloads[reviewed_gate_id],
                 unresolvedFindingCount=None,
             ),
             allow_legacy=False,
             item_id=reviewed_gate_id,
         ), {}, False),
        ("a re-share-requested disposition is not terminal",
         lambda _item: validate_capture_gate_receipt(
             gate_payloads[reviewed_gate_id],
             reviewed(
                 "re-share-requested",
                 0,
                 bound_to=gate_payloads[reviewed_gate_id],
             ),
             allow_legacy=False,
             item_id=reviewed_gate_id,
         ), {}, False),
        ("a mixed review passes only with explicit zero unresolved findings",
         lambda _item: validate_capture_gate_receipt(
             gate_payloads[reviewed_gate_id],
             reviewed(
                 "mixed-reviewed",
                 0,
                 bound_to=gate_payloads[reviewed_gate_id],
             ),
             allow_legacy=False,
             item_id=reviewed_gate_id,
         ), {}, True),
        ("a mixed review with one unresolved finding fails",
         lambda _item: validate_capture_gate_receipt(
             gate_payloads[reviewed_gate_id],
             reviewed(
                 "mixed-reviewed",
                 1,
                 bound_to=gate_payloads[reviewed_gate_id],
             ),
             allow_legacy=False,
             item_id=reviewed_gate_id,
         ), {}, False),
        ("a new canonical id cannot be backdated into legacy capture bypass",
         check_capture_gates, ref(
             "ref-9999-01-01-backdated-bypass", old, capture={}
         ), False),
        ("Slack closeout without persisted receipts fails",
         check_step11_reply, ref(
             "ref-9999-01-01-closeout-missing",
             new,
             sourceMessageTs="1.000001",
         ), False),
        ("Slack closeout passes with finalizer receipts",
         check_step11_reply, ref(
             "ref-9999-01-01-closeout-complete",
             new,
             sourceMessageTs="1.000001",
             stages={
                 "slackReplyTs": "1.000002",
                 "shipReaction": True,
             },
         ), True),
        ("curriculum closeout also requires the developer summary receipt",
         check_step11_reply, ref(
             "cur-9999-01-01-closeout-missing-dev",
             new,
             sourceMessageTs="1.000001",
             stages={
                 "slackReplyTs": "1.000002",
                 "shipReaction": True,
             },
         ), False),
        ("curriculum closeout passes with all finalizer receipts",
         check_step11_reply, ref(
             "cur-9999-01-01-closeout-complete",
             new,
             sourceMessageTs="1.000001",
             stages={
                 "slackReplyTs": "1.000002",
                 "devSummaryTs": "2.000001",
                 "shipReaction": True,
             },
         ), True),
        ("default verification remains pre-closeout for the finalizer",
         lambda _item: (
             all(
                 fn is not check_step11_reply
                 for _name, fn in verification_checks(
                     "ref-9999-01-01-pre-closeout", require_closeout=False
                 )
             ),
             "default check roster excludes Slack closeout",
         ), {}, True),
        ("explicit closeout verification adds the receipt gate",
         lambda _item: (
             any(
                 fn is check_step11_reply
                 for _name, fn in verification_checks(
                     "ref-9999-01-01-full-closeout", require_closeout=True
                 )
             ),
             "explicit check roster includes Slack closeout",
         ), {}, True),
        ("legacy ref without aboutness softens",
         check_aboutness, ref("ref-2026-07-01-x", old), True),
        ("new ref without aboutness fails",
         check_aboutness, ref("ref-2026-08-01-x", new), False),
        ("aboutness without a sidecar passes but says UNVERIFIED",
         check_aboutness, ref("ref-2026-08-01-x", new, aboutness=about()), True),
        ("every span present in the sidecar verifies",
         check_aboutness, ref(sidecar_id, new, aboutness=about()), True),
        ("a fabricated span fails",
         check_aboutness, ref(sidecar_id, new, aboutness=about(
             entities=[{"name": "Atlantis", "kind": "place", "role": "about", "quote": "they sailed to Atlantis"}])), False),
        ("an unknown entity kind fails",
         check_aboutness, ref(sidecar_id, new, aboutness=about(
             entities=[{"name": "Genoa", "kind": "city", "role": "about", "quote": "born in Genoa"}])), False),
        ("a claim with no span fails",
         check_aboutness, ref(sidecar_id, new, aboutness=about(
             themes=[{"name": "exploration"}])), False),
        ("empty subjects fails",
         check_aboutness, ref(sidecar_id, new, aboutness=about(subjects=[])), False),
        ("unavailable without a reason fails",
         check_aboutness, ref("ref-2026-08-01-x", new, aboutness=about(
             extractionQuality="unavailable")), False),
        ("unavailable with a reason passes",
         check_aboutness, ref("ref-2026-08-01-x", new, aboutness=about(
             extractionQuality="unavailable", reason="wordless picture book")), True),
        ("a claim with no role fails",
         check_aboutness, ref(sidecar_id, new, aboutness=about(
             subjects=[{"name": "columbus", "quote": "Christopher Columbus was born"}]))
         , False),
        ("an unknown role fails",
         check_aboutness, ref(sidecar_id, new, aboutness=about(
             subjects=[{"name": "columbus", "role": "vibes", "quote": "Christopher Columbus was born"}]))
         , False),
        ("decoration alone cannot answer a content question",
         check_aboutness, ref(sidecar_id, new, aboutness=about(
             subjects=[{"name": "swan", "role": "decoration", "quote": "Christopher Columbus was born"}]))
         , False),
        ("decoration beside a real subject is fine",
         check_aboutness, ref(sidecar_id, new, aboutness=about(
             subjects=[{"name": "columbus", "role": "about", "quote": "Christopher Columbus was born"},
                       {"name": "swan", "role": "decoration", "quote": "They landed on Hispaniola"}]))
         , True),
    ]

    def unit(ordinal=1, **over):
        base = {
            "ordinal": ordinal,
            "unitLabel": f"Week {ordinal}",
            "topic": {"name": "columbus", "quote": "Christopher Columbus was born"},
        }
        base.update(over)
        return base

    def cur(cid, dropped, **over):
        item = {"id": cid, "droppedAt": dropped}
        item.update(over)
        return item

    cases += [
        ("legacy curriculum without Layer 5 softens",
         check_cur_lesson_decomposition, cur("cur-2026-07-01-x", old), True),
        ("new curriculum without Layer 5 fails",
         check_cur_lesson_decomposition, cur("cur-2026-08-01-x", new), False),
        ("a valid decomposition passes",
         check_cur_lesson_decomposition, cur("cur-2026-08-01-x", new, layer5_lessons={
             "decompositionQuality": "full", "unitKind": "week",
             "unitsFound": 1, "unitsDecomposed": 1, "units": [unit()]}), True),
        ("'full' over a sampled pass fails",
         check_cur_lesson_decomposition, cur("cur-2026-08-01-x", new, layer5_lessons={
             "decompositionQuality": "full", "unitKind": "week",
             "unitsFound": 36, "unitsDecomposed": 1, "units": [unit()]}), False),
        ("the same numbers as 'partial' pass",
         check_cur_lesson_decomposition, cur("cur-2026-08-01-x", new, layer5_lessons={
             "decompositionQuality": "partial", "unitKind": "week",
             "unitsFound": 36, "unitsDecomposed": 1, "units": [unit()]}), True),
        ("a count that disagrees with the rows fails",
         check_cur_lesson_decomposition, cur("cur-2026-08-01-x", new, layer5_lessons={
             "decompositionQuality": "partial", "unitKind": "week",
             "unitsFound": 36, "unitsDecomposed": 2, "units": [unit()]}), False),
        ("duplicate ordinals fail",
         check_cur_lesson_decomposition, cur("cur-2026-08-01-x", new, layer5_lessons={
             "decompositionQuality": "full", "unitKind": "week",
             "unitsFound": 2, "unitsDecomposed": 2, "units": [unit(1), unit(1)]}), False),
        ("a unit span absent from the sidecar fails",
         check_cur_lesson_decomposition, cur(sidecar_id, new, layer5_lessons={
             "decompositionQuality": "full", "unitKind": "week",
             "unitsFound": 1, "unitsDecomposed": 1,
             "units": [unit(topic={"name": "mars", "quote": "Week 8: The Red Planet"})]}), False),
    ]

    failures = 0
    try:
        for label, fn, item, expected in cases:
            got, msg = fn(item)
            ok = got is expected
            print(f"  {'✅' if ok else '❌'} {label}"
                  + ("" if ok else f"\n       expected {expected}, got {got}: {msg}"))
            if not ok:
                failures += 1
    finally:
        sidecar.unlink(missing_ok=True)
        for gate_dir in gate_dirs:
            (gate_dir / "manifest.json").unlink(missing_ok=True)
            gate_dir.rmdir()

    print(f"\nself-test: {len(cases) - failures} passed, {failures} failed")
    return 1 if failures else 0


def main():
    flags = {"--no-fetch", "--require-closeout", "--require-portable-source"}
    args = [a for a in sys.argv[1:] if a not in flags]
    no_fetch = "--no-fetch" in sys.argv
    require_closeout = "--require-closeout" in sys.argv
    require_portable_source = "--require-portable-source" in sys.argv
    if not args:
        print("Usage: verify-ingestion.py <ref-id|cur-id> | --all | --recent <days> "
              "| --regen-index | --self-test [--no-fetch] [--require-closeout] "
              "[--require-portable-source]")
        sys.exit(1)

    if args[0] == "--regen-index":
        regen_index()
        sys.exit(0)

    if args[0] == "--self-test":
        sys.exit(self_test())

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
            if verify_one(
                item_id,
                fail_counts=fail_counts,
                require_closeout=require_closeout,
                require_portable_source=require_portable_source,
            ):
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
            if verify_one(
                item_id,
                require_closeout=require_closeout,
                require_portable_source=require_portable_source,
            ):
                passed += 1
        print(f"\n{'=' * 60}")
        print(f"RECENT ({days}d): {len(recent)} | PASSED: {passed} | FAILED: {len(recent) - passed}")
        sys.exit(0 if passed == len(recent) else 1)

    sys.exit(
        0
        if verify_one(
            args[0],
            require_closeout=require_closeout,
            require_portable_source=require_portable_source,
        )
        else 1
    )


if __name__ == "__main__":
    main()
