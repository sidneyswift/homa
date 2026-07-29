#!/usr/bin/env python3
"""
corpus-search.py: ask the ingestion corpus what it actually has.

WHY THIS EXISTS:
The engine analyzed form and never recorded content, so the corpus could not
answer the questions the founders actually ask (meeting 2026-07-28):

    "what do we have about insects for a three-year-old"
    "all the books about bunnies for age three"
    "is there an ingested happy birthday book to work from"
    "Anna wants to read A Wrinkle in Time"

Dimension F (aboutness, gh#366) and Layer 5 (lesson decomposition, gh#367)
put those answers in the JSONs. This script is the query side, and it is the
acceptance test for both: if a question above returns nothing once the corpus
carries aboutness, the extraction is wrong, not the query.

It reads the per-item JSONs, which are the source of truth, never index.json,
which is a generated view that can lag a hand-run analysis.

USAGE:
    corpus-search.py insects                    # any aboutness field
    corpus-search.py bunnies --age 36           # ... suitable at 36 months
    corpus-search.py "wrinkle in time"          # referenced works, incl. per unit
    corpus-search.py columbus --field entities  # narrow to one field
    corpus-search.py --list-subjects            # what the corpus knows about
    corpus-search.py insects --json             # machine-readable

MATCHING:
Substring, case-insensitive, deliberately dumb. This is a lookup over tags a
model already judged, not a second judgment layer: fuzzy scoring here would
quietly re-decide what an item is about, which is the model's job upstream
and the verifier's to check.

ROLES:
A content search matches only claims whose role is `teaches` or `about`. The
Fast Forward cover is a photograph of a swan: quotable, real, and recorded
as `decoration`, because "books about swans for a six-year-old" returning a
phonics workbook is how a parent learns to stop trusting search. Cast and
identity claims answer their own narrower questions (--role cast for a
character, --role identity for a series or level), and decoration answers
none unless you ask for it by name.
"""

import argparse
import json
import re
import sys
from pathlib import Path

COSMO = Path(__file__).resolve().parent.parent
REFS_DIR = COSMO / "references"
CURS_DIR = COSMO / "curriculums"

FIELDS = ("subjects", "entities", "themes", "keyTerms", "works", "title", "units")

# Only these roles may answer a content question. Mirrors CONTENT_ROLES in
# verify-ingestion.py, which is what enforces the labelling upstream.
CONTENT_ROLES = ("teaches", "about")


def load(path):
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return None


def items():
    """Every ref and cur JSON, newest first."""
    paths = sorted(REFS_DIR.glob("ref-*.json")) + sorted(CURS_DIR.glob("cur-*.json"))
    for path in paths:
        data = load(path)
        if data:
            yield data


def age_band(item):
    """[startMonths, endMonths] or None. References keep it in difficulty;
    curriculums vary, so fall back to the layer-3 range when present."""
    band = (item.get("difficulty") or {}).get("ageBand")
    if isinstance(band, list) and len(band) == 2 and all(isinstance(n, (int, float)) for n in band):
        return band
    band = (item.get("layer3_structure") or {}).get("ageRangeMonths")
    if isinstance(band, list) and len(band) == 2 and all(isinstance(n, (int, float)) for n in band):
        return band
    return None


def hits_for(item, needle, field_filter, roles=None):
    """Every place the needle appears, as (field, display) pairs."""
    about = item.get("aboutness") or {}
    found = []

    def scan(field, values):
        if field_filter and field != field_filter:
            return
        for value in values:
            if value and needle in value.lower():
                found.append((field, value))

    def in_scope(claim):
        role = claim.get("role")
        if roles is None:
            # Default: content only. An unlabelled legacy claim is treated as
            # content, because the pre-role corpus has no decoration in it.
            return role is None or role in CONTENT_ROLES
        return role in roles

    scan("subjects", [s.get("name", "") for s in about.get("subjects") or [] if in_scope(s)])
    scan("entities", [
        f"{e.get('name', '')} ({e.get('kind', '?')})"
        for e in about.get("entities") or [] if in_scope(e)
    ])
    scan("themes", [t.get("name", "") for t in about.get("themes") or []])
    scan("keyTerms", [k.get("term", "") for k in about.get("keyTerms") or []])
    scan("works", [w.get("title", "") for w in about.get("referencedWorks") or []])
    scan("title", [item.get("title") or item.get("name") or ""])

    # Layer 5: the per-unit index is what answers "which week teaches this"
    # and "which unit uses this book".
    if not field_filter or field_filter == "units":
        for unit in (item.get("layer5_lessons") or {}).get("units") or []:
            if not isinstance(unit, dict):
                continue
            label = unit.get("unitLabel", f"unit {unit.get('ordinal', '?')}")
            topic = (unit.get("topic") or {}).get("name", "")
            if topic and needle in topic.lower():
                found.append(("units", f"{label}: {topic}"))
            for work in unit.get("referencedWorks") or []:
                title = work.get("title", "")
                if title and needle in title.lower():
                    found.append(("units", f"{label} uses {title}"))
            for theme in unit.get("themes") or []:
                name = theme.get("name", "")
                if name and needle in name.lower():
                    found.append(("units", f"{label} theme: {name}"))
    return found


def search(needle, age=None, field_filter=None, roles=None):
    needle = needle.lower().strip()
    results = []
    for item in items():
        found = hits_for(item, needle, field_filter, roles)
        if not found:
            continue
        band = age_band(item)
        if age is not None:
            if band is None:
                continue
            if not (band[0] <= age <= band[1]):
                continue
        results.append({
            "id": item.get("id", ""),
            "title": item.get("title") or item.get("name") or "",
            "kind": "curriculum" if str(item.get("id", "")).startswith("cur-") else "reference",
            "ageBand": band,
            "droppedBy": item.get("droppedBy", ""),
            "hits": [{"field": f, "value": v} for f, v in found],
        })
    return results


def list_subjects():
    counts = {}
    for item in items():
        for subject in (item.get("aboutness") or {}).get("subjects") or []:
            name = subject.get("name", "")
            if name:
                counts[name] = counts.get(name, 0) + 1
    return sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))


def coverage():
    """How much of the corpus can answer content questions at all."""
    total = tagged = decomposed = curs = 0
    for item in items():
        total += 1
        if (item.get("aboutness") or {}).get("subjects"):
            tagged += 1
        if str(item.get("id", "")).startswith("cur-"):
            curs += 1
            if (item.get("layer5_lessons") or {}).get("units"):
                decomposed += 1
    return total, tagged, curs, decomposed


def main():
    parser = argparse.ArgumentParser(
        description="Search the ingestion corpus by what items are about.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("query", nargs="?", help="what to look for (substring, case-insensitive)")
    parser.add_argument("--age", type=int, metavar="MONTHS",
                        help="keep only items whose age band contains this age in months")
    parser.add_argument("--field", choices=FIELDS, help="narrow the search to one field")
    parser.add_argument("--role", action="append",
                        choices=("teaches", "about", "cast", "identity", "decoration"),
                        help="match claims in this role instead of content roles; repeatable")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    parser.add_argument("--list-subjects", action="store_true",
                        help="every subject the corpus carries, by frequency")
    args = parser.parse_args()

    if args.list_subjects:
        subjects = list_subjects()
        if args.json:
            print(json.dumps([{"subject": s, "items": n} for s, n in subjects], indent=2))
        elif not subjects:
            print("No aboutness tags in the corpus yet (gh#366 backfill is the debt).")
        else:
            for subject, count in subjects:
                print(f"{count:4d}  {subject}")
        return 0

    if not args.query:
        parser.print_help()
        return 2

    roles = tuple(args.role) if args.role else None
    results = search(args.query, age=args.age, field_filter=args.field, roles=roles)

    if args.json:
        print(json.dumps(results, indent=2))
        return 0 if results else 1

    total, tagged, curs, decomposed = coverage()
    if not results:
        print(f'Nothing found for "{args.query}"'
              + (f" at {args.age} months" if args.age is not None else "") + ".")
        print(f"\nCorpus coverage: {tagged} of {total} items carry aboutness tags; "
              f"{decomposed} of {curs} curriculums are decomposed.")
        if tagged == 0:
            print("Nothing is tagged yet, so this search cannot succeed. "
                  "Aboutness ships with new drops (gh#366); backfill needs the originals.")
        return 1

    label = f'"{args.query}"' + (f" at {args.age} months" if args.age is not None else "")
    print(f"{len(results)} item(s) matching {label}:\n")
    for r in results:
        band = f"{r['ageBand'][0]}-{r['ageBand'][1]}mo" if r["ageBand"] else "age unknown"
        print(f"  {r['title'] or r['id']}")
        print(f"    {r['id']}  [{r['kind']}, {band}, from {r['droppedBy'] or 'unknown'}]")
        for hit in r["hits"][:6]:
            print(f"    - {hit['field']}: {hit['value']}")
        if len(r["hits"]) > 6:
            print(f"    - ... {len(r['hits']) - 6} more")
        print()
    print(f"Corpus coverage: {tagged} of {total} items carry aboutness tags; "
          f"{decomposed} of {curs} curriculums are decomposed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
