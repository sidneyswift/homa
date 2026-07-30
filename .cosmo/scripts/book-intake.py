#!/usr/bin/env python3
"""
book-intake.py: turn one captured book into per-page masters plus text.

WHY THIS EXISTS:
The co-founders capture a book with CamScanner and drop ONE PDF per book in
#homa-inspo (founder ruling 2026-07-28: phone-first capture, filter set to
Original, photographed in reading order). A PDF is a fine handoff envelope
and a bad archive: every downstream use is page-shaped, and dimension F
cannot verify a single span without the text. This script opens the
envelope.

    one PDF in  ->  per-page master images
                    .cosmo/text/<id>.txt        (the sidecar spans verify against)
                    .cosmo/masters/<id>/manifest.json  (provenance + gates)

WHAT IT WILL NOT DO:
Re-encode a page it did not have to. When the PDF carries photographs (the
CamScanner case), the embedded image is extracted byte-for-byte as the
master. Rasterizing would bake in a second lossy pass over a photo that is
already the only copy of a page. Only vector or text PDFs get rendered, at
an explicit DPI recorded in the manifest.

DETERMINISTIC GATES (no model, per the plan's gatekeeper stage):
page-count assertion, blank detection by ink coverage, blur detection by
edge variance, and exact duplicate detection by content hash. A page that
fails a gate is reported, never silently dropped: the operator can re-shoot
one page instead of the book.

TEXT, A MIXTURE ON PURPOSE:
Text layer if the PDF has one (born-digital, free and perfect). Otherwise
tesseract over every page, because it is fast and genuinely good at dense
body text, and then a vision model over the pages tesseract cannot do
honestly: the covers, anything with ink but no text read off it, and
anything garbled past use. Per-page provenance is recorded as textSource.

Neither reader alone is enough. OCR turned this pipeline's first real cover
into "MET | Pacis | RO READING | HANDBOOK", and a vision model over 110
pages of ordinary worksheets would be slow and pointless. The escalation set
on that book was 2 pages out of 110. The model also returns what the page
SHOWS, which no character-recognition pass can produce, and that lands in
the manifest as `visual` for the theming and aboutness dimensions.

USAGE:
    book-intake.py <pdf> --id ref-2026-07-28-some-book
    book-intake.py <pdf> --id cur-2026-07-28-some-curriculum --kind curriculum
    book-intake.py <pdf> --id <id> --expect-pages 84   # assert the count
    book-intake.py <pdf> --id <id> --force             # redo a finished item
    book-intake.py --check <id>                        # re-run gates only
    book-intake.py <pdf> --id <id> --no-vision         # tesseract only
"""

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Optional

try:
    import fitz  # PyMuPDF
except ImportError:
    print("ERROR: PyMuPDF is required. Install with: pip3 install pymupdf", file=sys.stderr)
    sys.exit(2)

import numpy as np
from PIL import Image

COSMO = Path(__file__).resolve().parent.parent
TEXT_DIR = COSMO / "text"
MASTERS_DIR = COSMO / "masters"
REFS_DIR = COSMO / "references"
CURS_DIR = COSMO / "curriculums"

ID_RE = re.compile(r"^(ref|cur)-\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*$")

# Gate thresholds. Deliberately loose: these exist to catch a finger over the
# lens or a page photographed twice, not to grade photography. A false alarm
# costs one re-shoot; a miss costs a page nobody notices is missing until the
# book is gone.
BLANK_INK_COVERAGE = 0.005

# Sharpness is the 99.9th percentile of gradient magnitude: how crisp the
# sharpest edges on the page are, not how many edges it has.
#
# Average edge energy was tried first and failed on the first real book. On
# the 110-page Fast Forward handbook it flagged the photographic cover and a
# sideways worksheet with a blue background, both perfectly sharp, because a
# large flat dark or coloured area drags a whole-page average down. Content
# density and background colour move the average; they do not move the
# sharpest edge. Measured: every real page scored 153 to 217 (the two false
# alarms scored 165 and 153, mid-pack), while a genuinely blurred page scores
# about 14, because blur leaves no crisp edge anywhere.
#
# Judged relative to the book's own median, with an absolute floor so a book
# that is blurry cover to cover cannot normalise its own blur away.
BLUR_RELATIVE_FLOOR = 0.40
BLUR_ABSOLUTE_FLOOR = 60.0

# Two pages are "the same page shot twice" when their text agrees this
# closely. Byte equality only catches a PDF that duplicated a page; a parent
# who photographs one page twice produces two different files, which is the
# likelier phone-lane mistake.
#
# Two pages are the same page shot twice only when the words AND the picture
# both agree. Either signal alone is wrong for workbooks:
#
# - Image alone: at 8x8 every page of a workbook is the same white rectangle
#   with a title bar and a text block, so it called three different fixture
#   pages duplicates of page 1.
# - Text alone: workbooks reuse a worksheet template verbatim across units.
#   On the real Fast Forward handbook, page 53 ("Phonics Review ... Unit 5")
#   and page 106 (the same sheet, "Unit 10") share 95% of their text and are
#   different pages of a real book.
#
# Requiring both is precise: a re-shoot of one page matches on both, a reused
# template matches only on text (the real pair sat 7 bits apart, where a
# genuine re-shoot sits at 0 to 2).
NEAR_DUPLICATE_TEXT_RATIO = 0.95
NEAR_DUPLICATE_MIN_CHARS = 40
NEAR_DUPLICATE_HAMMING = 4

# Boilerplate cannot be duplicate evidence. A graphic page whose only text is
# a running header carries almost no words, so two such pages match on text
# trivially and on an 8x8 hash easily. The PEMDAS foldable is the case: its
# text layer holds just "5th Grade / Bundle 8.1 / Order of Operations PEMDAS"
# on every page, which cleared the 40-character floor and produced seven false
# duplicate findings on a 25-page product.
#
# The discriminator: A DUPLICATE IS A PAIR, A FAMILY IS STRUCTURE. Text that
# is near-identical across three or more pages is a header, a template, or a
# product catalogue, never one page shot twice. Those pages fall back to
# byte-identity alone.
#
# Exact matching was tried first and was not enough. The same PEMDAS product
# ends with three seller catalogue pages whose 169 characters differ by one
# word ("5th GRADE", "4th GRADE", "3rd GRADE Math Doodles"), so they are 98%
# similar and not exactly equal, and they slipped straight through an
# equality-based check. Family detection uses the same similarity measure the
# gate itself fires on.
# A real re-shoot pair gives each page exactly ONE similar sibling, so one is
# the highest kin count a genuine duplicate can have. Two or more siblings is
# a family.
BOILERPLATE_FAMILY_MIN = 1

RENDER_DPI = 300

# An embedded image is only the page when it actually COVERS the page.
#
# The rule used to be "exactly one image means this is a photograph of a
# page", which is true for a CamScanner scan and false for a born-digital
# PDF. On the Harbor + Sprout workbook it extracted a 53x53 point decorative
# glyph covering 0.6% of the page AS the page: the master was 386x384 pixels
# where real pages are 2550x3300, and the page's actual text and layout were
# thrown away. Those pages then read as "featureless" to the blur gate, so
# the damage surfaced as a bogus re-shoot request rather than as the data
# loss it was.
EMBEDDED_PAGE_COVERAGE = 0.85

# Vision escalation. OCR and a vision model are complementary, so the
# pipeline runs both and keeps the better answer per page (founder direction
# 2026-07-29, after the first real book turned "METRO READING / Fast Forward!
# / STUDENT HANDBOOK" into "MET | Pacis | RO READING | HANDBOOK").
#
# Escalation is deliberately narrow, because tesseract is genuinely good at
# the dense body text that is most of a workbook. Measured on that book:
# every page scored 0.83+ on the gibberish check, so a quality threshold
# alone would have escalated nothing and missed the cover. What caught it
# was text yield: ink on the page and almost nothing read off it.
VISION_MODEL = "google/gemini-3-flash"
VISION_MIN_CHARS = 40          # below this, with ink present, OCR gave up
VISION_MIN_INK = 0.02
VISION_QUALITY_FLOOR = 0.55    # garbled beyond usefulness
PAGE_READ_SCRIPT = "scripts/page-read.mts"

# Orientation. A page shot upside down is sharp, fully inked, and unique, so
# EVERY other gate here passes it while its text comes out reversed. Three
# independent analyses of three different books found rotated pages that this
# script had reported clean (Your Health scans 40-42, Social Studies 118/129/
# 130, New Practice Readers 60-87 and 130-158), which is exactly the shape of
# a blind spot: not one loud failure, the same quiet one everywhere.
#
# tesseract ships orientation detection (--psm 0), so this is deterministic
# and needs no model. Masters stay untouched; a rotated COPY is what gets
# OCR'd, and the angle is recorded so later image work knows.
ORIENTATION_CONFIDENCE_MIN = 1.0


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def page_metrics(path: Path) -> dict:
    """Ink coverage, edge energy, and a perceptual hash for one page."""
    try:
        with Image.open(path) as im:
            width, height = im.size
            gray = im.convert("L")
            small = gray.resize((1000, 1000)) if max(width, height) > 1000 else gray
            arr = np.asarray(small, dtype=np.float32)

            # "Ink" is anything meaningfully darker than paper.
            ink = float((arr < 200).mean())

            # Sharpness: how crisp the sharpest edges are (99.9th percentile
            # of gradient magnitude), NOT how many edges the page has. A
            # photo cover and a sparse worksheet have few edges and perfectly
            # crisp ones; a blurred page has none anywhere.
            gx = np.abs(np.diff(arr, axis=1))
            gy = np.abs(np.diff(arr, axis=0))
            sharpness = float(np.percentile(np.concatenate([gx.ravel(), gy.ravel()]), 99.9))

            # Average hash: 8x8 mean-threshold bits, for near-duplicate pages.
            tiny = np.asarray(gray.resize((8, 8)), dtype=np.float32)
            bits = (tiny > tiny.mean()).flatten()
            ahash = int("".join("1" if b else "0" for b in bits), 2)

            return {
                "width": width, "height": height,
                "inkCoverage": round(ink, 5),
                "sharpness": round(sharpness, 2),
                "aHash": f"{ahash:016x}",
            }
    except Exception as exc:  # a bad page must not kill the book
        return {"error": f"{type(exc).__name__}: {exc}"}


def extract_pages(pdf_paths, out_dir: Path) -> list:
    """One master per page, numbered continuously across parts.

    A phone capture of a big book arrives in parts: CamScanner splits it and
    Slack caps uploads, so "Handwriting w/o Tears" is a 110MB part 1 and a
    20MB part 2 of ONE book. Treating those as two items would fragment the
    book's scope across two analyses and double-count it in every search, so
    the parts are concatenated in the order given and the page numbers run
    straight through."""
    if isinstance(pdf_paths, Path):
        pdf_paths = [pdf_paths]
    pages = []
    number = 0
    for part_index, pdf_path in enumerate(pdf_paths, 1):
        for page in _extract_one(pdf_path, out_dir, len(pdf_paths) > 1 and part_index or 0,
                                 start_number=number):
            pages.append(page)
            number = page["page"]
    return pages


def _extract_one(pdf_path: Path, out_dir: Path, part: int, start_number: int) -> list:
    doc = fitz.open(pdf_path)
    pages = []
    for index, page in enumerate(doc):
        number = start_number + index + 1
        images = page.get_images(full=True)
        record = {"page": number}

        # The CamScanner shape: exactly one photograph that COVERS the page.
        # Copy the original bytes rather than re-encoding a photo that is
        # already the only surviving copy of a physical page. Anything that
        # merely sits on the page is an illustration, and the page around it
        # is what we actually want.
        covers_page = False
        if len(images) == 1:
            try:
                page_area = page.rect.width * page.rect.height
                placed = page.get_image_rects(images[0][0])
                covered = max((r.width * r.height) for r in placed) if placed else 0
                covers_page = page_area > 0 and (covered / page_area) >= EMBEDDED_PAGE_COVERAGE
            except Exception:
                covers_page = False
        if covers_page:
            xref = images[0][0]
            try:
                raw = doc.extract_image(xref)
                ext = raw.get("ext", "png")
                dest = out_dir / f"p{number:04d}.{ext}"
                dest.write_bytes(raw["image"])
                record.update({
                    "master": dest.name, "source": "embedded-image",
                    "reencoded": False, "dpi": None,
                })
            except Exception as exc:
                record.update({"error": f"extract failed: {exc}"})
                images = []  # fall through to render
        if "master" not in record:
            dest = out_dir / f"p{number:04d}.png"
            pix = page.get_pixmap(dpi=RENDER_DPI)
            pix.save(dest)
            record.update({
                "master": dest.name, "source": "rendered",
                "reencoded": True, "dpi": RENDER_DPI,
            })

        master_path = out_dir / record["master"]
        record["bytes"] = master_path.stat().st_size
        record["sha256"] = sha256_file(master_path)
        if part:
            record["part"] = part
            record["partPage"] = index + 1
        record.update(page_metrics(master_path))
        record["rotation"] = page_orientation(master_path)
        pages.append(record)
    doc.close()
    return pages


def text_layer(pdf_paths) -> list:
    """Per-page text already in the PDFs, concatenated across parts. Empty
    strings mean the page needs OCR."""
    if isinstance(pdf_paths, Path):
        pdf_paths = [pdf_paths]
    out = []
    for pdf_path in pdf_paths:
        doc = fitz.open(pdf_path)
        out.extend(page.get_text().strip() for page in doc)
        doc.close()
    return out


def page_orientation(image_path: Path) -> int:
    """Degrees the page must be rotated to read upright, or 0. Best effort:
    an unreadable OSD result means 0, because guessing a rotation is worse
    than leaving a page alone."""
    if not shutil.which("tesseract"):
        return 0
    try:
        done = subprocess.run(
            ["tesseract", str(image_path), "stdout", "--psm", "0"],
            capture_output=True, text=True, timeout=60, check=False,
        )
    except (subprocess.TimeoutExpired, OSError):
        return 0
    if done.returncode != 0:
        return 0
    rotate = re.search(r"^Rotate: (\d+)", done.stdout, re.M)
    conf = re.search(r"^Orientation confidence: ([\d.]+)", done.stdout, re.M)
    if not rotate:
        return 0
    if conf and float(conf.group(1)) < ORIENTATION_CONFIDENCE_MIN:
        return 0
    return int(rotate.group(1)) % 360


def ocr_page(image_path: Path, rotate: int = 0) -> str:
    if not shutil.which("tesseract"):
        return ""
    source = image_path
    tmp = None
    if rotate:
        # Rotate a copy, never the master: the master is the capture, and a
        # re-encoded master is a second lossy pass over the only copy.
        try:
            with Image.open(image_path) as im:
                tmp = image_path.parent / f".rot-{image_path.name}"
                im.rotate(-rotate, expand=True).save(tmp)
            source = tmp
        except Exception:
            source = image_path
    try:
        done = subprocess.run(
            ["tesseract", str(source), "stdout", "-l", "eng"],
            capture_output=True, text=True, timeout=180, check=False,
        )
        return done.stdout.strip() if done.returncode == 0 else ""
    except (subprocess.TimeoutExpired, OSError):
        return ""
    finally:
        if tmp is not None:
            tmp.unlink(missing_ok=True)


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def ocr_quality(text: str) -> float:
    """0 to 1 on whether this reads like language at all. Catches a garbled
    scan; does NOT catch a confident misreading, which is why text yield is
    the other half of the escalation rule."""
    body = re.sub(r"\s+", " ", text or "").strip()
    if not body:
        return 0.0
    tokens = [w for w in re.findall(r"[A-Za-z']+", body) if len(w) >= 3]
    vowel = (sum(1 for w in tokens if re.search(r"[aeiouAEIOU]", w)) / len(tokens)) if tokens else 0.0
    alpha = sum(c.isalnum() or c.isspace() for c in body) / len(body)
    return min(vowel, alpha)


def pages_needing_vision(pages: list, texts: list) -> list:
    """Page numbers whose text OCR cannot be trusted to have got right."""
    if not pages:
        return []
    last = pages[-1]["page"]
    out = []
    for p, text in zip(pages, texts):
        n = p["page"]
        if "error" in p:
            continue
        # Covers always. They carry the book's identity, they are the most
        # likely page to be display type over artwork, and they are two
        # pages out of a hundred.
        if n == 1 or n == last:
            out.append(n)
            continue
        if p.get("inkCoverage", 0) < BLANK_INK_COVERAGE:
            continue
        chars = len(re.sub(r"\s+", " ", text or "").strip())
        if chars < VISION_MIN_CHARS and p.get("inkCoverage", 0) > VISION_MIN_INK:
            out.append(n)
        elif chars >= VISION_MIN_CHARS and ocr_quality(text) < VISION_QUALITY_FLOOR:
            out.append(n)
    return out


def oidc_token() -> Optional[str]:
    """Vercel OIDC, never a gateway API key (founder ruling 2026-07-27).

    .env.local is gitignored, so a git worktree does not have one: an
    ingestion session run from a worktree has to reach the main checkout for
    it, or every cover silently falls back to OCR."""
    token = os.environ.get("VERCEL_OIDC_TOKEN")
    if token:
        return token
    candidates = [COSMO.parent / "apps" / "web" / ".env.local"]
    try:
        common = subprocess.run(
            ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
            cwd=COSMO.parent, capture_output=True, text=True, timeout=10, check=False,
        )
        if common.returncode == 0 and common.stdout.strip():
            candidates.append(Path(common.stdout.strip()).parent / "apps" / "web" / ".env.local")
    except (subprocess.TimeoutExpired, OSError):
        pass
    for env_local in candidates:
        if not env_local.exists():
            continue
        for line in env_local.read_text().splitlines():
            if line.startswith("VERCEL_OIDC_TOKEN="):
                value = line.split("=", 1)[1].strip().strip('"')
                if value:
                    return value
    return None


def read_pages_with_vision(item_dir: Path, pages: list, wanted: list) -> dict:
    """Page number -> {text, description, kind, confidence} from the vision
    model. Returns {} on any failure: a page keeps its tesseract text and the
    caller reports the degradation rather than silently shipping less."""
    if not wanted:
        return {}
    token = oidc_token()
    if not token:
        print("  WARNING: no VERCEL_OIDC_TOKEN, so the vision pass is skipped. "
              "Run `pnpm dev:token` and re-run with --force to read covers properly.")
        return {}
    by_number = {p["page"]: p for p in pages}
    payload = {
        "model": VISION_MODEL,
        "pages": [
            {"page": n, "path": str((item_dir / by_number[n]["master"]).resolve())}
            for n in wanted if "master" in by_number.get(n, {})
        ],
    }
    env = {**os.environ, "VERCEL_OIDC_TOKEN": token}
    try:
        done = subprocess.run(
            ["corepack", "pnpm", "--filter", "web", "exec", "tsx", PAGE_READ_SCRIPT],
            input=json.dumps(payload), capture_output=True, text=True,
            cwd=COSMO.parent, env=env, timeout=120 + 60 * len(wanted), check=False,
        )
    except (subprocess.TimeoutExpired, OSError) as exc:
        print(f"  WARNING: vision pass failed ({type(exc).__name__}); keeping OCR text.")
        return {}
    line = next((l for l in reversed(done.stdout.splitlines()) if l.startswith("{")), "")
    if not line:
        print(f"  WARNING: vision pass produced no result; keeping OCR text. "
              f"{(done.stderr or '').strip().splitlines()[-1][:160] if done.stderr else ''}")
        return {}
    try:
        parsed = json.loads(line)
    except json.JSONDecodeError:
        print("  WARNING: vision pass returned unparseable output; keeping OCR text.")
        return {}
    out, failed = {}, {}
    for row in parsed.get("pages", []):
        if "error" in row:
            print(f"  WARNING: page {row.get('page')} vision read failed ({row['error'][:110]}); keeping OCR text.")
            failed[row["page"]] = row["error"]
            continue
        out[row["page"]] = row
    return {"read": out, "failed": failed}


def run_gates(pages: list, expect_pages, texts: dict = None) -> list:
    """Deterministic findings. Every one names the page so a re-shoot is one
    page of work, and every one says what the operator should do about it."""
    findings = []
    if expect_pages is not None and expect_pages != len(pages):
        findings.append(
            f"page count is {len(pages)}, operator expected {expect_pages}. "
            "A short count on a phone capture usually means a page was skipped."
        )

    readable = [p for p in pages if "error" not in p]
    # Sharpness is relative to this book. Ignore near-blank pages when taking
    # the median: a book padded with blank versos would otherwise drag the
    # yardstick down until nothing looks blurry.
    inked = [p["sharpness"] for p in readable
             if p.get("inkCoverage", 0) >= BLANK_INK_COVERAGE and "sharpness" in p]
    median = float(np.median(inked)) if inked else 0.0

    exact, near, rotated = {}, [], []

    # For each page, how many OTHER pages read near-identically. More than one
    # means this text is structure (header, template, catalogue), so it cannot
    # be evidence that one page was captured twice.
    family_size = {}
    if texts:
        usable = {n: _normalize_text(v) for n, v in texts.items()
                  if len(_normalize_text(v)) >= NEAR_DUPLICATE_MIN_CHARS}
        for n, a_text in usable.items():
            kin = 0
            for m, b_text in usable.items():
                if m == n:
                    continue
                if SequenceMatcher(None, a_text, b_text).ratio() >= NEAR_DUPLICATE_TEXT_RATIO:
                    kin += 1
            family_size[n] = kin
    for p in pages:
        n = p["page"]
        if "error" in p:
            findings.append(f"page {n}: unreadable ({p['error']})")
            continue

        if p.get("inkCoverage", 1) < BLANK_INK_COVERAGE:
            findings.append(f"page {n}: looks blank (ink {p['inkCoverage']}). Skip it or re-shoot it.")
        elif median > 0:
            sharpness = p.get("sharpness", median)
            if sharpness < median * BLUR_RELATIVE_FLOOR or sharpness < BLUR_ABSOLUTE_FLOOR:
                findings.append(
                    f"page {n}: softer than the rest of the book "
                    f"(sharpness {sharpness} against a median of {round(median, 2)}). Re-shoot this page."
                )

        if p.get("rotation"):
            rotated.append(n)

        first = exact.setdefault(p["sha256"], n)
        if first != n:
            findings.append(f"page {n}: byte-identical to page {first}. The same page was captured twice.")
            continue

        text = _normalize_text(texts.get(n, "")) if texts else ""
        if family_size.get(n, 0) > BOILERPLATE_FAMILY_MIN:
            text = ""  # structure, not this page's own content
        if len(text) >= NEAR_DUPLICATE_MIN_CHARS and "aHash" in p:
            value = int(p["aHash"], 16)
            for other_n, other_text, other_hash in near:
                ratio = SequenceMatcher(None, text, other_text).ratio()
                if ratio < NEAR_DUPLICATE_TEXT_RATIO:
                    continue
                distance = bin(value ^ other_hash).count("1")
                if distance > NEAR_DUPLICATE_HAMMING:
                    # Same words, different picture: a reused worksheet
                    # template, not the same page twice.
                    continue
                findings.append(
                    f"page {n}: reads as the same page as page {other_n} shot again "
                    f"({int(ratio * 100)}% identical text, images {distance} bits apart). "
                    "Keep the sharper one and drop the other."
                )
                break
            near.append((n, text, value))

    if rotated:
        findings.append(
            f"{len(rotated)} page(s) were shot rotated ({rotated[:12]}"
            + (" ..." if len(rotated) > 12 else "")
            + "). Their text was read correctly from a rotated copy, so nothing is lost and no "
              "re-shoot is owed, but the MASTERS are still rotated: any later image work off "
              "them must turn them first."
        )
    return findings


def write_sidecar(item_id: str, pages: list, texts: list) -> dict:
    """One text file per item, page-marked. Whitespace is normalized by the
    verifier, so markers cannot break a span check; a span that straddles a
    page break failing to match is correct, not a bug."""
    TEXT_DIR.mkdir(parents=True, exist_ok=True)
    parts, empty = [], []
    for p, text in zip(pages, texts):
        parts.append(f"--- page {p['page']} ---\n{text}".rstrip())
        if not text.strip():
            empty.append(p["page"])
    path = TEXT_DIR / f"{item_id}.txt"
    path.write_text("\n\n".join(parts) + "\n")
    chars = sum(len(t) for t in texts)
    return {"path": str(path.relative_to(COSMO.parent)), "chars": chars, "emptyPages": empty}


def stub_json(item_id: str, kind: str, manifest: dict, pdf_path: Path) -> Path:
    """A stub the ingestion skill fills in. Mechanically-knowable fields only:
    this file never guesses at anything a model should be judging."""
    target_dir = CURS_DIR if kind == "curriculum" else REFS_DIR
    target = target_dir / f"{item_id}.json"
    capture = {
        "lane": "phone",
        "sourceFile": pdf_path.name,
        "sourceParts": [p["file"] for p in manifest["source"].get("parts", [])],
        "sourceSha256": manifest["source"]["sha256"],
        "pageCount": manifest["pageCount"],
        "mastersDir": manifest["mastersDir"],
        "intakeAt": manifest["intakeAt"],
        "gateFindings": manifest["gateFindings"],
    }
    if target.exists():
        # A re-run refreshes the capture block and touches nothing else. The
        # analyst's work is theirs; stale gate findings beside a fresh
        # manifest are a lie about what the capture looks like now.
        try:
            existing = json.loads(target.read_text())
        except (json.JSONDecodeError, OSError):
            return target
        existing["capture"] = {**(existing.get("capture") or {}), **capture}
        target.write_text(json.dumps(existing, indent=2) + "\n")
        return target
    stub = {
        "id": item_id,
        "droppedBy": None,
        "droppedAt": None,
        "sourceChannel": "homa-inspo",
        "sourceMessageTs": None,
        "capture": capture,
        "aboutness": {
            "extractionQuality": None,
            "textSidecar": manifest["text"]["path"],
            "textBlobUrl": None,
            "subjects": [], "entities": [], "themes": [],
            "keyTerms": [], "referencedWorks": [],
        },
    }
    if kind == "curriculum":
        stub["name"] = None
        stub["layer5_lessons"] = {
            "decompositionQuality": None, "unitKind": None,
            "unitsFound": None, "unitsDecomposed": 0, "units": [],
        }
    else:
        stub["title"] = None
        stub["format"] = None
    target.write_text(json.dumps(stub, indent=2) + "\n")
    return target


def intake(pdf_paths, item_id: str, kind: str, expect_pages, force: bool,
           use_vision: bool = True) -> int:
    out_dir = MASTERS_DIR / item_id
    manifest_path = out_dir / "manifest.json"
    if manifest_path.exists() and not force:
        print(f"Already ingested: {manifest_path}\nRe-run with --force to redo it.")
        return 0
    out_dir.mkdir(parents=True, exist_ok=True)

    names = ", ".join(p.name for p in pdf_paths)
    print(f"Reading {names} ..." if len(pdf_paths) == 1
          else f"Reading {len(pdf_paths)} parts as one book: {names} ...")
    pages = extract_pages(pdf_paths, out_dir)
    print(f"  {len(pages)} page(s) written to {out_dir}")

    layer = text_layer(pdf_paths)
    have_layer = sum(1 for t in layer if t.strip())
    texts, method = [], "pdf-text-layer"
    if have_layer >= max(1, len(pages) // 2):
        texts = layer
        print(f"  text layer present on {have_layer}/{len(pages)} page(s), no OCR needed")
    else:
        method = "tesseract"
        if not shutil.which("tesseract"):
            print("  WARNING: no text layer and tesseract is not installed. "
                  "The sidecar will be empty and no span can be verified.")
            texts = [""] * len(pages)
            method = "none"
        else:
            print(f"  no usable text layer, running OCR on {len(pages)} page(s) ...")
            for p in pages:
                texts.append(ocr_page(out_dir / p["master"], p.get("rotation", 0))
                             if "master" in p else "")
                if p["page"] % 10 == 0:
                    print(f"    ... page {p['page']}")

    # The mixture: keep OCR where it is good, escalate where it is not.
    vision, vision_failed, vision_attempted = {}, {}, []
    text_sources = {p["page"]: method for p in pages}
    if use_vision:
        wanted = pages_needing_vision(pages, texts)
        if wanted:
            vision_attempted = wanted
            print(f"  escalating {len(wanted)} page(s) to {VISION_MODEL}: {wanted[:12]}"
                  + (" ..." if len(wanted) > 12 else ""))
            outcome = read_pages_with_vision(out_dir, pages, wanted)
            vision, vision_failed = outcome.get("read", {}), outcome.get("failed", {})
            for i, p in enumerate(pages):
                row = vision.get(p["page"])
                if row and (row.get("text") or "").strip():
                    texts[i] = row["text"]
                    text_sources[p["page"]] = f"vision:{row.get('model', VISION_MODEL)}"
                elif p["page"] in vision_failed:
                    text_sources[p["page"]] = f"{method} (vision read failed)"
            if vision:
                print(f"  {len(vision)} page(s) re-read by the model")

    text_info = write_sidecar(item_id, pages, texts)
    findings = run_gates(pages, expect_pages,
                         texts={p["page"]: t for p, t in zip(pages, texts)})
    if vision_failed:
        findings.append(
            f"{len(vision_failed)} page(s) could not be read by the model "
            f"({sorted(vision_failed)}), so they keep their OCR text; that text is the "
            "least trustworthy in the book, because these are the pages OCR did worst on."
        )
    if text_info["emptyPages"]:
        findings.append(
            f"{len(text_info['emptyPages'])} page(s) produced no text: "
            f"{text_info['emptyPages'][:12]}. Spans cannot be verified against them."
        )

    manifest = {
        "id": item_id,
        "kind": kind,
        "intakeAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": {
            "file": pdf_paths[0].name,
            "sha256": sha256_file(pdf_paths[0]),
            "bytes": pdf_paths[0].stat().st_size,
            "parts": [
                {"file": p.name, "sha256": sha256_file(p), "bytes": p.stat().st_size}
                for p in pdf_paths
            ],
        },
        "pageCount": len(pages),
        "mastersDir": str(out_dir.relative_to(COSMO.parent)),
        "textExtraction": {
            "method": method,
            "visionModel": VISION_MODEL if vision_attempted else None,
            "visionAttempted": sorted(vision_attempted),
            "visionPages": sorted(vision),
            # A failed read must never look like a page that was simply never
            # escalated: the pages sent to the model are the ones whose OCR
            # text is worst, so a silent fallback hides the worst text in the
            # book behind a clean-looking manifest.
            "visionFailed": {str(k): v[:200] for k, v in sorted(vision_failed.items())},
            **text_info,
        },
        "text": text_info,
        "gateFindings": findings,
        "pages": [
            {
                **p,
                "textSource": text_sources.get(p["page"], method),
                **({"visual": {k: vision[p["page"]][k]
                               for k in ("description", "kind", "confidence")
                               if k in vision[p["page"]]}}
                   if p["page"] in vision else {}),
            }
            for p in pages
        ],
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

    stub = stub_json(item_id, kind, manifest, pdf_paths[0])

    print(f"\n  masters   {out_dir}")
    print(f"  text      {text_info['path']} ({text_info['chars']} chars, method {method})")
    print(f"  manifest  {manifest_path}")
    print(f"  stub      {stub}")
    if findings:
        print(f"\n  {len(findings)} gate finding(s):")
        for f in findings:
            print(f"    - {f}")
        print("\n  Fix what is fixable by re-shooting those pages, then re-run with --force.")
    else:
        print("\n  All deterministic gates passed.")
    print("\nNext: run the ingestion skill to fill the stub (identity, dimensions A-F"
          + (", Layer 5" if kind == "curriculum" else "") + "), then verify:")
    print(f"  python3 .cosmo/scripts/verify-ingestion.py {item_id}")
    return 1 if findings else 0


def sidecar_pages(item_id: str) -> dict:
    """Page number -> text, read back from the sidecar this script wrote."""
    path = TEXT_DIR / f"{item_id}.txt"
    if not path.exists():
        return {}
    out = {}
    for chunk in path.read_text().split("--- page ")[1:]:
        head, _, body = chunk.partition(" ---")
        if head.strip().isdigit():
            out[int(head.strip())] = body.strip()
    return out


def revision(item_id: str) -> int:
    """Redo only the vision pass, reusing the masters and the text already on
    disk.

    Iterating on the vision layer should not cost a re-OCR of the whole book:
    fixing an output-token budget meant re-reading two pages, and a full
    re-intake would have re-run tesseract over 317. Retries every page whose
    model read previously failed, plus anything that now qualifies."""
    item_dir = MASTERS_DIR / item_id
    manifest_path = item_dir / "manifest.json"
    if not manifest_path.exists():
        print(f"No manifest for {item_id}. Run intake first.")
        return 2
    manifest = json.loads(manifest_path.read_text())
    pages = manifest["pages"]
    by_page = sidecar_pages(item_id)
    if not by_page:
        print(f"No text sidecar for {item_id}. Run a full intake first.")
        return 2
    texts = [by_page.get(p["page"], "") for p in pages]

    previously_failed = [int(n) for n in (manifest.get("textExtraction", {})
                                          .get("visionFailed") or {})]
    wanted = sorted(set(pages_needing_vision(pages, texts)) | set(previously_failed))
    if not wanted:
        print(f"{item_id}: nothing needs a model read.")
        return 0
    print(f"{item_id}: re-reading {len(wanted)} page(s): {wanted[:12]}"
          + (" ..." if len(wanted) > 12 else ""))
    outcome = read_pages_with_vision(item_dir, pages, wanted)
    vision, failed = outcome.get("read", {}), outcome.get("failed", {})

    method = manifest.get("textExtraction", {}).get("method", "tesseract")
    for i, p in enumerate(pages):
        row = vision.get(p["page"])
        if row and (row.get("text") or "").strip():
            texts[i] = row["text"]
            p["textSource"] = f"vision:{row.get('model', VISION_MODEL)}"
            p["visual"] = {k: row[k] for k in ("description", "kind", "confidence") if k in row}
        elif p["page"] in failed:
            p["textSource"] = f"{method} (vision read failed)"

    text_info = write_sidecar(item_id, pages, texts)
    te = manifest.setdefault("textExtraction", {})
    te["visionAttempted"] = sorted(set(te.get("visionAttempted") or []) | set(wanted))
    te["visionPages"] = sorted({p["page"] for p in pages if "visual" in p})
    te["visionFailed"] = {str(k): v[:200] for k, v in sorted(failed.items())}
    te.update(text_info)
    manifest["text"] = text_info
    manifest["gateFindings"] = run_gates(
        pages, manifest.get("pageCount"),
        texts={p["page"]: t for p, t in zip(pages, texts)})
    if failed:
        manifest["gateFindings"].append(
            f"{len(failed)} page(s) could not be read by the model ({sorted(failed)}), "
            "so they keep their OCR text.")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    stub_json(item_id, manifest.get("kind", "reference"), manifest,
              Path(manifest["source"]["file"]))
    print(f"  {len(vision)} re-read, {len(failed)} still failing")
    for f in manifest["gateFindings"]:
        print(f"    - {f}")
    return 1 if failed else 0


def recheck(item_id: str) -> int:
    manifest_path = MASTERS_DIR / item_id / "manifest.json"
    if not manifest_path.exists():
        print(f"No manifest for {item_id}. Run intake first.")
        return 2
    manifest = json.loads(manifest_path.read_text())
    findings = run_gates(manifest["pages"], manifest["pageCount"], texts=sidecar_pages(item_id))
    print(f"{item_id}: {manifest['pageCount']} page(s), {len(findings)} finding(s)")
    for f in findings:
        print(f"  - {f}")
    return 1 if findings else 0


def self_test() -> int:
    """
    Regression net for the gates. Both thresholds in this file were wrong on
    the first pass and only measurement found it: the blur floor was an
    absolute number that a real blurry page sailed past, and image-hash
    duplicate detection called three different workbook pages duplicates of
    page 1. A gate that stops firing, or fires on everything, is worse than
    no gate, and neither failure is visible without fixtures.

    Run: python3 .cosmo/scripts/book-intake.py --self-test
    """
    import tempfile
    from PIL import ImageDraw, ImageEnhance, ImageFilter, ImageFont

    pages_text = [
        ("Week 7: Introduction to Science Fiction",
         "Read A Wrinkle in Time by Madeleine L'Engle,\nchapters 1 through 3.\nWhy is Meg frustrated?"),
        ("Week 8: Continuing A Wrinkle in Time",
         "Read chapters 4 through 7.\nWhat does the tesseract represent?\nBuild one from paper."),
        ("Week 9: Writing Your Own Story",
         "Students draft a science fiction scene.\nWhat makes a setting feel real?"),
    ]

    def render(title, body, blur=False):
        im = Image.new("RGB", (1700, 2200), "white")
        d = ImageDraw.Draw(im)
        try:
            ft = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 64)
            fb = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 46)
        except OSError:
            ft = fb = ImageFont.load_default()
        d.text((140, 220), title, fill="black", font=ft)
        d.multiline_text((140, 400), body, fill="black", font=fb, spacing=18)
        return im.filter(ImageFilter.GaussianBlur(6)) if blur else im

    failures = 0
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)

        def build_pdf(name, images):
            paths = []
            for i, im in enumerate(images, 1):
                p = tmp / f"{name}-{i}.jpg"
                im.save(p, "JPEG", quality=92)
                paths.append(p)
            doc = fitz.open()
            for p in paths:
                with Image.open(p) as im:
                    w, h = im.size
                page = doc.new_page(width=w * 0.24, height=h * 0.24)
                page.insert_image(page.rect, filename=str(p))
            out = tmp / f"{name}.pdf"
            doc.save(out)
            doc.close()
            return out

        sharp = [render(t, b) for t, b in pages_text]
        cases = []

        # A clean book must produce no findings at all. This is the case that
        # matters most: a noisy gate gets ignored.
        cases.append(("a clean book raises nothing", build_pdf("clean", sharp), 3, []))

        # One blurred page among sharp ones.
        cases.append(("a blurry page is caught",
                      build_pdf("blurry", sharp + [render(*pages_text[0], blur=True)]),
                      4, ["softer than the rest"]))

        # The same page shot twice: different bytes, same words.
        reshot = ImageEnhance.Brightness(sharp[0]).enhance(1.06).rotate(0.4, fillcolor="white")
        cases.append(("a re-shot page is caught by its text",
                      build_pdf("reshot", sharp + [reshot]),
                      4, ["shot again"]))

        # A page duplicated inside the PDF itself.
        cases.append(("a byte-identical page is caught",
                      build_pdf("dupe", sharp + [sharp[2].copy()]),
                      4, ["byte-identical"]))

        # A blank page.
        cases.append(("a blank page is caught",
                      build_pdf("blank", sharp + [Image.new("RGB", (1700, 2200), "white")]),
                      4, ["looks blank"]))

        # The three false alarms the first real book produced (the 110-page
        # Fast Forward handbook, 2026-07-29). Every one of them is a sharp
        # page of a good capture, and the first version of these gates
        # flagged all three. They are fixtures now.

        # A dark photographic cover: few edges, all crisp.
        cover = Image.new("RGB", (1700, 2200), (18, 20, 30))
        cd = ImageDraw.Draw(cover)
        try:
            cf = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 120)
        except OSError:
            cf = ImageFont.load_default()
        cd.ellipse((300, 700, 1400, 1500), fill=(210, 215, 225))
        cd.text((200, 300), "READING", fill=(230, 40, 40), font=cf)
        cases.append(("a dark photo cover is not called blurry",
                      build_pdf("cover", [cover] + sharp), 4, []))

        # A sideways worksheet on a coloured background: large flat areas.
        sideways = Image.new("RGB", (2200, 1700), (120, 170, 220))
        sd = ImageDraw.Draw(sideways)
        sd.rectangle((150, 120, 2050, 1580), fill="white")
        try:
            sf = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 46)
        except OSError:
            sf = ImageFont.load_default()
        sd.multiline_text((260, 300),
                          "Vocabulary: great, learn, some, work\n\n"
                          "1. Sara wants to be a ______ painter.\n"
                          "2. She will ______ how to mix paint.",
                          fill="black", font=sf, spacing=30)
        cases.append(("a sparse page on a coloured background is not called blurry",
                      build_pdf("sideways", sharp + [sideways]), 4, []))

        # A reused worksheet template: the SAME instructions with different
        # exercise content, which is how a workbook repeats a sheet across
        # units. The real pair (Phonics Review at Unit 5 and Unit 10) read as
        # 95% identical text while their pictures sat 7 bits apart, so the
        # fixture isolates exactly that: identical words, different picture.
        def template(fill_box):
            im = Image.new("RGB", (1700, 2200), "white")
            d = ImageDraw.Draw(im)
            try:
                f = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 46)
            except OSError:
                f = ImageFont.load_default()
            d.multiline_text((140, 260),
                             "Phonics Review\n\n"
                             "Use letters from the letter pools to make words.\n"
                             "You do not always have to use every pool.\n\n"
                             "Initial   Middle   Final",
                             fill="black", font=f, spacing=22)
            # The exercise area: where a real reused sheet actually differs.
            d.rectangle(fill_box, fill="black")
            return im

        # The PEMDAS catalogue: three pages of 169 characters differing by one
        # word. Near-identical, and three DIFFERENT pages of a real product.
        def catalogue(grade):
            im = Image.new("RGB", (1700, 2200), "white")
            d = ImageDraw.Draw(im)
            try:
                f = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 44)
            except OSError:
                f = ImageFont.load_default()
            d.multiline_text((140, 300),
                             "Copyright 2016 Science Doodles\n"
                             f"{grade} GRADE Math Doodles\n"
                             "All pictures hyperlinked, click a picture to go to product\n"
                             "Also some foldables",
                             fill="black", font=f, spacing=26)
            d.rectangle((200, 900 + 40 * len(grade), 1500, 1600), outline="black", width=6)
            return im

        cases.append(("a three-page catalogue family is not called duplicates",
                      build_pdf("catalogue", sharp + [catalogue("5th"), catalogue("4th"),
                                                      catalogue("3rd")]),
                      6, []))

        cases.append(("a reused worksheet template is not called a duplicate",
                      build_pdf("template", sharp + [
                          template((200, 900, 1500, 1400)),
                          template((200, 1500, 1500, 2000)),
                      ]), 5, []))

        for label, pdf, page_count, expected in cases:
            out_dir = tmp / f"out-{pdf.stem}"
            out_dir.mkdir()
            pages = extract_pages(pdf, out_dir)
            layer = text_layer(pdf)
            texts = layer if sum(1 for t in layer if t.strip()) >= max(1, len(pages) // 2) \
                else [ocr_page(out_dir / p["master"]) for p in pages]
            findings = run_gates(pages, page_count, texts=dict(zip(range(1, len(pages) + 1), texts)))
            missing = [e for e in expected if not any(e in f for f in findings)]
            extra = [] if expected else findings
            ok = not missing and not extra
            print(f"  {'✅' if ok else '❌'} {label}")
            if not ok:
                failures += 1
                for m in missing:
                    print(f"       expected a finding containing {m!r}")
                for f in extra:
                    print(f"       unexpected finding: {f}")

        # The page-count assertion.
        pdf = build_pdf("count", sharp)
        out_dir = tmp / "out-count"
        out_dir.mkdir()
        findings = run_gates(extract_pages(pdf, out_dir), 4)
        ok = any("page count is 3" in f for f in findings)
        print(f"  {'✅' if ok else '❌'} a short page count is caught")
        failures += 0 if ok else 1

    print(f"\nself-test: {len(cases) + 1 - failures} passed, {failures} failed")
    return 1 if failures else 0


def main():
    parser = argparse.ArgumentParser(description="Explode a captured book into masters plus text.")
    parser.add_argument("pdf", nargs="*",
                        help="the captured PDF(s). Give several, in reading order, when a\nphone capture split ONE book across parts; they become one item.")
    parser.add_argument("--id", help="item id: ref-YYYY-MM-DD-slug or cur-YYYY-MM-DD-slug")
    parser.add_argument("--kind", choices=("reference", "curriculum"),
                        help="defaults to curriculum for a cur- id, reference otherwise")
    parser.add_argument("--expect-pages", type=int,
                        help="page count the operator counted, asserted against the capture")
    parser.add_argument("--force", action="store_true", help="redo an already-ingested item")
    parser.add_argument("--check", metavar="ID", help="re-run the gates on an ingested item")
    parser.add_argument("--revision", metavar="ID",
                        help="redo only the model pass on an ingested item, reusing its masters and text")
    parser.add_argument("--no-vision", action="store_true",
                        help="tesseract only; skip the model pass over covers and unreadable pages")
    parser.add_argument("--self-test", action="store_true", help="run the gate fixtures")
    args = parser.parse_args()

    if args.self_test:
        return self_test()
    if args.revision:
        return revision(args.revision)
    if args.check:
        return recheck(args.check)
    if not args.pdf or not args.id:
        parser.print_help()
        return 2
    if not ID_RE.match(args.id):
        print(f"ERROR: id {args.id!r} must look like ref-2026-07-28-some-slug", file=sys.stderr)
        return 2
    pdf_paths = [Path(p) for p in args.pdf]
    missing = [str(p) for p in pdf_paths if not p.exists()]
    if missing:
        print(f"ERROR: no such file: {', '.join(missing)}", file=sys.stderr)
        return 2
    kind = args.kind or ("curriculum" if args.id.startswith("cur-") else "reference")
    return intake(pdf_paths, args.id, kind, args.expect_pages, args.force,
                  use_vision=not args.no_vision)


if __name__ == "__main__":
    sys.exit(main())
