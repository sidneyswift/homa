#!/usr/bin/env python3
"""Safety regressions for capture download and staging provenance."""

import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


def load_script(module_name: str, filename: str):
    path = Path(__file__).with_name(filename)
    spec = importlib.util.spec_from_file_location(module_name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


STAGE = load_script("stage_captured", "stage-captured.py")
DOWNLOAD = load_script("download_pending", "download-pending.py")


class StageCapturedTest(unittest.TestCase):
    def test_recovery_capture_timestamps_do_not_replace_record_identity(self):
        record = {
            "id": "ref-old",
            "sourceMessageTs": "1.0",
            "coversMessageTs": ["9.0"],
            "captureMessageTs": ["9.0"],
        }
        self.assertEqual(STAGE.plan_timestamps(record), ["1.0", "9.0"])
        self.assertEqual(STAGE.capture_timestamps(record), ["9.0"])

    def test_existing_record_cannot_be_rebound_without_an_opt_in_plan_flag(self):
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "ref-old.json"
            path.write_text(
                '{"id":"ref-old","title":"Old","sourceMessageTs":"1.0",'
                '"coversMessageTs":[],"blobUrl":"https://blob/old.pdf",'
                '"sourceFiles":[{"filename":"old.pdf","slackFileId":"FOLD",'
                '"slackMessageTs":"1.0","sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
                'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","blobUrl":"https://blob/old.pdf"}]}\n'
            )
            record = {
                "id": "ref-old",
                "kind": "reference",
                "title": "Old",
                "sourceMessageTs": "1.0",
                "coversMessageTs": ["9.0"],
            }
            item = {
                "name": "new.pdf",
                "fileId": "FNEW",
                "ts": "9.0",
                "localPath": "capture/new.pdf",
                "size": 5,
                "sha256": "a" * 64,
                "mimetype": "application/pdf",
            }
            state = {STAGE.upload_key("ref-old", item): "https://blob/new.pdf"}
            with patch.object(STAGE, "record_path", return_value=path):
                with self.assertRaisesRegex(RuntimeError, "mergeExistingSources"):
                    STAGE.write_stub(
                        record, [item], state, {"1.0": {"dropper": "Founder"}}
                    )

            unchanged = json.loads(path.read_text())
            self.assertEqual(unchanged["coversMessageTs"], [])
            self.assertEqual(len(unchanged["sourceFiles"]), 1)

    def test_explicit_merge_unions_coverage_and_preserves_authored_identity(self):
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "ref-old.json"
            path.write_text(json.dumps({
                "id": "ref-old",
                "title": "Authored title",
                "droppedBy": "Original founder",
                "droppedAt": "2026-08-01T00:00:00-04:00",
                "sourceMessageTs": "1.0",
                "coversMessageTs": ["2.0"],
                "sourceFiles": [],
            }))
            record = {
                "id": "ref-old",
                "kind": "reference",
                "title": "Authored title",
                "sourceMessageTs": "1.0",
                "coversMessageTs": ["9.0"],
                "captureMessageTs": ["9.0"],
                "mergeExistingSources": True,
            }
            item = {
                "name": "new.pdf",
                "fileId": "FNEW",
                "ts": "9.0",
                "localPath": "capture/new.pdf",
                "size": 5,
                "sha256": "a" * 64,
                "mimetype": "application/pdf",
            }
            state = {STAGE.upload_key("ref-old", item): "https://blob/new.pdf"}
            with patch.object(STAGE, "record_path", return_value=path):
                STAGE.write_stub(
                    record, [item], state, {"1.0": {"dropper": "Replacement founder"}}
                )

            merged = json.loads(path.read_text())
            self.assertEqual(merged["title"], "Authored title")
            self.assertEqual(merged["droppedBy"], "Original founder")
            self.assertEqual(merged["droppedAt"], "2026-08-01T00:00:00-04:00")
            self.assertEqual(merged["sourceMessageTs"], "1.0")
            self.assertEqual(merged["coversMessageTs"], ["2.0", "9.0"])

    def test_rerunning_the_same_slack_file_never_duplicates_itself(self):
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "ref-repeat.json"
            record = {
                "id": "ref-repeat",
                "kind": "reference",
                "title": "Repeat",
                "sourceMessageTs": "1.0",
                "coversMessageTs": [],
            }
            item = {
                "name": "same.pdf",
                "fileId": "FSAME",
                "ts": "1.0",
                "localPath": "capture/same.pdf",
                "size": 5,
                "sha256": "a" * 64,
                "mimetype": "application/pdf",
            }
            state = {STAGE.upload_key("ref-repeat", item): "https://blob/same.pdf"}
            with patch.object(STAGE, "record_path", return_value=path):
                STAGE.write_stub(record, [item], state, {"1.0": {"dropper": "Founder"}})
                STAGE.write_stub(record, [item], state, {"1.0": {"dropper": "Founder"}})

            [source] = json.loads(path.read_text())["sourceFiles"]
            self.assertEqual(source["slackFileId"], "FSAME")
            self.assertNotIn("duplicateOf", source)

    def test_duplicate_plan_record_ids_fail_before_item_assignment(self):
        with self.assertRaisesRegex(RuntimeError, "duplicate record IDs"):
            STAGE.validate_plan_records([
                {"id": "ref-one"},
                {"id": "ref-one"},
            ])

    def test_record_scoped_retry_cannot_bypass_global_timestamp_ownership(self):
        records = [
            {
                "id": "ref-2026-08-02-one",
                "kind": "reference",
                "title": "One",
                "sourceMessageTs": "1.0",
                "coversMessageTs": [],
            },
            {
                "id": "ref-2026-08-02-two",
                "kind": "reference",
                "title": "Two",
                "sourceMessageTs": "2.0",
                "coversMessageTs": ["1.0"],
                "captureMessageTs": ["1.0"],
            },
        ]

        with self.assertRaisesRegex(RuntimeError, "assigned to both"):
            STAGE.validate_plan_records(records)

    def test_plan_schema_binds_capture_messages_to_declared_record_coverage(self):
        valid = {
            "id": "ref-2026-08-02-example",
            "kind": "reference",
            "title": "Example",
            "sourceMessageTs": "1.0",
            "coversMessageTs": ["9.0"],
            "captureMessageTs": ["9.0"],
        }
        self.assertEqual(STAGE.validate_plan_records([valid]), [valid])

        invalid = [
            {**valid, "id": "../escape"},
            {**valid, "kind": "curriculum"},
            {**valid, "sourceMessageTs": 1.0},
            {**valid, "captureMessageTs": ["7.0"]},
        ]
        for record in invalid:
            with self.subTest(record=record):
                with self.assertRaises(RuntimeError):
                    STAGE.validate_plan_records([record])

    def test_restage_keeps_first_nonduplicate_hash_occurrence_canonical(self):
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "ref-repeat.json"
            path.write_text(json.dumps({
                "id": "ref-repeat",
                "title": "Repeat",
                "sourceMessageTs": "1.0",
                "coversMessageTs": ["2.0"],
                "sourceFiles": [
                    {
                        "filename": "first.pdf",
                        "slackFileId": "F1",
                        "slackMessageTs": "1.0",
                        "sha256": "a" * 64,
                        "blobUrl": "https://blob/first.pdf",
                    },
                    {
                        "filename": "second.pdf",
                        "slackFileId": "F2",
                        "slackMessageTs": "2.0",
                        "sha256": "a" * 64,
                        "blobUrl": "https://blob/second.pdf",
                        "duplicateOf": {
                            "slackMessageTs": "1.0",
                            "filename": "first.pdf",
                        },
                    },
                ],
            }))
            record = {
                "id": "ref-repeat",
                "kind": "reference",
                "title": "Repeat",
                "sourceMessageTs": "1.0",
                "coversMessageTs": ["2.0"],
            }
            item = {
                "name": "first.pdf",
                "fileId": "F1",
                "ts": "1.0",
                "localPath": "capture/first.pdf",
                "size": 5,
                "sha256": "a" * 64,
                "mimetype": "application/pdf",
            }
            state = {STAGE.upload_key("ref-repeat", item): "https://blob/first.pdf"}
            with patch.object(STAGE, "record_path", return_value=path):
                STAGE.write_stub(record, [item], state, {"1.0": {"dropper": "Founder"}})

            first, second = json.loads(path.read_text())["sourceFiles"]
            self.assertNotIn("duplicateOf", first)
            self.assertEqual(second["duplicateOf"]["slackMessageTs"], "1.0")

    def test_same_name_attachments_get_distinct_capture_and_blob_names(self):
        first = DOWNLOAD.capture_name("Reader.pdf", "F001")
        second = DOWNLOAD.capture_name("Reader.pdf", "F002")
        self.assertEqual(first, "Reader-F001.pdf")
        self.assertEqual(second, "Reader-F002.pdf")
        self.assertNotEqual(first, second)

        base = {"ts": "1.2", "name": "Reader.pdf", "sha256": "a" * 64}
        self.assertNotEqual(
            STAGE.stored_name({**base, "fileId": "F001"}),
            STAGE.stored_name({**base, "fileId": "F002"}),
        )

    def test_local_capture_requires_the_manifest_hash_not_only_size(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            capture_root = root / ".cosmo" / "inspo-files" / "slack"
            path = capture_root / "1.0" / "capture.pdf"
            path.parent.mkdir(parents=True)
            path.write_bytes(b"right")
            item = {
                "localPath": str(path.relative_to(root)),
                "ts": "1.0",
                "size": 5,
                "sha256": hashlib.sha256(b"right").hexdigest(),
            }
            with (
                patch.object(STAGE, "REPO", root),
                patch.object(STAGE, "CAPTURE_ROOT", capture_root),
            ):
                self.assertEqual(STAGE.verified_capture(item), path.resolve())
                path.write_bytes(b"wrong")
                with self.assertRaisesRegex(RuntimeError, "hash mismatch"):
                    STAGE.verified_capture(item)

    def test_local_capture_cannot_escape_its_exact_timestamp_directory(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            capture_root = root / ".cosmo" / "inspo-files" / "slack"
            outside = root / "secret.env"
            outside.write_bytes(b"right")
            wrong_timestamp = capture_root / "2.0" / "capture.pdf"
            wrong_timestamp.parent.mkdir(parents=True)
            wrong_timestamp.write_bytes(b"right")
            base = {
                "ts": "1.0",
                "size": 5,
                "sha256": hashlib.sha256(b"right").hexdigest(),
            }
            with (
                patch.object(STAGE, "REPO", root),
                patch.object(STAGE, "CAPTURE_ROOT", capture_root),
            ):
                with self.assertRaisesRegex(RuntimeError, "capture root"):
                    STAGE.verified_capture({
                        **base,
                        "localPath": str(outside.relative_to(root)),
                    })
                with self.assertRaisesRegex(RuntimeError, "timestamp directory"):
                    STAGE.verified_capture({
                        **base,
                        "localPath": str(wrong_timestamp.relative_to(root)),
                    })

    def test_local_capture_rejects_leaf_and_parent_symlinks(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            capture_root = root / ".cosmo" / "inspo-files" / "slack"
            timestamp_root = capture_root / "1.0"
            original = timestamp_root / "original.pdf"
            timestamp_root.mkdir(parents=True)
            original.write_bytes(b"right")
            leaf_link = timestamp_root / "leaf.pdf"
            leaf_link.symlink_to(original)
            parent_link = capture_root / "alias"
            parent_link.symlink_to(timestamp_root, target_is_directory=True)
            base = {
                "ts": "1.0",
                "size": 5,
                "sha256": hashlib.sha256(b"right").hexdigest(),
            }
            with (
                patch.object(STAGE, "REPO", root),
                patch.object(STAGE, "CAPTURE_ROOT", capture_root),
            ):
                with self.assertRaisesRegex(RuntimeError, "symlink"):
                    STAGE.verified_capture({
                        **base,
                        "localPath": str(leaf_link.relative_to(root)),
                    })
                with self.assertRaisesRegex(RuntimeError, "timestamp directory"):
                    STAGE.verified_capture({
                        **base,
                        "localPath": str((parent_link / original.name).relative_to(root)),
                    })

    def test_same_slack_file_shared_twice_keeps_both_occurrences(self):
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "ref-repeat.json"
            record = {
                "id": "ref-repeat",
                "kind": "reference",
                "title": "Repeat",
                "sourceMessageTs": "1.0",
                "coversMessageTs": ["2.0"],
            }
            items = [
                {
                    "name": "same.pdf",
                    "fileId": "FSAME",
                    "ts": timestamp,
                    "localPath": f"capture/{timestamp}/same.pdf",
                    "size": 5,
                    "sha256": "a" * 64,
                    "mimetype": "application/pdf",
                }
                for timestamp in ("1.0", "2.0")
            ]
            state = {
                STAGE.upload_key("ref-repeat", item): "https://blob/same.pdf"
                for item in items
            }
            with patch.object(STAGE, "record_path", return_value=path):
                STAGE.write_stub(record, items, state, {"1.0": {"dropper": "Founder"}})

            sources = json.loads(path.read_text())["sourceFiles"]
            self.assertEqual(
                [(source["slackMessageTs"], source["slackFileId"]) for source in sources],
                [("1.0", "FSAME"), ("2.0", "FSAME")],
            )
            self.assertEqual(sources[1]["duplicateOf"]["slackMessageTs"], "1.0")
            for source in sources:
                self.assertTrue(source["slackSizeVerified"])
                self.assertTrue(source["blobReadBackVerified"])
                self.assertEqual(source["blobReadBackSize"], 5)
                self.assertEqual(source["blobReadBackSha256"], "a" * 64)

    def test_same_bytes_with_different_mime_use_distinct_verified_uploads(self):
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "ref-mime.json"
            record = {
                "id": "ref-mime",
                "kind": "reference",
                "title": "MIME variants",
                "sourceMessageTs": "1.0",
                "coversMessageTs": ["2.0"],
            }
            pdf = {
                "name": "same.pdf",
                "fileId": "FPDF",
                "ts": "1.0",
                "localPath": "capture/1.0/same.pdf",
                "size": 5,
                "sha256": "a" * 64,
                "mimetype": "application/pdf",
            }
            text = {
                **pdf,
                "name": "same.txt",
                "fileId": "FTEXT",
                "ts": "2.0",
                "localPath": "capture/2.0/same.txt",
                "mimetype": "text/plain; charset=utf-8",
            }
            pdf_key = STAGE.upload_key("ref-mime", pdf)
            text_key = STAGE.upload_key("ref-mime", text)
            self.assertNotEqual(pdf_key, text_key)
            state = {
                pdf_key: "https://blob/pdf",
                text_key: "https://blob/text",
            }

            with patch.object(STAGE, "record_path", return_value=path):
                STAGE.write_stub(
                    record, [pdf, text], state, {"1.0": {"dropper": "Founder"}}
                )

            pdf_source, text_source = json.loads(path.read_text())["sourceFiles"]
            self.assertEqual(pdf_source["blobUrl"], "https://blob/pdf")
            self.assertEqual(pdf_source["contentType"], "application/pdf")
            self.assertEqual(
                pdf_source["blobReadBackContentType"], "application/pdf"
            )
            self.assertEqual(
                pdf_source["blobReadBackReceiptVersion"],
                STAGE.BLOB_READ_BACK_RECEIPT_VERSION,
            )
            self.assertEqual(
                pdf_source["blobReadBackIdentity"],
                f"{'a' * 64}:application/pdf",
            )
            self.assertEqual(text_source["blobUrl"], "https://blob/text")
            self.assertEqual(text_source["contentType"], "text/plain")
            self.assertEqual(
                text_source["blobReadBackContentType"], "text/plain"
            )
            self.assertEqual(
                text_source["blobReadBackReceiptVersion"],
                STAGE.BLOB_READ_BACK_RECEIPT_VERSION,
            )
            self.assertEqual(
                text_source["blobReadBackIdentity"],
                f"{'a' * 64}:text/plain",
            )

    def test_full_plan_requires_bidirectional_capture_coverage(self):
        files = {"1.0": [{}], "2.0": [{}]}
        with self.assertRaisesRegex(RuntimeError, "omits 1 captured"):
            STAGE.validate_capture_coverage(["1.0"], files, 2, subset=False)
        STAGE.validate_capture_coverage(["1.0"], files, 2, subset=True)
        with self.assertRaisesRegex(RuntimeError, "contains files for 2"):
            STAGE.validate_capture_coverage(["1.0"], files, 3, subset=True)

    def test_blob_read_back_rejects_lookalike_hosts_before_network(self):
        with self.assertRaisesRegex(RuntimeError, "outside Homa's pinned"):
            STAGE.verify_blob_read_back(
                "https://example.com/inspo/record/file.pdf",
                5,
                "a" * 64,
                "application/pdf",
            )

    def test_cached_upload_is_live_verified_before_reuse(self):
        item = {
            "localPath": "capture.pdf",
            "size": 5,
            "sha256": "a" * 64,
            "name": "Reader.pdf",
            "ts": "1.0",
            "fileId": "F001",
            "mimetype": "application/pdf",
        }
        key = STAGE.upload_key("ref-one", item)
        url = f"https://{STAGE.EXPECTED_BLOB_HOST}/inspo/ref-one/Reader.pdf"
        with (
            patch.object(STAGE, "verified_capture", return_value=Path("capture.pdf")),
            patch.object(STAGE, "verify_blob_read_back") as read_back,
        ):
            result = STAGE.upload_one("ref-one", item, {key: url})

        self.assertEqual(result, (key, url, False))
        read_back.assert_called_once_with(url, 5, "a" * 64, "application/pdf")

    def test_generic_slack_binary_uses_the_precise_filename_mime(self):
        self.assertEqual(
            STAGE.content_type({
                "name": "CalendarBundle.pdf",
                "mimetype": "application/octet-stream",
            }),
            "application/pdf",
        )

    def test_same_size_untrusted_capture_is_redownloaded(self):
        class FakeResponse:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def read(self, size=-1):
                if getattr(self, "done", False):
                    return b""
                self.done = True
                return b"right"

        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            capture_root = root / "capture"
            final = capture_root / "1.0" / "Reader-F001.pdf"
            final.parent.mkdir(parents=True)
            final.write_bytes(b"wrong")
            trusted = {"F001": {
                "fileId": "F001",
                "ts": "1.0",
                "localPath": str(final.relative_to(root)),
                "size": 5,
                "sha256": hashlib.sha256(b"right").hexdigest(),
            }}
            file = {
                "id": "F001",
                "name": "Reader.pdf",
                "size": 5,
                "url_private_download": "https://slack.example/file",
            }
            with (
                patch.object(DOWNLOAD, "REPO", root),
                patch.object(DOWNLOAD, "CAPTURE_ROOT", capture_root),
                patch.object(DOWNLOAD, "urlopen", return_value=FakeResponse()) as opener,
            ):
                result = DOWNLOAD.download_one("secret", "1.0", file, trusted)

            self.assertFalse(result["skipped"])
            self.assertEqual(final.read_bytes(), b"right")
            opener.assert_called_once()


if __name__ == "__main__":
    unittest.main()
