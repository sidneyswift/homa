#!/usr/bin/env python3
"""Focused safety regressions for rescue-originals.py."""

import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPT = Path(__file__).with_name("rescue-originals.py")
SPEC = importlib.util.spec_from_file_location("rescue_originals", SCRIPT)
RESCUE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RESCUE)


class RescueOriginalsTest(unittest.TestCase):
    def test_exact_record_selection_keeps_requested_order(self):
        rows = [
            {"record_id": "ref-a", "slack_ts": "a-source"},
            {"record_id": "ref-b", "slack_ts": "b-source"},
            {"record_id": "ref-c", "slack_ts": "c-source"},
        ]
        records = {
            "ref-a": {"id": "ref-a", "sourceMessageTs": "a-source"},
            "ref-c": {"id": "ref-c", "sourceMessageTs": "c-source"},
        }

        def load_record(item_id):
            if item_id not in records:
                raise RESCUE.RescueError(f"record {item_id} is not present in the corpus")
            return records[item_id]

        with patch.object(RESCUE, "load_record", side_effect=load_record):
            selected = RESCUE.select_rows(rows, ["ref-c", "ref-a"])
            with self.assertRaisesRegex(RESCUE.RescueError, "ref-missing"):
                RESCUE.select_rows(rows, ["ref-missing"])

        self.assertEqual([row["record_id"] for row in selected], ["ref-c", "ref-a"])

    def test_record_only_selection_keeps_all_declared_parts_in_record_order(self):
        rows = [
            {"record_id": "cur-many", "slack_ts": "cover-2", "part": 3},
            {"record_id": "cur-many", "slack_ts": "undeclared", "part": 99},
            {"record_id": "cur-many", "slack_ts": "source", "part": 1},
            {"record_id": "cur-many", "slack_ts": "cover-1", "part": 2},
        ]
        record = {
            "id": "cur-many",
            "sourceMessageTs": "source",
            "coversMessageTs": ["cover-1", "cover-2"],
            "sourceFiles": [],
        }

        with patch.object(RESCUE, "load_record", return_value=record):
            selected = RESCUE.select_rows(rows, ["cur-many"])

        self.assertEqual(
            [row["slack_ts"] for row in selected],
            ["source", "cover-1", "cover-2"],
        )
        self.assertEqual([row["part"] for row in selected], [1, 2, 3])

    def test_explicit_record_can_fall_back_to_canonical_source_identity(self):
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "ref-old.json"
            path.write_text(
                '{"id":"ref-old","sourceMessageTs":"123.456","sourceFiles":[]}\n'
            )
            with patch.object(RESCUE, "record_path", return_value=path):
                selected = RESCUE.select_rows([], ["ref-old"])

        self.assertEqual(selected, [{
            "record_id": "ref-old",
            "slack_ts": "123.456",
            "blob_url": "",
            "status": "record-fallback",
        }])

    def test_explicit_record_parent_selection_does_not_depend_on_ledger_rows(self):
        records = {
            "cur-many": {
                "id": "cur-many",
                "sourceMessageTs": "primary-parent",
                "sourceFiles": [{"blobUrl": "https://blob/original.pdf"}],
            }
        }
        with patch.object(RESCUE, "load_record", side_effect=records.__getitem__):
            selected = RESCUE.explicit_record_rows(["cur-many", "cur-many"])

        self.assertEqual(len(selected), 2)
        self.assertEqual([row["record_id"] for row in selected], ["cur-many", "cur-many"])
        self.assertTrue(all(row["blob_url"] == "yes" for row in selected))

    def test_recovery_parent_resolves_from_corpus_when_ledger_is_stale(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            refs = root / "references"
            curs = root / "curriculums"
            refs.mkdir()
            curs.mkdir()
            (refs / "ref-requested.json").write_text(json.dumps({
                "id": "ref-requested",
                "sourceMessageTs": "old-parent",
                "sourceFiles": [],
                "originalRecovery": {"requestTs": "new-parent"},
            }))
            with (
                patch.object(RESCUE, "REFS_DIR", refs),
                patch.object(RESCUE, "CURS_DIR", curs),
            ):
                selected = RESCUE.select_rows_for_parent_timestamps([], ["new-parent"])

        self.assertEqual(selected, [{
            "record_id": "ref-requested",
            "slack_ts": "new-parent",
            "blob_url": "",
            "status": "parent-resolved",
        }])

    def test_exact_cover_parent_selects_its_matching_multipart_ledger_row(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            refs = root / "references"
            curs = root / "curriculums"
            refs.mkdir()
            curs.mkdir()
            (curs / "cur-many.json").write_text(json.dumps({
                "id": "cur-many",
                "sourceMessageTs": "source-parent",
                "coversMessageTs": ["cover-1", "cover-2"],
                "sourceFiles": [],
            }))
            rows = [
                {"record_id": "cur-many", "slack_ts": "source-parent", "part": 1},
                {"record_id": "cur-many", "slack_ts": "cover-1", "part": 2},
                {"record_id": "cur-many", "slack_ts": "cover-2", "part": 3},
            ]
            with (
                patch.object(RESCUE, "REFS_DIR", refs),
                patch.object(RESCUE, "CURS_DIR", curs),
            ):
                selected = RESCUE.select_rows_for_parent_timestamps(rows, ["cover-2"])

        self.assertEqual(selected, [{
            "record_id": "cur-many",
            "slack_ts": "cover-2",
            "part": 3,
            "status": "parent-resolved",
        }])

    def test_explicit_parent_must_be_recorded_on_the_selected_record(self):
        row = {"record_id": "ref-requested", "slack_ts": "old-parent"}
        record = {
            "id": "ref-requested",
            "sourceMessageTs": "old-parent",
            "originalRecovery": {"requestTs": "new-parent"},
        }
        with patch.object(RESCUE, "load_record", return_value=record):
            bound = RESCUE.bind_explicit_parent_rows([row], ["new-parent"])
            with self.assertRaisesRegex(RESCUE.RescueError, "not recorded"):
                RESCUE.bind_explicit_parent_rows([row], ["wrong-parent"])

        self.assertEqual(bound[0]["slack_ts"], "new-parent")
        self.assertEqual(bound[0]["status"], "explicit-parent")

    def test_partial_curriculum_recovery_parents_are_provenance_scoped(self):
        record = {
            "sourceMessageTs": "primary-parent",
            "coversMessageTs": ["cover-part-1", "cover-part-2"],
            "sourceCompleteness": {
                "threadTs": "continuation-parent",
                "affectedSlackMessageTs": "corrupt-file-parent",
                "requestTs": "our-request-reply",
                "replyTs": "our-other-request-reply",
            },
        }

        self.assertEqual(
            RESCUE.record_slack_timestamps(record),
            {
                "primary-parent",
                "cover-part-1",
                "cover-part-2",
                "continuation-parent",
                "corrupt-file-parent",
            },
        )

    def test_global_identity_index_tolerates_legacy_record_without_source(self):
        self.assertEqual(
            RESCUE.record_slack_timestamps({
                "id": "legacy-analysis",
                "coversMessageTs": ["cover-part"],
                "originalRecovery": {"requestTs": "recovery-parent"},
            }),
            {"cover-part", "recovery-parent"},
        )

    def test_history_and_thread_replies_are_both_paginated(self):
        calls = []

        def api_call(method, params):
            cursor = params.get("cursor", "")
            calls.append((method, params.get("ts"), cursor))
            pages = {
                ("conversations.history", None, ""): {
                    "messages": [{"ts": "direct-1"}],
                    "response_metadata": {"next_cursor": "history-2"},
                },
                ("conversations.history", None, "history-2"): {
                    "messages": [{"ts": "direct-2"}],
                    "response_metadata": {"next_cursor": ""},
                },
                ("conversations.replies", "parent-1", ""): {
                    "messages": [{"ts": "parent-1"}, {"ts": "reply-1"}],
                    "response_metadata": {"next_cursor": "reply-2"},
                },
                ("conversations.replies", "parent-1", "reply-2"): {
                    "messages": [{"ts": "reply-2"}],
                    "response_metadata": {"next_cursor": ""},
                },
            }
            return pages[(method, params.get("ts"), cursor)]

        messages = RESCUE.slack_messages_by_ts(["parent-1"], api_call=api_call)

        self.assertEqual(
            set(messages),
            {"direct-1", "direct-2", "parent-1", "reply-1", "reply-2"},
        )
        self.assertEqual(len(calls), 4)

    def test_explicit_parent_prefers_all_file_replies_in_timestamp_order(self):
        row = {"slack_ts": "parent-1"}
        parent = {"ts": "parent-1", "files": [{"id": "expired"}]}
        messages = {
            "parent-1": parent,
            "reply-2": {
                "ts": "reply-2", "thread_ts": "parent-1", "files": [{"id": "F2"}],
            },
            "reply-1": {
                "ts": "reply-1", "thread_ts": "parent-1", "files": [{"id": "F1"}],
            },
            "text-only": {"ts": "text-only", "thread_ts": "parent-1", "text": "here it is"},
        }

        selected = RESCUE.source_messages_for_row(row, messages, {"parent-1"})

        self.assertEqual([message["ts"] for message in selected], ["reply-1", "reply-2"])

    def test_parent_file_remains_the_safe_fallback(self):
        row = {"slack_ts": "parent-1"}
        parent = {"ts": "parent-1", "files": [{"id": "F0"}]}
        messages = {
            "parent-1": parent,
            "text-only": {"ts": "text-only", "thread_ts": "parent-1", "text": "checking"},
        }

        self.assertEqual(
            RESCUE.source_messages_for_row(row, messages, {"parent-1"}),
            [parent],
        )
        self.assertEqual(RESCUE.source_messages_for_row(row, messages, set()), [parent])

    def test_safe_filename_removes_paths_and_control_characters(self):
        self.assertEqual(
            RESCUE.safe_filename("../../folder/bad\x00name?.jpg", "F123"),
            "bad_name_.jpg",
        )
        self.assertEqual(RESCUE.safe_filename("..", "F123"), "slack-F123.bin")

    def test_real_mime_prefers_slack_metadata(self):
        self.assertEqual(
            RESCUE.slack_mime_type(
                {"name": "page.jpg", "mimetype": "image/jpeg"}
            ),
            "image/jpeg",
        )
        self.assertEqual(
            RESCUE.slack_mime_type({"name": "page.png", "mimetype": "bad"}),
            "image/png",
        )
        self.assertEqual(
            RESCUE.slack_mime_type(
                {"name": "lesson.pdf", "mimetype": "application/octet-stream"},
                "application/pdf; charset=binary",
            ),
            "application/pdf",
        )

    def test_file_receipt_checks_slack_size_and_hashes_bytes(self):
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "page.jpg"
            path.write_bytes(b"original-bytes")
            receipt = RESCUE.file_receipt(path, expected_size=14)
            self.assertEqual(receipt["size"], 14)
            self.assertEqual(
                receipt["sha256"], hashlib.sha256(b"original-bytes").hexdigest()
            )
            with self.assertRaisesRegex(RESCUE.RescueError, "Slack declared 13"):
                RESCUE.file_receipt(path, expected_size=13)

    def test_source_file_merge_is_idempotent_by_slack_occurrence(self):
        source_files = []
        entry = {
            "filename": "page.jpg",
            "slackFileId": "F123",
            "slackMessageTs": "1.0",
            "blobUrl": "https://blob/page.jpg",
            "size": 14,
            "sha256": "abc",
        }
        self.assertTrue(RESCUE.merge_source_file(source_files, entry))
        self.assertFalse(RESCUE.merge_source_file(source_files, dict(entry)))
        self.assertEqual(source_files, [entry])

        replacement = {**entry, "blobUrl": "https://blob/new-page.jpg"}
        self.assertTrue(RESCUE.merge_source_file(source_files, replacement))
        self.assertEqual(len(source_files), 1)
        self.assertEqual(source_files[0]["blobUrl"], replacement["blobUrl"])

    def test_identical_bytes_from_distinct_slack_files_keep_both_occurrences(self):
        source_files = [{
            "filename": "same.pdf",
            "slackFileId": "F1",
            "slackMessageTs": "1.0",
            "blobUrl": "https://blob/same.pdf",
            "size": 14,
            "sha256": "abc",
        }]
        second = {
            **source_files[0],
            "slackFileId": "F2",
            "slackMessageTs": "2.0",
        }

        self.assertTrue(RESCUE.merge_source_file(source_files, second))
        self.assertEqual([entry["slackFileId"] for entry in source_files], ["F1", "F2"])

    def test_same_slack_file_shared_twice_keeps_both_message_occurrences(self):
        source_files = [{
            "filename": "same.pdf",
            "slackFileId": "F-SHARED",
            "slackMessageTs": "1.0",
            "blobUrl": "https://blob/same.pdf",
            "size": 14,
            "sha256": "abc",
        }]
        second = {**source_files[0], "slackMessageTs": "2.0"}

        self.assertTrue(RESCUE.merge_source_file(source_files, second))
        self.assertEqual(
            [entry["slackMessageTs"] for entry in source_files],
            ["1.0", "2.0"],
        )

    def test_record_read_back_rejects_an_unversioned_blob_receipt(self):
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "ref-receipt.json"
            path.write_text(json.dumps({
                "sourceFiles": [{
                    "slackMessageTs": "1.0",
                    "slackFileId": "F123",
                    "blobUrl": "https://blob/source.pdf",
                    "size": 5,
                    "sha256": "a" * 64,
                    "contentType": "application/pdf",
                    "slackDeclaredSize": 5,
                    "slackSizeVerified": True,
                    "blobReadBackVerified": True,
                    "blobReadBackVerifiedAt": "2026-08-02T12:00:00+00:00",
                    "blobReadBackSize": 5,
                    "blobReadBackSha256": "a" * 64,
                    "blobReadBackContentType": "application/pdf",
                    "blobReadBackIdentity": f"{'a' * 64}:application/pdf",
                }],
            }))

            with self.assertRaisesRegex(RESCUE.RescueError, "read-back is incomplete"):
                RESCUE.verify_record_read_back(path, [("1.0", "F123")])

    def test_verified_legacy_blob_backfills_record_receipts_without_reupload(self):
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "ref-old.json"
            path.write_text(json.dumps({
                "id": "ref-old",
                "sourceFiles": [{
                    "filename": "source.pdf",
                    "slackFileId": "F123",
                    "slackMessageTs": "1.0",
                    "blobUrl": "https://blob/source.pdf",
                    "size": 14,
                    "sha256": "a" * 64,
                    "contentType": "application/pdf",
                }],
            }))
            row = {"record_id": "ref-old", "slack_ts": "1.0"}
            messages = [{
                "ts": "1.0",
                "files": [{
                    "id": "F123",
                    "name": "source.pdf",
                    "size": 14,
                    "mimetype": "application/pdf",
                }],
            }]

            with (
                patch.object(RESCUE, "record_path", return_value=path),
                patch.object(RESCUE, "blob_read_back") as read_back,
                patch.object(RESCUE, "upload") as upload,
                patch.object(
                    RESCUE,
                    "download_slack_file",
                    return_value={
                        "size": 14,
                        "sha256": "a" * 64,
                        "contentType": "application/pdf",
                    },
                ) as download,
            ):
                result = RESCUE.rescue_record(row, messages)

            saved = json.loads(path.read_text())["sourceFiles"][0]
            self.assertEqual(result["urls"], ["https://blob/source.pdf"])
            self.assertTrue(saved["slackSizeVerified"])
            self.assertTrue(saved["blobReadBackVerified"])
            self.assertTrue(saved["blobReadBackVerifiedAt"])
            self.assertEqual(saved["blobReadBackSha256"], "a" * 64)
            self.assertEqual(
                saved["blobReadBackReceiptVersion"],
                RESCUE.BLOB_READ_BACK_RECEIPT_VERSION,
            )
            self.assertEqual(
                saved["blobReadBackIdentity"],
                f"{'a' * 64}:application/pdf",
            )
            read_back.assert_called_once()
            upload.assert_not_called()
            download.assert_called_once()

    def test_same_size_wrong_existing_blob_is_replaced_from_fresh_slack_bytes(self):
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "ref-old.json"
            path.write_text(json.dumps({
                "id": "ref-old",
                "sourceFiles": [{
                    "filename": "source.pdf",
                    "slackFileId": "F123",
                    "slackMessageTs": "1.0",
                    "blobUrl": "https://blob/wrong.pdf",
                    "size": 5,
                    "sha256": "a" * 64,
                    "contentType": "application/pdf",
                }],
            }))
            row = {"record_id": "ref-old", "slack_ts": "1.0"}
            messages = [{
                "ts": "1.0",
                "files": [{
                    "id": "F123",
                    "name": "source.pdf",
                    "size": 5,
                    "mimetype": "application/pdf",
                }],
            }]
            with (
                patch.object(RESCUE, "record_path", return_value=path),
                patch.object(
                    RESCUE,
                    "download_slack_file",
                    return_value={
                        "size": 5,
                        "sha256": "b" * 64,
                        "contentType": "application/pdf",
                    },
                ) as download,
                patch.object(
                    RESCUE, "upload", return_value="https://blob/fresh.pdf"
                ) as upload,
                patch.object(RESCUE, "blob_read_back") as read_back,
            ):
                RESCUE.rescue_record(row, messages)

            [saved] = json.loads(path.read_text())["sourceFiles"]
            self.assertEqual(saved["sha256"], "b" * 64)
            self.assertEqual(saved["blobUrl"], "https://blob/fresh.pdf")
            download.assert_called_once()
            upload.assert_called_once()
            read_back.assert_called_once_with(
                "https://blob/fresh.pdf", 5, "b" * 64, "application/pdf"
            )

    def test_rescue_keeps_same_file_id_at_two_slack_timestamps(self):
        with tempfile.TemporaryDirectory() as raw:
            path = Path(raw) / "ref-shared.json"
            path.write_text(json.dumps({"id": "ref-shared", "sourceFiles": []}))
            row = {"record_id": "ref-shared", "slack_ts": "1.0"}
            messages = [
                {
                    "ts": "1.0",
                    "files": [{"id": "F-SHARED", "name": "same.pdf", "size": 5}],
                },
                {
                    "ts": "2.0",
                    "thread_ts": "1.0",
                    "files": [{"id": "F-SHARED", "name": "same.pdf", "size": 5}],
                },
            ]
            receipt = {
                "size": 5,
                "sha256": "a" * 64,
                "contentType": "application/pdf",
            }
            with (
                patch.object(RESCUE, "record_path", return_value=path),
                patch.object(RESCUE, "download_slack_file", return_value=receipt),
                patch.object(
                    RESCUE,
                    "upload",
                    side_effect=["https://blob/one.pdf", "https://blob/two.pdf"],
                ),
                patch.object(RESCUE, "blob_read_back"),
            ):
                result = RESCUE.rescue_record(row, messages)

            sources = json.loads(path.read_text())["sourceFiles"]
            self.assertEqual(result["files"], 2)
            self.assertEqual(
                [
                    (source["slackMessageTs"], source["slackFileId"])
                    for source in sources
                ],
                [("1.0", "F-SHARED"), ("2.0", "F-SHARED")],
            )


if __name__ == "__main__":
    unittest.main()
