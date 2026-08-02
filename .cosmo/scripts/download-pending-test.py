#!/usr/bin/env python3
"""Focused regressions for pending Slack capture."""

import importlib.util
import tempfile
import unittest
from pathlib import Path
from urllib.error import HTTPError, URLError
from unittest.mock import patch


SCRIPT = Path(__file__).with_name("download-pending.py")
SPEC = importlib.util.spec_from_file_location("download_pending", SCRIPT)
DOWNLOAD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DOWNLOAD)


class FakeResponse:
    def __init__(self, body: bytes):
        self.status = 200
        self.chunks = [body, b""]

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def read(self, _size: int) -> bytes:
        return self.chunks.pop(0)


class InterruptedResponse(FakeResponse):
    def __init__(self):
        self.status = 200
        self.sent = False

    def read(self, _size: int) -> bytes:
        if not self.sent:
            self.sent = True
            return b"fr"
        raise URLError("connection interrupted")


class DownloadPendingTest(unittest.TestCase):
    def test_fetch_messages_paginates_thread_replies(self):
        calls = []

        def slack_api(method, token, **params):
            self.assertEqual(token, "token")
            cursor = params.get("cursor", "")
            calls.append((method, cursor))
            pages = {
                ("conversations.history", ""): {
                    "messages": [{"ts": "parent", "reply_count": 2}],
                    "response_metadata": {"next_cursor": ""},
                },
                ("conversations.replies", ""): {
                    "messages": [
                        {"ts": "parent"},
                        {"ts": "other-reply", "thread_ts": "parent"},
                    ],
                    "response_metadata": {"next_cursor": "replies-2"},
                },
                ("conversations.replies", "replies-2"): {
                    "messages": [
                        {"ts": "target-reply", "thread_ts": "parent"},
                    ],
                    "response_metadata": {"next_cursor": ""},
                },
            }
            return pages[(method, cursor)]

        with (
            patch.object(DOWNLOAD, "slack_api", side_effect=slack_api),
            patch.object(DOWNLOAD.time, "sleep"),
        ):
            messages = DOWNLOAD.fetch_messages("token", {"target-reply"})

        self.assertEqual(set(messages), {"target-reply"})
        self.assertEqual(
            calls,
            [
                ("conversations.history", ""),
                ("conversations.replies", ""),
                ("conversations.replies", "replies-2"),
            ],
        )

    def test_exact_size_partial_is_deleted_and_downloaded_fresh(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            capture_root = root / "capture"
            directory = capture_root / "123.456"
            directory.mkdir(parents=True)
            partial = directory / "book-F1.pdf.part"
            partial.write_bytes(b"stale")
            requests = []

            def urlopen(request, timeout):
                self.assertEqual(timeout, 3600)
                self.assertFalse(partial.exists())
                requests.append(dict(request.header_items()))
                return FakeResponse(b"fresh")

            with (
                patch.object(DOWNLOAD, "REPO", root),
                patch.object(DOWNLOAD, "CAPTURE_ROOT", capture_root),
                patch.object(DOWNLOAD, "urlopen", side_effect=urlopen),
            ):
                result = DOWNLOAD.download_one(
                    "token",
                    "123.456",
                    {
                        "id": "F1",
                        "name": "book.pdf",
                        "size": 5,
                        "url_private_download": "https://slack.example/book.pdf",
                    },
                    {},
                )

            final = directory / "book-F1.pdf"
            self.assertEqual(final.read_bytes(), b"fresh")
            self.assertFalse(result["skipped"])
            self.assertNotIn("Range", requests[0])

    def test_short_stale_partial_is_deleted_and_downloaded_fresh(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            capture_root = root / "capture"
            directory = capture_root / "123.456"
            directory.mkdir(parents=True)
            partial = directory / "book-F1.pdf.part"
            partial.write_bytes(b"XX")
            requests = []

            def urlopen(request, timeout):
                del timeout
                self.assertFalse(partial.exists())
                requests.append(dict(request.header_items()))
                return FakeResponse(b"fresh")

            with (
                patch.object(DOWNLOAD, "REPO", root),
                patch.object(DOWNLOAD, "CAPTURE_ROOT", capture_root),
                patch.object(DOWNLOAD, "urlopen", side_effect=urlopen),
            ):
                DOWNLOAD.download_one(
                    "token",
                    "123.456",
                    {
                        "id": "F1",
                        "name": "book.pdf",
                        "size": 5,
                        "url_private_download": "https://slack.example/book.pdf",
                    },
                    {},
                )

            self.assertEqual(len(requests), 1)
            self.assertNotIn("Range", requests[0])
            self.assertEqual((directory / "book-F1.pdf").read_bytes(), b"fresh")

    def test_http_416_discards_same_invocation_partial_before_retry(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            capture_root = root / "capture"
            directory = capture_root / "123.456"
            requests = []

            def urlopen(request, timeout):
                del timeout
                requests.append(dict(request.header_items()))
                if len(requests) == 1:
                    return InterruptedResponse()
                if len(requests) == 2:
                    raise HTTPError(request.full_url, 416, "range", None, None)
                return FakeResponse(b"fresh")

            with (
                patch.object(DOWNLOAD, "REPO", root),
                patch.object(DOWNLOAD, "CAPTURE_ROOT", capture_root),
                patch.object(DOWNLOAD, "urlopen", side_effect=urlopen),
                patch.object(DOWNLOAD.time, "sleep"),
            ):
                DOWNLOAD.download_one(
                    "token",
                    "123.456",
                    {
                        "id": "F1",
                        "name": "book.pdf",
                        "size": 5,
                        "url_private_download": "https://slack.example/book.pdf",
                    },
                    {},
                )

            self.assertNotIn("Range", requests[0])
            self.assertIn("Range", requests[1])
            self.assertNotIn("Range", requests[2])
            self.assertEqual((directory / "book-F1.pdf").read_bytes(), b"fresh")


if __name__ == "__main__":
    unittest.main()
