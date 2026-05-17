#!/usr/bin/env python3
"""OpenClaw daily janitor.

Cleans slop, rotates logs, ages stale files, and reports drift.
DEFAULT MODE IS DRY-RUN. Pass --live to actually mutate.

Tiers:
  1. Rotate / truncate logs (safe, auto in --live)
  2. Age stale files into archive/ (safe, auto in --live)
  3. MEMORY.md drift report — handled by the cron caller (Claude reads MEMORY.md)
  4. Health checks (read-only, always reported)

Safety rules:
  - Backups before any mutation
  - Action cap and freed-bytes cap per run
  - Strict don't-touch list
  - One JSON line per action in logs/janitor.jsonl
"""

import argparse
import datetime
import gzip
import json
import pathlib
import re
import shutil
import sys
import traceback
from collections import defaultdict

ROOT = pathlib.Path.home() / ".openclaw"
WORKSPACE = ROOT / "workspace"
LOGS_DIR = ROOT / "logs"
BACKUPS = WORKSPACE / "_janitor-backups"
AUDIT_LOG = LOGS_DIR / "janitor.jsonl"

NOW = datetime.datetime.now(datetime.timezone.utc)
TODAY = NOW.date()

# Hard "do not touch" list. Anything under these prefixes is refused, even if
# a future tier adds a rule that would otherwise match.
PROTECTED = [
    WORKSPACE / "children",
    WORKSPACE / "profile-history",
    WORKSPACE / "benchmarks",
    WORKSPACE / "practice",
    WORKSPACE / "feedback.jsonl",
    WORKSPACE / "MEMORY.md",
    WORKSPACE / "USER.md",
    WORKSPACE / "AGENTS.md",
    WORKSPACE / "SOUL.md",
    WORKSPACE / "IDENTITY.md",
    WORKSPACE / "BOOTSTRAP.md",
    WORKSPACE / "TOOLS.md",
    WORKSPACE / "HEARTBEAT.md",
    WORKSPACE / "skills",
    WORKSPACE / "scripts",
    WORKSPACE / "activities",
    WORKSPACE / "research-journal.md",
    WORKSPACE / "learning-journal.jsonl",
    WORKSPACE / "learning-loop-state.json",
    WORKSPACE / "children",
    pathlib.Path.home() / "Documents" / "Homeschool",
]

ACTION_CAP = 200  # higher to allow first-run cleanup; steady state is <10/day
FREED_MB_CAP = 500
DATE_PREFIX_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})")


class State:
    def __init__(self, dry: bool):
        self.dry = dry
        self.actions = 0
        self.bytes_freed = 0
        self.report_lines: list[str] = []
        self.warnings: list[str] = []
        self.tier_summary: dict[str, dict] = {}
        self._cap_warned = False

    def can_act(self) -> bool:
        if self.actions >= ACTION_CAP:
            if not self._cap_warned:
                self.warnings.append(f"ACTION_CAP reached ({ACTION_CAP}); stopping mutations.")
                self._cap_warned = True
            return False
        if self.bytes_freed >= FREED_MB_CAP * 1024 * 1024:
            if not self._cap_warned:
                self.warnings.append(f"FREED_MB_CAP reached ({FREED_MB_CAP}MB); stopping mutations.")
                self._cap_warned = True
            return False
        return True

    def audit(self, action: str, **kwargs):
        rec = {"ts": NOW.isoformat(), "dry": self.dry, "action": action, **kwargs}
        AUDIT_LOG.parent.mkdir(parents=True, exist_ok=True)
        with AUDIT_LOG.open("a") as f:
            f.write(json.dumps(rec) + "\n")
        self.report_lines.append(rec)


def is_protected(path: pathlib.Path) -> bool:
    try:
        p = path.resolve()
    except OSError:
        return True
    for pre in PROTECTED:
        try:
            pre_resolved = pre.resolve()
        except OSError:
            continue
        if p == pre_resolved:
            return True
        try:
            p.relative_to(pre_resolved)
            return True
        except ValueError:
            pass
    return False


def safe_move(state: State, src: pathlib.Path, dst: pathlib.Path) -> bool:
    if is_protected(src):
        state.warnings.append(f"REFUSED move (protected): {src}")
        return False
    if not state.can_act():
        return False
    size = src.stat().st_size if src.is_file() else 0
    if not state.dry:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dst))
    state.actions += 1
    state.bytes_freed += size
    state.audit("move", src=str(src), dst=str(dst), bytes=size)
    return True


def safe_delete(state: State, path: pathlib.Path) -> bool:
    if is_protected(path):
        state.warnings.append(f"REFUSED delete (protected): {path}")
        return False
    if not state.can_act():
        return False
    size = path.stat().st_size if path.is_file() else 0
    if not state.dry:
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink()
    state.actions += 1
    state.bytes_freed += size
    state.audit("delete", path=str(path), bytes=size)
    return True


def backup_critical(state: State):
    """Snapshot critical files before any mutation. Rotated 14 days."""
    if state.dry:
        return
    backup_dir = BACKUPS / TODAY.isoformat()
    backup_dir.mkdir(parents=True, exist_ok=True)
    targets = [
        ROOT / "cron" / "jobs.json",
        ROOT / "openclaw.json",
        WORKSPACE / "MEMORY.md",
        WORKSPACE / "children",
        WORKSPACE / "learning-loop-state.json",
        WORKSPACE / "email-triage-state.json",
    ]
    for t in targets:
        if t.exists():
            shutil.copy2(t, backup_dir / t.name)
    # Rotate
    for d in BACKUPS.iterdir() if BACKUPS.exists() else []:
        if not d.is_dir():
            continue
        try:
            day = datetime.date.fromisoformat(d.name)
        except ValueError:
            continue
        if (TODAY - day).days > 14:
            shutil.rmtree(d)


# ─── Tier 1: Rotate / truncate ─────────────────────────────────────────────


def tier1_rotate_gateway_logs(state: State) -> dict:
    rotated = []
    for name in ("gateway.log", "gateway.err.log"):
        path = LOGS_DIR / name
        if not path.exists() or path.stat().st_size < 1_000_000:
            continue
        # Shift .2.gz → .3.gz, .1.gz → .2.gz, drop .3.gz
        gen3 = LOGS_DIR / f"{name}.3.gz"
        gen2 = LOGS_DIR / f"{name}.2.gz"
        gen1 = LOGS_DIR / f"{name}.1.gz"
        if gen3.exists():
            safe_delete(state, gen3)
        if gen2.exists() and not state.dry:
            gen2.rename(gen3)
            state.audit("rotate-shift", src=str(gen2), dst=str(gen3))
        if gen1.exists() and not state.dry:
            gen1.rename(gen2)
            state.audit("rotate-shift", src=str(gen1), dst=str(gen2))
        if not state.dry:
            with path.open("rb") as fin, gzip.open(gen1, "wb") as fout:
                shutil.copyfileobj(fin, fout)
            path.write_bytes(b"")
        size = path.stat().st_size if state.dry else 0
        state.actions += 1
        state.audit("rotate-gzip", path=str(path), original_bytes=size)
        rotated.append(name)
    return {"rotated": rotated}


def tier1_truncate_cron_run_logs(state: State) -> dict:
    runs_dir = ROOT / "cron" / "runs"
    if not runs_dir.is_dir():
        return {"truncated": 0, "orphaned": 0}
    archive = runs_dir / "archive"
    job_ids: set[str] = set()
    jobs_file = ROOT / "cron" / "jobs.json"
    if jobs_file.exists():
        try:
            jobs = json.loads(jobs_file.read_text())
            job_ids = {j["id"] for j in jobs.get("jobs", [])}
        except (json.JSONDecodeError, KeyError):
            state.warnings.append("Could not parse cron/jobs.json for orphan check.")

    truncated = 0
    orphaned = 0
    for f in runs_dir.glob("*.jsonl"):
        if not f.is_file():
            continue
        stem = f.stem
        # Orphan: file whose ID is no longer a current job
        if job_ids and stem not in job_ids:
            dst = archive / "orphaned" / f.name
            if safe_move(state, f, dst):
                orphaned += 1
            continue
        try:
            lines = f.read_text().splitlines()
        except OSError:
            continue
        if len(lines) <= 30:
            continue
        keep = lines[-30:]
        old = lines[:-30]
        archive_file = archive / f"{stem}-{TODAY.strftime('%Y-%m')}.jsonl"
        if not state.dry:
            archive_file.parent.mkdir(parents=True, exist_ok=True)
            with archive_file.open("a") as af:
                af.write("\n".join(old) + "\n")
            f.write_text("\n".join(keep) + "\n")
        state.actions += 1
        state.audit("truncate-cron-runs", path=str(f), trimmed=len(old))
        truncated += 1
    return {"truncated": truncated, "orphaned": orphaned}


def tier1_collapse_triage_log(state: State) -> dict:
    path = WORKSPACE / "email-triage-log.jsonl"
    if not path.exists():
        return {"collapsed": 0}
    try:
        raw = [json.loads(l) for l in path.read_text().splitlines() if l.strip()]
    except json.JSONDecodeError:
        state.warnings.append("email-triage-log.jsonl has malformed lines; skipping collapse.")
        return {"collapsed": 0}
    by_day: dict[str, list[dict]] = defaultdict(list)
    for entry in raw:
        day = (entry.get("ts", "") or "")[:10]
        by_day[day].append(entry)

    today_str = TODAY.isoformat()
    yesterday_str = (TODAY - datetime.timedelta(days=1)).isoformat()
    new_lines: list[str] = []
    collapsed_total = 0
    for day, entries in sorted(by_day.items()):
        if day in (today_str, yesterday_str):
            new_lines.extend(json.dumps(e) for e in entries)
            continue
        all_quiet = all(
            e.get("important", 0) == 0 and e.get("new_pinged", 0) == 0 and e.get("errors", 0) == 0
            for e in entries
        )
        if all_quiet and len(entries) > 1:
            summary = {
                "ts": day + "T23:59:59Z",
                "scanned": sum(e.get("scanned", 0) for e in entries),
                "important": 0,
                "new_pinged": 0,
                "skipped_dedup": sum(e.get("skipped_dedup", 0) for e in entries),
                "errors": 0,
                "_collapsed_runs": len(entries),
            }
            new_lines.append(json.dumps(summary))
            collapsed_total += len(entries) - 1
        else:
            new_lines.extend(json.dumps(e) for e in entries)

    if collapsed_total > 0:
        if not state.dry:
            path.write_text("\n".join(new_lines) + "\n")
        state.actions += 1
        state.audit("collapse-triage-log", removed=collapsed_total, kept=len(new_lines))
    return {"collapsed": collapsed_total}


def tier1_bak_retention(state: State) -> dict:
    deleted = 0
    # openclaw.json.bak* — keep newest 3
    candidates = sorted(
        ROOT.glob("openclaw.json.bak*"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    for old in candidates[3:]:
        if safe_delete(state, old):
            deleted += 1
    return {"deleted_baks": deleted}


# ─── Tier 2: Age stale files ───────────────────────────────────────────────


def tier2_age_memory_dailies(state: State) -> dict:
    mem_dir = WORKSPACE / "memory"
    if not mem_dir.is_dir():
        return {"aged": 0}
    cutoff = TODAY - datetime.timedelta(days=30)
    archive = mem_dir / "archive"
    aged = 0
    for f in mem_dir.iterdir():
        if not f.is_file():
            continue
        m = DATE_PREFIX_RE.match(f.name)
        if not m:
            continue
        try:
            file_date = datetime.date.fromisoformat(m.group(1))
        except ValueError:
            continue
        if file_date >= cutoff:
            continue
        dst = archive / file_date.strftime("%Y-%m") / f.name
        if safe_move(state, f, dst):
            aged += 1
    return {"aged": aged}


def tier2_age_root_media(state: State) -> dict:
    """Move root-level media older than 30d into _archive/{yyyy-mm}/.
    Only operates on files directly in WORKSPACE root, never subdirs.
    """
    cutoff_ts = (NOW - datetime.timedelta(days=30)).timestamp()
    media_exts = {".jpg", ".jpeg", ".png", ".pdf", ".svg", ".html", ".mp3", ".mp4", ".webp", ".gif"}
    archive = WORKSPACE / "_archive"
    aged = 0
    for f in WORKSPACE.iterdir():
        if not f.is_file():
            continue
        if f.suffix.lower() not in media_exts:
            continue
        if f.stat().st_mtime > cutoff_ts:
            continue
        ym = datetime.date.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m")
        dst = archive / ym / f.name
        if safe_move(state, f, dst):
            aged += 1
    return {"aged_media": aged}


# ─── Tier 4: Health checks (read-only) ────────────────────────────────────


def tier4_health(state: State) -> dict:
    findings: list[str] = []

    # Failing crons
    jobs_file = ROOT / "cron" / "jobs.json"
    failing: list[str] = []
    if jobs_file.exists():
        try:
            jobs = json.loads(jobs_file.read_text())
            for j in jobs.get("jobs", []):
                st = j.get("state", {})
                if st.get("consecutiveErrors", 0) > 0 or st.get("lastRunStatus") == "error":
                    err = st.get("lastError", "no error msg")
                    failing.append(f"{j['name']}: {err}")
        except (json.JSONDecodeError, KeyError):
            findings.append("Could not parse cron/jobs.json for health check.")
    for f in failing:
        findings.append(f"FAILING_CRON: {f}")

    # Stale state cursors
    for sf_name in ("learning-loop-state.json", "email-triage-state.json"):
        sf = WORKSPACE / sf_name
        if not sf.exists():
            continue
        try:
            data = json.loads(sf.read_text())
        except json.JSONDecodeError:
            findings.append(f"MALFORMED: {sf_name}")
            continue
        last_run = data.get("last_run")
        if last_run:
            try:
                t = datetime.datetime.fromisoformat(last_run.replace("Z", "+00:00"))
                age_days = (NOW - t).days
                if age_days > 7:
                    findings.append(f"STALE_CURSOR: {sf_name} last_run={last_run} ({age_days}d ago)")
            except ValueError:
                pass

    # pinged_message_ids bloat
    triage = WORKSPACE / "email-triage-state.json"
    if triage.exists():
        try:
            data = json.loads(triage.read_text())
            n = len(data.get("pinged_message_ids", []))
            if n > 1000:
                findings.append(
                    f"BLOAT: email-triage-state.pinged_message_ids has {n} entries "
                    "(no timestamp pruning — schema needs timestamps)"
                )
        except json.JSONDecodeError:
            pass

    # Workspace size growth (relative to yesterday's snapshot if present)
    state_file = WORKSPACE / "_archive" / ".janitor-disk-state.json"
    try:
        total = sum(
            p.stat().st_size for p in WORKSPACE.rglob("*") if p.is_file()
        )
    except OSError:
        total = 0
    prev = None
    if state_file.exists():
        try:
            prev = json.loads(state_file.read_text())
        except json.JSONDecodeError:
            prev = None
    if prev and "bytes" in prev:
        delta = total - prev["bytes"]
        if delta > 100 * 1024 * 1024:
            findings.append(f"DISK_GROWTH: workspace grew {delta // 1_048_576}MB since last run")
    if not state.dry:
        state_file.parent.mkdir(parents=True, exist_ok=True)
        state_file.write_text(json.dumps({"ts": NOW.isoformat(), "bytes": total}))

    state.warnings.extend(findings)
    return {"findings": findings, "workspace_bytes": total}


# ─── Main ──────────────────────────────────────────────────────────────────


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true", help="Mutate (default: dry-run)")
    ap.add_argument("--report-file", help="Write JSON report here")
    args = ap.parse_args()

    state = State(dry=not args.live)
    summary: dict = {"ts": NOW.isoformat(), "mode": "live" if args.live else "dry-run"}

    try:
        if args.live:
            backup_critical(state)
        summary["tier1_gateway"] = tier1_rotate_gateway_logs(state)
        summary["tier1_cron_runs"] = tier1_truncate_cron_run_logs(state)
        summary["tier1_triage"] = tier1_collapse_triage_log(state)
        summary["tier1_baks"] = tier1_bak_retention(state)
        summary["tier2_memory"] = tier2_age_memory_dailies(state)
        summary["tier2_root_media"] = tier2_age_root_media(state)
        summary["tier4_health"] = tier4_health(state)
    except Exception as e:
        state.warnings.append(f"FATAL: {e}\n{traceback.format_exc()}")

    summary["actions"] = state.actions
    summary["bytes_freed"] = state.bytes_freed
    summary["mb_freed"] = round(state.bytes_freed / 1_048_576, 2)
    summary["warnings"] = state.warnings

    out = json.dumps(summary, indent=2)
    print(out)
    if args.report_file:
        pathlib.Path(args.report_file).write_text(out)


if __name__ == "__main__":
    main()
