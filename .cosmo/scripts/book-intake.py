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

OCR:
Text layer if the PDF has one (born-digital, free and perfect). Otherwise
tesseract, whose output is honest-but-rough and marked as such in the
manifest. The corpus plan's model-grade OCR replaces this stage later
without changing anything downstream, because the sidecar path and format
are the contract.

USAGE:
    book-intake.py <pdf> --id ref-2026-07-28-some-book
    book-intake.py <pdf> --id cur-2026-07-28-some-curriculum --kind curriculum
    book-intake.py <pdf> --id <id> --expect-pages 84   # assert the count
    book-intake.py <pdf> --id <id> --force             # redo a finished item
    book-intake.py --check <id>                        # re-run gates only
"""

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path

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

# Sharpness is judged RELATIVE to the book's own pages, never against a fixed
# number. Edge energy scales with resolution, content density, and camera, so
# an absolute threshold either cries wolf on a sparse page or sleeps through a
# blurry one: measured on the fixture book, sharp pages ran 858 to 1114 and
# the deliberately blurred page ran 261, so no single constant separates
# "blurry" from "a page with less text on it". The median of this item is the
# only honest yardstick.
BLUR_RELATIVE_FLOOR = 0.45
BLUR_ABSOLUTE_FLOOR = 25.0

# Two pages are "the same page shot twice" when their text agrees this
# closely. Byte equality only catches a PDF that duplicated a page; a parent
# who photographs one page twice produces two different files, which is the
# likelier phone-lane mistake.
#
# Text, not image similarity. An average-hash comparison was tried first and
# flagged pages 2, 3, and 4 of the fixture workbook as duplicates of page 1:
# at 8x8 every page of a workbook is the same white rectangle with a title
# bar and a text block, so the whole book reads as duplicates. A gate that
# cries wolf teaches the operator to ignore it, which is worse than no gate.
# The aHash is still recorded per page for the corpus plan's later dedup
# work; it is simply not what this gate fires on.
NEAR_DUPLICATE_TEXT_RATIO = 0.95
NEAR_DUPLICATE_MIN_CHARS = 40

RENDER_DPI = 300


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

            # Edge energy: mean squared gradient. Sharp type produces hard
            # transitions; blur smears them and the number collapses.
            gx = np.diff(arr, axis=1)
            gy = np.diff(arr, axis=0)
            edge = float((gx ** 2).mean() + (gy ** 2).mean()) / 2.0

            # Average hash: 8x8 mean-threshold bits, for near-duplicate pages.
            tiny = np.asarray(gray.resize((8, 8)), dtype=np.float32)
            bits = (tiny > tiny.mean()).flatten()
            ahash = int("".join("1" if b else "0" for b in bits), 2)

            return {
                "width": width, "height": height,
                "inkCoverage": round(ink, 5),
                "edgeEnergy": round(edge, 2),
                "aHash": f"{ahash:016x}",
            }
    except Exception as exc:  # a bad page must not kill the book
        return {"error": f"{type(exc).__name__}: {exc}"}


def extract_pages(pdf_path: Path, out_dir: Path) -> list:
    """One master per page. Embedded photographs are copied out untouched;
    anything else is rendered at RENDER_DPI. Returns page records."""
    doc = fitz.open(pdf_path)
    pages = []
    for index, page in enumerate(doc):
        number = index + 1
        images = page.get_images(full=True)
        record = {"page": number}

        # The CamScanner shape: exactly one full-page photograph. Copy the
        # original bytes rather than re-encoding a photo that is already the
        # only surviving copy of a physical page.
        if len(images) == 1:
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
        record.update(page_metrics(master_path))
        pages.append(record)
    doc.close()
    return pages


def text_layer(pdf_path: Path) -> list:
    """Per-page text already in the PDF. Empty strings mean it needs OCR."""
    doc = fitz.open(pdf_path)
    out = [page.get_text().strip() for page in doc]
    doc.close()
    return out


def ocr_page(image_path: Path) -> str:
    if not shutil.which("tesseract"):
        return ""
    try:
        done = subprocess.run(
            ["tesseract", str(image_path), "stdout", "-l", "eng"],
            capture_output=True, text=True, timeout=180, check=False,
        )
        return done.stdout.strip() if done.returncode == 0 else ""
    except (subprocess.TimeoutExpired, OSError):
        return ""


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


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
    inked = [p["edgeEnergy"] for p in readable
             if p.get("inkCoverage", 0) >= BLANK_INK_COVERAGE and "edgeEnergy" in p]
    median = float(np.median(inked)) if inked else 0.0

    exact, near = {}, []
    for p in pages:
        n = p["page"]
        if "error" in p:
            findings.append(f"page {n}: unreadable ({p['error']})")
            continue

        if p.get("inkCoverage", 1) < BLANK_INK_COVERAGE:
            findings.append(f"page {n}: looks blank (ink {p['inkCoverage']}). Skip it or re-shoot it.")
        elif median > 0:
            energy = p.get("edgeEnergy", median)
            if energy < median * BLUR_RELATIVE_FLOOR or energy < BLUR_ABSOLUTE_FLOOR:
                findings.append(
                    f"page {n}: softer than the rest of the book "
                    f"(edge energy {energy} against a median of {round(median, 2)}). Re-shoot this page."
                )

        first = exact.setdefault(p["sha256"], n)
        if first != n:
            findings.append(f"page {n}: byte-identical to page {first}. The same page was captured twice.")
            continue

        text = _normalize_text(texts.get(n, "")) if texts else ""
        if len(text) >= NEAR_DUPLICATE_MIN_CHARS:
            for other_n, other_text in near:
                ratio = SequenceMatcher(None, text, other_text).ratio()
                if ratio >= NEAR_DUPLICATE_TEXT_RATIO:
                    findings.append(
                        f"page {n}: reads as the same page as page {other_n} shot again "
                        f"({int(ratio * 100)}% identical text). Keep the sharper one and drop the other."
                    )
                    break
            near.append((n, text))
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
    if target.exists():
        return target
    stub = {
        "id": item_id,
        "droppedBy": None,
        "droppedAt": None,
        "sourceChannel": "homa-inspo",
        "sourceMessageTs": None,
        "capture": {
            "lane": "phone",
            "sourceFile": pdf_path.name,
            "sourceSha256": manifest["source"]["sha256"],
            "pageCount": manifest["pageCount"],
            "mastersDir": manifest["mastersDir"],
            "intakeAt": manifest["intakeAt"],
            "gateFindings": manifest["gateFindings"],
        },
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


def intake(pdf_path: Path, item_id: str, kind: str, expect_pages, force: bool) -> int:
    out_dir = MASTERS_DIR / item_id
    manifest_path = out_dir / "manifest.json"
    if manifest_path.exists() and not force:
        print(f"Already ingested: {manifest_path}\nRe-run with --force to redo it.")
        return 0
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Reading {pdf_path.name} ...")
    pages = extract_pages(pdf_path, out_dir)
    print(f"  {len(pages)} page(s) written to {out_dir}")

    layer = text_layer(pdf_path)
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
                texts.append(ocr_page(out_dir / p["master"]) if "master" in p else "")
                if p["page"] % 10 == 0:
                    print(f"    ... page {p['page']}")

    text_info = write_sidecar(item_id, pages, texts)
    findings = run_gates(pages, expect_pages,
                         texts={p["page"]: t for p, t in zip(pages, texts)})
    if text_info["emptyPages"]:
        findings.append(
            f"{len(text_info['emptyPages'])} page(s) produced no text: "
            f"{text_info['emptyPages'][:12]}. Spans cannot be verified against them."
        )

    manifest = {
        "id": item_id,
        "kind": kind,
        "intakeAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": {"file": pdf_path.name, "sha256": sha256_file(pdf_path),
                   "bytes": pdf_path.stat().st_size},
        "pageCount": len(pages),
        "mastersDir": str(out_dir.relative_to(COSMO.parent)),
        "textExtraction": {"method": method, **text_info},
        "text": text_info,
        "gateFindings": findings,
        "pages": pages,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

    stub = stub_json(item_id, kind, manifest, pdf_path)

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

    print(f"\nself-test: {6 - failures} passed, {failures} failed")
    return 1 if failures else 0


def main():
    parser = argparse.ArgumentParser(description="Explode a captured book into masters plus text.")
    parser.add_argument("pdf", nargs="?", help="the captured PDF, one book per file")
    parser.add_argument("--id", help="item id: ref-YYYY-MM-DD-slug or cur-YYYY-MM-DD-slug")
    parser.add_argument("--kind", choices=("reference", "curriculum"),
                        help="defaults to curriculum for a cur- id, reference otherwise")
    parser.add_argument("--expect-pages", type=int,
                        help="page count the operator counted, asserted against the capture")
    parser.add_argument("--force", action="store_true", help="redo an already-ingested item")
    parser.add_argument("--check", metavar="ID", help="re-run the gates on an ingested item")
    parser.add_argument("--self-test", action="store_true", help="run the gate fixtures")
    args = parser.parse_args()

    if args.self_test:
        return self_test()
    if args.check:
        return recheck(args.check)
    if not args.pdf or not args.id:
        parser.print_help()
        return 2
    if not ID_RE.match(args.id):
        print(f"ERROR: id {args.id!r} must look like ref-2026-07-28-some-slug", file=sys.stderr)
        return 2
    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        print(f"ERROR: no such file: {pdf_path}", file=sys.stderr)
        return 2
    kind = args.kind or ("curriculum" if args.id.startswith("cur-") else "reference")
    return intake(pdf_path, args.id, kind, args.expect_pages, args.force)


if __name__ == "__main__":
    sys.exit(main())
