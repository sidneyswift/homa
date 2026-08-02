#!/usr/bin/env python3
"""Close a verified ingestion wave in Slack and persist read-back receipts.

Dry-run is the default. Pass --apply only after every corpus record and product
graduation change is ready to ship. The script is deliberately idempotent:
messages are identified by a visible ingestion-record footer, and every Slack
write is read back before its receipt is stored in the corpus record.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import ssl
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from http.client import HTTPException
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

try:
    import certifi
except ImportError:  # pragma: no cover, macOS Python may already trust Slack
    certifi = None


REPO = Path(__file__).resolve().parents[2]
COSMO = REPO / ".cosmo"
VERIFY = COSMO / "scripts" / "verify-ingestion.py"
DEFAULT_PLAN = Path("/private/tmp/homa-capture-plan.json")
INSPO_CHANNEL = "C0BHQDC033M"
DEV_CHANNEL = "C0BF3QUABDH"
HTTPS_CONTEXT = (
    ssl.create_default_context(cafile=certifi.where())
    if certifi is not None
    else ssl.create_default_context()
)
NON_IDEMPOTENT_SLACK_METHODS = {"chat.postMessage", "reactions.add"}
EXPECTED_BLOB_HOST = "pkvvudjdhxk33dig.public.blob.vercel-storage.com"
BLOB_READ_BACK_RECEIPT_VERSION = "sha256-content-type-v1"


class FinalizeError(RuntimeError):
    """A closeout invariant failed."""


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key == "SLACK_BOT_TOKEN" and key not in os.environ:
            os.environ[key] = value.strip().strip('"').strip("'")


def slack_api(method: str, params: dict[str, object]) -> dict:
    token = os.environ.get("SLACK_BOT_TOKEN")
    if not token:
        raise FinalizeError("SLACK_BOT_TOKEN is required")
    request = Request(
        f"https://slack.com/api/{method}",
        data=urlencode(params).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            with urlopen(request, timeout=120, context=HTTPS_CONTEXT) as response:
                payload = response.read()
            data = json.loads(payload)
            if data.get("ok"):
                return data
            if data.get("error") != "ratelimited":
                raise FinalizeError(
                    f"Slack {method} failed: {data.get('error', 'unknown_error')}"
                )
            last_error = FinalizeError(f"Slack {method} was rate limited")
        except (HTTPError, URLError, TimeoutError, OSError, HTTPException) as exc:
            last_error = exc
            if method in NON_IDEMPOTENT_SLACK_METHODS:
                raise FinalizeError(
                    f"Slack {method} had an ambiguous transport failure. "
                    "Run the closeout again so read-back can establish whether it applied."
                ) from exc
        if attempt < 3:
            time.sleep(attempt)
    raise FinalizeError(
        f"Slack {method} request failed: {type(last_error).__name__}"
    ) from last_error


def paginated_messages(method: str, params: dict[str, object], api_call=slack_api) -> list[dict]:
    messages: list[dict] = []
    cursor = ""
    seen: set[str] = set()
    while True:
        query = {**params, "limit": 200}
        if cursor:
            query["cursor"] = cursor
        data = api_call(method, query)
        messages.extend(data.get("messages") or [])
        cursor = ((data.get("response_metadata") or {}).get("next_cursor") or "").strip()
        if not cursor:
            return messages
        if cursor in seen:
            raise FinalizeError(f"Slack {method} repeated pagination cursor")
        seen.add(cursor)


def marker(record_id: str) -> str:
    return f"Ingestion record: `{record_id}`"


def validate_message(record_id: str, text: object, field: str) -> str:
    if not isinstance(text, str) or not text.strip():
        raise FinalizeError(f"{record_id} is missing {field}")
    if marker(record_id) not in text:
        raise FinalizeError(f"{record_id} {field} is missing its ingestion marker")
    if chr(0x2014) in text:
        raise FinalizeError(f"{record_id} {field} contains a forbidden em dash")
    return text.strip()


def load_wave(plan_path: Path, messages_path: Path) -> list[dict]:
    plan = json.loads(plan_path.read_text())
    configured = json.loads(messages_path.read_text())
    records = plan.get("records")
    messages = configured.get("records")
    if not isinstance(records, list) or not isinstance(messages, dict):
        raise FinalizeError("plan.records must be a list and messages.records an object")
    plan_ids = [row.get("id") for row in records]
    if len(plan_ids) != len(set(plan_ids)) or any(not item for item in plan_ids):
        raise FinalizeError("plan contains missing or duplicate record IDs")
    if set(plan_ids) != set(messages):
        missing = sorted(set(plan_ids) - set(messages))
        extra = sorted(set(messages) - set(plan_ids))
        raise FinalizeError(f"message config mismatch, missing={missing}, extra={extra}")
    wave: list[dict] = []
    timestamp_owner: dict[str, str] = {}
    for row in records:
        record_id = row["id"]
        config = messages[record_id]
        kind = row.get("kind")
        if kind not in {"reference", "curriculum"}:
            raise FinalizeError(f"{record_id} has invalid kind {kind}")
        source_ts = row.get("sourceMessageTs")
        covers = row.get("coversMessageTs") or []
        if not isinstance(source_ts, str) or not isinstance(covers, list):
            raise FinalizeError(f"{record_id} has invalid Slack timestamp coverage")
        record_source_ts = row.get("recordSourceMessageTs", source_ts)
        record_covers = row.get("recordCoversMessageTs", covers) or []
        if not isinstance(record_source_ts, str) or not isinstance(record_covers, list):
            raise FinalizeError(f"{record_id} has invalid record Slack identity")
        if not record_source_ts or any(
            not isinstance(timestamp, str) or not timestamp
            for timestamp in record_covers
        ):
            raise FinalizeError(f"{record_id} has an invalid record Slack timestamp")
        thread_reply = validate_message(record_id, config.get("threadReply"), "threadReply")
        dev_summary = config.get("devSummary")
        if kind == "curriculum":
            dev_summary = validate_message(record_id, dev_summary, "devSummary")
        elif dev_summary is not None:
            raise FinalizeError(f"reference {record_id} must not have a devSummary")
        covered_ts = list(dict.fromkeys([source_ts, *covers]))
        capture_ts = row.get("captureMessageTs") or []
        if not isinstance(capture_ts, list) or any(
            not isinstance(timestamp, str) or not timestamp
            for timestamp in capture_ts
        ):
            raise FinalizeError(f"{record_id} has invalid capture timestamps")
        for timestamp in covered_ts:
            if not isinstance(timestamp, str) or not timestamp:
                raise FinalizeError(f"{record_id} has an invalid covered timestamp")
            owner = timestamp_owner.get(timestamp)
            if owner:
                raise FinalizeError(
                    f"Slack timestamp {timestamp} belongs to both {owner} and {record_id}"
                )
            timestamp_owner[timestamp] = record_id
        retained_ts = list(dict.fromkeys(capture_ts or covered_ts))
        if any(timestamp not in covered_ts for timestamp in retained_ts):
            raise FinalizeError(
                f"{record_id} capture timestamps fall outside its covered Slack messages"
            )
        wave.append(
            {
                **row,
                "threadReply": thread_reply,
                "devSummary": dev_summary,
                "coveredTs": covered_ts,
                "retainedTs": retained_ts,
            }
        )
    return wave


def record_path(record_id: str, kind: str) -> Path:
    folder = "curriculums" if kind == "curriculum" else "references"
    path = COSMO / folder / f"{record_id}.json"
    if not path.exists():
        raise FinalizeError(f"record file does not exist: {path.relative_to(REPO)}")
    return path


def run_verifier(
    record_id: str,
    *,
    require_closeout: bool = False,
    require_portable_source: bool = False,
) -> None:
    command = [sys.executable, str(VERIFY), record_id]
    if require_closeout:
        command.append("--require-closeout")
    if require_portable_source:
        command.append("--require-portable-source")
    result = subprocess.run(
        command,
        cwd=REPO,
        text=True,
        capture_output=True,
        timeout=300,
    )
    if result.returncode != 0:
        detail = (result.stdout + result.stderr).strip()
        raise FinalizeError(f"verifier failed for {record_id}:\n{detail}")


def normalized_content_type(value: object) -> str:
    return str(value or "").split(";", 1)[0].strip().lower()


def validate_source_blob_url(record_id: str, source: dict) -> str:
    url = source.get("blobUrl")
    if not isinstance(url, str) or not url:
        raise FinalizeError(f"{record_id} source file has no Blob URL")
    parsed = urlparse(url)
    expected_prefix = f"/inspo/{record_id}/"
    if (
        parsed.scheme != "https"
        or parsed.netloc != EXPECTED_BLOB_HOST
        or not parsed.path.startswith(expected_prefix)
        or parsed.path == expected_prefix
        or parsed.params
        or parsed.query
        or parsed.fragment
    ):
        raise FinalizeError(
            f"{record_id} source file does not use the exact Homa Blob path"
        )
    return url


def has_bound_read_back_receipt(source: dict, slack_size: int) -> bool:
    content_type = normalized_content_type(source.get("contentType"))
    receipt_identity = f"{source.get('sha256')}:{content_type}"
    return all(
        (
            source.get("slackSizeVerified") is True,
            source.get("slackDeclaredSize") == slack_size,
            source.get("size") == slack_size,
            source.get("blobReadBackVerified") is True,
            isinstance(source.get("blobReadBackVerifiedAt"), str),
            bool(str(source.get("blobReadBackVerifiedAt") or "").strip()),
            source.get("blobReadBackSize") == source.get("size"),
            source.get("blobReadBackSha256") == source.get("sha256"),
            normalized_content_type(source.get("blobReadBackContentType"))
            == content_type,
            source.get("blobReadBackReceiptVersion")
            == BLOB_READ_BACK_RECEIPT_VERSION,
            source.get("blobReadBackIdentity") == receipt_identity,
            bool(content_type),
        )
    )


def verify_blob_source_read_back(record_id: str, source: dict) -> dict[str, object]:
    url = validate_source_blob_url(record_id, source)
    expected_size = source.get("size")
    expected_sha = source.get("sha256")
    expected_content_type = normalized_content_type(source.get("contentType"))
    if not isinstance(expected_size, int) or expected_size <= 0:
        raise FinalizeError(f"{record_id} source file has an invalid byte size")
    if not isinstance(expected_sha, str) or not re.fullmatch(r"[0-9a-f]{64}", expected_sha):
        raise FinalizeError(f"{record_id} source file has an invalid SHA256")
    if not expected_content_type:
        raise FinalizeError(f"{record_id} source file has no content type")

    last_error: Exception | None = None
    for attempt in range(1, 4):
        digest = hashlib.sha256()
        actual_size = 0
        try:
            with urlopen(
                Request(url), timeout=900, context=HTTPS_CONTEXT
            ) as response:
                actual_content_type = normalized_content_type(
                    response.headers.get("Content-Type", "")
                )
                for chunk in iter(lambda: response.read(1 << 20), b""):
                    actual_size += len(chunk)
                    digest.update(chunk)
            if actual_size != expected_size:
                raise FinalizeError(
                    f"Blob read-back size is {actual_size}, expected {expected_size}"
                )
            if digest.hexdigest() != expected_sha:
                raise FinalizeError("Blob read-back SHA256 differs from the source receipt")
            if actual_content_type != expected_content_type:
                raise FinalizeError(
                    f"Blob read-back MIME is {actual_content_type or '<missing>'}, "
                    f"expected {expected_content_type}"
                )
            return {
                "blobReadBackVerified": True,
                "blobReadBackVerifiedAt": datetime.now(timezone.utc).isoformat(
                    timespec="seconds"
                ),
                "blobReadBackSize": actual_size,
                "blobReadBackSha256": digest.hexdigest(),
                "blobReadBackContentType": actual_content_type,
                "blobReadBackReceiptVersion": BLOB_READ_BACK_RECEIPT_VERSION,
                "blobReadBackIdentity": f"{expected_sha}:{expected_content_type}",
            }
        except (HTTPError, URLError, TimeoutError, OSError, HTTPException, FinalizeError) as error:
            last_error = error
            if attempt < 3:
                time.sleep(attempt)
    raise FinalizeError(
        f"{record_id} source Blob failed live read-back: {last_error}"
    ) from last_error


def slack_file_expectations(
    covered_timestamps: list[str], api_call=slack_api
) -> dict[str, list[dict]]:
    expected: dict[str, list[dict]] = {}
    for timestamp in covered_timestamps:
        data = api_call(
            "reactions.get", {"channel": INSPO_CHANNEL, "timestamp": timestamp}
        )
        message = data.get("message")
        if not isinstance(message, dict) or str(message.get("ts") or "") != timestamp:
            raise FinalizeError(
                f"Slack did not return the exact covered message {timestamp}"
            )
        files = message.get("files")
        if files is None:
            files = []
        if not isinstance(files, list):
            raise FinalizeError(f"Slack message {timestamp} has malformed file metadata")
        rows: list[dict] = []
        seen_ids: set[str] = set()
        for file in files:
            if not isinstance(file, dict):
                raise FinalizeError(f"Slack message {timestamp} has malformed file metadata")
            file_id = file.get("id")
            size = file.get("size")
            if not isinstance(file_id, str) or not file_id:
                raise FinalizeError(f"Slack message {timestamp} has a file without an ID")
            if file_id in seen_ids:
                raise FinalizeError(
                    f"Slack message {timestamp} repeats file ID {file_id}"
                )
            if not isinstance(size, int) or size <= 0:
                raise FinalizeError(
                    f"Slack file {file_id} on {timestamp} has an invalid byte size"
                )
            seen_ids.add(file_id)
            rows.append({"id": file_id, "size": size, "name": file.get("name")})
        expected[timestamp] = rows
    return expected


def verify_record_slack_identity(
    row: dict,
    expected_files_by_ts: dict[str, list[dict]],
    *,
    persist_blob_receipts: bool = False,
) -> Path:
    path = record_path(row["id"], row["kind"])
    record = json.loads(path.read_text())
    if record.get("id") != row["id"]:
        raise FinalizeError(f"record identity mismatch in {path.relative_to(REPO)}")
    expected_source_ts = row.get("recordSourceMessageTs", row["sourceMessageTs"])
    expected_covers = row.get("recordCoversMessageTs", row.get("coversMessageTs") or [])
    if record.get("sourceMessageTs") != expected_source_ts:
        raise FinalizeError(f"{row['id']} sourceMessageTs differs from the wave plan")
    if (record.get("coversMessageTs") or []) != expected_covers:
        raise FinalizeError(f"{row['id']} coversMessageTs differs from the wave plan")
    covered_ts = row.get("coveredTs") or list(
        dict.fromkeys([
            row["sourceMessageTs"],
            *(row.get("coversMessageTs") or []),
        ])
    )
    retained_ts = row["retainedTs"]
    if set(expected_files_by_ts) != set(covered_ts):
        raise FinalizeError(
            f"{row['id']} Slack file expectations do not match covered timestamps"
        )
    retained_set = set(retained_ts)
    if not retained_set.issubset(set(covered_ts)):
        raise FinalizeError(f"{row['id']} retained timestamps fall outside coverage")
    source_files = record.get("sourceFiles") or []
    if not isinstance(source_files, list):
        raise FinalizeError(f"{row['id']} sourceFiles is not an array")
    expected_occurrences: set[tuple[str, str]] = set()
    receipts_changed = False
    for timestamp in covered_ts:
        expected_files = expected_files_by_ts.get(timestamp)
        if not isinstance(expected_files, list):
            raise FinalizeError(f"{row['id']} has invalid Slack files for {timestamp}")
        if timestamp in retained_set and not expected_files:
            raise FinalizeError(
                f"{row['id']} retained Slack message {timestamp} has no attachments"
            )
        if timestamp not in retained_set and expected_files:
            raise FinalizeError(
                f"{row['id']} non-retained covered message {timestamp} has attachments"
            )
        for expected in expected_files:
            file_id = expected.get("id")
            slack_size = expected.get("size")
            occurrence = (timestamp, file_id)
            if occurrence in expected_occurrences:
                raise FinalizeError(
                    f"{row['id']} repeats expected Slack file occurrence {timestamp}/{file_id}"
                )
            expected_occurrences.add(occurrence)
            matches = [
                source
                for source in source_files
                if isinstance(source, dict)
                and source.get("slackMessageTs") == timestamp
                and source.get("slackFileId") == file_id
            ]
            if len(matches) != 1:
                raise FinalizeError(
                    f"{row['id']} has {len(matches)} rows for Slack file occurrence "
                    f"{timestamp}/{file_id}"
                )
            source = matches[0]
            if source.get("size") != slack_size:
                raise FinalizeError(
                    f"{row['id']} source size differs from Slack for {timestamp}/{file_id}"
                )
            validate_source_blob_url(row["id"], source)
            sha = source.get("sha256")
            if not isinstance(sha, str) or not re.fullmatch(r"[0-9a-f]{64}", sha):
                raise FinalizeError(
                    f"{row['id']} source SHA256 is invalid for {timestamp}/{file_id}"
                )
            if not has_bound_read_back_receipt(source, slack_size):
                receipt = verify_blob_source_read_back(row["id"], source)
                source.update(
                    {
                        "slackDeclaredSize": slack_size,
                        "slackSizeVerified": True,
                        **receipt,
                    }
                )
                receipts_changed = True

    unexpected = [
        (str(source.get("slackMessageTs")), str(source.get("slackFileId")))
        for source in source_files
        if isinstance(source, dict)
        and source.get("slackMessageTs") in covered_ts
        and source.get("slackFileId")
        and (str(source.get("slackMessageTs")), str(source.get("slackFileId")))
        not in expected_occurrences
    ]
    if unexpected:
        raise FinalizeError(
            f"{row['id']} has source occurrences absent from live Slack: {unexpected}"
        )
    if receipts_changed and persist_blob_receipts:
        atomic_json_write(path, record)
        persisted = json.loads(path.read_text())
        persisted_sources = persisted.get("sourceFiles") or []
        if not isinstance(persisted_sources, list):
            raise FinalizeError(
                f"{row['id']} source receipt persistence lost sourceFiles"
            )
        for timestamp in covered_ts:
            for expected in expected_files_by_ts[timestamp]:
                file_id = expected["id"]
                slack_size = expected["size"]
                matches = [
                    source
                    for source in persisted_sources
                    if isinstance(source, dict)
                    and source.get("slackMessageTs") == timestamp
                    and source.get("slackFileId") == file_id
                ]
                if len(matches) != 1 or not has_bound_read_back_receipt(
                    matches[0], slack_size
                ):
                    raise FinalizeError(
                        f"{row['id']} Blob receipt failed local read-back for "
                        f"{timestamp}/{file_id}"
                    )
    return path


def unique_marker_message(
    messages: list[dict],
    record_id: str,
    location: str,
    bot_user_id: str,
    expected_thread_ts: str | None,
) -> dict | None:
    """Return the bot's unique marker message, ignoring every foreign author."""
    matches = [
        message
        for message in messages
        if message.get("user") == bot_user_id
        and marker(record_id) in (message.get("text") or "")
        and (
            (
                expected_thread_ts is not None
                and message.get("thread_ts") == expected_thread_ts
                and str(message.get("ts") or "") != expected_thread_ts
            )
            or (
                expected_thread_ts is None
                and not message.get("thread_ts")
            )
        )
    ]
    if len(matches) > 1:
        raise FinalizeError(f"{record_id} has duplicate bot-owned {location} messages")
    return matches[0] if matches else None


def ensure_message(
    *,
    channel: str,
    text: str,
    record_id: str,
    bot_user_id: str,
    thread_ts: str | None,
    apply: bool,
    api_call=slack_api,
) -> str | None:
    if thread_ts:
        existing_messages = paginated_messages(
            "conversations.replies", {"channel": channel, "ts": thread_ts}, api_call
        )
        location = "thread acknowledgment"
    else:
        existing_messages = paginated_messages(
            "conversations.history", {"channel": channel}, api_call
        )
        location = "developer summary"
    existing = unique_marker_message(
        existing_messages, record_id, location, bot_user_id, thread_ts
    )
    if existing:
        if (existing.get("text") or "").strip() != text:
            raise FinalizeError(f"{record_id} existing {location} text differs from config")
        return existing.get("ts")
    if not apply:
        return None
    params: dict[str, object] = {
        "channel": channel,
        "text": text,
        "unfurl_links": "false",
        "unfurl_media": "false",
    }
    if thread_ts:
        params["thread_ts"] = thread_ts
    posted = api_call("chat.postMessage", params)
    posted_ts = posted.get("ts")
    if not posted_ts:
        raise FinalizeError(f"Slack did not return a timestamp for {record_id} {location}")
    if thread_ts:
        read_back = paginated_messages(
            "conversations.replies", {"channel": channel, "ts": thread_ts}, api_call
        )
    else:
        read_back = paginated_messages(
            "conversations.history", {"channel": channel}, api_call
        )
    verified = unique_marker_message(
        read_back, record_id, location, bot_user_id, thread_ts
    )
    if not verified or verified.get("ts") != posted_ts or (verified.get("text") or "").strip() != text:
        raise FinalizeError(f"{record_id} {location} failed Slack read-back")
    return posted_ts


def reaction_owned(message: dict, user_id: str) -> bool:
    return any(
        reaction.get("name") == "ship" and user_id in (reaction.get("users") or [])
        for reaction in (message.get("reactions") or [])
    )


def exact_reaction_message(data: dict, timestamp: str) -> dict:
    message = data.get("message")
    if not isinstance(message, dict) or str(message.get("ts") or "") != timestamp:
        raise FinalizeError(
            f"Slack reaction read-back did not return the exact Slack message {timestamp}"
        )
    return message


def ensure_ship_reaction(
    channel: str,
    timestamp: str,
    user_id: str,
    *,
    apply: bool,
    api_call=slack_api,
) -> bool:
    before = api_call("reactions.get", {"channel": channel, "timestamp": timestamp})
    if reaction_owned(exact_reaction_message(before, timestamp), user_id):
        return True
    if not apply:
        return False
    api_call("reactions.add", {"channel": channel, "timestamp": timestamp, "name": "ship"})
    after = api_call("reactions.get", {"channel": channel, "timestamp": timestamp})
    if not reaction_owned(exact_reaction_message(after, timestamp), user_id):
        raise FinalizeError(f":ship: reaction failed read-back for Slack ts {timestamp}")
    return True


def atomic_json_write(path: Path, payload: dict) -> None:
    rendered = json.dumps(payload, indent=2, ensure_ascii=True) + "\n"
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=path.parent, delete=False
    ) as handle:
        handle.write(rendered)
        temporary = Path(handle.name)
    temporary.replace(path)


def persist_receipts(
    path: Path,
    *,
    slack_reply_ts: str,
    dev_summary_ts: str | None,
    ship_reaction: bool,
) -> None:
    record = json.loads(path.read_text())
    stages = record.setdefault("stages", {})
    stages["slackReplyTs"] = slack_reply_ts
    if dev_summary_ts is not None:
        stages["devSummaryTs"] = dev_summary_ts
    stages["shipReaction"] = ship_reaction
    atomic_json_write(path, record)
    read_back = json.loads(path.read_text()).get("stages") or {}
    if read_back.get("slackReplyTs") != slack_reply_ts:
        raise FinalizeError(f"local Slack receipt failed read-back for {record.get('id')}")
    if dev_summary_ts is not None and read_back.get("devSummaryTs") != dev_summary_ts:
        raise FinalizeError(f"local dev-summary receipt failed read-back for {record.get('id')}")
    if read_back.get("shipReaction") is not ship_reaction:
        raise FinalizeError(f"local reaction receipt failed read-back for {record.get('id')}")


def finalize_row(
    row: dict, bot_user_id: str, *, apply: bool, api_call=slack_api
) -> dict:
    record_id = row["id"]
    expected_files_by_ts = slack_file_expectations(row["coveredTs"], api_call)
    path = verify_record_slack_identity(
        row,
        expected_files_by_ts,
        persist_blob_receipts=apply,
    )
    run_verifier(record_id, require_portable_source=apply)
    thread_ts = ensure_message(
        channel=INSPO_CHANNEL,
        text=row["threadReply"],
        record_id=record_id,
        bot_user_id=bot_user_id,
        thread_ts=row["sourceMessageTs"],
        apply=apply,
        api_call=api_call,
    )
    dev_ts = None
    if row["kind"] == "curriculum":
        dev_ts = ensure_message(
            channel=DEV_CHANNEL,
            text=row["devSummary"],
            record_id=record_id,
            bot_user_id=bot_user_id,
            thread_ts=None,
            apply=apply,
            api_call=api_call,
        )
    reactions = [
        ensure_ship_reaction(
            INSPO_CHANNEL, timestamp, bot_user_id, apply=apply, api_call=api_call
        )
        for timestamp in row["coveredTs"]
    ]
    complete = bool(thread_ts and all(reactions) and (dev_ts if row["kind"] == "curriculum" else True))
    if apply and not complete:
        raise FinalizeError(f"{record_id} closeout is incomplete after Slack writes")
    if apply:
        persist_receipts(
            path,
            slack_reply_ts=thread_ts,
            dev_summary_ts=dev_ts,
            ship_reaction=True,
        )
        # The pre-closeout verifier proves the analysis. Only this second pass
        # can prove that the exact Slack reply, reaction, and optional
        # curriculum summary receipts survived the local readback.
        run_verifier(
            record_id,
            require_closeout=True,
            require_portable_source=True,
        )
    return {
        "id": record_id,
        "coveredMessages": len(row["coveredTs"]),
        "threadReplyTs": thread_ts,
        "devSummaryTs": dev_ts,
        "shipReactionsVerified": sum(reactions),
        "complete": complete,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, default=DEFAULT_PLAN)
    parser.add_argument("--messages", type=Path, required=True)
    parser.add_argument("--record", action="append", default=[])
    parser.add_argument("--expect-covered", type=int)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    load_env_file(COSMO / ".env")
    wave = load_wave(args.plan, args.messages)
    if args.record:
        selected = set(args.record)
        unknown = selected - {row["id"] for row in wave}
        if unknown:
            raise FinalizeError(f"unknown selected record IDs: {sorted(unknown)}")
        wave = [row for row in wave if row["id"] in selected]
    if not wave:
        raise FinalizeError("no records selected")
    covered_count = sum(len(row["coveredTs"]) for row in wave)
    if args.expect_covered is not None and covered_count != args.expect_covered:
        raise FinalizeError(
            f"selected wave covers {covered_count} Slack messages, "
            f"expected {args.expect_covered}"
        )
    identity = slack_api("auth.test", {})
    user_id = identity.get("user_id")
    if not user_id:
        raise FinalizeError("Slack auth.test did not return user_id")

    results = []
    for row in wave:
        result = finalize_row(row, user_id, apply=args.apply)
        results.append(result)
        print(json.dumps(result, sort_keys=True))
    covered = sum(result["coveredMessages"] for result in results)
    verified = sum(result["shipReactionsVerified"] for result in results)
    print(
        f"{'APPLIED' if args.apply else 'DRY RUN'}: "
        f"{len(results)} records, {covered} covered Slack messages, "
        f"{verified} existing bot :ship: reactions"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (FinalizeError, json.JSONDecodeError, OSError, subprocess.TimeoutExpired) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
