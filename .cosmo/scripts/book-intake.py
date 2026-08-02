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
capture master. If a page was photographed sideways, the capture master is
kept and a separate upright working master is created. JPEG pages use
lossless jpegtran when possible; other pages become lossless PNGs. Only
vector or text PDFs get rendered, at an explicit DPI recorded in the
manifest.

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
    book-intake.py <pdf> --id ref-2026-07-28-some-book --expect-pages 84
    book-intake.py <pdf> --id cur-2026-07-28-some-curriculum --kind curriculum --expect-pages 84
    book-intake.py <pdf> --id <id> --force             # redo a finished item
    book-intake.py <pdf> --id <id> --jobs 4            # bounded page workers
    book-intake.py <pdf...> --id <id> --expect-pages 84 --resume-captured
    book-intake.py --check <id>                        # re-run gates only
    book-intake.py --normalize-masters <id>            # repair old sideways masters
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
import tempfile
from concurrent.futures import ThreadPoolExecutor
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
VISION_BATCH_PAGES = 12

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

# Tesseract is CPU and memory heavy. Concurrency is opt-in and capped so one
# large wave cannot turn a typo into hundreds of simultaneous subprocesses.
MAX_JOBS = 8


def parse_jobs(value: str) -> int:
    try:
        jobs = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("jobs must be an integer") from exc
    if not 1 <= jobs <= MAX_JOBS:
        raise argparse.ArgumentTypeError(f"jobs must be between 1 and {MAX_JOBS}")
    return jobs


def parse_expected_pages(value: str) -> int:
    try:
        pages = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("expected pages must be an integer") from exc
    if pages <= 0:
        raise argparse.ArgumentTypeError("expected pages must be positive")
    return pages


def _check_jobs(jobs: int) -> None:
    if not 1 <= jobs <= MAX_JOBS:
        raise ValueError(f"jobs must be between 1 and {MAX_JOBS}")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def source_receipt(pdf_paths: list[Path]) -> dict:
    parts = [
        {"file": path.name, "sha256": sha256_file(path), "bytes": path.stat().st_size}
        for path in pdf_paths
    ]
    return {
        "file": parts[0]["file"],
        "sha256": parts[0]["sha256"],
        "bytes": parts[0]["bytes"],
        "parts": parts,
    }


def portable_source_receipt(item_id: str, kind: str, source: dict) -> dict:
    """Committed byte identity for verification without ignored local masters."""
    return {
        "version": 1,
        "recordId": item_id,
        "kind": kind,
        "parts": [
            {
                "file": part["file"],
                "sha256": part["sha256"],
                "bytes": part["bytes"],
            }
            for part in source.get("parts", [])
        ],
    }


def _positive_page_count(value) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value > 0


def expected_page_count(manifest: dict) -> Optional[int]:
    """The independent operator assertion, never inferred from observed pages."""
    expected = manifest.get("expectedPageCount")
    if _positive_page_count(expected):
        return expected
    return None


def capture_review_binding(
    item_id: str,
    kind: str,
    source: dict,
    page_count,
    asserted_page_count,
) -> Optional[dict]:
    """Exact capture identity a human gate review must have inspected."""
    if not _positive_page_count(page_count) or not _positive_page_count(
        asserted_page_count
    ):
        return None
    receipt = portable_source_receipt(item_id, kind, source)
    parts = receipt.get("parts") or []
    if not parts:
        return None
    encoded = json.dumps(
        receipt,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return {
        "version": 1,
        "recordId": item_id,
        "sourceReceiptSha256": hashlib.sha256(encoded).hexdigest(),
        "pageCount": page_count,
        "expectedPageCount": asserted_page_count,
    }


def atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=path.parent, delete=False) as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.replace(path)


def source_checkpoint_path(item_dir: Path) -> Path:
    return item_dir / "source-checkpoint.json"


def write_source_checkpoint(
    item_dir: Path, item_id: str, kind: str, pdf_paths: list[Path]
) -> dict:
    checkpoint = {
        "version": 1,
        "id": item_id,
        "kind": kind,
        "source": source_receipt(pdf_paths),
    }
    atomic_json(source_checkpoint_path(item_dir), checkpoint)
    return checkpoint["source"]


def verify_resume_checkpoint(
    item_dir: Path, item_id: str, kind: str, pdf_paths: list[Path]
) -> dict:
    path = source_checkpoint_path(item_dir)
    if not path.exists():
        raise ValueError(
            "captured masters predate the exact source checkpoint; run a full intake"
        )
    try:
        checkpoint = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError("source checkpoint is unreadable") from error
    expected = {
        "version": 1,
        "id": item_id,
        "kind": kind,
        "source": source_receipt(pdf_paths),
    }
    if checkpoint != expected:
        raise ValueError("resume sources do not exactly match the capture checkpoint")
    return expected["source"]


def prepare_intake_workspace(
    item_id: str,
    out_dir: Path,
    force: bool,
    *,
    kind: Optional[str] = None,
    pdf_paths: Optional[list[Path]] = None,
) -> None:
    """Start a forced intake with no masters or sidecar from an older source."""
    if force:
        expected = (MASTERS_DIR / item_id).resolve()
        if out_dir.resolve() != expected:
            raise ValueError(f"refusing to clear unexpected intake path: {out_dir}")
        if out_dir.exists():
            shutil.rmtree(out_dir)
        (TEXT_DIR / f"{item_id}.txt").unlink(missing_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    if not force and any(out_dir.iterdir()):
        if kind is None or pdf_paths is None:
            raise ValueError(
                "non-empty intake workspace requires an exact source checkpoint"
            )
        verify_resume_checkpoint(out_dir, item_id, kind, pdf_paths)


def gate_findings_sha256(findings: list[str]) -> str:
    encoded = json.dumps(
        findings, ensure_ascii=False, separators=(",", ":")
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def set_gate_result(manifest: dict, findings: list[str]) -> None:
    digest = gate_findings_sha256(findings)
    manifest["gateStatus"] = "complete" if not findings else "findings"
    manifest["gateFindings"] = findings
    manifest["gateFindingCount"] = len(findings)
    manifest["gateFindingsSha256"] = digest
    review = manifest.get("gateReview") or {}
    binding = capture_review_binding(
        manifest.get("id", ""),
        manifest.get("kind", "reference"),
        manifest.get("source") or {},
        manifest.get("pageCount"),
        expected_page_count(manifest),
    )
    if (
        review.get("findingsSha256") != digest
        or binding is None
        or review.get("captureBinding") != binding
    ):
        manifest.pop("gateReview", None)


def add_extraction_findings(manifest: dict, findings: list[str]) -> list[str]:
    combined = list(findings)
    vision_failed = (manifest.get("textExtraction") or {}).get("visionFailed") or {}
    if vision_failed:
        pages = sorted(int(number) for number in vision_failed)
        combined.append(
            f"{len(pages)} page(s) could not be read by the model ({pages}), "
            "so they keep their OCR text."
        )
    empty_pages = (manifest.get("text") or {}).get("emptyPages") or []
    if empty_pages:
        combined.append(
            f"{len(empty_pages)} page(s) produced no text: "
            f"{empty_pages[:12]}. Spans cannot be verified against them."
        )
    return combined


def pdf_page_count(path: Path) -> int:
    doc = fitz.open(path)
    try:
        return doc.page_count
    finally:
        doc.close()


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


def _page_image_covers_pdf_page(page) -> bool:
    """Whether one embedded image is the page rather than an illustration."""
    images = page.get_images(full=True)
    if len(images) != 1:
        return False
    try:
        page_area = page.rect.width * page.rect.height
        placed = page.get_image_rects(images[0][0])
        covered = max((rect.width * rect.height) for rect in placed) if placed else 0
        return page_area > 0 and (covered / page_area) >= EMBEDDED_PAGE_COVERAGE
    except Exception:
        return False


def extract_pages(pdf_paths, out_dir: Path, jobs: int = 1) -> list:
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
        for page in _extract_one(
            pdf_path,
            out_dir,
            len(pdf_paths) > 1 and part_index or 0,
            start_number=number,
            jobs=jobs,
        ):
            pages.append(page)
            number = page["page"]
    return pages


def _extract_one(
    pdf_path: Path,
    out_dir: Path,
    part: int,
    start_number: int,
    jobs: int = 1,
) -> list:
    doc = fitz.open(pdf_path)
    pages = []
    for index, page in enumerate(doc):
        number = start_number + index + 1
        record = {"page": number}

        # The CamScanner shape: exactly one photograph that COVERS the page.
        # Copy the original bytes rather than re-encoding a photo that is
        # already the only surviving copy of a physical page. Anything that
        # merely sits on the page is an illustration, and the page around it
        # is what we actually want.
        images = page.get_images(full=True)
        covers_page = _page_image_covers_pdf_page(page)
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
                record.update({"embeddedCaptureError": f"extract failed: {exc}"})
                images = []  # fall through to render
        if "master" not in record:
            dest = out_dir / f"p{number:04d}.png"
            pix = page.get_pixmap(dpi=RENDER_DPI)
            pix.save(dest)
            record.update({
                "master": dest.name,
                "source": (
                    "rendered-fallback"
                    if "embeddedCaptureError" in record
                    else "rendered"
                ),
                "reencoded": True, "dpi": RENDER_DPI,
            })

        master_path = out_dir / record["master"]
        metrics = page_metrics(master_path)
        if covers_page and "error" in metrics:
            capture_path = master_path.with_name(
                f"p{number:04d}.embedded-capture{master_path.suffix.lower()}"
            )
            os.replace(master_path, capture_path)
            rendered_path = out_dir / f"p{number:04d}.rendered.png"
            pix = page.get_pixmap(dpi=RENDER_DPI)
            pix.save(rendered_path)
            record.update({
                "master": rendered_path.name,
                "source": "rendered-fallback",
                "reencoded": True,
                "dpi": RENDER_DPI,
                "embeddedCaptureMaster": capture_path.name,
                "embeddedCaptureBytes": capture_path.stat().st_size,
                "embeddedCaptureSha256": sha256_file(capture_path),
                "embeddedCaptureError": metrics["error"],
            })
            master_path = rendered_path
            metrics = page_metrics(master_path)
        record["bytes"] = master_path.stat().st_size
        record["sha256"] = sha256_file(master_path)
        if part:
            record["part"] = part
            record["partPage"] = index + 1
        record.update(metrics)
        pages.append(record)
    doc.close()
    for record, rotation in zip(pages, page_orientations(out_dir, pages, jobs)):
        record["rotation"] = rotation
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


def page_orientations(item_dir: Path, pages: list, jobs: int = 1) -> list:
    """Orientation values in page order, even when checks finish out of order."""
    _check_jobs(jobs)

    def check(page):
        if "master" not in page:
            return 0
        return page_orientation(item_dir / page["master"])

    if jobs == 1:
        return [check(page) for page in pages]
    with ThreadPoolExecutor(
        max_workers=jobs, thread_name_prefix="book-intake-orientation"
    ) as executor:
        return list(executor.map(check, pages))


def _upright_name(source: Path, lossless_jpeg: bool) -> Path:
    suffix = source.suffix if lossless_jpeg else ".png"
    return source.with_name(f"{source.stem}.upright{suffix}")


def normalize_page_master(item_dir: Path, page: dict) -> bool:
    """Create an upright working master while retaining the exact capture.

    The original PDF remains the durable source of truth in Blob. Keeping the
    extracted capture beside the normalized derivative also makes this local
    transformation auditable and reversible without another download.
    """
    rotation = int(page.get("rotation") or 0) % 360
    if rotation == 0 or "master" not in page:
        return False

    source = item_dir / page["master"]
    if not source.exists():
        raise FileNotFoundError(f"missing master for page {page.get('page')}: {source}")

    source_sha = sha256_file(source)
    lossless_jpeg = source.suffix.lower() in {".jpg", ".jpeg"} and bool(shutil.which("jpegtran"))
    dest = _upright_name(source, lossless_jpeg)
    tmp = dest.with_name(f".{dest.name}.tmp")
    lossless = False

    if lossless_jpeg:
        done = subprocess.run(
            [
                "jpegtran", "-copy", "all", "-perfect", "-rotate", str(rotation),
                "-outfile", str(tmp), str(source),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if done.returncode == 0 and tmp.exists():
            lossless = True
        else:
            tmp.unlink(missing_ok=True)
            lossless_jpeg = False
            dest = _upright_name(source, False)
            tmp = dest.with_name(f".{dest.name}.tmp")

    if not lossless_jpeg:
        with Image.open(source) as im:
            im.rotate(-rotation, expand=True).save(tmp, "PNG")

    os.replace(tmp, dest)
    page["captureMaster"] = page["master"]
    page["master"] = dest.name
    page["normalization"] = {
        "operation": "rotate-clockwise",
        "degrees": rotation,
        "sourceSha256": source_sha,
        "lossless": lossless or dest.suffix.lower() == ".png",
    }
    page["normalizedRotation"] = rotation
    page["rotation"] = 0
    page["bytes"] = dest.stat().st_size
    page["sha256"] = sha256_file(dest)
    page.update(page_metrics(dest))
    return True


def normalize_page_masters(item_dir: Path, pages: list) -> int:
    """Normalize every confidently detected sideways page in page order."""
    return sum(1 for page in pages if normalize_page_master(item_dir, page))


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


def ocr_pages(
    item_dir: Path,
    pages: list,
    jobs: int = 1,
    report_progress: bool = True,
) -> list:
    """OCR text in page order, with bounded parallel page workers."""
    _check_jobs(jobs)

    def read(page):
        if "master" not in page:
            return ""
        return ocr_page(
            item_dir / page["master"],
            page.get("rotation", 0),
        )

    def collect(results):
        texts = []
        for page, text in zip(pages, results):
            texts.append(text)
            if report_progress and page["page"] % 10 == 0:
                print(f"    ... page {page['page']}")
        return texts

    if jobs == 1:
        return collect(map(read, pages))
    with ThreadPoolExecutor(
        max_workers=jobs, thread_name_prefix="book-intake-ocr"
    ) as executor:
        return collect(executor.map(read, pages))


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def near_duplicate_text_ratio(a_text: str, b_text: str) -> float:
    """Return the expensive similarity ratio only when cheap upper bounds pass."""
    if not a_text or not b_text:
        return 0.0
    length_upper_bound = (2 * min(len(a_text), len(b_text))) / (len(a_text) + len(b_text))
    if length_upper_bound < NEAR_DUPLICATE_TEXT_RATIO:
        return 0.0
    matcher = SequenceMatcher(None, a_text, b_text)
    if matcher.quick_ratio() < NEAR_DUPLICATE_TEXT_RATIO:
        return 0.0
    return matcher.ratio()


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
    model. Every attempted page receives either a read result or an explicit
    failure so the caller cannot confuse a broken reader with no work."""
    if not wanted:
        return {"read": {}, "failed": {}}

    def failed_all(reason: str) -> dict:
        return {"read": {}, "failed": {n: reason for n in wanted}}

    token = oidc_token()
    if not token:
        print("  WARNING: no VERCEL_OIDC_TOKEN, so the vision pass is skipped. "
              "Run `pnpm dev:token` and re-run with --force to read covers properly.")
        return failed_all("no Vercel OIDC token")
    by_number = {p["page"]: p for p in pages}
    env = {**os.environ, "VERCEL_OIDC_TOKEN": token}
    out, failed = {}, {}
    batches = [
        wanted[start:start + VISION_BATCH_PAGES]
        for start in range(0, len(wanted), VISION_BATCH_PAGES)
    ]
    for batch_index, batch in enumerate(batches, 1):
        if len(batches) > 1:
            print(
                f"    ... vision batch {batch_index}/{len(batches)} "
                f"({len(batch)} page(s))"
            )
        payload = {
            "model": VISION_MODEL,
            "pages": [
                {"page": n, "path": str((item_dir / by_number[n]["master"]).resolve())}
                for n in batch if "master" in by_number.get(n, {})
            ],
        }
        try:
            done = subprocess.run(
                ["corepack", "pnpm", "--filter", "web", "exec", "tsx", PAGE_READ_SCRIPT],
                input=json.dumps(payload), capture_output=True, text=True,
                cwd=COSMO.parent, env=env,
                timeout=120 + 60 * len(batch), check=False,
            )
        except (subprocess.TimeoutExpired, OSError) as exc:
            print(
                f"  WARNING: vision batch {batch_index} failed "
                f"({type(exc).__name__}); keeping OCR text."
            )
            failed.update({page: f"vision subprocess {type(exc).__name__}" for page in batch})
            continue
        line = next(
            (value for value in reversed(done.stdout.splitlines()) if value.startswith("{")),
            "",
        )
        if not line:
            stderr_lines = [
                value.strip()
                for value in (done.stderr or "").splitlines()
                if value.strip()
            ]
            detail = " | ".join(stderr_lines[-3:])[:300]
            print(
                f"  WARNING: vision batch {batch_index} produced no result; "
                f"keeping OCR text. {detail}"
            )
            reason = f"vision subprocess produced no result{': ' + detail if detail else ''}"
            failed.update({page: reason for page in batch})
            continue
        try:
            parsed = json.loads(line)
        except json.JSONDecodeError:
            print(
                f"  WARNING: vision batch {batch_index} returned unparseable output; "
                "keeping OCR text."
            )
            failed.update({page: "vision subprocess returned unparseable output" for page in batch})
            continue
        for row in parsed.get("pages", []):
            if "error" in row:
                print(
                    f"  WARNING: page {row.get('page')} vision read failed "
                    f"({row['error'][:110]}); keeping OCR text."
                )
                failed[row["page"]] = row["error"]
                continue
            out[row["page"]] = row
        for page_number in batch:
            if page_number not in out and page_number not in failed:
                failed[page_number] = "page missing from vision response"
    return {"read": out, "failed": failed}


def run_gates(pages: list, expect_pages, texts: dict = None) -> list:
    """Deterministic findings. Every one names the page so a re-shoot is one
    page of work, and every one says what the operator should do about it."""
    findings = []
    if not _positive_page_count(expect_pages):
        findings.append(
            "independent expected page count is missing. Count the source pages "
            "outside this extraction and rerun with --expect-pages."
        )
    elif expect_pages != len(pages):
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

    exact, near, rotated, near_candidates = {}, [], [], []
    usable = {}
    if texts:
        for n, value in texts.items():
            normalized = _normalize_text(value)
            if len(normalized) >= NEAR_DUPLICATE_MIN_CHARS:
                usable[n] = normalized
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

        text = usable.get(n, "")
        if len(text) >= NEAR_DUPLICATE_MIN_CHARS and "aHash" in p:
            value = int(p["aHash"], 16)
            for other_n, other_text, other_hash in near:
                distance = bin(value ^ other_hash).count("1")
                if distance > NEAR_DUPLICATE_HAMMING:
                    continue
                ratio = near_duplicate_text_ratio(text, other_text)
                if ratio >= NEAR_DUPLICATE_TEXT_RATIO:
                    near_candidates.append((n, other_n, ratio, distance))
            near.append((n, text, value))

    # Only an image-and-text candidate can become a duplicate finding. Check
    # that small set for a third near-identical text sibling. Three or more
    # pages are a repeated workbook template or catalogue family, not one page
    # photographed twice. This preserves the original guard without doing a
    # full text comparison for every pair in a large curriculum.
    similarity_cache = {}

    def similarity(a_n: int, b_n: int) -> float:
        key = tuple(sorted((a_n, b_n)))
        if key not in similarity_cache:
            similarity_cache[key] = near_duplicate_text_ratio(
                usable.get(a_n, ""), usable.get(b_n, "")
            )
        return similarity_cache[key]

    for n, other_n, ratio, distance in near_candidates:
        kin = 0
        for candidate_n in usable:
            if candidate_n == n:
                continue
            if similarity(n, candidate_n) >= NEAR_DUPLICATE_TEXT_RATIO:
                kin += 1
                if kin > BOILERPLATE_FAMILY_MIN:
                    break
        if kin > BOILERPLATE_FAMILY_MIN:
            continue
        findings.append(
            f"page {n}: reads as the same page as page {other_n} shot again "
            f"({int(ratio * 100)}% identical text, images {distance} bits apart). "
            "Keep the sharper one and drop the other."
        )

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
    asserted_page_count = expected_page_count(manifest)
    source_identity = portable_source_receipt(item_id, kind, manifest["source"])
    review_binding = capture_review_binding(
        item_id,
        kind,
        manifest["source"],
        manifest["pageCount"],
        asserted_page_count,
    )
    capture = {
        "lane": "phone",
        "sourceFile": pdf_path.name,
        "sourceParts": [p["file"] for p in manifest["source"].get("parts", [])],
        "sourceSha256": manifest["source"]["sha256"],
        "pageCount": manifest["pageCount"],
        "expectedPageCount": asserted_page_count,
        "sourceReceipt": source_identity,
        "reviewBinding": review_binding,
        "mastersDir": manifest["mastersDir"],
        "intakeAt": manifest["intakeAt"],
        "gateStatus": manifest.get("gateStatus"),
        "gateFindings": manifest["gateFindings"],
        "gateFindingCount": manifest.get(
            "gateFindingCount", len(manifest.get("gateFindings") or [])
        ),
        "gateFindingsSha256": manifest.get("gateFindingsSha256")
        or gate_findings_sha256(manifest.get("gateFindings") or []),
        "normalizedMasterPages": sum(
            1 for page in manifest.get("pages", []) if page.get("normalizedRotation")
        ),
    }
    if target.exists():
        # A re-run refreshes the capture block and touches nothing else. The
        # analyst's work is theirs; stale gate findings beside a fresh
        # manifest are a lie about what the capture looks like now.
        try:
            existing = json.loads(target.read_text())
        except (json.JSONDecodeError, OSError):
            return target
        existing_capture = existing.get("capture") or {}
        review = existing_capture.get("gateReview") or {}
        if (
            review.get("findingsSha256") != capture["gateFindingsSha256"]
            or review_binding is None
            or review.get("captureBinding") != review_binding
        ):
            existing_capture.pop("gateReview", None)
        existing["capture"] = {**existing_capture, **capture}
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


def _captured_master_files(item_dir: Path, expected_pages: int) -> list[Path]:
    """Return the untouched capture masters in strict page order.

    Upright derivatives deliberately have a second dot in their name, so a
    one-extension match separates them from the exact extracted captures.
    """
    by_page = {}
    for path in item_dir.iterdir():
        match = re.fullmatch(r"p(\d{4})\.[^.]+", path.name)
        if not match or not path.is_file():
            continue
        page = int(match.group(1))
        if page in by_page:
            raise ValueError(f"page {page}: multiple capture masters")
        by_page[page] = path
    expected = set(range(1, expected_pages + 1))
    actual = set(by_page)
    if actual != expected:
        missing = sorted(expected - actual)[:12]
        extra = sorted(actual - expected)[:12]
        raise ValueError(
            f"capture master sequence differs from sources: missing={missing}, extra={extra}"
        )
    return [by_page[page] for page in range(1, expected_pages + 1)]


def _upright_derivative(capture: Path) -> Optional[Path]:
    matches = sorted(capture.parent.glob(f"{capture.stem}.upright.*"))
    if len(matches) > 1:
        raise ValueError(f"{capture.name}: multiple upright derivatives")
    return matches[0] if matches else None


def _rotation_matching_derivative(capture: Path, upright: Path) -> tuple[int, float]:
    """Recover the exact clockwise rotation used for an existing derivative."""
    with Image.open(capture) as source_image, Image.open(upright) as upright_image:
        source = source_image.convert("L")
        target = np.asarray(upright_image.convert("L").resize((96, 96)), dtype=np.float32)
        candidates = []
        for degrees in (90, 180, 270):
            rotated = source.rotate(-degrees, expand=True).resize((96, 96))
            error = float(np.mean(np.abs(np.asarray(rotated, dtype=np.float32) - target)))
            candidates.append((error, degrees))
    candidates.sort()
    best_error, best_degrees = candidates[0]
    next_error = candidates[1][0]
    if next_error - best_error < 0.5:
        raise ValueError(
            f"{capture.name}: upright rotation is ambiguous "
            f"(best={best_error:.2f}, next={next_error:.2f})"
        )
    return best_degrees, round(best_error, 3)


def reconstruct_captured_pages(pdf_paths: list[Path], item_dir: Path, jobs: int = 1) -> list:
    """Rebuild page provenance without rendering, orienting, or OCRing again."""
    _check_jobs(jobs)
    source_rows = []
    for part_index, pdf_path in enumerate(pdf_paths, 1):
        doc = fitz.open(pdf_path)
        try:
            for part_page, pdf_page in enumerate(doc, 1):
                source_rows.append({
                    "part": part_index,
                    "partPage": part_page,
                    "embedded": _page_image_covers_pdf_page(pdf_page),
                })
        finally:
            doc.close()

    captures = _captured_master_files(item_dir, len(source_rows))

    def reconstruct(args):
        number, capture, source = args
        upright = _upright_derivative(capture)
        master = upright or capture
        record = {
            "page": number,
            "master": master.name,
            "source": "embedded-image" if source["embedded"] else "rendered",
            "reencoded": not source["embedded"],
            "dpi": None if source["embedded"] else RENDER_DPI,
            "bytes": master.stat().st_size,
            "sha256": sha256_file(master),
            "rotation": 0,
        }
        if len(pdf_paths) > 1:
            record["part"] = source["part"]
            record["partPage"] = source["partPage"]
        if upright:
            degrees, match_error = _rotation_matching_derivative(capture, upright)
            record.update({
                "captureMaster": capture.name,
                "normalization": {
                    "operation": "rotate-clockwise",
                    "degrees": degrees,
                    "sourceSha256": sha256_file(capture),
                    "lossless": upright.suffix.lower() == ".png"
                    or capture.suffix.lower() in {".jpg", ".jpeg"},
                    "recoveredMatchMeanAbsError": match_error,
                },
                "normalizedRotation": degrees,
            })
        record.update(page_metrics(master))
        return record

    work = [(index, capture, source_rows[index - 1])
            for index, capture in enumerate(captures, 1)]
    if jobs == 1:
        return [reconstruct(row) for row in work]
    with ThreadPoolExecutor(
        max_workers=jobs, thread_name_prefix="book-intake-resume"
    ) as executor:
        return list(executor.map(reconstruct, work))


def resume_captured(
    pdf_paths: list[Path],
    item_id: str,
    kind: str,
    expect_pages: Optional[int],
    force: bool,
    jobs: int,
) -> int:
    """Finish an intake whose masters and sidecar survived an interrupted gate."""
    if not _positive_page_count(expect_pages):
        print(
            "ERROR: --expect-pages must be a positive independent page count",
            file=sys.stderr,
        )
        return 2
    item_dir = MASTERS_DIR / item_id
    manifest_path = item_dir / "manifest.json"
    pending_manifest = None
    if manifest_path.exists() and not force:
        try:
            pending_manifest = json.loads(manifest_path.read_text())
            existing_status = pending_manifest.get("gateStatus")
        except (OSError, json.JSONDecodeError):
            existing_status = None
        if existing_status != "pending":
            print(f"Already has a manifest: {manifest_path}\nRe-run with --force to replace it.")
            return 2
    if not item_dir.is_dir():
        print(f"No captured masters for {item_id}. Run a full intake first.")
        return 2

    try:
        source = verify_resume_checkpoint(item_dir, item_id, kind, pdf_paths)
    except ValueError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2

    source_count = sum(pdf_page_count(path) for path in pdf_paths)
    if source_count != expect_pages:
        print(
            f"ERROR: source page count is {source_count}, expected {expect_pages}",
            file=sys.stderr,
        )
        return 2
    by_page = sidecar_pages(item_id)
    expected_numbers = set(range(1, source_count + 1))
    if set(by_page) != expected_numbers:
        missing = sorted(expected_numbers - set(by_page))[:12]
        extra = sorted(set(by_page) - expected_numbers)[:12]
        print(
            f"ERROR: sidecar page sequence differs from sources: missing={missing}, extra={extra}",
            file=sys.stderr,
        )
        return 2

    if pending_manifest is not None:
        identity_matches = (
            pending_manifest.get("id") == item_id
            and pending_manifest.get("kind") == kind
            and pending_manifest.get("pageCount") == source_count
            and pending_manifest.get("expectedPageCount") == expect_pages
            and pending_manifest.get("source") == source
        )
        if not identity_matches:
            print(
                "ERROR: pending manifest identity differs from the exact source checkpoint",
                file=sys.stderr,
            )
            return 2
        print(f"{item_id}: completing the pending manifest without reconstructing it")
        return recheck(item_id)

    print(f"{item_id}: reconstructing {source_count} captured page records with {jobs} jobs")
    pages = reconstruct_captured_pages(pdf_paths, item_dir, jobs=jobs)
    layer = text_layer(pdf_paths)
    have_layer = sum(1 for text in layer if text.strip())
    method = "pdf-text-layer" if have_layer >= max(1, source_count // 2) else "tesseract"
    texts = [by_page[page] for page in range(1, source_count + 1)]
    text_info = {
        "path": str((TEXT_DIR / f"{item_id}.txt").relative_to(COSMO.parent)),
        "chars": sum(len(text) for text in texts),
        "emptyPages": [page for page, text in by_page.items() if not text.strip()],
    }
    first_mtime = min(path.stat().st_mtime for path in _captured_master_files(item_dir, source_count))
    manifest = {
        "id": item_id,
        "kind": kind,
        "intakeAt": datetime.fromtimestamp(first_mtime, timezone.utc).isoformat(timespec="seconds"),
        "recoveredAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "recoveredFromExistingCapture": True,
        "source": source,
        "pageCount": source_count,
        "expectedPageCount": expect_pages,
        "mastersDir": str(item_dir.relative_to(COSMO.parent)),
        "textExtraction": {
            "method": method,
            "visionModel": None,
            "visionAttempted": [],
            "visionPages": [],
            "visionFailed": {},
            "recoveredBeforeVisionProvenance": True,
            **text_info,
        },
        "text": text_info,
        "gateStatus": "pending",
        "gateFindings": ["Deterministic gates are pending after capture recovery."],
        "pages": [{**page, "textSource": method} for page in pages],
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

    findings = add_extraction_findings(
        manifest,
        run_gates(
            manifest["pages"],
            expected_page_count(manifest),
            texts={page: by_page[page] for page in range(1, source_count + 1)},
        ),
    )
    set_gate_result(manifest, findings)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    stub = stub_json(item_id, kind, manifest, pdf_paths[0])

    print(f"  manifest  {manifest_path}")
    print(f"  stub      {stub}")
    print(f"  {len(findings)} gate finding(s)")
    for finding in findings:
        print(f"    - {finding}")
    return 1 if findings else 0


def intake(
    pdf_paths,
    item_id: str,
    kind: str,
    expect_pages,
    force: bool,
    use_vision: bool = True,
    jobs: int = 1,
) -> int:
    if not _positive_page_count(expect_pages):
        print(
            "ERROR: --expect-pages must be a positive independent page count",
            file=sys.stderr,
        )
        return 2
    out_dir = MASTERS_DIR / item_id
    manifest_path = out_dir / "manifest.json"
    if manifest_path.exists() and not force:
        print(f"Already ingested: {manifest_path}\nRe-run with --force to redo it.")
        return 0
    try:
        prepare_intake_workspace(
            item_id,
            out_dir,
            force,
            kind=kind,
            pdf_paths=pdf_paths,
        )
    except ValueError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2

    # Pin source identity before rendering or OCR. A resumed run may reuse
    # expensive masters only when every ordered source part has the same
    # name, byte count, and SHA256 as this checkpoint.
    source = write_source_checkpoint(out_dir, item_id, kind, pdf_paths)

    names = ", ".join(p.name for p in pdf_paths)
    print(f"Reading {names} ..." if len(pdf_paths) == 1
          else f"Reading {len(pdf_paths)} parts as one book: {names} ...")
    if jobs > 1:
        print(f"  using {jobs} jobs for page orientation and OCR")
    pages = extract_pages(pdf_paths, out_dir, jobs=jobs)
    normalized = normalize_page_masters(out_dir, pages)
    print(f"  {len(pages)} page(s) written to {out_dir}")
    if normalized:
        print(f"  {normalized} sideways page master(s) normalized; captures retained")

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
            suffix = f" with {jobs} jobs" if jobs > 1 else ""
            print(
                f"  no usable text layer, running OCR on {len(pages)} page(s){suffix} ..."
            )
            texts = ocr_pages(out_dir, pages, jobs=jobs)

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
    manifest = {
        "id": item_id,
        "kind": kind,
        "intakeAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": source,
        "pageCount": len(pages),
        "expectedPageCount": expect_pages,
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
        # Persist the expensive work before the gates run. If a process is
        # interrupted here, --check can finish the same capture instead of
        # rendering and OCRing the entire book again.
        "gateStatus": "pending",
        "gateFindings": ["Deterministic gates are pending."],
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

    findings = add_extraction_findings(
        manifest,
        run_gates(
            pages,
            expected_page_count(manifest),
            texts={p["page"]: t for p, t in zip(pages, texts)},
        ),
    )
    set_gate_result(manifest, findings)
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

    te = manifest.setdefault("textExtraction", {})
    prior_vision_text = {
        p["page"]
        for p in pages
        if str(p.get("textSource", "")).startswith("vision:")
    }
    for i, p in enumerate(pages):
        row = vision.get(p["page"])
        if row and (row.get("text") or "").strip():
            texts[i] = row["text"]
            p["textSource"] = f"vision:{row.get('model', VISION_MODEL)}"
            p["visual"] = {k: row[k] for k in ("description", "kind", "confidence") if k in row}

    text_info = write_sidecar(item_id, pages, texts)
    te["visionAttempted"] = sorted(set(te.get("visionAttempted") or []) | set(wanted))
    te["visionPages"] = sorted({p["page"] for p in pages if "visual" in p})
    te["visionFailed"] = {
        str(k): v[:200]
        for k, v in sorted(failed.items())
        if k not in prior_vision_text
    }
    retry_failed = dict(te.get("visionRetryFailed") or {})
    for page_number in wanted:
        retry_failed.pop(str(page_number), None)
    retry_failed.update({str(k): v[:200] for k, v in sorted(failed.items())})
    te["visionRetryFailed"] = retry_failed
    te.update(text_info)
    manifest["text"] = text_info
    findings = add_extraction_findings(
        manifest,
        run_gates(
            pages,
            expected_page_count(manifest),
            texts={p["page"]: t for p, t in zip(pages, texts)},
        ),
    )
    set_gate_result(manifest, findings)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    stub_json(item_id, manifest.get("kind", "reference"), manifest,
              Path(manifest["source"]["file"]))
    print(f"  {len(vision)} re-read, {len(failed)} still failing")
    for f in findings:
        print(f"    - {f}")
    return 1 if findings else 0


def recheck(item_id: str) -> int:
    manifest_path = MASTERS_DIR / item_id / "manifest.json"
    if not manifest_path.exists():
        print(f"No manifest for {item_id}. Run intake first.")
        return 2
    manifest = json.loads(manifest_path.read_text())
    findings = add_extraction_findings(
        manifest,
        run_gates(
            manifest["pages"],
            expected_page_count(manifest),
            texts=sidecar_pages(item_id),
        ),
    )
    set_gate_result(manifest, findings)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    stub_json(
        item_id,
        manifest.get("kind", "curriculum" if item_id.startswith("cur-") else "reference"),
        manifest,
        Path(manifest["source"]["file"]),
    )
    print(f"{item_id}: {manifest['pageCount']} page(s), {len(findings)} finding(s)")
    for f in findings:
        print(f"  - {f}")
    return 1 if findings else 0


def repair_unreadable_masters(item_id: str) -> int:
    """Render unreadable extracted masters from their exact source PDF pages.

    Some scanner PDFs contain a full-page JPEG whose stream is truncated even
    though the PDF renderer can still composite the page. Preserve that broken
    embedded capture, render only the affected page, refresh its OCR, and rerun
    the deterministic gates. No source Blob or analysis judgment is changed.
    """
    manifest_path = MASTERS_DIR / item_id / "manifest.json"
    item_path = (
        CURS_DIR if item_id.startswith("cur-") else REFS_DIR
    ) / f"{item_id}.json"
    if not manifest_path.exists() or not item_path.exists():
        print(f"No manifest and corpus record pair for {item_id}.")
        return 2
    manifest = json.loads(manifest_path.read_text())
    item = json.loads(item_path.read_text())
    broken = [page for page in manifest.get("pages", []) if page.get("error")]
    if not broken:
        print(f"{item_id}: no unreadable masters need repair.")
        return 0

    sources_by_sha = {}
    for source_file in item.get("sourceFiles") or []:
        local_value = source_file.get("localPath")
        digest = source_file.get("sha256")
        if not local_value or not digest:
            continue
        local_path = Path(local_value)
        if not local_path.is_absolute():
            local_path = COSMO.parent / local_path
        if local_path.exists():
            sources_by_sha.setdefault(digest, []).append(local_path)

    source_paths = []
    for part in manifest.get("source", {}).get("parts", []):
        candidates = sources_by_sha.get(part.get("sha256"), [])
        named = [path for path in candidates if path.name == part.get("file")]
        candidates = named or candidates
        if not candidates:
            print(f"Missing exact local source for {part.get('file')}.")
            return 2
        source_path = candidates[0]
        if sha256_file(source_path) != part.get("sha256"):
            print(f"Source hash changed for {source_path}.")
            return 2
        source_paths.append(source_path)

    item_dir = manifest_path.parent
    sidecar = sidecar_pages(item_id)
    repaired = []
    documents = {}
    repaired_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    try:
        for page in broken:
            part_number = int(page.get("part") or 1)
            part_page = int(page.get("partPage") or page["page"])
            if not 1 <= part_number <= len(source_paths):
                raise ValueError(f"page {page['page']} has invalid source part {part_number}")
            document = documents.get(part_number)
            if document is None:
                document = fitz.open(source_paths[part_number - 1])
                documents[part_number] = document
            if not 1 <= part_page <= document.page_count:
                raise ValueError(f"page {page['page']} has invalid part page {part_page}")

            old_master = item_dir / page["master"]
            if not old_master.exists():
                raise FileNotFoundError(f"missing failed master {old_master}")
            old_error = page["error"]
            rendered = item_dir / f"p{page['page']:04d}.rendered.png"
            temporary = item_dir / f".p{page['page']:04d}.rendered.tmp.png"
            pix = document[part_page - 1].get_pixmap(dpi=RENDER_DPI)
            pix.save(temporary)
            os.replace(temporary, rendered)
            metrics = page_metrics(rendered)
            if "error" in metrics:
                raise ValueError(
                    f"rendered fallback for page {page['page']} is still unreadable: "
                    f"{metrics['error']}"
                )

            page.update({
                "master": rendered.name,
                "source": "rendered-fallback",
                "reencoded": True,
                "dpi": RENDER_DPI,
                "embeddedCaptureMaster": old_master.name,
                "embeddedCaptureBytes": old_master.stat().st_size,
                "embeddedCaptureSha256": sha256_file(old_master),
                "embeddedCaptureError": old_error,
                "bytes": rendered.stat().st_size,
                "sha256": sha256_file(rendered),
                "repair": {
                    "at": repaired_at,
                    "operation": "render-exact-source-pdf-page",
                    "sourcePart": part_number,
                    "sourcePartPage": part_page,
                    "sourceSha256": manifest["source"]["parts"][part_number - 1]["sha256"],
                },
                **metrics,
            })
            page.pop("error", None)
            rotation = page_orientation(rendered)
            page["rotation"] = rotation
            if rotation:
                normalize_page_master(item_dir, page)
            sidecar[page["page"]] = ocr_page(
                item_dir / page["master"], page.get("rotation", 0)
            )
            page["textSource"] = "tesseract after rendered fallback"
            repaired.append(page["page"])
    except (OSError, ValueError, RuntimeError) as exc:
        print(f"ERROR: unreadable-master repair stopped: {exc}")
        return 2
    finally:
        for document in documents.values():
            document.close()

    expected_pages = set(range(1, manifest["pageCount"] + 1))
    if set(sidecar) != expected_pages:
        print("ERROR: sidecar page sequence is incomplete after repair.")
        return 2
    texts = [sidecar[number] for number in range(1, manifest["pageCount"] + 1)]
    text_info = write_sidecar(item_id, manifest["pages"], texts)
    extraction = manifest.setdefault("textExtraction", {})
    extraction.update(text_info)
    manifest["text"] = text_info
    findings = add_extraction_findings(
        manifest,
        run_gates(
            manifest["pages"],
            expected_page_count(manifest),
            texts={number: sidecar[number] for number in expected_pages},
        ),
    )
    set_gate_result(manifest, findings)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    stub_json(
        item_id,
        manifest.get("kind", "curriculum" if item_id.startswith("cur-") else "reference"),
        manifest,
        source_paths[0],
    )
    print(f"{item_id}: repaired unreadable masters {repaired}")
    for finding in findings:
        print(f"  - {finding}")
    return 1 if findings else 0


def normalize_existing_masters(item_id: str) -> int:
    """Repair manifests created before upright masters became automatic."""
    manifest_path = MASTERS_DIR / item_id / "manifest.json"
    if not manifest_path.exists():
        print(f"No manifest for {item_id}. Run intake first.")
        return 2
    manifest = json.loads(manifest_path.read_text())
    pages = manifest.get("pages") or []
    changed = normalize_page_masters(manifest_path.parent, pages)
    findings = add_extraction_findings(
        manifest,
        run_gates(
            pages,
            expected_page_count(manifest),
            texts=sidecar_pages(item_id),
        ),
    )
    set_gate_result(manifest, findings)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

    folder = CURS_DIR if item_id.startswith("cur-") else REFS_DIR
    item_path = folder / f"{item_id}.json"
    if item_path.exists():
        item = json.loads(item_path.read_text())
        capture = item.setdefault("capture", {})
        capture["gateFindings"] = findings
        capture["gateStatus"] = manifest["gateStatus"]
        capture["gateFindingCount"] = manifest["gateFindingCount"]
        capture["gateFindingsSha256"] = manifest["gateFindingsSha256"]
        review = capture.get("gateReview") or {}
        if review.get("findingsSha256") != manifest["gateFindingsSha256"]:
            capture.pop("gateReview", None)
        capture["normalizedMasterPages"] = sum(
            1 for page in pages if page.get("normalizedRotation")
        )
        item_path.write_text(json.dumps(item, indent=2) + "\n")

    print(f"{item_id}: normalized {changed} page master(s), {len(findings)} finding(s)")
    for finding in findings:
        print(f"  - {finding}")
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
    parser.add_argument(
        "--expect-pages",
        type=parse_expected_pages,
        help="required independent page count asserted against the capture",
    )
    parser.add_argument("--force", action="store_true", help="redo an already-ingested item")
    parser.add_argument(
        "--resume-captured",
        action="store_true",
        help="rebuild provenance and finish gates from existing masters plus sidecar",
    )
    parser.add_argument("--check", metavar="ID", help="re-run the gates on an ingested item")
    parser.add_argument(
        "--repair-unreadable",
        metavar="ID",
        help="render unreadable extracted masters from their exact source PDF pages",
    )
    parser.add_argument("--normalize-masters", metavar="ID",
                        help="make old sideways page masters upright, retaining captures")
    parser.add_argument("--revision", metavar="ID",
                        help="redo only the model pass on an ingested item, reusing its masters and text")
    parser.add_argument("--no-vision", action="store_true",
                        help="tesseract only; skip the model pass over covers and unreadable pages")
    parser.add_argument(
        "--jobs",
        type=parse_jobs,
        default=1,
        metavar="N",
        help=f"page orientation and OCR workers, 1-{MAX_JOBS} (default: 1)",
    )
    parser.add_argument("--self-test", action="store_true", help="run the gate fixtures")
    args = parser.parse_args()

    if args.self_test:
        return self_test()
    if args.revision:
        return revision(args.revision)
    if args.repair_unreadable:
        return repair_unreadable_masters(args.repair_unreadable)
    if args.normalize_masters:
        return normalize_existing_masters(args.normalize_masters)
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
    if args.resume_captured:
        return resume_captured(
            pdf_paths,
            args.id,
            kind,
            args.expect_pages,
            args.force,
            args.jobs,
        )
    return intake(
        pdf_paths,
        args.id,
        kind,
        args.expect_pages,
        args.force,
        use_vision=not args.no_vision,
        jobs=args.jobs,
    )


if __name__ == "__main__":
    sys.exit(main())
