#!/usr/bin/env python3
"""Focused tests for the ingestion-wave Slack closeout."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import URLError


SCRIPT = Path(__file__).with_name("finalize-ingestion-wave.py")
SPEC = importlib.util.spec_from_file_location("finalize_ingestion_wave", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class FakeSlack:
    def __init__(self, posted_user="BOT"):
        self.thread_messages = []
        self.channel_messages = []
        self.messages = {
            "1.0": {
                "ts": "1.0",
                "files": [{"id": "F1", "size": 10, "name": "source.pdf"}],
                "reactions": [],
            }
        }
        self.next_ts = 10
        self.posted_user = posted_user

    def __call__(self, method, params):
        if method == "conversations.replies":
            return {"ok": True, "messages": list(self.thread_messages)}
        if method == "conversations.history":
            return {"ok": True, "messages": list(self.channel_messages)}
        if method == "chat.postMessage":
            self.next_ts += 1
            message = {
                "ts": str(self.next_ts),
                "text": params["text"],
                "user": self.posted_user,
            }
            if params.get("thread_ts"):
                self.thread_messages.append(message)
            else:
                self.channel_messages.append(message)
            return {"ok": True, "ts": message["ts"]}
        if method == "reactions.get":
            return {"ok": True, "message": self.messages[params["timestamp"]]}
        if method == "reactions.add":
            message = self.messages[params["timestamp"]]
            message["reactions"] = [{"name": "ship", "users": ["BOT"]}]
            return {"ok": True}
        raise AssertionError(method)


class FinalizeWaveTests(unittest.TestCase):
    @staticmethod
    def source(
        timestamp: str,
        file_id: str,
        *,
        record_id: str = "ref-1",
        size: int = 10,
        receipt: bool = True,
    ) -> dict:
        source = {
            "filename": f"{file_id}.pdf",
            "slackFileId": file_id,
            "slackMessageTs": timestamp,
            "blobUrl": (
                f"https://{MODULE.EXPECTED_BLOB_HOST}/"
                f"inspo/{record_id}/{file_id}.pdf"
            ),
            "sha256": "a" * 64,
            "size": size,
            "contentType": "application/pdf",
        }
        if receipt:
            source.update({
                "slackDeclaredSize": size,
                "slackSizeVerified": True,
                "blobReadBackVerified": True,
                "blobReadBackVerifiedAt": "2026-08-02T00:00:00+00:00",
                "blobReadBackSize": size,
                "blobReadBackSha256": "a" * 64,
                "blobReadBackContentType": "application/pdf",
            })
        return source

    def test_non_idempotent_slack_write_is_not_retried_after_transport_failure(self):
        with (
            patch.dict(MODULE.os.environ, {"SLACK_BOT_TOKEN": "test"}),
            patch.object(MODULE, "urlopen", side_effect=URLError("lost response")) as opener,
            patch.object(MODULE.time, "sleep"),
        ):
            with self.assertRaisesRegex(MODULE.FinalizeError, "ambiguous transport failure"):
                MODULE.slack_api("chat.postMessage", {"channel": "C", "text": "hello"})

        self.assertEqual(opener.call_count, 1)

    def test_idempotent_slack_read_still_retries_transport_failure(self):
        with (
            patch.dict(MODULE.os.environ, {"SLACK_BOT_TOKEN": "test"}),
            patch.object(MODULE, "urlopen", side_effect=URLError("offline")) as opener,
            patch.object(MODULE.time, "sleep"),
        ):
            with self.assertRaisesRegex(MODULE.FinalizeError, "request failed"):
                MODULE.slack_api("conversations.history", {"channel": "C"})

        self.assertEqual(opener.call_count, 3)

    def test_closeout_thread_can_differ_from_canonical_record_identity(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            plan = root / "plan.json"
            messages = root / "messages.json"
            plan.write_text(json.dumps({"records": [{
                "id": "ref-1",
                "kind": "reference",
                "sourceMessageTs": "2.0",
                "coversMessageTs": ["1.0"],
                "recordSourceMessageTs": "1.0",
                "recordCoversMessageTs": ["2.0"],
            }]}))
            messages.write_text(json.dumps({"records": {"ref-1": {
                "threadReply": "Captured duplicate.\n\nIngestion record: `ref-1`"
            }}}))

            wave = MODULE.load_wave(plan, messages)

            self.assertEqual(wave[0]["sourceMessageTs"], "2.0")
            self.assertEqual(wave[0]["coveredTs"], ["2.0", "1.0"])
            self.assertEqual(wave[0]["recordSourceMessageTs"], "1.0")
            self.assertEqual(wave[0]["recordCoversMessageTs"], ["2.0"])

    def test_invalid_canonical_record_identity_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            plan = root / "plan.json"
            messages = root / "messages.json"
            plan.write_text(json.dumps({"records": [{
                "id": "ref-1",
                "kind": "reference",
                "sourceMessageTs": "2.0",
                "coversMessageTs": [],
                "recordSourceMessageTs": "",
            }]}))
            messages.write_text(json.dumps({"records": {"ref-1": {
                "threadReply": "Captured.\n\nIngestion record: `ref-1`"
            }}}))

            with self.assertRaisesRegex(MODULE.FinalizeError, "record Slack timestamp"):
                MODULE.load_wave(plan, messages)

    def test_every_covered_timestamp_must_have_durably_retained_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "record.json"
            path.write_text(json.dumps({
                "id": "ref-1",
                "sourceMessageTs": "1.0",
                "coversMessageTs": ["2.0"],
                "sourceFiles": [self.source("1.0", "F1")],
            }))
            row = {
                "id": "ref-1",
                "kind": "reference",
                "sourceMessageTs": "1.0",
                "coversMessageTs": ["2.0"],
                "coveredTs": ["1.0", "2.0"],
                "retainedTs": ["1.0", "2.0"],
            }
            expected = {
                "1.0": [{"id": "F1", "size": 10, "name": "one.pdf"}],
                "2.0": [{"id": "F2", "size": 20, "name": "two.pdf"}],
            }
            with patch.object(MODULE, "record_path", return_value=path):
                with self.assertRaisesRegex(MODULE.FinalizeError, "Slack file occurrence.*F2"):
                    MODULE.verify_record_slack_identity(row, expected)

            record = json.loads(path.read_text())
            second = self.source("2.0", "F2", size=20)
            second["sha256"] = "b" * 64
            second["blobReadBackSha256"] = "b" * 64
            record["sourceFiles"].append(second)
            path.write_text(json.dumps(record))
            with patch.object(MODULE, "record_path", return_value=path):
                self.assertEqual(MODULE.verify_record_slack_identity(row, expected), path)

    def test_every_file_in_one_slack_message_must_have_one_source_occurrence(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "record.json"
            path.write_text(json.dumps({
                "id": "ref-1",
                "sourceMessageTs": "1.0",
                "coversMessageTs": [],
                "sourceFiles": [self.source("1.0", "F1")],
            }))
            row = {
                "id": "ref-1",
                "kind": "reference",
                "sourceMessageTs": "1.0",
                "coversMessageTs": [],
                "retainedTs": ["1.0"],
            }
            expected = {"1.0": [
                {"id": "F1", "size": 10, "name": "one.pdf"},
                {"id": "F2", "size": 10, "name": "two.pdf"},
            ]}
            with patch.object(MODULE, "record_path", return_value=path):
                with self.assertRaisesRegex(MODULE.FinalizeError, "Slack file occurrence.*F2"):
                    MODULE.verify_record_slack_identity(row, expected)

    def test_blob_source_url_requires_https_pinned_host_and_exact_record_path(self):
        row = {
            "id": "ref-1",
            "kind": "reference",
            "sourceMessageTs": "1.0",
            "coversMessageTs": [],
            "retainedTs": ["1.0"],
        }
        expected = {"1.0": [{"id": "F1", "size": 10, "name": "one.pdf"}]}
        bad_urls = [
            f"http://{MODULE.EXPECTED_BLOB_HOST}/inspo/ref-1/F1.pdf",
            f"https://{MODULE.EXPECTED_BLOB_HOST}/inspo/ref-2/F1.pdf",
            f"//{MODULE.EXPECTED_BLOB_HOST}/inspo/ref-1/F1.pdf",
        ]
        for url in bad_urls:
            with self.subTest(url=url), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / "record.json"
                source = self.source("1.0", "F1")
                source["blobUrl"] = url
                path.write_text(json.dumps({
                    "id": "ref-1",
                    "sourceMessageTs": "1.0",
                    "coversMessageTs": [],
                    "sourceFiles": [source],
                }))
                with patch.object(MODULE, "record_path", return_value=path):
                    with self.assertRaisesRegex(MODULE.FinalizeError, "exact Homa Blob path"):
                        MODULE.verify_record_slack_identity(row, expected)

    def test_missing_persisted_receipt_performs_fresh_blob_read_back(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "record.json"
            source = self.source("1.0", "F1", receipt=False)
            path.write_text(json.dumps({
                "id": "ref-1",
                "sourceMessageTs": "1.0",
                "coversMessageTs": [],
                "sourceFiles": [source],
            }))
            row = {
                "id": "ref-1",
                "kind": "reference",
                "sourceMessageTs": "1.0",
                "coversMessageTs": [],
                "retainedTs": ["1.0"],
            }
            expected = {"1.0": [{"id": "F1", "size": 10, "name": "one.pdf"}]}
            with (
                patch.object(MODULE, "record_path", return_value=path),
                patch.object(MODULE, "verify_blob_source_read_back") as read_back,
            ):
                self.assertEqual(MODULE.verify_record_slack_identity(row, expected), path)
            read_back.assert_called_once_with("ref-1", source)

    def test_slack_file_expectations_read_every_attachment_from_exact_messages(self):
        fake = FakeSlack()
        fake.messages["2.0"] = {
            "ts": "2.0",
            "files": [
                {"id": "F2", "size": 20, "name": "two.pdf"},
                {"id": "F3", "size": 30, "name": "three.pdf"},
            ],
            "reactions": [],
        }

        expected = MODULE.slack_file_expectations(["1.0", "2.0"], fake)

        self.assertEqual([file["id"] for file in expected["1.0"]], ["F1"])
        self.assertEqual([file["id"] for file in expected["2.0"]], ["F2", "F3"])

    def test_finalize_row_passes_live_slack_file_inventory_to_identity_check(self):
        row = {
            "id": "ref-1",
            "kind": "reference",
            "sourceMessageTs": "1.0",
            "coversMessageTs": [],
            "retainedTs": ["1.0"],
            "coveredTs": ["1.0"],
            "threadReply": "Captured.\n\nIngestion record: `ref-1`",
        }
        expected = {"1.0": [{"id": "F1", "size": 10, "name": "one.pdf"}]}
        fake = FakeSlack()
        with (
            patch.object(MODULE, "slack_file_expectations", return_value=expected) as inventory,
            patch.object(MODULE, "verify_record_slack_identity", return_value=Path("record.json")) as identity,
            patch.object(MODULE, "run_verifier"),
            patch.object(MODULE, "ensure_message", return_value=None),
            patch.object(MODULE, "ensure_ship_reaction", return_value=False),
        ):
            MODULE.finalize_row(row, "BOT", apply=False, api_call=fake)

        inventory.assert_called_once_with(["1.0"], fake)
        identity.assert_called_once_with(row, expected)

    def test_capture_timestamps_narrow_retention_to_attachment_messages(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            plan = root / "plan.json"
            messages = root / "messages.json"
            plan.write_text(json.dumps({"records": [{
                "id": "ref-1",
                "kind": "reference",
                "sourceMessageTs": "1.0",
                "coversMessageTs": ["2.0"],
                "captureMessageTs": ["2.0"],
            }]}))
            messages.write_text(json.dumps({"records": {"ref-1": {
                "threadReply": "Captured.\n\nIngestion record: `ref-1`"
            }}}))

            [row] = MODULE.load_wave(plan, messages)

            self.assertEqual(row["coveredTs"], ["1.0", "2.0"])
            self.assertEqual(row["retainedTs"], ["2.0"])

    def test_closed_set_and_visible_markers_are_required(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            plan = root / "plan.json"
            messages = root / "messages.json"
            plan.write_text(json.dumps({"records": [{
                "id": "ref-1", "kind": "reference", "sourceMessageTs": "1.0",
                "coversMessageTs": [],
            }]}))
            messages.write_text(json.dumps({"records": {"ref-1": {
                "threadReply": "Done without the required footer"
            }}}))
            with self.assertRaisesRegex(MODULE.FinalizeError, "missing its ingestion marker"):
                MODULE.load_wave(plan, messages)

    def test_one_slack_timestamp_cannot_belong_to_two_records(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            plan = root / "plan.json"
            messages = root / "messages.json"
            plan.write_text(json.dumps({"records": [
                {
                    "id": "ref-1", "kind": "reference",
                    "sourceMessageTs": "1.0", "coversMessageTs": [],
                },
                {
                    "id": "ref-2", "kind": "reference",
                    "sourceMessageTs": "2.0", "coversMessageTs": ["1.0"],
                },
            ]}))
            messages.write_text(json.dumps({"records": {
                "ref-1": {"threadReply": "One\n\nIngestion record: `ref-1`"},
                "ref-2": {"threadReply": "Two\n\nIngestion record: `ref-2`"},
            }}))
            with self.assertRaisesRegex(MODULE.FinalizeError, "belongs to both"):
                MODULE.load_wave(plan, messages)

    def test_foreign_marker_is_ignored_and_bot_posts_canonical_message(self):
        fake = FakeSlack()
        text = "Captured and learned.\n\nIngestion record: `ref-1`"
        fake.thread_messages.append({
            "ts": "9",
            "text": "Human note.\n\nIngestion record: `ref-1`",
            "user": "HUMAN",
        })

        posted = MODULE.ensure_message(
            channel="C", text=text, record_id="ref-1", bot_user_id="BOT",
            thread_ts="1.0", apply=True, api_call=fake,
        )

        self.assertEqual(posted, "11")
        self.assertEqual(len(fake.thread_messages), 2)
        self.assertEqual(fake.thread_messages[-1]["user"], "BOT")

    def test_bot_marker_is_reused(self):
        fake = FakeSlack()
        text = "Captured and learned.\n\nIngestion record: `ref-1`"
        fake.thread_messages.append({"ts": "9", "text": text, "user": "BOT"})

        existing = MODULE.ensure_message(
            channel="C", text=text, record_id="ref-1", bot_user_id="BOT",
            thread_ts="1.0", apply=True, api_call=fake,
        )

        self.assertEqual(existing, "9")
        self.assertEqual(len(fake.thread_messages), 1)

    def test_duplicate_bot_markers_are_rejected(self):
        fake = FakeSlack()
        text = "Captured and learned.\n\nIngestion record: `ref-1`"
        fake.thread_messages.extend([
            {"ts": "8", "text": text, "user": "BOT"},
            {"ts": "9", "text": text, "user": "BOT"},
        ])

        with self.assertRaisesRegex(MODULE.FinalizeError, "duplicate bot-owned"):
            MODULE.ensure_message(
                channel="C", text=text, record_id="ref-1", bot_user_id="BOT",
                thread_ts="1.0", apply=True, api_call=fake,
            )

    def test_posted_readback_must_be_owned_by_authenticated_bot(self):
        fake = FakeSlack(posted_user="OTHER-BOT")
        text = "Captured and learned.\n\nIngestion record: `ref-1`"

        with self.assertRaisesRegex(MODULE.FinalizeError, "failed Slack read-back"):
            MODULE.ensure_message(
                channel="C", text=text, record_id="ref-1", bot_user_id="BOT",
                thread_ts="1.0", apply=True, api_call=fake,
            )

        self.assertEqual(fake.thread_messages[0]["user"], "OTHER-BOT")

    def test_bot_marker_text_must_still_match_config(self):
        fake = FakeSlack()
        fake.thread_messages.append({
            "ts": "9",
            "text": "Old copy.\n\nIngestion record: `ref-1`",
            "user": "BOT",
        })

        with self.assertRaisesRegex(MODULE.FinalizeError, "text differs from config"):
            MODULE.ensure_message(
                channel="C",
                text="New copy.\n\nIngestion record: `ref-1`",
                record_id="ref-1",
                bot_user_id="BOT",
                thread_ts="1.0",
                apply=True,
                api_call=fake,
            )

    def test_reaction_writes_are_idempotent_and_owned(self):
        fake = FakeSlack()
        self.assertTrue(MODULE.ensure_ship_reaction(
            "C", "1.0", "BOT", apply=True, api_call=fake,
        ))
        self.assertTrue(MODULE.ensure_ship_reaction(
            "C", "1.0", "BOT", apply=True, api_call=fake,
        ))
        self.assertEqual(len(fake.messages["1.0"]["reactions"]), 1)

    def test_receipts_round_trip_without_losing_record_content(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "record.json"
            path.write_text(json.dumps({"id": "cur-1", "name": "A", "stages": {}}))
            MODULE.persist_receipts(
                path, slack_reply_ts="2.0", dev_summary_ts="3.0", ship_reaction=True
            )
            record = json.loads(path.read_text())
            self.assertEqual(record["name"], "A")
            self.assertEqual(record["stages"]["slackReplyTs"], "2.0")
            self.assertEqual(record["stages"]["devSummaryTs"], "3.0")
            self.assertTrue(record["stages"]["shipReaction"])


if __name__ == "__main__":
    unittest.main()
