#!/usr/bin/env python3
"""Upload captured Slack originals and create exact ingestion stubs.

The plan supplies the model-judged grouping. This script verifies that every
captured message is assigned once, uploads each unique byte stream through
Homa's store-pinned helper, and writes only mechanically knowable identity and
source metadata. It never writes analysis, taxonomy, recipes, or Slack replies.

Usage:
    python3 .cosmo/scripts/stage-captured.py --plan /path/to/plan.json
    python3 .cosmo/scripts/stage-captured.py --plan ... --record <id>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import re
import ssl
import subprocess
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from http.client import HTTPException
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

try:
    import certifi
except ImportError:
    certifi = None


COSMO = Path(__file__).resolve().parent.parent
REPO = COSMO.parent
CAPTURE_MANIFEST = COSMO / "inspo-files" / "slack" / "manifest.json"
CAPTURE_ROOT = CAPTURE_MANIFEST.parent
UPLOAD_STATE = COSMO / "inspo-files" / "slack" / "upload-state.json"
LEDGER = COSMO / "ingestion-ledger.json"
UPLOAD = COSMO / "scripts" / "blob-upload.sh"
EXPECTED_BLOB_HOST = "pkvvudjdhxk33dig.public.blob.vercel-storage.com"
BLOB_READ_BACK_RECEIPT_VERSION = "sha256-content-type-v1"
CHUNK_BYTES = 1 << 20
HTTPS_CONTEXT = ssl.create_default_context(cafile=certifi.where() if certifi else None)


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


def atomic_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=path.parent, delete=False) as handle:
        json.dump(value, handle, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.replace(path)


def plan_timestamps(record: dict) -> list[str]:
    return [str(record["sourceMessageTs"]), *[str(ts) for ts in record.get("coversMessageTs", [])]]


def capture_timestamps(record: dict) -> list[str]:
    explicit = record.get("captureMessageTs")
    if explicit is None:
        return plan_timestamps(record)
    if not isinstance(explicit, list) or not explicit:
        raise RuntimeError(f"{record.get('id')} captureMessageTs must be a non-empty list")
    return [str(timestamp) for timestamp in explicit]


def content_type(item: dict) -> str:
    declared = item.get("mimetype")
    if isinstance(declared, str) and declared and declared != "application/octet-stream":
        return declared
    return mimetypes.guess_type(item["name"])[0] or "application/octet-stream"


def normalized_content_type(item: dict) -> str:
    return content_type(item).split(";", 1)[0].strip().lower()


def upload_key(record_id: str, item: dict) -> str:
    return f"{record_id}:{item['sha256']}:{normalized_content_type(item)}"


def legacy_upload_key(record_id: str, item: dict) -> str:
    return f"{record_id}:{item['sha256']}"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(CHUNK_BYTES), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verified_capture(item: dict) -> Path:
    local_path = item.get("localPath")
    timestamp = item.get("ts")
    if not isinstance(local_path, str) or not local_path or Path(local_path).is_absolute():
        raise RuntimeError("capture localPath must be a nonempty repository-relative path")
    if not isinstance(timestamp, str) or not timestamp:
        raise RuntimeError("capture has no Slack timestamp")

    candidate = REPO / local_path
    candidate_absolute = candidate.absolute()
    capture_root_absolute = CAPTURE_ROOT.absolute()
    if capture_root_absolute not in candidate_absolute.parents:
        raise RuntimeError(f"capture path is outside the capture root: {local_path}")
    expected_parent = (CAPTURE_ROOT / timestamp).absolute()
    if candidate_absolute.parent != expected_parent:
        raise RuntimeError(
            f"capture path is outside Slack timestamp directory {timestamp}: {local_path}"
        )
    try:
        original = candidate.resolve(strict=True)
        capture_root = CAPTURE_ROOT.resolve(strict=True)
    except OSError as error:
        raise RuntimeError(f"capture missing: {local_path}") from error
    if candidate.is_symlink():
        raise RuntimeError(f"capture path uses a symlink: {local_path}")
    if capture_root not in original.parents:
        raise RuntimeError(f"capture path is outside the capture root: {local_path}")
    if original.parent != capture_root / timestamp:
        raise RuntimeError(
            f"capture path is outside Slack timestamp directory {timestamp}: {local_path}"
        )
    if not original.is_file():
        raise RuntimeError(f"capture is not a regular file: {local_path}")
    expected_size = int(item["size"])
    expected_sha = str(item["sha256"])
    if original.stat().st_size != expected_size:
        raise RuntimeError(f"capture missing or wrong size: {local_path}")
    actual_sha = sha256_file(original)
    if actual_sha != expected_sha:
        raise RuntimeError(f"capture hash mismatch: {local_path}")
    return original


def verify_blob_read_back(
    url: str, expected_size: int, expected_sha: str, expected_content_type: str
) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc != EXPECTED_BLOB_HOST:
        raise RuntimeError("cached upload URL is outside Homa's pinned Blob store")
    last_error: Exception | None = None
    for attempt in range(1, 4):
        try:
            digest = hashlib.sha256()
            size = 0
            with urlopen(Request(url), timeout=900, context=HTTPS_CONTEXT) as response:
                actual_content_type = (
                    response.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
                )
                for chunk in iter(lambda: response.read(CHUNK_BYTES), b""):
                    size += len(chunk)
                    digest.update(chunk)
            if size != expected_size:
                raise RuntimeError(
                    f"Blob read-back size is {size}, expected {expected_size}"
                )
            if digest.hexdigest() != expected_sha:
                raise RuntimeError("Blob read-back hash differs from captured bytes")
            if actual_content_type != expected_content_type.split(";", 1)[0].strip().lower():
                raise RuntimeError(
                    f"Blob read-back MIME is {actual_content_type or '<missing>'}, "
                    f"expected {expected_content_type}"
                )
            return
        except (HTTPError, URLError, TimeoutError, OSError, HTTPException, RuntimeError) as error:
            last_error = error
            if attempt < 3:
                time.sleep(attempt)
    raise RuntimeError(f"Blob live read-back failed: {last_error}") from last_error


def stored_name(item: dict) -> str:
    file_id = re.sub(r"[^A-Za-z0-9_-]", "_", str(item.get("fileId") or ""))
    identity = file_id or str(item["sha256"])[:12]
    suffix = Path(item["name"]).suffix
    stem = Path(item["name"]).stem
    return f"{item['ts']}-{identity}-{stem}{suffix}"


def upload_one(record_id: str, item: dict, state: dict) -> tuple[str, str, bool]:
    key = upload_key(record_id, item)
    original = verified_capture(item)
    blob_content_type = normalized_content_type(item)
    for state_key in (key, legacy_upload_key(record_id, item)):
        existing = state.get(state_key)
        if isinstance(existing, str) and existing.startswith("https://"):
            try:
                verify_blob_read_back(
                    existing,
                    int(item["size"]),
                    str(item["sha256"]),
                    blob_content_type,
                )
                return key, existing, False
            except RuntimeError:
                # Repair a stale, missing, overwritten, or wrongly typed cached
                # object from the already hash-verified local capture below.
                pass

    with tempfile.TemporaryDirectory(prefix="homa-stage-") as temporary:
        linked = Path(temporary) / stored_name(item)
        os.link(original, linked)
        result = subprocess.run(
            ["bash", str(UPLOAD), record_id, str(linked), blob_content_type],
            cwd=REPO,
            capture_output=True,
            text=True,
            timeout=3600,
            check=False,
            env=os.environ.copy(),
        )
    lines = result.stdout.strip().splitlines()
    url = lines[-1] if lines else ""
    if result.returncode != 0 or not url.startswith("https://"):
        detail = result.stderr.strip() or result.stdout.strip() or "no Blob URL returned"
        raise RuntimeError(f"{record_id} {item['name']}: {detail}")
    verify_blob_read_back(
        url, int(item["size"]), str(item["sha256"]), blob_content_type
    )
    return key, url, True


def validate_capture_coverage(
    selected_ts: list[str], files_by_ts: dict[str, list[dict]], message_count: int, *, subset: bool
) -> None:
    selected = set(selected_ts)
    captured = set(files_by_ts)
    if len(captured) != message_count:
        raise RuntimeError(
            f"capture names {message_count} messages but contains files for {len(captured)}"
        )
    missing = sorted(selected - captured, key=float)
    if missing:
        raise RuntimeError(f"plan references {len(missing)} uncaptured message(s): {missing}")
    if not subset:
        omitted = sorted(captured - selected, key=float)
        if omitted:
            raise RuntimeError(
                f"full plan omits {len(omitted)} captured message(s): {omitted}"
            )


def validate_plan_records(plan: object) -> list[dict]:
    if not isinstance(plan, list) or not plan:
        raise RuntimeError("plan.records must be a nonempty list")
    record_ids = [record.get("id") for record in plan if isinstance(record, dict)]
    if len(record_ids) != len(plan) or any(
        not isinstance(record_id, str) or not record_id
        for record_id in record_ids
    ):
        raise RuntimeError("plan contains a missing or invalid record ID")
    duplicates = sorted({record_id for record_id in record_ids if record_ids.count(record_id) > 1})
    if duplicates:
        raise RuntimeError(f"plan contains duplicate record IDs: {duplicates}")
    timestamp_pattern = re.compile(r"^\d+\.\d+$")
    id_pattern = re.compile(r"^(ref|cur)-[a-z0-9][a-z0-9-]*$")
    timestamp_owner: dict[str, str] = {}
    for record in plan:
        record_id = record["id"]
        kind = record.get("kind")
        expected_prefix = "cur-" if kind == "curriculum" else "ref-"
        if (
            kind not in {"reference", "curriculum"}
            or not id_pattern.fullmatch(record_id)
            or not record_id.startswith(expected_prefix)
        ):
            raise RuntimeError(f"{record_id} has an invalid kind or canonical ID")
        source_ts = record.get("sourceMessageTs")
        covers = record.get("coversMessageTs") or []
        title = record.get("title")
        merge_existing = record.get("mergeExistingSources", False)
        if (
            not isinstance(source_ts, str)
            or not timestamp_pattern.fullmatch(source_ts)
            or not isinstance(covers, list)
            or any(
                not isinstance(timestamp, str)
                or not timestamp_pattern.fullmatch(timestamp)
                for timestamp in covers
            )
        ):
            raise RuntimeError(f"{record_id} has invalid Slack timestamp coverage")
        if not isinstance(title, str) or not title.strip():
            raise RuntimeError(f"{record_id} has no title")
        if not isinstance(merge_existing, bool):
            raise RuntimeError(f"{record_id} mergeExistingSources must be a boolean")
        declared = {source_ts, *covers}
        captured = capture_timestamps(record)
        if any(
            not isinstance(timestamp, str)
            or not timestamp_pattern.fullmatch(timestamp)
            for timestamp in captured
        ):
            raise RuntimeError(f"{record_id} has invalid capture timestamps")
        outside = sorted(set(captured) - declared, key=float)
        if outside:
            raise RuntimeError(
                f"{record_id} captureMessageTs fall outside declared coverage: {outside}"
            )
        for timestamp in captured:
            owner = timestamp_owner.get(timestamp)
            if owner is not None:
                raise RuntimeError(
                    f"Slack timestamp {timestamp} is assigned to both {owner} and {record_id}"
                )
            timestamp_owner[timestamp] = record_id
    return plan


def record_path(record: dict) -> Path:
    folder = "curriculums" if record["kind"] == "curriculum" else "references"
    return COSMO / folder / f"{record['id']}.json"


def dropped_at(ts: str) -> str:
    moment = datetime.fromtimestamp(float(ts), tz=ZoneInfo("America/New_York"))
    return moment.isoformat(timespec="seconds")


def ledger_by_ts() -> dict[str, dict]:
    rows = json.loads(LEDGER.read_text()).get("rows", [])
    return {str(row["slack_ts"]): row for row in rows}


def write_stub(record: dict, items: list[dict], state: dict, rows: dict[str, dict]) -> None:
    path = record_path(record)
    existing: dict = {}
    if path.exists():
        existing = json.loads(path.read_text())

    source_ts = str(record["sourceMessageTs"])
    planned_covers = [str(ts) for ts in record.get("coversMessageTs", [])]
    merge_existing = record.get("mergeExistingSources") is True
    authored_field = "name" if record["kind"] == "curriculum" else "title"
    planned_title = record.get("title")
    if existing:
        if existing.get("id") != record["id"]:
            raise RuntimeError(f"{record['id']} existing record identity does not match")
        if existing.get("sourceMessageTs") != source_ts:
            raise RuntimeError(
                f"{record['id']} existing sourceMessageTs differs from the staging plan"
            )
        if existing.get(authored_field) != planned_title:
            raise RuntimeError(
                f"{record['id']} existing {authored_field} differs from the staging plan"
            )
        existing_covers = existing.get("coversMessageTs") or []
        if not isinstance(existing_covers, list) or any(
            not isinstance(timestamp, str) or not timestamp
            for timestamp in existing_covers
        ):
            raise RuntimeError(f"{record['id']} existing coversMessageTs is invalid")
        if not merge_existing and existing_covers != planned_covers:
            raise RuntimeError(
                f"{record['id']} needs mergeExistingSources to add or replace Slack coverage"
            )
        covers = list(dict.fromkeys([*existing_covers, *planned_covers]))
    else:
        if merge_existing:
            raise RuntimeError(
                f"{record['id']} requested mergeExistingSources but no existing record exists"
            )
        covers = planned_covers

    # Existing originals are durable evidence. A staging plan may add a new
    # Slack occurrence, but it never has authority to erase an earlier source.
    sources: list[dict] = [
        dict(source) for source in (existing.get("sourceFiles") or [])
    ]
    seen_hashes: dict[str, dict] = {}
    for source in [
        *[entry for entry in sources if not entry.get("duplicateOf")],
        *[entry for entry in sources if entry.get("duplicateOf")],
    ]:
        digest = source.get("sha256")
        if not digest or digest in seen_hashes:
            continue
        seen_hashes[digest] = {
            "ts": source.get("slackMessageTs"),
            "name": source.get("filename"),
            "fileId": source.get("slackFileId"),
        }
    source_index: dict[tuple[str, str], int] = {}
    for index, source in enumerate(sources):
        file_id = source.get("slackFileId")
        timestamp = source.get("slackMessageTs")
        if not file_id or not timestamp:
            continue
        occurrence = (str(timestamp), str(file_id))
        if occurrence in source_index:
            raise RuntimeError(
                f"{record['id']} has duplicate source occurrence {occurrence}"
            )
        source_index[occurrence] = index
    receipt_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for item in items:
        file_id = item.get("fileId")
        item_ts = item.get("ts")
        if not isinstance(file_id, str) or not file_id:
            raise RuntimeError(f"{record['id']} captured file has no Slack file ID")
        if not isinstance(item_ts, str) or not item_ts:
            raise RuntimeError(f"{record['id']} captured file has no Slack timestamp")
        canonical = seen_hashes.get(item["sha256"])
        url = state[upload_key(record["id"], item)]
        blob_content_type = normalized_content_type(item)
        source = {
            "filename": item["name"],
            "slackFileId": file_id,
            "slackMessageTs": item_ts,
            "localPath": item["localPath"],
            "size": item["size"],
            "sha256": item["sha256"],
            "contentType": blob_content_type,
            "blobUrl": url,
            "slackDeclaredSize": item["size"],
            "slackSizeVerified": True,
            "blobReadBackVerified": True,
            "blobReadBackVerifiedAt": receipt_at,
            "blobReadBackSize": item["size"],
            "blobReadBackSha256": item["sha256"],
            "blobReadBackContentType": blob_content_type,
            "blobReadBackReceiptVersion": BLOB_READ_BACK_RECEIPT_VERSION,
            "blobReadBackIdentity": f"{item['sha256']}:{blob_content_type}",
        }
        same_occurrence = bool(canonical) and (
            (
                canonical.get("fileId")
                and canonical["fileId"] == file_id
                and canonical.get("ts") == item_ts
            )
            or (
                not canonical.get("fileId")
                and canonical.get("ts") == item_ts
                and canonical.get("name") == item.get("name")
            )
        )
        if canonical and not same_occurrence:
            source["duplicateOf"] = {
                "slackMessageTs": canonical["ts"],
                "filename": canonical["name"],
            }
        else:
            seen_hashes[item["sha256"]] = {
                "ts": item_ts,
                "name": item.get("name"),
                "fileId": file_id,
            }
        occurrence = (item_ts, file_id)
        existing_index = source_index.get(occurrence)
        if existing_index is None:
            sources.append(source)
            source_index[occurrence] = len(sources) - 1
        else:
            sources[existing_index] = {**sources[existing_index], **source}
            if same_occurrence:
                sources[existing_index].pop("duplicateOf", None)

    row = rows.get(source_ts, {})
    identity = {
        "id": record["id"],
        "droppedBy": existing.get("droppedBy") or row.get("dropper"),
        "droppedAt": existing.get("droppedAt") or dropped_at(source_ts),
        "sourceChannel": existing.get("sourceChannel") or "homa-inspo",
        "sourceMessageTs": source_ts,
        "coversMessageTs": covers,
        "sourceFiles": sources,
        "blobUrl": (
            existing.get("blobUrl")
            if existing.get("blobUrl")
            else sources[0]["blobUrl"] if sources else None
        ),
    }
    if not existing:
        identity[authored_field] = planned_title

    stages = existing.get("stages") or {}
    if not isinstance(stages, dict):
        raise RuntimeError(f"{record['id']} existing stages is not an object")
    stages.setdefault("captured", receipt_at)
    stages["lastCaptured"] = receipt_at
    merged = {**existing, **identity, "stages": stages}
    path.parent.mkdir(parents=True, exist_ok=True)
    atomic_json(path, merged)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", required=True)
    parser.add_argument("--record")
    parser.add_argument("--jobs", type=int, default=3)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    load_local_env(REPO / "apps" / "web" / ".env.local")
    if not args.dry_run and not os.environ.get("BLOB_READ_WRITE_TOKEN"):
        print("ERROR: BLOB_READ_WRITE_TOKEN is required")
        return 2
    if not CAPTURE_MANIFEST.exists():
        print(f"ERROR: capture manifest missing: {CAPTURE_MANIFEST}")
        return 2

    try:
        plan = validate_plan_records(
            json.loads(Path(args.plan).read_text()).get("records", [])
        )
    except RuntimeError as error:
        print(f"ERROR: {error}")
        return 2
    if args.record:
        plan = [record for record in plan if record["id"] == args.record]
    if not plan:
        print("ERROR: plan selected no records")
        return 2
    captured = json.loads(CAPTURE_MANIFEST.read_text())
    if captured.get("failures"):
        print(f"ERROR: capture has {len(captured['failures'])} failure(s)")
        return 2

    files_by_ts: dict[str, list[dict]] = {}
    for item in captured.get("files", []):
        files_by_ts.setdefault(str(item["ts"]), []).append(item)

    try:
        selected_ts = [ts for record in plan for ts in capture_timestamps(record)]
    except RuntimeError as error:
        print(f"ERROR: {error}")
        return 2
    if len(selected_ts) != len(set(selected_ts)):
        print("ERROR: selected plan assigns a Slack message more than once")
        return 2
    try:
        validate_capture_coverage(
            selected_ts,
            files_by_ts,
            int(captured.get("messages") or 0),
            subset=bool(args.record),
        )
    except RuntimeError as error:
        print(f"ERROR: {error}")
        return 2

    rows = ledger_by_ts()
    state = json.loads(UPLOAD_STATE.read_text()) if UPLOAD_STATE.exists() else {}
    record_items: dict[str, list[dict]] = {}
    for record in plan:
        items = [item for ts in capture_timestamps(record) for item in files_by_ts[ts]]
        record_items[record["id"]] = items
        unique_hashes = len({item["sha256"] for item in items})
        unique_uploads = len(
            {
                (item["sha256"], normalized_content_type(item))
                for item in items
            }
        )
        print(
            f"{record['id']}: {len(items)} file(s), {unique_hashes} unique hash(es), "
            f"{unique_uploads} Blob representation(s)"
        )

    if args.dry_run:
        return 0

    futures = {}
    with ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
        for record in plan:
            unique_by_upload: dict[tuple[str, str], dict] = {}
            for item in record_items[record["id"]]:
                identity = (str(item["sha256"]), normalized_content_type(item))
                unique_by_upload.setdefault(identity, item)
            for item in unique_by_upload.values():
                future = pool.submit(upload_one, record["id"], item, state)
                futures[future] = (record["id"], item["name"])

        for future in as_completed(futures):
            record_id, name = futures[future]
            try:
                key, url, uploaded = future.result()
            except Exception as error:
                print(f"FAIL {record_id} {name}: {error}")
                atomic_json(UPLOAD_STATE, state)
                return 1
            state[key] = url
            atomic_json(UPLOAD_STATE, state)
            print(f"  {'uploaded' if uploaded else 'verified'} {record_id}  {name}")

    for record in plan:
        write_stub(record, record_items[record["id"]], state, rows)
    print(f"staged {len(plan)} record(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
