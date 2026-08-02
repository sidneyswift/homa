#!/usr/bin/env python3
"""Focused namespace and path-safety regressions for blob-upload.sh."""

import os
import subprocess
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("blob-upload.sh")
STORE_ID = "pkvvudjdhxk33dig"


class BlobUploadTest(unittest.TestCase):
    def run_upload(self, *args: str) -> tuple[subprocess.CompletedProcess[str], str]:
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            source = root / "lesson notes.txt"
            source.write_text("captured text\n", encoding="utf-8")
            recorded_args = root / "curl-args.txt"
            fake_curl = root / "curl"
            fake_curl.write_text(
                """#!/bin/sh
printf '%s\\n' "$@" > "$FAKE_CURL_ARGS"
for arg in "$@"; do
  case "$arg" in
    https://blob.vercel-storage.com/*) endpoint="$arg" ;;
  esac
done
pathname=${endpoint#https://blob.vercel-storage.com/}
printf '{"url":"https://%s.public.blob.vercel-storage.com/%s"}' "$FAKE_STORE_ID" "$pathname"
""",
                encoding="utf-8",
            )
            fake_curl.chmod(0o755)
            env = {
                **os.environ,
                "PATH": f"{root}:{os.environ['PATH']}",
                "BLOB_READ_WRITE_TOKEN": f"vercel_blob_rw_{STORE_ID}_test",
                "FAKE_CURL_ARGS": str(recorded_args),
                "FAKE_STORE_ID": STORE_ID,
            }
            expanded = [str(source) if arg == "SOURCE" else arg for arg in args]
            result = subprocess.run(
                ["bash", str(SCRIPT), *expanded],
                check=False,
                capture_output=True,
                text=True,
                env=env,
            )
            curl_args = recorded_args.read_text("utf-8") if recorded_args.exists() else ""
            return result, curl_args

    def test_default_mode_stays_in_library_original_namespace(self):
        result, curl_args = self.run_upload("ref-2026-07-31-example", "SOURCE")

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            result.stdout.strip(),
            f"https://{STORE_ID}.public.blob.vercel-storage.com/"
            "inspo/ref-2026-07-31-example/lesson%20notes.txt",
        )
        self.assertIn("application/octet-stream", curl_args)

    def test_text_mode_uses_non_library_namespace_and_text_content_type(self):
        result, curl_args = self.run_upload(
            "--text", "cur-2026-07-31-example", "SOURCE"
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            result.stdout.strip(),
            f"https://{STORE_ID}.public.blob.vercel-storage.com/"
            "inspo-text/cur-2026-07-31-example/lesson%20notes.txt",
        )
        self.assertIn("text/plain; charset=utf-8", curl_args)

    def test_record_id_cannot_escape_selected_namespace(self):
        result, curl_args = self.run_upload("--text", "../other-prefix", "SOURCE")

        self.assertEqual(result.returncode, 2)
        self.assertIn("record id must contain only", result.stderr)
        self.assertEqual(curl_args, "")

        for record_id in (".", ".."):
            result, curl_args = self.run_upload("--text", record_id, "SOURCE")
            self.assertEqual(result.returncode, 2)
            self.assertIn("record id must contain only", result.stderr)
            self.assertEqual(curl_args, "")

    def test_unknown_options_fail_closed(self):
        result, curl_args = self.run_upload("--namespace", "SOURCE")

        self.assertEqual(result.returncode, 2)
        self.assertIn("unknown option", result.stderr)
        self.assertEqual(curl_args, "")


if __name__ == "__main__":
    unittest.main()
