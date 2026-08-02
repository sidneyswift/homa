#!/usr/bin/env python3
"""Backfill missing reference-ingestion JSON files from PDFs."""

import fitz  # pymupdf
import json
import os
import re
import random
import string
from pathlib import Path

REPO = Path("/Users/recoupable/projects/homa")
REFS_DIR = REPO / ".cosmo" / "references"
INSPO_DIR = REPO / ".cosmo" / "inspo-images"
INDEX_PATH = REFS_DIR / "index.json"

def extract_text(pdf_path, max_pages=10):
    """Extract text from first N pages of a PDF."""
    try:
        doc = fitz.open(str(pdf_path))
        text = ""
        for i, page in enumerate(doc):
            if i >= max_pages:
                break
            text += page.get_text() + "\n"
        doc.close()
        return text.strip()
    except Exception as e:
        return f"[extraction failed: {e}]"

def get_page_count(pdf_path):
    try:
        doc = fitz.open(str(pdf_path))
        n = len(doc)
        doc.close()
        return n
    except:
        return 0

def infer_subject_domain_from_name_and_text(name, text):
    """Infer subject and domain from filename and extracted text."""
    nl = name.lower()
    tl = text.lower()[:3000]

    # Math keywords
    if any(k in nl for k in ['math', 'algebra', 'geometry', 'pemdas', 'equation', 'calculus']):
        if 'algebra' in nl:
            return 'math', 'algebra'
        if 'geometry' in nl:
            return 'math', 'geometry'
        if 'pemdas' in nl or 'order of operations' in tl:
            return 'math', 'operations-algebraic-thinking'
        return 'math', 'general-math'

    # ELA / Writing / Literature / Composition
    if any(k in nl for k in ['essay', 'paragraph', 'composition', 'writing', 'word', 'poet']):
        return 'ela', 'writing'
    if any(k in nl for k in ['literature', 'reading']):
        return 'ela', 'literature'
    if 'english' in nl:
        return 'ela', 'english-language-arts'
    if 'latin-american-literature' in nl:
        return 'ela', 'literature'
    if 'british-literature' in nl:
        return 'ela', 'literature'
    if 'american-literature' in nl:
        return 'ela', 'literature'
    if 'heros-journey' in nl or "hero" in nl:
        return 'ela', 'literature'
    if 'critical-media' in nl:
        return 'ela', 'media-literacy'

    # Science
    if any(k in nl for k in ['science', 'chemistry', 'physics', 'forensic', 'climate', 'environmental']):
        if 'chemistry' in nl:
            return 'science', 'chemistry'
        if 'physics' in nl:
            return 'science', 'physics'
        if 'forensic' in nl:
            return 'science', 'forensic-science'
        if 'earth-science' in nl:
            return 'science', 'earth-science'
        if 'physical-science' in nl:
            return 'science', 'physical-science'
        if 'life-science' in nl or 'basic-life' in nl:
            return 'science', 'life-science'
        if 'environmental' in nl:
            return 'science', 'environmental-science'
        if 'climate' in nl:
            return 'science', 'environmental-science'
        return 'science', 'general-science'

    # History / Social Studies
    if any(k in nl for k in ['history', 'civilization', 'geography', 'government', 'economics', 'race-and-ethnic']):
        if 'ancient-civilization' in nl:
            return 'social-studies', 'ancient-civilizations'
        if 'world-history' in nl:
            return 'social-studies', 'world-history'
        if 'geography' in nl:
            return 'social-studies', 'world-geography'
        if 'government' in nl:
            return 'social-studies', 'civics'
        if 'economics' in nl:
            return 'social-studies', 'economics'
        if 'race-and-ethnic' in nl:
            return 'social-studies', 'ethnic-studies'
        return 'social-studies', 'general-social-studies'

    # Languages
    if any(k in nl for k in ['french', 'spanish', 'latin']):
        if 'french' in nl:
            return 'world-languages', 'french'
        if 'spanish' in nl:
            return 'world-languages', 'spanish'
        if 'latin' in nl and 'literature' not in nl:
            return 'world-languages', 'latin'
        return 'ela', 'literature'

    # Art
    if any(k in nl for k in ['drawing', 'painting', 'photography', 'crafts', 'art']):
        return 'art', 'visual-arts'

    # Music
    if any(k in nl for k in ['recorder', 'music']):
        return 'music', 'instrumental'

    # Food / Home Ec
    if 'foodways' in nl or 'food-systems' in nl:
        return 'science', 'environmental-science'

    # General grade-level coursebooks
    if 'coursebook' in nl or 'resource-book' in nl:
        # Try to detect from text
        if any(k in tl for k in ['math', 'addition', 'subtract', 'multiply', 'number']):
            return 'math', 'general-math'
        if any(k in tl for k in ['reading', 'writing', 'letter', 'phonics', 'story']):
            return 'ela', 'english-language-arts'
        if any(k in tl for k in ['science', 'nature', 'plant', 'animal']):
            return 'science', 'general-science'
        return 'multidisciplinary', 'integrated-curriculum'

    # Preschool
    if 'preschool' in nl or 'kindergarten' in nl:
        return 'multidisciplinary', 'early-childhood'

    return 'multidisciplinary', 'integrated-curriculum'

def infer_grade_band(name):
    """Infer age band from filename."""
    nl = name.lower()

    # Explicit grade numbers
    grade_match = re.search(r'grade[-_]?(\d+)', nl)
    if grade_match:
        g = int(grade_match.group(1))
        start_age = 60 + (g * 12)  # rough: grade 1 = 72mo
        return [start_age, start_age + 12], f"{g}"

    if 'preschool' in nl:
        return [36, 60], "PreK"
    if 'kindergarten' in nl:
        return [60, 72], "K"

    # High school indicators
    if '-hs' in nl or 'high-school' in nl or any(k in nl for k in ['algebra', 'geometry', 'chemistry', 'physics', 'economics', 'government', 'composition-1', 'composition-2']):
        return [168, 216], "9-12"

    # Dimensions math textbook levels
    if 't2a' in nl:
        return [84, 96], "2"
    if 't3a' in nl:
        return [96, 108], "3"
    if 't4a' in nl:
        return [108, 120], "4"
    if 't5a' in nl:
        return [120, 132], "5"

    # BookShark levels
    for prefix, band, grade in [('ahb', [60, 72], "K"), ('bhb', [72, 84], "1"),
                                  ('chb', [84, 96], "2"), ('dhb', [96, 108], "3"),
                                  ('ehb', [108, 120], "4"), ('fhb', [120, 132], "5"),
                                  ('ghb', [132, 144], "6"), ('phb', [48, 60], "PreK")]:
        if prefix in nl:
            return band, grade

    # Middle school
    if any(k in nl for k in ['grade-6', 'grade-7', 'grade-8']):
        return [132, 168], "6-8"

    # Recorder levels
    if 'beginning_recorder' in nl or '1_beginning' in nl:
        return [84, 108], "2-4"
    if 'intermediate_recorder' in nl or '2_intermediate' in nl:
        return [108, 132], "4-6"
    if 'advanced_recorder' in nl or '3_advanced' in nl:
        return [132, 156], "6-8"
    if 'recorder_duets' in nl or '4_recorder' in nl:
        return [132, 168], "6-9"

    return [96, 168], "3-9"

def make_title_from_filename(filename):
    """Create a human-readable title from filename."""
    name = filename.replace('.pdf', '')

    # Remove atlas prefix
    for prefix in ['atlas-dimensions-math-', 'atlas-bookshark-', 'atlas-oak-meadow-']:
        name = name.replace(prefix, '')

    # Clean up
    name = name.replace('-', ' ').replace('_', ' ')
    name = re.sub(r'\s+', ' ', name).strip()

    # Title case
    title = name.title()

    # Fix common acronyms
    for acr in ['Hs', 'Cvc', 'Pemdas', 'Pdf', 'Dm']:
        title = title.replace(acr, acr.upper())

    return title

def build_ref(ref_id, title, pdf_path, dropped_by, source_channel, dropped_at, text, page_count):
    """Build a reference JSON object."""
    filename = os.path.basename(str(pdf_path))
    subject, domain = infer_subject_domain_from_name_and_text(filename, text)
    age_band, grade_label = infer_grade_band(filename)

    # Determine format
    fmt = "curriculum-sample"
    if source_channel == "homa-inspo":
        if 'foldable' in filename.lower():
            fmt = "foldable"
        elif 'outline' in filename.lower() or 'essay' in filename.lower():
            fmt = "graphic-organizer"
        else:
            fmt = "worksheet"

    if 'bookshark' in filename.lower():
        fmt = "curriculum-sample"
    if 'oak-meadow' in filename.lower():
        fmt = "curriculum-sample"
    if 'dimensions-math' in filename.lower():
        fmt = "textbook-sample"

    # Determine complexity
    complexity = "multi-skill" if page_count > 5 else "single-skill"

    # Layout based on format
    if fmt == "foldable":
        layout = {"structure": "sectioned", "spacing": "dense", "visualHierarchy": "instruction-dominant", "whiteSpaceRatio": 0.2, "flowDirection": "top-down"}
    elif fmt == "graphic-organizer":
        layout = {"structure": "sectioned", "spacing": "airy", "visualHierarchy": "activity-area-dominant", "whiteSpaceRatio": 0.4, "flowDirection": "top-down"}
    elif fmt in ("curriculum-sample", "textbook-sample"):
        layout = {"structure": "sectioned", "spacing": "mixed", "visualHierarchy": "instruction-dominant", "whiteSpaceRatio": 0.25, "flowDirection": "top-down"}
    else:
        layout = {"structure": "linear-top-to-bottom", "spacing": "mixed", "visualHierarchy": "activity-area-dominant", "whiteSpaceRatio": 0.3, "flowDirection": "top-down"}

    # Theming
    if fmt in ("curriculum-sample", "textbook-sample"):
        theming = {
            "themeType": "neutral",
            "characters": [],
            "visualStyle": "clean-textbook",
            "colorPalette": "limited-palette",
            "appealDrivers": ["structured lessons", "professional layout", "clear progression"]
        }
    else:
        theming = {
            "themeType": "neutral",
            "characters": [],
            "visualStyle": "clean-textbook",
            "colorPalette": "black-and-white",
            "appealDrivers": ["structured format", "clear instructions"]
        }

    # Print format
    print_fmt = {
        "pageSize": "letter",
        "orientation": "portrait",
        "margins": "standard",
        "inkDensity": "light" if fmt in ("foldable", "graphic-organizer", "worksheet") else "medium",
        "colorRequirement": "prints well in B&W"
    }

    # Recipe match
    recipe_match = {"matchedRecipes": [], "gaps": []}
    if fmt == "foldable":
        recipe_match["matchedRecipes"] = ["foldable"]
    elif fmt == "graphic-organizer":
        recipe_match["matchedRecipes"] = ["structured-outline"]
    elif fmt in ("curriculum-sample", "textbook-sample"):
        recipe_match["gaps"] = [f"curriculum-sample: multi-page lesson plan with reading passages, exercises, and teacher notes, {page_count} pages"]

    # Skill targeting
    skill_targeting = {
        "subject": subject,
        "domain": domain,
        "topics": [],
        "unmappedSkills": []
    }

    # Try to extract more specific info from text
    notes = f"{page_count}-page {fmt} from {source_channel}."
    text_snippet = text[:500].replace('\n', ' ').strip()
    if text_snippet and '[extraction failed' not in text_snippet:
        notes += f" Content preview: {text_snippet[:200]}..."

    # Difficulty
    difficulty = {
        "ageBandMonths": age_band,
        "ageBandGrades": grade_label,
        "complexity": complexity,
        "prerequisites": [],
        "scaffolding": "high" if fmt in ("foldable", "graphic-organizer") else "medium"
    }

    return {
        "id": ref_id,
        "droppedBy": dropped_by,
        "droppedAt": dropped_at,
        "sourceChannel": source_channel,
        "format": fmt,
        "title": title,
        "layout": layout,
        "skillTargeting": skill_targeting,
        "difficulty": difficulty,
        "theming": theming,
        "printFormat": print_fmt,
        "recipeMatch": recipe_match,
        "notes": notes
    }


def main():
    created = []

    # ---- Priority 1: Direct homa-inspo drops ----
    p1_items = [
        {
            "id": "ref-2026-07-12-pemdas-foldable",
            "title": "PEMDAS Foldable (Order of Operations)",
            "pdf": "/Users/recoupable/.openclaw/media/inbound/4bc3c122-fc94-4c1c-abfb-4c163b7b14a6.pdf",
            "droppedBy": "sid",
            "sourceChannel": "homa-inspo",
            "droppedAt": "2026-07-12T22:00:00-04:00"
        },
        {
            "id": "ref-2026-07-12-five-paragraph-essay-outline",
            "title": "Five Paragraph Essay Outline",
            "pdf": "/Users/recoupable/.openclaw/media/inbound/ca91d84f-3598-42b6-bbdb-8d94224ab038.pdf",
            "droppedBy": "sid",
            "sourceChannel": "homa-inspo",
            "droppedAt": "2026-07-12T22:05:00-04:00"
        }
    ]

    for item in p1_items:
        pdf_path = item["pdf"]
        text = extract_text(pdf_path)
        pc = get_page_count(pdf_path)
        ref = build_ref(item["id"], item["title"], pdf_path, item["droppedBy"],
                       item["sourceChannel"], item["droppedAt"], text, pc)
        out_path = REFS_DIR / f"{item['id']}.json"
        with open(out_path, 'w') as f:
            json.dump(ref, f, indent=2)
        created.append({"id": item["id"], "title": item["title"], "subject": ref["skillTargeting"]["subject"],
                        "domain": ref["skillTargeting"]["domain"], "format": ref["format"],
                        "droppedBy": item["droppedBy"], "droppedAt": item["droppedAt"]})
        print(f"  ✓ {item['id']}")

    # ---- Priority 2: Dimensions Math ----
    dm_items = [
        ("atlas-dimensions-math-T2A.pdf", "ref-2026-07-17-dm-T2A", "Dimensions Math Textbook 2A"),
        ("atlas-dimensions-math-T3A.pdf", "ref-2026-07-17-dm-T3A", "Dimensions Math Textbook 3A"),
        ("atlas-dimensions-math-T4A.pdf", "ref-2026-07-17-dm-T4A", "Dimensions Math Textbook 4A"),
        ("atlas-dimensions-math-T5A.pdf", "ref-2026-07-17-dm-T5A", "Dimensions Math Textbook 5A"),
    ]

    for filename, ref_id, title in dm_items:
        pdf_path = INSPO_DIR / filename
        text = extract_text(pdf_path)
        pc = get_page_count(pdf_path)
        ref = build_ref(ref_id, title, pdf_path, "cosmo-atlas-scrape",
                       "atlas-scrape", "2026-07-17T22:06:00-04:00", text, pc)
        out_path = REFS_DIR / f"{ref_id}.json"
        with open(out_path, 'w') as f:
            json.dump(ref, f, indent=2)
        created.append({"id": ref_id, "title": title, "subject": ref["skillTargeting"]["subject"],
                        "domain": ref["skillTargeting"]["domain"], "format": ref["format"],
                        "droppedBy": "cosmo-atlas-scrape", "droppedAt": "2026-07-17T22:06:00-04:00"})
        print(f"  ✓ {ref_id}")

    # ---- Priority 3: BookShark ----
    import glob
    bs_files = sorted(glob.glob(str(INSPO_DIR / "atlas-bookshark-*.pdf")))
    for pdf_path in bs_files:
        filename = os.path.basename(pdf_path)
        slug = filename.replace('atlas-bookshark-', '').replace('.pdf', '')
        ref_id = f"ref-2026-07-17-bs-{slug}"
        title = f"BookShark {make_title_from_filename(filename)}"
        text = extract_text(pdf_path)
        pc = get_page_count(pdf_path)
        ref = build_ref(ref_id, title, pdf_path, "cosmo-atlas-scrape",
                       "atlas-scrape", "2026-07-17T22:07:00-04:00", text, pc)
        out_path = REFS_DIR / f"{ref_id}.json"
        with open(out_path, 'w') as f:
            json.dump(ref, f, indent=2)
        created.append({"id": ref_id, "title": title, "subject": ref["skillTargeting"]["subject"],
                        "domain": ref["skillTargeting"]["domain"], "format": ref["format"],
                        "droppedBy": "cosmo-atlas-scrape", "droppedAt": "2026-07-17T22:07:00-04:00"})
        print(f"  ✓ {ref_id}")

    # ---- Priority 4: Oak Meadow ----
    skip_slugs = ['drawing-and-design', 'integrated-drawing', 'painting', 'photography']
    om_files = sorted(glob.glob(str(INSPO_DIR / "atlas-oak-meadow-*.pdf")))
    for pdf_path in om_files:
        filename = os.path.basename(pdf_path)
        slug = filename.replace('atlas-oak-meadow-', '').replace('.pdf', '')
        # Check if should skip
        should_skip = False
        for skip in skip_slugs:
            if skip in slug:
                should_skip = True
                break
        if should_skip:
            print(f"  ⊘ skipping {slug} (already done)")
            continue

        ref_id = f"ref-2026-07-17-om-{slug}"
        title = f"Oak Meadow {make_title_from_filename(filename)}"
        text = extract_text(pdf_path)
        pc = get_page_count(pdf_path)
        ref = build_ref(ref_id, title, pdf_path, "cosmo-atlas-scrape",
                       "atlas-scrape", "2026-07-17T22:08:00-04:00", text, pc)
        out_path = REFS_DIR / f"{ref_id}.json"
        with open(out_path, 'w') as f:
            json.dump(ref, f, indent=2)
        created.append({"id": ref_id, "title": title, "subject": ref["skillTargeting"]["subject"],
                        "domain": ref["skillTargeting"]["domain"], "format": ref["format"],
                        "droppedBy": "cosmo-atlas-scrape", "droppedAt": "2026-07-17T22:08:00-04:00"})
        print(f"  ✓ {ref_id}")

    # ---- Update index.json ----
    with open(INDEX_PATH, 'r') as f:
        index = json.load(f)

    existing_ids = {r["id"] for r in index["references"]}
    for entry in created:
        if entry["id"] not in existing_ids:
            index["references"].append(entry)

    with open(INDEX_PATH, 'w') as f:
        json.dump(index, f, indent=2)

    print(f"\n✅ Created {len(created)} reference JSONs, index updated.")

if __name__ == "__main__":
    main()
