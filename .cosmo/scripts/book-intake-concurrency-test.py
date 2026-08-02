#!/usr/bin/env python3
"""Focused concurrency regressions for book-intake.py."""

import argparse
import hashlib
import importlib.util
import json
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from PIL import Image, ImageDraw
import fitz


SCRIPT = Path(__file__).with_name("book-intake.py")
SPEC = importlib.util.spec_from_file_location("book_intake", SCRIPT)
BOOK_INTAKE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BOOK_INTAKE)


class BookIntakeConcurrencyTest(unittest.TestCase):
    def test_resume_checkpoint_requires_exact_ordered_source_hashes(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            item_dir = root / "masters"
            item_dir.mkdir()
            first = root / "part-1.pdf"
            second = root / "part-2.pdf"
            first.write_bytes(b"first")
            second.write_bytes(b"second")
            BOOK_INTAKE.write_source_checkpoint(
                item_dir, "cur-2026-08-02-fixture", "curriculum", [first, second]
            )

            receipt = BOOK_INTAKE.verify_resume_checkpoint(
                item_dir, "cur-2026-08-02-fixture", "curriculum", [first, second]
            )
            self.assertEqual([part["file"] for part in receipt["parts"]], [
                "part-1.pdf", "part-2.pdf",
            ])

            second.write_bytes(b"SECOND")
            with self.assertRaisesRegex(ValueError, "do not exactly match"):
                BOOK_INTAKE.verify_resume_checkpoint(
                    item_dir,
                    "cur-2026-08-02-fixture",
                    "curriculum",
                    [first, second],
                )

    def test_resume_without_source_checkpoint_fails_closed(self):
        with tempfile.TemporaryDirectory() as raw:
            source = Path(raw) / "source.pdf"
            source.write_bytes(b"source")
            with self.assertRaisesRegex(ValueError, "predate the exact source checkpoint"):
                BOOK_INTAKE.verify_resume_checkpoint(
                    Path(raw) / "masters",
                    "cur-2026-08-02-fixture",
                    "curriculum",
                    [source],
                )

    def test_forced_intake_clears_old_masters_checkpoint_and_sidecar(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            masters = root / "masters"
            text = root / "text"
            item_id = "cur-2026-08-02-fixture"
            item_dir = masters / item_id
            item_dir.mkdir(parents=True)
            text.mkdir()
            (item_dir / "p0001.old.png").write_bytes(b"old master")
            (item_dir / "source-checkpoint.json").write_text('{"old":true}')
            (text / f"{item_id}.txt").write_text("old sidecar")

            with (
                patch.object(BOOK_INTAKE, "MASTERS_DIR", masters),
                patch.object(BOOK_INTAKE, "TEXT_DIR", text),
            ):
                BOOK_INTAKE.prepare_intake_workspace(item_id, item_dir, force=True)

            self.assertTrue(item_dir.is_dir())
            self.assertEqual(list(item_dir.iterdir()), [])
            self.assertFalse((text / f"{item_id}.txt").exists())

    def test_non_force_workspace_requires_an_exact_source_checkpoint(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            item_id = "cur-2026-08-02-fixture"
            item_dir = root / "masters" / item_id
            item_dir.mkdir(parents=True)
            original = root / "source.pdf"
            replacement = root / "replacement.pdf"
            original.write_bytes(b"original source")
            replacement.write_bytes(b"different source")
            BOOK_INTAKE.write_source_checkpoint(
                item_dir, item_id, "curriculum", [original]
            )
            (item_dir / "p0001.png").write_bytes(b"partial capture")

            BOOK_INTAKE.prepare_intake_workspace(
                item_id,
                item_dir,
                force=False,
                kind="curriculum",
                pdf_paths=[original],
            )
            with self.assertRaisesRegex(ValueError, "do not exactly match"):
                BOOK_INTAKE.prepare_intake_workspace(
                    item_id,
                    item_dir,
                    force=False,
                    kind="curriculum",
                    pdf_paths=[replacement],
                )

            with (
                patch.object(BOOK_INTAKE, "MASTERS_DIR", root / "masters"),
                patch.object(BOOK_INTAKE, "TEXT_DIR", root / "text"),
                patch.object(
                    BOOK_INTAKE,
                    "extract_pages",
                    side_effect=AssertionError("colliding bytes must not be read"),
                ),
            ):
                self.assertEqual(
                    BOOK_INTAKE.intake(
                        [replacement],
                        item_id,
                        "curriculum",
                        1,
                        False,
                        use_vision=False,
                    ),
                    2,
                )

            source_checkpoint = item_dir / "source-checkpoint.json"
            source_checkpoint.unlink()
            with self.assertRaisesRegex(ValueError, "predate the exact source checkpoint"):
                BOOK_INTAKE.prepare_intake_workspace(
                    item_id,
                    item_dir,
                    force=False,
                    kind="curriculum",
                    pdf_paths=[original],
                )

    def test_initial_intake_persists_expected_count_receipt_and_all_findings(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            cosmo = root / ".cosmo"
            masters = cosmo / "masters"
            text_dir = cosmo / "text"
            references = cosmo / "references"
            curriculums = cosmo / "curriculums"
            for directory in (masters, text_dir, references, curriculums):
                directory.mkdir(parents=True)
            source = root / "source.pdf"
            source.write_bytes(b"captured source")
            source_sha = hashlib.sha256(source.read_bytes()).hexdigest()
            page = {
                "page": 1,
                "master": "p0001.png",
                "source": "rendered",
                "reencoded": True,
                "dpi": 300,
                "bytes": 10,
                "sha256": "a" * 64,
                "inkCoverage": 0.1,
                "sharpness": 100.0,
                "aHash": "0" * 16,
                "rotation": 0,
            }
            item_id = "ref-2026-08-02-intake-fixture"

            with (
                patch.object(BOOK_INTAKE, "COSMO", cosmo),
                patch.object(BOOK_INTAKE, "MASTERS_DIR", masters),
                patch.object(BOOK_INTAKE, "TEXT_DIR", text_dir),
                patch.object(BOOK_INTAKE, "REFS_DIR", references),
                patch.object(BOOK_INTAKE, "CURS_DIR", curriculums),
                patch.object(BOOK_INTAKE, "extract_pages", return_value=[page]),
                patch.object(BOOK_INTAKE, "normalize_page_masters", return_value=0),
                patch.object(BOOK_INTAKE, "text_layer", return_value=["OCR fallback"]),
                patch.object(BOOK_INTAKE, "pages_needing_vision", return_value=[1]),
                patch.object(
                    BOOK_INTAKE,
                    "read_pages_with_vision",
                    return_value={"read": {}, "failed": {1: "provider timeout"}},
                ),
                patch.object(
                    BOOK_INTAKE,
                    "write_sidecar",
                    return_value={
                        "path": f".cosmo/text/{item_id}.txt",
                        "chars": 0,
                        "emptyPages": [1],
                    },
                ),
                patch.object(
                    BOOK_INTAKE,
                    "run_gates",
                    return_value=["page count is 1, operator expected 2"],
                ),
            ):
                result = BOOK_INTAKE.intake(
                    [source], item_id, "reference", 2, False, use_vision=True
                )

            manifest = json.loads(
                (masters / item_id / "manifest.json").read_text()
            )
            record = json.loads((references / f"{item_id}.json").read_text())
            self.assertEqual(result, 1)
            self.assertEqual(manifest["expectedPageCount"], 2)
            self.assertEqual(record["capture"]["expectedPageCount"], 2)
            self.assertEqual(manifest["gateFindingCount"], 3)
            self.assertIn("could not be read by the model", manifest["gateFindings"][1])
            self.assertIn("produced no text", manifest["gateFindings"][2])
            receipt = record["capture"]["sourceReceipt"]
            self.assertEqual(receipt["recordId"], item_id)
            self.assertEqual(receipt["kind"], "reference")
            self.assertEqual(receipt["parts"], [{
                "file": source.name,
                "sha256": source_sha,
                "bytes": source.stat().st_size,
            }])

    def test_missing_expected_page_count_is_never_laundered_from_observed_count(self):
        manifest = {"pageCount": 3}

        self.assertIsNone(BOOK_INTAKE.expected_page_count(manifest))
        self.assertNotIn("expectedPageCount", manifest)
        self.assertTrue(any(
            "independent expected page count is missing" in finding
            for finding in BOOK_INTAKE.run_gates([], None)
        ))

    def test_intake_requires_a_positive_independent_expected_page_count(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            source = root / "source.pdf"
            source.write_bytes(b"captured source")
            masters = root / "masters"
            text = root / "text"

            with (
                patch.object(BOOK_INTAKE, "MASTERS_DIR", masters),
                patch.object(BOOK_INTAKE, "TEXT_DIR", text),
                patch.object(
                    BOOK_INTAKE,
                    "extract_pages",
                    side_effect=AssertionError("missing assertion must stop before extraction"),
                ),
            ):
                result = BOOK_INTAKE.intake(
                    [source],
                    "ref-2026-08-02-count-required-fixture",
                    "reference",
                    None,
                    False,
                    use_vision=False,
                )

            self.assertEqual(result, 2)
            self.assertFalse(masters.exists())

    def test_same_findings_do_not_preserve_review_across_source_replacement(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            refs = root / "references"
            curs = root / "curriculums"
            refs.mkdir()
            curs.mkdir()
            item_id = "ref-2026-08-02-review-binding-fixture"
            target = refs / f"{item_id}.json"
            findings = ["page 1: looks blank"]
            digest = BOOK_INTAKE.gate_findings_sha256(findings)
            old_source = {
                "file": "old.pdf",
                "sha256": "a" * 64,
                "bytes": 101,
                "parts": [{"file": "old.pdf", "sha256": "a" * 64, "bytes": 101}],
            }
            new_source = {
                "file": "new.pdf",
                "sha256": "b" * 64,
                "bytes": 202,
                "parts": [{"file": "new.pdf", "sha256": "b" * 64, "bytes": 202}],
            }
            old_binding = BOOK_INTAKE.capture_review_binding(
                item_id, "reference", old_source, 1, 1
            )
            target.write_text(json.dumps({
                "id": item_id,
                "capture": {
                    "gateReview": {
                        "status": "reviewed",
                        "findingsSha256": digest,
                        "captureBinding": old_binding,
                    }
                },
            }))
            manifest = {
                "id": item_id,
                "kind": "reference",
                "source": new_source,
                "pageCount": 1,
                "expectedPageCount": 1,
                "mastersDir": f".cosmo/masters/{item_id}",
                "intakeAt": "2026-08-02T00:00:00+00:00",
                "gateStatus": "findings",
                "gateFindings": findings,
                "gateFindingCount": 1,
                "gateFindingsSha256": digest,
                "pages": [{"page": 1}],
                "text": {"path": f".cosmo/text/{item_id}.txt"},
            }

            with (
                patch.object(BOOK_INTAKE, "REFS_DIR", refs),
                patch.object(BOOK_INTAKE, "CURS_DIR", curs),
            ):
                BOOK_INTAKE.stub_json(item_id, "reference", manifest, Path("new.pdf"))

            capture = json.loads(target.read_text())["capture"]
            self.assertNotIn("gateReview", capture)
            self.assertNotEqual(capture["reviewBinding"], old_binding)

    def test_gate_status_is_complete_only_when_findings_are_empty(self):
        clean = {"gateReview": {"findingsSha256": "stale"}}
        BOOK_INTAKE.set_gate_result(clean, [])
        self.assertEqual(clean["gateStatus"], "complete")
        self.assertEqual(clean["gateFindingCount"], 0)
        self.assertNotIn("gateReview", clean)

        findings = ["page 2: looks blank"]
        flagged = {}
        BOOK_INTAKE.set_gate_result(flagged, findings)
        self.assertEqual(flagged["gateStatus"], "findings")
        self.assertEqual(flagged["gateFindingCount"], 1)
        self.assertEqual(
            flagged["gateFindingsSha256"],
            BOOK_INTAKE.gate_findings_sha256(findings),
        )

    def test_recheck_keeps_model_and_empty_page_findings(self):
        findings = BOOK_INTAKE.add_extraction_findings(
            {
                "textExtraction": {"visionFailed": {"2": "timeout"}},
                "text": {"emptyPages": [3, 4]},
            },
            ["page 1: looks blank"],
        )
        self.assertEqual(len(findings), 3)
        self.assertIn("1 page(s) could not be read by the model ([2])", findings[1])
        self.assertIn("2 page(s) produced no text: [3, 4]", findings[2])

    def test_jobs_are_explicitly_bounded(self):
        self.assertEqual(BOOK_INTAKE.parse_jobs("1"), 1)
        self.assertEqual(
            BOOK_INTAKE.parse_jobs(str(BOOK_INTAKE.MAX_JOBS)),
            BOOK_INTAKE.MAX_JOBS,
        )
        for value in ("0", str(BOOK_INTAKE.MAX_JOBS + 1), "many"):
            with self.assertRaises(argparse.ArgumentTypeError):
                BOOK_INTAKE.parse_jobs(value)

    def test_orientation_results_keep_page_order(self):
        pages = [
            {"page": 1, "master": "p0001.png"},
            {"page": 2, "master": "p0002.png"},
            {"page": 3, "master": "p0003.png"},
        ]

        def finish_in_reverse(path):
            page = int(path.stem[1:])
            time.sleep((4 - page) * 0.01)
            return page * 90

        with patch.object(BOOK_INTAKE, "page_orientation", side_effect=finish_in_reverse):
            result = BOOK_INTAKE.page_orientations(Path("/unused"), pages, jobs=3)

        self.assertEqual(result, [90, 180, 270])
        self.assertEqual([page["page"] for page in pages], [1, 2, 3])

    def test_ocr_results_keep_page_order_and_rotation(self):
        pages = [
            {"page": 1, "master": "p0001.png", "rotation": 0},
            {"page": 2, "master": "p0002.png", "rotation": 90},
            {"page": 3, "master": "p0003.png", "rotation": 180},
        ]

        def finish_in_reverse(path, rotation):
            page = int(path.stem[1:])
            time.sleep((4 - page) * 0.01)
            return f"page={page};rotation={rotation}"

        with patch.object(BOOK_INTAKE, "ocr_page", side_effect=finish_in_reverse):
            result = BOOK_INTAKE.ocr_pages(
                Path("/unused"), pages, jobs=3, report_progress=False
            )

        self.assertEqual(
            result,
            ["page=1;rotation=0", "page=2;rotation=90", "page=3;rotation=180"],
        )

    def test_parallel_worker_failure_still_aborts(self):
        pages = [
            {"page": 1, "master": "p0001.png"},
            {"page": 2, "master": "p0002.png"},
        ]

        def fail_second(path):
            if path.name == "p0002.png":
                raise RuntimeError("orientation failed")
            return 0

        with patch.object(BOOK_INTAKE, "page_orientation", side_effect=fail_second):
            with self.assertRaisesRegex(RuntimeError, "orientation failed"):
                BOOK_INTAKE.page_orientations(Path("/unused"), pages, jobs=2)

    def test_normalization_keeps_capture_and_records_provenance(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            Image.new("RGB", (40, 80), "white").save(root / "p0001.png")
            page = {"page": 1, "master": "p0001.png", "rotation": 90}

            self.assertTrue(BOOK_INTAKE.normalize_page_master(root, page))
            self.assertTrue((root / "p0001.png").exists())
            self.assertTrue((root / page["master"]).exists())
            self.assertEqual(page["captureMaster"], "p0001.png")
            self.assertEqual(page["normalizedRotation"], 90)
            self.assertEqual(page["rotation"], 0)
            self.assertEqual((page["width"], page["height"]), (80, 40))

    def test_resume_recovers_the_exact_rotation_from_existing_pixels(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = Image.new("L", (40, 80), "white")
            draw = ImageDraw.Draw(source)
            draw.rectangle((3, 8, 15, 60), fill="black")
            source.save(root / "p0001.png")
            source.rotate(-90, expand=True).save(root / "p0001.upright.png")

            degrees, error = BOOK_INTAKE._rotation_matching_derivative(
                root / "p0001.png", root / "p0001.upright.png"
            )

            self.assertEqual(degrees, 90)
            self.assertLess(error, 0.1)

    def test_resume_master_sequence_ignores_derivatives_and_refuses_gaps(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in ("p0001.png", "p0001.upright.png", "p0003.jpg"):
                Image.new("RGB", (10, 10), "white").save(root / name)

            with self.assertRaisesRegex(ValueError, "missing=\\[2\\]"):
                BOOK_INTAKE._captured_master_files(root, 3)

            Image.new("RGB", (10, 10), "white").save(root / "p0002.png")
            masters = BOOK_INTAKE._captured_master_files(root, 3)
            self.assertEqual([path.name for path in masters], [
                "p0001.png", "p0002.png", "p0003.jpg",
            ])

    def test_missing_oidc_marks_every_vision_page_failed(self):
        with patch.object(BOOK_INTAKE, "oidc_token", return_value=None):
            outcome = BOOK_INTAKE.read_pages_with_vision(
                Path("/unused"), [], [1, 7]
            )
        self.assertEqual(set(outcome["failed"]), {1, 7})

    def test_partial_vision_response_marks_the_missing_page_failed(self):
        pages = [
            {"page": 1, "master": "p0001.png"},
            {"page": 2, "master": "p0002.png"},
        ]
        result = SimpleNamespace(
            stdout='{"pages":[{"page":1,"text":"cover"}]}\n',
            stderr="",
        )
        with (
            patch.object(BOOK_INTAKE, "oidc_token", return_value="token"),
            patch.object(BOOK_INTAKE.subprocess, "run", return_value=result),
        ):
            outcome = BOOK_INTAKE.read_pages_with_vision(
                Path("/unused"), pages, [1, 2]
            )
        self.assertEqual(outcome["read"][1]["text"], "cover")
        self.assertEqual(outcome["failed"], {2: "page missing from vision response"})

    def test_embedded_extract_failure_falls_back_without_marking_page_unreadable(self):
        class FakePixmap:
            def save(self, destination):
                Image.new("RGB", (80, 100), "white").save(destination)

        class FakePage:
            def get_images(self, full=True):
                return [(7,)]

            def get_pixmap(self, dpi):
                return FakePixmap()

        class FakeDocument:
            def __iter__(self):
                return iter([FakePage()])

            def extract_image(self, xref):
                raise OSError("truncated embedded stream")

            def close(self):
                pass

        with tempfile.TemporaryDirectory() as raw:
            out = Path(raw)
            with (
                patch.object(BOOK_INTAKE.fitz, "open", return_value=FakeDocument()),
                patch.object(BOOK_INTAKE, "_page_image_covers_pdf_page", return_value=True),
                patch.object(BOOK_INTAKE, "page_orientations", return_value=[0]),
            ):
                [page] = BOOK_INTAKE._extract_one(Path("source.pdf"), out, 0, 0)

        self.assertNotIn("error", page)
        self.assertEqual(page["source"], "rendered-fallback")
        self.assertIn("truncated embedded stream", page["embeddedCaptureError"])

    def test_pending_resume_preserves_model_read_provenance(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            masters = root / "masters"
            text_dir = root / "text"
            refs = root / "references"
            curs = root / "curriculums"
            for directory in (masters, text_dir, refs, curs):
                directory.mkdir()
            item_id = "ref-2026-08-02-pending-fixture"
            item_dir = masters / item_id
            item_dir.mkdir()
            source_pdf = root / "source.pdf"
            document = fitz.open()
            page = document.new_page(width=100, height=100)
            page.insert_text((10, 50), "Readable fallback")
            document.save(source_pdf)
            document.close()
            source = BOOK_INTAKE.write_source_checkpoint(
                item_dir, item_id, "reference", [source_pdf]
            )
            master = item_dir / "p0001.png"
            Image.new("RGB", (100, 100), "white").save(master)
            (text_dir / f"{item_id}.txt").write_text("--- page 1 ---\nReadable fallback\n")
            manifest = {
                "id": item_id,
                "kind": "reference",
                "source": source,
                "pageCount": 1,
                "expectedPageCount": 1,
                "mastersDir": str(item_dir),
                "intakeAt": "2026-08-02T00:00:00+00:00",
                "text": {"path": str(text_dir / f"{item_id}.txt"), "chars": 17},
                "gateStatus": "pending",
                "gateFindings": ["Deterministic gates are pending."],
                "textExtraction": {
                    "method": "tesseract",
                    "visionAttempted": [1],
                    "visionPages": [],
                    "visionFailed": {"1": "provider timeout"},
                },
                "pages": [{
                    "page": 1,
                    "master": master.name,
                    "source": "rendered",
                    "bytes": master.stat().st_size,
                    "sha256": hashlib.sha256(master.read_bytes()).hexdigest(),
                    "rotation": 0,
                    "visual": {"kind": "worksheet"},
                }],
            }
            (item_dir / "manifest.json").write_text(json.dumps(manifest))
            with (
                patch.object(BOOK_INTAKE, "MASTERS_DIR", masters),
                patch.object(BOOK_INTAKE, "TEXT_DIR", text_dir),
                patch.object(BOOK_INTAKE, "REFS_DIR", refs),
                patch.object(BOOK_INTAKE, "CURS_DIR", curs),
                patch.object(BOOK_INTAKE, "run_gates", return_value=[]),
            ):
                result = BOOK_INTAKE.resume_captured(
                    [source_pdf], item_id, "reference", 1, False, 1
                )

            completed = json.loads((item_dir / "manifest.json").read_text())
            self.assertEqual(result, 1)
            self.assertEqual(completed["textExtraction"]["visionAttempted"], [1])
            self.assertEqual(completed["textExtraction"]["visionFailed"], {"1": "provider timeout"})
            self.assertEqual(completed["pages"][0]["visual"], {"kind": "worksheet"})
            self.assertEqual(completed["gateStatus"], "findings")

    def test_recheck_reuses_operator_expected_page_count(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            masters = root / "masters"
            text_dir = root / "text"
            item_id = "ref-2026-08-02-recheck-fixture"
            item_dir = masters / item_id
            item_dir.mkdir(parents=True)
            text_dir.mkdir()
            manifest = {
                "id": item_id,
                "kind": "reference",
                "source": {
                    "file": "source.pdf",
                    "sha256": "a" * 64,
                    "bytes": 10,
                    "parts": [{"file": "source.pdf", "sha256": "a" * 64, "bytes": 10}],
                },
                "pageCount": 1,
                "expectedPageCount": 2,
                "mastersDir": str(item_dir),
                "intakeAt": "2026-08-02T00:00:00+00:00",
                "text": {"path": "text.txt", "chars": 4, "emptyPages": []},
                "textExtraction": {"method": "tesseract", "visionFailed": {}},
                "pages": [{"page": 1}],
            }
            (item_dir / "manifest.json").write_text(json.dumps(manifest))
            (text_dir / f"{item_id}.txt").write_text("--- page 1 ---\ntext\n")
            observed = []

            def gates(pages, expected, texts=None):
                observed.append(expected)
                return []

            with (
                patch.object(BOOK_INTAKE, "MASTERS_DIR", masters),
                patch.object(BOOK_INTAKE, "TEXT_DIR", text_dir),
                patch.object(BOOK_INTAKE, "run_gates", side_effect=gates),
                patch.object(BOOK_INTAKE, "stub_json"),
            ):
                BOOK_INTAKE.recheck(item_id)

            self.assertEqual(observed, [2])

    def test_failed_revision_preserves_prior_vision_provenance_and_expected_count(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            masters = root / "masters"
            text_dir = root / "text"
            item_id = "ref-2026-08-02-revision-fixture"
            item_dir = masters / item_id
            item_dir.mkdir(parents=True)
            text_dir.mkdir()
            prior_visual = {
                "description": "A trustworthy prior visual read",
                "kind": "cover",
                "confidence": 0.9,
            }
            manifest = {
                "id": item_id,
                "kind": "reference",
                "source": {
                    "file": "source.pdf",
                    "sha256": "a" * 64,
                    "bytes": 10,
                    "parts": [{"file": "source.pdf", "sha256": "a" * 64, "bytes": 10}],
                },
                "pageCount": 1,
                "expectedPageCount": 2,
                "mastersDir": str(item_dir),
                "intakeAt": "2026-08-02T00:00:00+00:00",
                "text": {"path": "text.txt", "chars": 18, "emptyPages": []},
                "textExtraction": {
                    "method": "tesseract",
                    "visionAttempted": [1],
                    "visionPages": [1],
                    "visionFailed": {},
                },
                "pages": [{
                    "page": 1,
                    "master": "p0001.png",
                    "textSource": "vision:prior-model",
                    "visual": prior_visual,
                }],
            }
            (item_dir / "manifest.json").write_text(json.dumps(manifest))
            prior_text = "Trusted prior read"
            (text_dir / f"{item_id}.txt").write_text(
                f"--- page 1 ---\n{prior_text}\n"
            )
            observed = []

            def gates(pages, expected, texts=None):
                observed.append(expected)
                return []

            with (
                patch.object(BOOK_INTAKE, "COSMO", root),
                patch.object(BOOK_INTAKE, "MASTERS_DIR", masters),
                patch.object(BOOK_INTAKE, "TEXT_DIR", text_dir),
                patch.object(BOOK_INTAKE, "pages_needing_vision", return_value=[1]),
                patch.object(
                    BOOK_INTAKE,
                    "read_pages_with_vision",
                    return_value={"read": {}, "failed": {1: "retry timeout"}},
                ),
                patch.object(BOOK_INTAKE, "run_gates", side_effect=gates),
                patch.object(BOOK_INTAKE, "stub_json"),
            ):
                result = BOOK_INTAKE.revision(item_id)

            revised = json.loads((item_dir / "manifest.json").read_text())
            self.assertEqual(result, 0)
            self.assertEqual(observed, [2])
            self.assertEqual(revised["pages"][0]["textSource"], "vision:prior-model")
            self.assertEqual(revised["pages"][0]["visual"], prior_visual)
            self.assertEqual(revised["textExtraction"]["visionFailed"], {})
            self.assertEqual(
                revised["textExtraction"]["visionRetryFailed"],
                {"1": "retry timeout"},
            )
            self.assertIn(prior_text, (text_dir / f"{item_id}.txt").read_text())

    def test_normalize_reuses_operator_expected_page_count(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            masters = root / "masters"
            refs = root / "references"
            text_dir = root / "text"
            item_id = "ref-2026-08-02-normalize-fixture"
            item_dir = masters / item_id
            item_dir.mkdir(parents=True)
            refs.mkdir()
            text_dir.mkdir()
            manifest = {
                "id": item_id,
                "kind": "reference",
                "pageCount": 1,
                "expectedPageCount": 3,
                "text": {"emptyPages": []},
                "textExtraction": {"visionFailed": {}},
                "pages": [{"page": 1}],
            }
            (item_dir / "manifest.json").write_text(json.dumps(manifest))
            observed = []

            def gates(pages, expected, texts=None):
                observed.append(expected)
                return []

            with (
                patch.object(BOOK_INTAKE, "MASTERS_DIR", masters),
                patch.object(BOOK_INTAKE, "REFS_DIR", refs),
                patch.object(BOOK_INTAKE, "TEXT_DIR", text_dir),
                patch.object(BOOK_INTAKE, "normalize_page_masters", return_value=0),
                patch.object(BOOK_INTAKE, "run_gates", side_effect=gates),
            ):
                BOOK_INTAKE.normalize_existing_masters(item_id)

            self.assertEqual(observed, [3])

    def test_vision_pages_are_split_into_bounded_identity_preserving_batches(self):
        pages = [
            {"page": number, "master": f"p{number:04d}.png"}
            for number in range(1, 15)
        ]
        batch_sizes = []

        def respond(*args, **kwargs):
            payload = json.loads(kwargs["input"])
            batch_sizes.append(len(payload["pages"]))
            return SimpleNamespace(
                stdout=json.dumps({
                    "pages": [
                        {"page": row["page"], "text": f"page {row['page']}"}
                        for row in payload["pages"]
                    ]
                }) + "\n",
                stderr="",
            )

        with (
            patch.object(BOOK_INTAKE, "oidc_token", return_value="token"),
            patch.object(BOOK_INTAKE.subprocess, "run", side_effect=respond) as runner,
        ):
            outcome = BOOK_INTAKE.read_pages_with_vision(
                Path("/unused"), pages, list(range(1, 15))
            )

        self.assertEqual(batch_sizes, [BOOK_INTAKE.VISION_BATCH_PAGES, 2])
        self.assertEqual(runner.call_count, 2)
        self.assertEqual(set(outcome["read"]), set(range(1, 15)))
        self.assertEqual(outcome["failed"], {})

    def test_unreadable_master_repair_preserves_capture_and_binds_exact_pdf(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            masters = root / "masters"
            curriculums = root / "curriculums"
            references = root / "references"
            text_dir = root / "text"
            for directory in (masters, curriculums, references, text_dir):
                directory.mkdir()

            item_id = "cur-2026-08-02-repair-fixture"
            item_dir = masters / item_id
            item_dir.mkdir()
            source_pdf = root / "source.pdf"
            document = fitz.open()
            page = document.new_page(width=612, height=792)
            page.insert_text((72, 120), "Recovered lesson page", fontsize=24)
            document.save(source_pdf)
            document.close()
            source_sha = hashlib.sha256(source_pdf.read_bytes()).hexdigest()

            broken = item_dir / "p0001.jpeg"
            broken.write_bytes(b"broken-jpeg")
            broken_sha = hashlib.sha256(broken.read_bytes()).hexdigest()
            manifest = {
                "id": item_id,
                "kind": "curriculum",
                "intakeAt": "2026-08-02T00:00:00+00:00",
                "source": {
                    "file": source_pdf.name,
                    "sha256": source_sha,
                    "bytes": source_pdf.stat().st_size,
                    "parts": [{
                        "file": source_pdf.name,
                        "sha256": source_sha,
                        "bytes": source_pdf.stat().st_size,
                    }],
                },
                "pageCount": 1,
                "expectedPageCount": 4,
                "mastersDir": str(item_dir),
                "textExtraction": {"method": "tesseract", "visionFailed": {}},
                "pages": [{
                    "page": 1,
                    "master": broken.name,
                    "source": "embedded-image",
                    "bytes": broken.stat().st_size,
                    "sha256": broken_sha,
                    "error": "OSError: truncated image",
                }],
            }
            (item_dir / "manifest.json").write_text(json.dumps(manifest))
            (text_dir / f"{item_id}.txt").write_text("--- page 1 ---\n")
            (curriculums / f"{item_id}.json").write_text(json.dumps({
                "id": item_id,
                "sourceFiles": [{
                    "filename": source_pdf.name,
                    "localPath": str(source_pdf),
                    "sha256": source_sha,
                }],
            }))
            observed_expected_counts = []

            def gates(pages, expected, texts=None):
                observed_expected_counts.append(expected)
                return []

            with (
                patch.object(BOOK_INTAKE, "COSMO", root / ".cosmo"),
                patch.object(BOOK_INTAKE, "MASTERS_DIR", masters),
                patch.object(BOOK_INTAKE, "CURS_DIR", curriculums),
                patch.object(BOOK_INTAKE, "REFS_DIR", references),
                patch.object(BOOK_INTAKE, "TEXT_DIR", text_dir),
                patch.object(BOOK_INTAKE, "page_orientation", return_value=0),
                patch.object(BOOK_INTAKE, "ocr_page", return_value="Recovered lesson page"),
                patch.object(BOOK_INTAKE, "run_gates", side_effect=gates),
            ):
                result = BOOK_INTAKE.repair_unreadable_masters(item_id)

            repaired = json.loads((item_dir / "manifest.json").read_text())["pages"][0]
            self.assertEqual(result, 0)
            self.assertEqual(repaired["source"], "rendered-fallback")
            self.assertEqual(repaired["embeddedCaptureMaster"], broken.name)
            self.assertEqual(repaired["embeddedCaptureSha256"], broken_sha)
            self.assertTrue((item_dir / repaired["master"]).exists())
            self.assertEqual(repaired["repair"]["sourceSha256"], source_sha)
            self.assertEqual(observed_expected_counts, [4])
            self.assertIn(
                "Recovered lesson page",
                (text_dir / f"{item_id}.txt").read_text(),
            )


if __name__ == "__main__":
    unittest.main()
