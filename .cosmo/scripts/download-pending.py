#!/usr/bin/env python3
"""Download unresolved #homa-inspo files into the ignored capture workspace.

This tool does capture only. It never assigns a reference or curriculum id,
uploads to Blob, writes an analysis, or reacts in Slack. Those steps require
the ingestion skill's routing judgment. Files are keyed by Slack message ts,
the one identity shared by the snapshot, ledger, and eventual analysis.

Usage:
    python3 .cosmo/scripts/download-pending.py [--since YYYY-MM-DD] [--jobs N]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


COSMO = Path(__file__).resolve().parent.parent
REPO = COSMO.parent
LEDGER = COSMO / "ingestion-ledger.json"
CAPTURE_ROOT = COSMO / "inspo-files" / "slack"
CHANNEL = "C0BHQDC033M"


def load_local_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        if key and key not in os.environ:
            os.environ[key] = value.strip().strip('"').strip("'")


def slack_api(method: str, token: str, **params: object) -> dict:
    url = f"https://slack.com/api/{method}?{urllib.parse.urlencode(params)}"
    request = Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urlopen(request, timeout=120) as response:
            data = json.loads(response.read().decode("utf-8") or "{}")
    except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Slack {method} transport failed: {type(error).__name__}") from error
    if not data.get("ok"):
        raise RuntimeError(f"Slack {method} failed: {data.get('error', 'unknown_error')}")
    return data


def target_timestamps(since: str) -> set[str]:
    rows = json.loads(LEDGER.read_text()).get("rows", [])
    return {
        str(row["slack_ts"])
        for row in rows
        if str(row.get("date", "")) >= since
        and row.get("status") not in {"complete", "legacy", "excluded"}
    }


def paginated_messages(method: str, token: str, **params: object) -> list[dict]:
    """Read every Slack message page and reject a stuck cursor."""
    messages: list[dict] = []
    cursor: str | None = None
    seen_cursors: set[str] = set()
    while True:
        request_params = {**params, "limit": 200}
        if cursor:
            request_params["cursor"] = cursor
        page = slack_api(method, token, **request_params)
        messages.extend(page.get("messages") or [])
        next_cursor = str(
            (page.get("response_metadata") or {}).get("next_cursor") or ""
        ).strip()
        if not next_cursor:
            return messages
        if next_cursor in seen_cursors:
            raise RuntimeError(f"Slack {method} repeated pagination cursor")
        seen_cursors.add(next_cursor)
        cursor = next_cursor
        time.sleep(1.1)


def fetch_messages(token: str, targets: set[str]) -> dict[str, dict]:
    messages: dict[str, dict] = {}
    parents = paginated_messages("conversations.history", token, channel=CHANNEL)

    for message in parents:
        ts = str(message.get("ts", ""))
        if ts in targets:
            messages[ts] = message
        if not ts or not message.get("reply_count"):
            continue
        replies = paginated_messages(
            "conversations.replies",
            token,
            channel=CHANNEL,
            ts=ts,
        )
        for reply in replies:
            reply_ts = str(reply.get("ts", ""))
            if reply_ts != ts and reply_ts in targets:
                messages[reply_ts] = reply
        time.sleep(1.1)
    return messages


def safe_name(value: str) -> str:
    return Path(value.replace("\\", "/")).name.replace("/", "_") or "file.bin"


def capture_name(value: str, file_id: object) -> str:
    name = safe_name(value)
    identity = re.sub(r"[^A-Za-z0-9_-]", "_", str(file_id or ""))
    if not identity:
        raise RuntimeError("Slack attachment has no file ID")
    suffix = Path(name).suffix
    stem = name[: -len(suffix)] if suffix else name
    return f"{stem}-{identity}{suffix}"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_one(token: str, ts: str, file: dict, trusted: dict[str, dict]) -> dict:
    expected = int(file.get("size") or 0)
    name = safe_name(str(file.get("name") or file.get("title") or "file.bin"))
    local_name = capture_name(name, file.get("id"))
    directory = CAPTURE_ROOT / ts
    directory.mkdir(parents=True, exist_ok=True)
    final = directory / local_name
    partial = final.with_suffix(final.suffix + ".part")
    url = file.get("url_private_download") or file.get("url_private")
    if not url:
        raise RuntimeError(f"{ts} {name}: Slack returned no download URL")

    prior = trusted.get(str(file.get("id") or ""))
    relative_final = str(final.relative_to(REPO))
    trusted_final = (
        final.exists()
        and prior is not None
        and prior.get("ts") == ts
        and prior.get("localPath") == relative_final
        and prior.get("size") == final.stat().st_size
        and prior.get("sha256") == sha256(final)
        and (not expected or final.stat().st_size == expected)
    )
    if trusted_final:
        return {
            "ts": ts,
            "fileId": file.get("id"),
            "name": name,
            "size": final.stat().st_size,
            "sha256": sha256(final),
            "localPath": relative_final,
            "filetype": file.get("filetype"),
            "mimetype": file.get("mimetype"),
            "skipped": True,
        }
    final.unlink(missing_ok=True)
    # A partial from an earlier process has no byte identity, ETag, or other
    # receipt binding it to this Slack object. Starting from it could splice
    # stale bytes onto a valid Range response and still hit the expected size.
    # Retries within this call may resume the prefix they just downloaded, but
    # every new invocation starts from Slack byte zero.
    partial.unlink(missing_ok=True)
    last_error = None
    for attempt in range(1, 6):
        offset = partial.stat().st_size if partial.exists() else 0
        headers = {"Authorization": f"Bearer {token}"}
        if offset:
            headers["Range"] = f"bytes={offset}-"
        try:
            with urlopen(Request(str(url), headers=headers), timeout=3600) as response:
                append = offset > 0 and getattr(response, "status", 200) == 206
                with partial.open("ab" if append else "wb") as handle:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        handle.write(chunk)
            last_error = None
            break
        except (HTTPError, URLError, TimeoutError, OSError) as error:
            last_error = error
            if isinstance(error, HTTPError) and error.code == 416:
                partial.unlink(missing_ok=True)
            if attempt < 5:
                time.sleep(attempt * 2)
    if last_error is not None:
        raise RuntimeError(f"{ts} {name}: download failed: {type(last_error).__name__}") from last_error
    actual = partial.stat().st_size if partial.exists() else 0
    if expected and actual != expected:
        raise RuntimeError(f"{ts} {name}: expected {expected} bytes, downloaded {actual}")
    partial.replace(final)
    return {
        "ts": ts,
        "fileId": file.get("id"),
        "name": name,
        "size": actual,
        "sha256": sha256(final),
        "localPath": relative_final,
        "filetype": file.get("filetype"),
        "mimetype": file.get("mimetype"),
        "skipped": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--since", default="2026-07-29")
    parser.add_argument("--jobs", type=int, default=3)
    args = parser.parse_args()

    load_local_env(COSMO / ".env")
    token = os.environ.get("SLACK_BOT_TOKEN")
    if not token:
        print("ERROR: SLACK_BOT_TOKEN is required")
        return 2
    if not LEDGER.exists():
        print("ERROR: refresh and generate ingestion-ledger.json first")
        return 2

    targets = target_timestamps(args.since)
    messages = fetch_messages(token, targets)
    missing = sorted(targets - messages.keys(), key=float)
    if missing:
        print(f"ERROR: {len(missing)} target message(s) were not returned by Slack")
        for ts in missing:
            print(f"  missing {ts}")
        return 1

    jobs: list[tuple[str, dict]] = []
    for ts in sorted(messages, key=float):
        for file in messages[ts].get("files", []):
            jobs.append((ts, file))
    print(f"capture targets: {len(targets)} messages, {len(jobs)} files")

    trusted: dict[str, dict] = {}
    manifest_path = CAPTURE_ROOT / "manifest.json"
    if manifest_path.exists():
        try:
            previous = json.loads(manifest_path.read_text())
            trusted = {
                str(item["fileId"]): item
                for item in (previous.get("files") or [])
                if item.get("fileId")
            }
        except (OSError, json.JSONDecodeError):
            trusted = {}

    results: list[dict] = []
    failures: list[str] = []
    with ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
        futures = {
            pool.submit(download_one, token, ts, file, trusted): (ts, file.get("name", "?"))
            for ts, file in jobs
        }
        for future in as_completed(futures):
            ts, name = futures[future]
            try:
                item = future.result()
                results.append(item)
                verb = "kept" if item["skipped"] else "saved"
                print(f"  {verb} {ts}  {item['size'] / 1048576:7.1f}MB  {name}")
            except Exception as error:
                failures.append(str(error))
                print(f"  FAIL {ts}  {name}: {error}")

    manifest = {
        "channel": CHANNEL,
        "since": args.since,
        "messages": len(targets),
        "files": sorted(results, key=lambda item: (float(item["ts"]), item["name"])),
        "failures": failures,
    }
    CAPTURE_ROOT.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=CAPTURE_ROOT, delete=False) as handle:
        json.dump(manifest, handle, indent=2)
        handle.write("\n")
        temp_path = Path(handle.name)
    temp_path.replace(manifest_path)

    total = sum(item["size"] for item in results)
    print(
        f"done: {len(results)}/{len(jobs)} files, {total / 1073741824:.3f} GiB, "
        f"{len(failures)} failure(s)"
    )
    print(f"manifest: {manifest_path}")
    return 1 if failures or len(results) != len(jobs) else 0


if __name__ == "__main__":
    raise SystemExit(main())
