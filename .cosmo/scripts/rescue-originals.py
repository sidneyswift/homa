#!/usr/bin/env python3
"""
rescue-originals.py: pull missing Slack originals into Homa's Blob store.

The script changes capture provenance only. It never re-analyses a record,
edits an analysis judgment, or deletes an original. Every download must match
Slack's declared byte size. Every upload is then downloaded from its public
Blob URL and checked against the same size and SHA256 before sourceFiles is
written.

Examples:
    python3 .cosmo/scripts/rescue-originals.py --record <id> --dry-run
    python3 .cosmo/scripts/rescue-originals.py \
      --record <id> --parent-ts <thread-parent-ts>

Passing --parent-ts explicitly prefers every file-bearing reply in that
thread. If there is no such reply, the original parent attachment is used.

Repeat --record and --parent-ts when several exact records share a run. Tokens
are loaded without printing them: SLACK_BOT_TOKEN from .cosmo/.env and
BLOB_READ_WRITE_TOKEN from apps/web/.env.local. Existing environment values
take precedence.
"""

import argparse
import hashlib
from http.client import HTTPException
import json
import mimetypes
import os
import re
import ssl
import subprocess
import sys
import tempfile
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

try:
    import certifi
except ImportError:  # Use the host trust store when certifi is unavailable.
    certifi = None


COSMO = Path(__file__).resolve().parent.parent
REPO = COSMO.parent
LEDGER = COSMO / "ingestion-ledger.json"
REFS_DIR = COSMO / "references"
CURS_DIR = COSMO / "curriculums"
UPLOAD = COSMO / "scripts" / "blob-upload.sh"
CHANNEL_ID = "C0BHQDC033M"
EXPECTED_BLOB_HOST = "pkvvudjdhxk33dig.public.blob.vercel-storage.com"
CHUNK_BYTES = 1 << 20
HTTPS_CONTEXT = ssl.create_default_context(cafile=certifi.where() if certifi else None)
MIME_RE = re.compile(r"^[a-z0-9][a-z0-9!#$&^_.+-]*/[a-z0-9][a-z0-9!#$&^_.+-]*$")
SOURCE_FILES_NOTE = (
    "Originals rescued from Slack into Homa's pinned Blob store by "
    "rescue-originals.py. Each sourceFiles entry records Slack identity, "
    "byte size, SHA256, MIME type, upload time, and live Blob read-back verification."
)


class RescueError(RuntimeError):
    pass


def utc_receipt() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def load_env_file(path: Path, allowed: set) -> None:
    """Load only named values, without executing the env file or printing it."""
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        key, separator, value = line.partition("=")
        if not separator or key not in allowed or os.environ.get(key):
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        if value:
            os.environ[key] = value


def load_credentials() -> None:
    load_env_file(COSMO / ".env", {"SLACK_BOT_TOKEN"})
    load_env_file(REPO / "apps" / "web" / ".env.local", {"BLOB_READ_WRITE_TOKEN"})


def record_path(item_id: str) -> Path:
    return (CURS_DIR if item_id.startswith("cur-") else REFS_DIR) / f"{item_id}.json"


def load_record(item_id: str) -> dict:
    path = record_path(item_id)
    if not path.exists():
        raise RescueError(f"record {item_id} is not present in the corpus")
    try:
        record = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise RescueError(f"record {item_id} is unreadable") from exc
    if record.get("id") != item_id:
        raise RescueError(f"record {item_id} has mismatched identity")
    return record


def record_part_timestamps(record: dict) -> list:
    """Return the canonical drop and every declared cover part in record order."""
    item_id = record.get("id") or "<unknown>"
    source_ts = record.get("sourceMessageTs")
    if not isinstance(source_ts, str) or not source_ts:
        raise RescueError(f"record {item_id} has incomplete source identity")

    covers = record.get("coversMessageTs") or []
    if not isinstance(covers, list):
        raise RescueError(f"record {item_id} has invalid coversMessageTs")

    timestamps = [source_ts]
    for timestamp in covers:
        if not isinstance(timestamp, str) or not timestamp:
            raise RescueError(f"record {item_id} has invalid coversMessageTs")
        if timestamp not in timestamps:
            timestamps.append(timestamp)
    return timestamps


def record_slack_timestamps(record: dict) -> set:
    """Return exact source-part and recovery-thread identities in the corpus."""
    timestamps = set()
    source_ts = record.get("sourceMessageTs")
    if isinstance(source_ts, str) and source_ts:
        timestamps.add(source_ts)
    covers = record.get("coversMessageTs") or []
    if isinstance(covers, list):
        timestamps.update(
            timestamp
            for timestamp in covers
            if isinstance(timestamp, str) and timestamp
        )
    recovery = record.get("originalRecovery") or {}
    if isinstance(recovery, dict):
        timestamps.add(recovery.get("requestTs"))
    completeness = record.get("sourceCompleteness") or {}
    if isinstance(completeness, dict):
        # Partial curricula ask for replacements in an exact source thread.
        # These fields identify that parent; requestTs/replyTs identify our own
        # request message and are intentionally not treated as thread roots.
        timestamps.add(completeness.get("threadTs"))
        timestamps.add(completeness.get("affectedSlackMessageTs"))
    return {timestamp for timestamp in timestamps if timestamp}


def fallback_row(record: dict, slack_ts=None) -> dict:
    item_id = record["id"]
    source_ts = slack_ts or record_part_timestamps(record)[0]
    return {
        "record_id": item_id,
        "slack_ts": source_ts,
        "blob_url": "yes" if any(
            entry.get("blobUrl") for entry in (record.get("sourceFiles") or [])
        ) else "",
        "status": "record-fallback",
    }


def select_rows(rows: list, record_ids: list) -> list:
    """Select every declared part for exact records, preserving CLI order."""
    if not record_ids:
        return [
            row
            for row in rows
            if row.get("record_id")
            and row.get("blob_url") != "yes"
            and row.get("status") != "excluded"
        ]
    wanted = list(dict.fromkeys(record_ids))
    by_id = {}
    for row in rows:
        item_id = row.get("record_id")
        if item_id:
            by_id.setdefault(item_id, []).append(row)
    selected = []
    for item_id in wanted:
        record = load_record(item_id)
        matches_by_timestamp = {}
        for row in by_id.get(item_id, []):
            timestamp = row.get("slack_ts")
            if timestamp:
                matches_by_timestamp.setdefault(str(timestamp), []).append(row)
        for timestamp in record_part_timestamps(record):
            matches = matches_by_timestamp.get(timestamp, [])
            if len(matches) > 1:
                raise RescueError(
                    f"record {item_id} has {len(matches)} ledger rows for {timestamp}"
                )
            selected.append(matches[0] if matches else fallback_row(record, timestamp))
    return selected


def explicit_record_rows(record_ids: list) -> list:
    """Build one canonical row per CLI occurrence for record-plus-parent rescue."""
    return [fallback_row(load_record(item_id)) for item_id in record_ids]


def bind_explicit_parent_rows(selected: list, parent_timestamps: list) -> list:
    """Bind one requested record to one provenance-checked Slack parent."""
    if len(selected) != len(parent_timestamps):
        raise RescueError(
            "--record and --parent-ts must have the same count when combined"
        )
    bound = []
    for row, parent_ts in zip(selected, parent_timestamps):
        record = load_record(row["record_id"])
        if parent_ts not in record_slack_timestamps(record):
            raise RescueError(
                f"Slack parent {parent_ts} is not recorded on {row['record_id']}"
            )
        bound.append({**row, "slack_ts": parent_ts, "status": "explicit-parent"})
    return bound


def select_rows_for_parent_timestamps(rows: list, parent_timestamps: list) -> list:
    """Resolve recovery parents to exactly one corpus record without filename guesses."""
    ledger_by_id = {}
    for row in rows:
        item_id = row.get("record_id")
        if item_id:
            ledger_by_id.setdefault(item_id, []).append(row)

    identity_map = {}
    records = {}
    for directory in (REFS_DIR, CURS_DIR):
        for path in directory.glob("*.json"):
            if path.name == "index.json":
                continue
            try:
                record = json.loads(path.read_text())
            except (OSError, json.JSONDecodeError) as exc:
                raise RescueError(f"record {path.name} is unreadable") from exc
            item_id = record.get("id")
            if not item_id:
                continue
            records[item_id] = record
            for timestamp in record_slack_timestamps(record):
                identity_map.setdefault(timestamp, []).append(item_id)

    selected = []
    for parent_ts in dict.fromkeys(parent_timestamps):
        item_ids = identity_map.get(parent_ts, [])
        if len(item_ids) != 1:
            raise RescueError(
                f"Slack parent {parent_ts} resolves to {len(item_ids)} corpus records"
            )
        item_id = item_ids[0]
        ledger_matches = [
            row
            for row in ledger_by_id.get(item_id, [])
            if str(row.get("slack_ts") or "") == parent_ts
        ]
        if len(ledger_matches) > 1:
            raise RescueError(
                f"record {item_id} has {len(ledger_matches)} ledger rows for {parent_ts}"
            )
        row = (
            ledger_matches[0]
            if ledger_matches
            else fallback_row(records[item_id], parent_ts)
        )
        selected.append({**row, "slack_ts": parent_ts, "status": "parent-resolved"})
    return selected


def slack_api(method: str, params: dict) -> dict:
    token = os.environ.get("SLACK_BOT_TOKEN")
    if not token:
        raise RescueError("SLACK_BOT_TOKEN is required")
    query = urlencode(params)
    request = Request(
        f"https://slack.com/api/{method}?{query}",
        headers={"Authorization": f"Bearer {token}"},
    )
    last_error = None
    payload = b""
    for attempt in range(1, 4):
        try:
            with urlopen(request, timeout=120, context=HTTPS_CONTEXT) as response:
                payload = response.read()
            break
        except (HTTPError, URLError, TimeoutError, OSError, HTTPException) as exc:
            last_error = exc
            if attempt < 3:
                time.sleep(attempt)
    else:
        raise RescueError(
            f"Slack {method} request failed: {type(last_error).__name__}"
        ) from last_error
    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise RescueError(f"Slack {method} returned invalid JSON") from exc
    if not data.get("ok"):
        raise RescueError(f"Slack {method} failed: {data.get('error', 'unknown_error')}")
    return data


def _paginated_messages(method: str, params: dict, api_call) -> list:
    messages = []
    cursor = ""
    seen_cursors = set()
    while True:
        request_params = {**params, "limit": 200}
        if cursor:
            request_params["cursor"] = cursor
        data = api_call(method, request_params)
        messages.extend(data.get("messages") or [])
        cursor = ((data.get("response_metadata") or {}).get("next_cursor") or "").strip()
        if not cursor:
            return messages
        if cursor in seen_cursors:
            raise RescueError(f"Slack {method} repeated pagination cursor")
        seen_cursors.add(cursor)


def slack_messages_by_ts(parent_timestamps: list, api_call=None) -> dict:
    """Index paginated channel history plus each requested reply thread."""
    api_call = api_call or slack_api
    messages = _paginated_messages(
        "conversations.history", {"channel": CHANNEL_ID}, api_call
    )
    for parent_ts in dict.fromkeys(parent_timestamps):
        messages.extend(
            _paginated_messages(
                "conversations.replies",
                {"channel": CHANNEL_ID, "ts": parent_ts},
                api_call,
            )
        )
    return {message["ts"]: message for message in messages if message.get("ts")}


def source_messages_for_row(row: dict, messages: dict, reply_parents: set) -> list:
    """Select the exact parent drop or all explicit file-bearing re-share replies."""
    parent_ts = row.get("slack_ts")
    if parent_ts in reply_parents:
        replies = sorted(
            (
                message
                for message in messages.values()
                if message.get("thread_ts") == parent_ts
                and message.get("ts") != parent_ts
                and message.get("files")
            ),
            key=lambda message: message["ts"],
        )
        if replies:
            return replies
    parent = messages.get(parent_ts)
    return [parent] if parent else []


def safe_filename(name: str, file_id: str) -> str:
    """One non-traversing basename suitable for a temporary file and Blob."""
    normalized = unicodedata.normalize("NFKC", name or "").replace("\\", "/")
    leaf = normalized.rsplit("/", 1)[-1]
    leaf = "".join(
        char if char.isalnum() or char in " ._()-" else "_" for char in leaf
    )
    leaf = re.sub(r"\s+", " ", leaf).strip(" .")
    if not leaf or leaf in (".", ".."):
        clean_id = re.sub(r"[^A-Za-z0-9_-]", "_", file_id or "file")
        return f"slack-{clean_id}.bin"
    if leaf.startswith("."):
        leaf = f"file{leaf}"
    if len(leaf) > 180:
        suffix = Path(leaf).suffix[:16]
        leaf = f"{Path(leaf).stem[:160]}{suffix}"
    return leaf


def unique_filename(name: str, file_id: str, used: set) -> str:
    candidate = safe_filename(name, file_id)
    if candidate not in used:
        used.add(candidate)
        return candidate
    suffix = Path(candidate).suffix
    stem = candidate[: -len(suffix)] if suffix else candidate
    clean_id = re.sub(r"[^A-Za-z0-9_-]", "_", file_id or "file")
    candidate = f"{stem}-{clean_id}{suffix}"
    counter = 2
    while candidate in used:
        candidate = f"{stem}-{clean_id}-{counter}{suffix}"
        counter += 1
    used.add(candidate)
    return candidate


def _normalized_mime(value: str) -> str:
    mime = (value or "").split(";", 1)[0].strip().lower()
    return mime if MIME_RE.fullmatch(mime) else ""


def slack_mime_type(file_object: dict, response_content_type: str = "") -> str:
    guessed = mimetypes.guess_type(file_object.get("name") or "")[0] or ""
    for candidate in (
        file_object.get("mimetype") or "",
        response_content_type,
        guessed,
    ):
        normalized = _normalized_mime(candidate)
        if normalized and normalized != "application/octet-stream":
            return normalized
    return "application/octet-stream"


def file_receipt(path: Path, expected_size: int) -> dict:
    size = path.stat().st_size
    if size != expected_size:
        raise RescueError(
            f"Slack declared {expected_size} bytes but the download contains {size}"
        )
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(CHUNK_BYTES), b""):
            digest.update(chunk)
    return {"size": size, "sha256": digest.hexdigest()}


def _expected_slack_size(file_object: dict) -> int:
    try:
        size = int(file_object.get("size"))
    except (TypeError, ValueError) as exc:
        raise RescueError(f"Slack file {file_object.get('id', '<unknown>')} has no byte size") from exc
    if size <= 0:
        raise RescueError(f"Slack file {file_object.get('id', '<unknown>')} has invalid byte size")
    return size


def download_slack_file(file_object: dict, destination: Path) -> dict:
    token = os.environ.get("SLACK_BOT_TOKEN")
    if not token:
        raise RescueError("SLACK_BOT_TOKEN is required")
    url = file_object.get("url_private_download") or file_object.get("url_private")
    if not url:
        raise RescueError(f"Slack file {file_object.get('id', '<unknown>')} has no download URL")
    expected_size = _expected_slack_size(file_object)
    last_error = None
    for attempt in range(1, 4):
        destination.unlink(missing_ok=True)
        request = Request(url, headers={"Authorization": f"Bearer {token}"})
        try:
            with urlopen(
                request, timeout=900, context=HTTPS_CONTEXT
            ) as response, destination.open("wb") as output:
                response_mime = response.headers.get("Content-Type", "")
                while True:
                    chunk = response.read(CHUNK_BYTES)
                    if not chunk:
                        break
                    output.write(chunk)
            receipt = file_receipt(destination, expected_size)
            content_type = slack_mime_type(file_object, response_mime)
            response_type = _normalized_mime(response_mime)
            if (
                response_type
                and response_type != "application/octet-stream"
                and response_type != content_type
            ):
                raise RescueError(
                    f"Slack MIME mismatch for {file_object.get('id')}: "
                    f"metadata {content_type}, response {response_type}"
                )
            return {**receipt, "contentType": content_type}
        except (HTTPError, URLError, TimeoutError, OSError, RescueError) as exc:
            last_error = exc
            destination.unlink(missing_ok=True)
            if attempt < 3:
                time.sleep(attempt)
    raise RescueError(
        f"download failed for Slack file {file_object.get('id', '<unknown>')}: "
        f"{type(last_error).__name__}"
    ) from last_error


def upload(item_id: str, path: Path, content_type: str) -> str:
    done = subprocess.run(
        ["bash", str(UPLOAD), item_id, str(path), content_type],
        capture_output=True,
        text=True,
        cwd=REPO,
        timeout=1800,
        check=False,
    )
    if done.returncode != 0:
        detail = (done.stderr or "").strip().splitlines()
        raise RescueError(
            f"Blob upload failed for {path.name}: {detail[-1] if detail else 'unknown error'}"
        )
    line = done.stdout.strip().splitlines()[-1] if done.stdout.strip() else ""
    parsed = urlparse(line)
    if parsed.scheme != "https" or parsed.netloc != EXPECTED_BLOB_HOST:
        raise RescueError(f"Blob upload returned an unexpected URL for {path.name}")
    return line


def blob_read_back(
    url: str,
    expected_size: int,
    expected_sha256: str,
    expected_content_type: str,
) -> dict:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc != EXPECTED_BLOB_HOST:
        raise RescueError("Blob read-back URL is outside Homa's pinned store")
    last_error = None
    for attempt in range(1, 4):
        digest = hashlib.sha256()
        size = 0
        try:
            with urlopen(
                Request(url), timeout=900, context=HTTPS_CONTEXT
            ) as response:
                response_type = _normalized_mime(response.headers.get("Content-Type", ""))
                while True:
                    chunk = response.read(CHUNK_BYTES)
                    if not chunk:
                        break
                    size += len(chunk)
                    digest.update(chunk)
            actual_sha = digest.hexdigest()
            if size != expected_size:
                raise RescueError(
                    f"Blob read-back size is {size}, expected {expected_size}"
                )
            if actual_sha != expected_sha256:
                raise RescueError("Blob read-back SHA256 does not match the Slack download")
            if response_type != expected_content_type:
                raise RescueError(
                    f"Blob read-back MIME is {response_type or '<missing>'}, "
                    f"expected {expected_content_type}"
                )
            return {
                "size": size,
                "sha256": actual_sha,
                "contentType": response_type,
            }
        except (HTTPError, URLError, TimeoutError, OSError, RescueError) as exc:
            last_error = exc
            if attempt < 3:
                time.sleep(attempt)
    raise RescueError(f"Blob live read-back failed: {last_error}") from last_error


def _source_file_match(entry: dict, new_entry: dict) -> bool:
    file_id = new_entry.get("slackFileId")
    entry_file_id = entry.get("slackFileId")
    if entry_file_id:
        return bool(file_id) and entry_file_id == file_id
    return (
        entry.get("filename") == new_entry.get("filename")
        and entry.get("sha256") == new_entry.get("sha256")
        and entry.get("size") == new_entry.get("size")
    )


def merge_source_file(source_files: list, new_entry: dict) -> bool:
    matches = [index for index, entry in enumerate(source_files) if _source_file_match(entry, new_entry)]
    if len(matches) > 1:
        raise RescueError(
            f"sourceFiles has duplicate identity for {new_entry.get('slackFileId') or new_entry.get('filename')}"
        )
    if not matches:
        source_files.append(dict(new_entry))
        return True
    index = matches[0]
    merged = {**source_files[index], **new_entry}
    if merged == source_files[index]:
        return False
    source_files[index] = merged
    return True


def _entry_for_slack_id(source_files: list, file_id: str):
    matches = [entry for entry in source_files if entry.get("slackFileId") == file_id]
    if len(matches) > 1:
        raise RescueError(f"sourceFiles has duplicate Slack file id {file_id}")
    return matches[0] if matches else None


def verify_record_read_back(path: Path, slack_file_ids: list) -> list:
    record = json.loads(path.read_text())
    source_files = record.get("sourceFiles") or []
    for file_id in slack_file_ids:
        matches = [entry for entry in source_files if entry.get("slackFileId") == file_id]
        if len(matches) != 1:
            raise RescueError(
                f"record read-back has {len(matches)} entries for Slack file {file_id}"
            )
        entry = matches[0]
        required = (
            entry.get("blobUrl"),
            entry.get("size"),
            entry.get("sha256"),
            entry.get("contentType"),
            entry.get("slackSizeVerified"),
            entry.get("blobReadBackVerified"),
        )
        if not all(required):
            raise RescueError(f"record read-back is incomplete for Slack file {file_id}")
    return source_files


def rescue_record(row: dict, messages: list, dry_run: bool = False) -> dict:
    item_id = row["record_id"]
    path = record_path(item_id)
    if not path.exists():
        raise RescueError(f"no record file for {item_id}")
    parent_ts = row.get("slack_ts")
    for message in messages:
        if message.get("ts") != parent_ts and message.get("thread_ts") != parent_ts:
            raise RescueError(f"Slack message mismatch for {item_id}")
    message_files = [
        (message, file_object)
        for message in messages
        for file_object in (message.get("files") or [])
    ]
    if not message_files:
        raise RescueError(f"Slack thread {parent_ts} has no selected files")

    record = json.loads(path.read_text())
    source_files = record.get("sourceFiles") or []
    if not isinstance(source_files, list):
        raise RescueError(f"sourceFiles is not an array for {item_id}")
    used_names = {entry.get("filename") for entry in source_files if entry.get("filename")}
    slack_ids = []
    urls = []
    changed = False
    receipt_at = utc_receipt()

    for index, (message, file_object) in enumerate(message_files, 1):
        file_id = file_object.get("id")
        if not file_id:
            raise RescueError(f"Slack file {index} on {message.get('ts')} has no id")
        slack_ids.append(file_id)
        expected_size = _expected_slack_size(file_object)
        content_type = slack_mime_type(file_object)
        existing = _entry_for_slack_id(source_files, file_id)
        original_name = file_object.get("name") or f"slack-{file_id}"
        filename = (
            existing.get("filename")
            if existing and existing.get("filename")
            else unique_filename(original_name, file_id, used_names)
        )

        if dry_run:
            print(
                f"    {index:02d} {filename} | {expected_size} bytes | {content_type} | "
                f"{file_id} | Slack ts {message.get('ts')}"
            )
            continue

        if (
            existing
            and existing.get("blobUrl")
            and existing.get("size") == expected_size
            and existing.get("sha256")
            and existing.get("contentType") == content_type
        ):
            try:
                blob_read_back(
                    existing["blobUrl"],
                    expected_size,
                    existing["sha256"],
                    content_type,
                )
                verified_existing = {
                    **existing,
                    "slackSizeVerified": True,
                    "blobReadBackVerified": True,
                    "blobReadBackVerifiedAt": receipt_at,
                }
                changed = merge_source_file(
                    source_files, verified_existing
                ) or changed
                urls.append(existing["blobUrl"])
                print(f"    verified existing {filename} | {existing['blobUrl']}")
                continue
            except RescueError:
                print(f"    repairing failed read-back for {filename}")

        with tempfile.TemporaryDirectory(prefix="homa-rescue-original-") as raw:
            local = Path(raw) / filename
            download_receipt = download_slack_file(file_object, local)
            blob_url = upload(item_id, local, download_receipt["contentType"])
            blob_read_back(
                blob_url,
                download_receipt["size"],
                download_receipt["sha256"],
                download_receipt["contentType"],
            )

        entry = {
            "filename": filename,
            "slackFilename": original_name,
            "slackFileId": file_id,
            "slackMessageTs": message["ts"],
            **(
                {"slackParentTs": message["thread_ts"]}
                if message.get("thread_ts") and message.get("thread_ts") != message.get("ts")
                else {}
            ),
            "size": download_receipt["size"],
            "sha256": download_receipt["sha256"],
            "contentType": download_receipt["contentType"],
            "blobUrl": blob_url,
            "blobUploadedAt": receipt_at,
            "rescuedFromSlack": True,
            "slackSizeVerified": True,
            "blobReadBackVerified": True,
        }
        changed = merge_source_file(source_files, entry) or changed
        urls.append(blob_url)
        print(
            f"    uploaded {filename} | {entry['size']} bytes | "
            f"sha256 {entry['sha256'][:12]}... | {blob_url}"
        )

    if dry_run:
        return {"id": item_id, "files": len(message_files), "urls": []}

    record_changed = changed
    if record.get("sourceFiles") != source_files:
        record["sourceFiles"] = source_files
        record_changed = True
    if record.get("sourceFilesNote") != SOURCE_FILES_NOTE:
        record["sourceFilesNote"] = SOURCE_FILES_NOTE
        record_changed = True
    if "rescueNote" in record:
        del record["rescueNote"]
        record_changed = True
    if record_changed:
        path.write_text(json.dumps(record, indent=2) + "\n")

    read_back = verify_record_read_back(path, slack_ids)
    print(
        f"  read-back ok {item_id}: {len(slack_ids)} Slack file(s), "
        f"{len(read_back)} sourceFiles row(s)"
    )
    return {"id": item_id, "files": len(slack_ids), "urls": urls}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Recover exact Slack originals into Homa's pinned Blob store."
    )
    parser.add_argument(
        "--record",
        action="append",
        default=[],
        metavar="ID",
        help="exact record id to rescue; repeat for several records",
    )
    parser.add_argument(
        "--parent-ts",
        action="append",
        default=[],
        metavar="TS",
        help="Slack parent whose file-bearing replies should replace the parent file; repeat as needed",
    )
    parser.add_argument("--limit", type=int, default=0, help="stop after N selected drops")
    parser.add_argument("--dry-run", action="store_true", help="list Slack metadata only")
    args = parser.parse_args()

    load_credentials()
    if not os.environ.get("SLACK_BOT_TOKEN"):
        print("ERROR: SLACK_BOT_TOKEN is required in .cosmo/.env.", file=sys.stderr)
        return 2
    if not args.dry_run and not os.environ.get("BLOB_READ_WRITE_TOKEN"):
        print("ERROR: BLOB_READ_WRITE_TOKEN is required in apps/web/.env.local.", file=sys.stderr)
        return 2
    if not LEDGER.exists():
        print("ERROR: run ingestion-ledger.py first.", file=sys.stderr)
        return 2

    try:
        rows = json.loads(LEDGER.read_text())["rows"]
        if args.record and args.parent_ts:
            selected = bind_explicit_parent_rows(
                explicit_record_rows(args.record), args.parent_ts
            )
        elif args.parent_ts:
            selected = select_rows_for_parent_timestamps(rows, args.parent_ts)
        else:
            selected = select_rows(rows, args.record)
        if args.limit:
            selected = selected[: args.limit]
        messages = slack_messages_by_ts(args.parent_ts)
    except (KeyError, json.JSONDecodeError, OSError, RescueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    print(f"{len(selected)} selected record(s)")
    results = []
    failures = 0
    reply_parents = set(args.parent_ts)
    for row in selected:
        item_id = row["record_id"]
        source_messages = source_messages_for_row(row, messages, reply_parents)
        if not source_messages:
            print(
                f"  FAIL {item_id}: Slack message {row.get('slack_ts')} was not found "
                "in paginated history or requested replies"
            )
            failures += 1
            continue
        print(f"  {'would rescue' if args.dry_run else 'rescuing'} {item_id}")
        try:
            results.append(rescue_record(row, source_messages, dry_run=args.dry_run))
        except (OSError, json.JSONDecodeError, RescueError, subprocess.TimeoutExpired) as exc:
            print(f"  FAIL {item_id}: {exc}")
            failures += 1

    file_count = sum(result["files"] for result in results)
    print(
        f"\n{'would rescue' if args.dry_run else 'rescued'} "
        f"{len(results)} record(s), {file_count} file(s), {failures} failure(s)"
    )
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
