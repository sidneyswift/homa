#!/usr/bin/env python3
"""Homa doctor — read-only scored health check of the whole Homa OS.

The verification surface: answers "is Homa consistent?" with checkable evidence, not a feeling.
READ-ONLY. Finds and reports problems; never fixes them (the janitor / reflect fix). A doctor that
edits the workspace is a cage, not a gauge.

Deterministic fast path for the `homa-system-doctor` skill. Walks the filesystem, scores 0-100, and
writes `operations/health.md` with a dated punch list. Exits non-zero when findings exist (severity
>= "warn") so a caller can gate on it.

The SKILL.md is the full contract — it adds the live checks this script can't do offline (cron-armed
via `openclaw cron list`, dashboard-vs-reality, CLI-command lint). This script makes the mechanical
subset cheap and reliable.

Usage: python3 scripts/doctor.py [--json]
"""

import argparse
import datetime
import json
import pathlib
import re
import sys

ROOT = pathlib.Path.home() / ".openclaw"
WORKSPACE = ROOT / "workspace"
SKILLS_DIR = WORKSPACE / "skills"
AGENTS_MD = WORKSPACE / "AGENTS.md"
HEALTH_MD = WORKSPACE / "operations" / "health.md"

NOW = datetime.datetime.now(datetime.timezone.utc)

# The skill-naming convention (enforced rule). Every skill dir must match:
#   homa-<category>-<what>   with category in this set and what in kebab-case.
ALLOWED_CATEGORIES = {"system", "make", "google", "track", "capture"}
NAME_RE = re.compile(r"^homa-(" + "|".join(sorted(ALLOWED_CATEGORIES)) + r")-[a-z0-9]+(-[a-z0-9]+)*$")

# Severity → points subtracted from 100.
WEIGHTS = {"high": 15, "warn": 7, "low": 2}


def add(findings, sev, check, what, where):
    findings.append({"severity": sev, "check": check, "what": what, "where": where})


# ─── Checks ──────────────────────────────────────────────────────────────────

def skill_dirs():
    if not SKILLS_DIR.is_dir():
        return []
    return sorted(p for p in SKILLS_DIR.iterdir() if p.is_dir() and not p.name.startswith("."))


def check_naming(findings):
    """Every skill folder follows homa-<category>-<what> with an allowed category."""
    for d in skill_dirs():
        if not NAME_RE.match(d.name):
            cat = d.name.split("-")[1] if d.name.startswith("homa-") and "-" in d.name[5:] else None
            why = (f"category '{cat}' not in {sorted(ALLOWED_CATEGORIES)}"
                   if cat and cat not in ALLOWED_CATEGORIES
                   else "must be homa-<category>-<what>, all-lowercase kebab-case")
            add(findings, "warn", "naming", f"skill '{d.name}' breaks the naming convention ({why})",
                f"skills/{d.name}/")


def check_skill_structure(findings):
    """Every skill dir has a SKILL.md whose frontmatter name matches the dir."""
    for d in skill_dirs():
        sk = d / "SKILL.md"
        if not sk.exists():
            add(findings, "high", "structure", f"skill '{d.name}' has no SKILL.md", f"skills/{d.name}/")
            continue
        text = sk.read_text(errors="replace")
        m = re.search(r"(?m)^name:\s*(.+?)\s*$", text)
        if not m:
            add(findings, "warn", "structure", f"skill '{d.name}' SKILL.md has no frontmatter name",
                f"skills/{d.name}/SKILL.md")
        elif m.group(1).strip() != d.name:
            add(findings, "warn", "structure",
                f"frontmatter name '{m.group(1).strip()}' != dir '{d.name}'",
                f"skills/{d.name}/SKILL.md")
        if not re.search(r"(?m)^description:\s*\S", text):
            add(findings, "warn", "structure", f"skill '{d.name}' has no description (unroutable)",
                f"skills/{d.name}/SKILL.md")


def quickref_names():
    """Skill names listed in the AGENTS.md '🧩 Skills (Quick Reference)' section (backticked)."""
    if not AGENTS_MD.exists():
        return None
    text = AGENTS_MD.read_text(errors="replace")
    m = re.search(r"Skills \(Quick Reference\)(.+?)(\nThese skills are loaded|\Z)", text, re.S)
    section = m.group(1) if m else ""
    # Only skill names (homa-*) — excludes the category-rule bullets (`system`, `make`, …).
    return set(re.findall(r"-\s+\*\*`(homa-[a-z0-9-]+)`\*\*", section))


def check_quickref_parity(findings):
    """No dark skills: every skill dir is listed in the quick reference, and vice versa."""
    listed = quickref_names()
    if listed is None:
        add(findings, "high", "quickref", "AGENTS.md not found", "AGENTS.md")
        return
    dirs = {d.name for d in skill_dirs()}
    for missing in sorted(dirs - listed):
        add(findings, "warn", "quickref",
            f"dark skill: '{missing}' exists but is not in the AGENTS.md Quick Reference",
            "AGENTS.md")
    for ghost in sorted(listed - dirs):
        add(findings, "warn", "quickref",
            f"stale entry: Quick Reference lists '{ghost}' but no such skill dir exists", "AGENTS.md")


def check_stale_cursors(findings):
    for name in ("learning-loop-state.json", "email-triage-state.json"):
        sf = WORKSPACE / name
        if not sf.exists():
            continue
        try:
            data = json.loads(sf.read_text())
        except json.JSONDecodeError:
            add(findings, "high", "state", f"malformed JSON: {name}", name)
            continue
        last = data.get("last_run") or data.get("last_processed_ts")
        if isinstance(last, str) and "T" in last:
            try:
                t = datetime.datetime.fromisoformat(last.replace("Z", "+00:00"))
                age = (NOW - t).days
                if age > 7:
                    add(findings, "warn", "state", f"{name} stale ({age}d since last_run)", name)
            except ValueError:
                pass


def check_heartbeat_state(findings):
    # The heartbeat must PERSIST what it checked, or every beat runs blind and
    # falsely concludes "nothing new" (this is what let the CM DC syllabus deadline
    # sit, 2026-06-27). Flag a frozen heartbeat-state: newest lastChecks epoch-ms
    # timestamp older than 2 days means the heartbeat isn't writing state.
    sf = WORKSPACE / "memory" / "heartbeat-state.json"
    if not sf.exists():
        add(findings, "warn", "state", "memory/heartbeat-state.json missing", "memory/heartbeat-state.json")
        return
    try:
        data = json.loads(sf.read_text())
    except json.JSONDecodeError:
        add(findings, "high", "state", "malformed JSON: heartbeat-state.json", "memory/heartbeat-state.json")
        return
    checks = data.get("lastChecks") or {}
    vals = [v for v in checks.values() if isinstance(v, (int, float))]
    if not vals:
        add(findings, "warn", "state", "heartbeat-state has no lastChecks timestamps", "memory/heartbeat-state.json")
        return
    newest_ms = max(vals)
    age_days = (NOW.timestamp() * 1000 - newest_ms) / 86_400_000
    if age_days > 2:
        # Escalate a CHRONICALLY frozen heartbeat to high. A 2-3d freeze is a
        # warn (may just be a quiet weekend); but >3d means the heartbeat has
        # been blind across multiple daily cycles and reflect has surfaced it
        # for consecutive nights with no repair (the restricted reflect cron
        # can't fix the heartbeat cron itself). A persistent warn that never
        # escalates just gets surfaced-and-ignored — so past ~3.5d the finding
        # goes high, forcing a main-session look instead of another quiet night.
        # (Grounded: heartbeat-state frozen since 2026-06-28, flagged 06-30 /
        # 07-01 / 07-02 — 3 consecutive reflect passes, catcher firing, cause
        # unrepaired from the restricted run.)
        sev = "high" if age_days > 3.5 else "warn"
        add(findings, sev, "state",
            f"heartbeat-state frozen ({age_days:.0f}d since newest check) — heartbeat may be running blind",
            "memory/heartbeat-state.json")


def check_feedback_loop(findings):
    # The what-works keystone (shipped 2026-06-29) reads content/learners/story/
    # what-works.md, which the 👍/👎 reaction loop is supposed to populate via
    # homa-capture-feedback -> feedback.jsonl. But feedback.jsonl has been EMPTY
    # since 2026-04-25 (2+ months). Either the parent never reacts (UX reality) or the
    # inbound reaction event never reaches the agent (unwired catcher — config has
    # only outbound statusReactions, no reaction_added delivery). Flag it LOW so
    # the dead loop stays visible instead of silently starving the keystone.
    # Stops firing the moment a single feedback event lands, OR if the partner drops a
    # sentinel file operations/.feedback-loop-ack (acknowledged as UX reality).
    fb = WORKSPACE / "feedback.jsonl"
    ack = WORKSPACE / "operations" / ".feedback-loop-ack"
    if ack.exists():
        return
    if not fb.exists():
        add(findings, "low", "feedback-loop", "feedback.jsonl missing — reaction learning loop not capturing", "feedback.jsonl")
        return
    has_event = any(line.strip() for line in fb.read_text().splitlines())
    if not has_event:
        add(findings, "low", "feedback-loop",
            "feedback.jsonl empty since 2026-04-25 — 👍/👎 loop never populated; the what-works "
            "keystone has no signal. Verify Slack reaction_added events reach the agent, or ack as "
            "UX-reality via operations/.feedback-loop-ack",
            "feedback.jsonl")


def check_config(findings):
    cfg = ROOT / "openclaw.json"
    if not cfg.exists():
        add(findings, "high", "config", "openclaw.json missing", "openclaw.json")
        return
    try:
        json.loads(cfg.read_text())
    except json.JSONDecodeError as e:
        add(findings, "high", "config", f"openclaw.json does not parse: {e}", "openclaw.json")
    if not (ROOT / "openclaw.json.last-good").exists():
        add(findings, "low", "config", "no openclaw.json.last-good backup present", "openclaw.json.last-good")


def check_draft_debt(findings):
    # Files that *document* the marker string rather than carry a real draft annotation.
    SELF = {"operations/health.md", "skills/homa-system-doctor/SKILL.md",
            "skills/homa-system-skillify/SKILL.md"}
    n = 0
    for md in WORKSPACE.glob("**/*.md"):
        if "_janitor-backups" in md.parts or "_archive" in md.parts or "archive" in md.parts:
            continue
        if md.relative_to(WORKSPACE).as_posix() in SELF:
            continue
        try:
            body = md.read_text(errors="replace").lower()
            n += body.count("draft — confirm") + body.count("draft - confirm")
        except OSError:
            pass
    if n:
        add(findings, "low", "draft-debt", f"{n} 'draft — confirm' markers awaiting confirmation",
            "workspace/**")


def check_organs(findings):
    """The self-management organs are wired."""
    if not (WORKSPACE / ".git").is_dir():
        add(findings, "warn", "organs",
            "git safety net not armed (.git missing) — autonomous builds aren't revertable",
            "workspace/.git")
    if not (WORKSPACE / "operations" / "improvements.md").exists():
        add(findings, "warn", "organs", "no operations/improvements.md (reflect Lens A unwired)",
            "operations/")
    roadmap = WORKSPACE / "operations" / "roadmap.md"
    if not roadmap.exists():
        add(findings, "warn", "organs", "no operations/roadmap.md (reflect Lens B / capability backlog unwired)",
            "operations/")
    else:
        # Roadmap is rewritten nightly; a stale last-groomed date means reflect stopped running.
        m = re.search(r"(?m)^last-groomed:\s*(\d{4}-\d{2}-\d{2})", roadmap.read_text(errors="replace"))
        if not m:
            add(findings, "warn", "organs", "roadmap.md missing a 'last-groomed:' date stamp",
                "operations/roadmap.md")
        else:
            try:
                d = datetime.date.fromisoformat(m.group(1))
                age = (NOW.date() - d).days
                if age > 3:
                    add(findings, "warn", "organs",
                        f"roadmap not groomed in {age}d — nightly reflect may have stopped",
                        "operations/roadmap.md")
            except ValueError:
                add(findings, "warn", "organs", "roadmap 'last-groomed:' date unparseable",
                    "operations/roadmap.md")


# ─── Score + report ──────────────────────────────────────────────────────────

# Workspace-root allowlist: the spine (machinery + state) + the content/ root + archives.
# Anything else loose at root is content that belongs filed under content/ (see content/AGENTS.md).
SPINE_ROOT = {
    # brain
    "AGENTS.md", "SOUL.md", "TOOLS.md", "USER.md", "HEARTBEAT.md", "IDENTITY.md", "MEMORY.md",
    # root-level state/data the runtime reads+writes by absolute path
    "story-profile.json", "word-of-the-week.json", "research-journal.md",
    "feedback.jsonl", "journal.jsonl", "journal-prompts.jsonl", "learning-loop-state.json",
    "learning-journal.jsonl", "email-triage-state.json", "email-triage-log.jsonl",
    # spine dirs
    "content", "scripts", "skills", "operations", "memory", "benchmarks", "practice",
    "research", "profile-history", "activities", "dashboard-deploy", "fonts", "clipart",
    "reference-images", "archive", "_janitor-backups",
}


def check_root_hygiene(findings):
    """No stray content loose at the workspace root — it belongs filed under content/."""
    stray = [p.name for p in WORKSPACE.iterdir()
             if not p.name.startswith(".") and p.name not in SPINE_ROOT]
    if stray:
        stray.sort()
        examples = ", ".join(stray[:8]) + (f", +{len(stray) - 8} more" if len(stray) > 8 else "")
        add(findings, "low", "root-hygiene",
            f"{len(stray)} loose entr{'y' if len(stray) == 1 else 'ies'} at workspace root "
            f"— file under content/ per content/AGENTS.md ({examples})",
            "workspace/")


def canon_slugs():
    """The 15 canonical domain slugs, derived from benchmarks/ (the spine's own vocabulary)
    so the check auto-tracks when a domain is added — never a hardcoded list to drift."""
    bdir = WORKSPACE / "benchmarks"
    if not bdir.is_dir():
        return None
    return {p.stem for p in bdir.glob("*.md") if p.stem.lower() != "readme"}


KEBAB_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def check_content_taxonomy(findings):
    """content/curriculum/ subject folders must be clean kebab-case (the parent's binder, organized for Homa).
    Subjects that map to a scoring domain SHOULD use the benchmark slug (soft convention in AGENTS, not
    enforced here — curriculum is the human's-language binder, not a strict 15-domain mirror)."""
    cur = WORKSPACE / "content" / "curriculum"
    if not cur.is_dir():
        return
    for d in cur.iterdir():
        if d.is_dir() and not KEBAB_RE.match(d.name):
            add(findings, "warn", "taxonomy",
                f"content/curriculum/{d.name} is not clean kebab-case (subjects must be lowercase-hyphen)",
                f"content/curriculum/{d.name}/")


def check_version_pairs(findings):
    """Versioning must be an in-folder convention, not a sibling `<x>` + `<x>-v2` folder pair."""
    SKIP = {"archive", "_archive", "_janitor-backups", ".git"}
    scan_roots = [WORKSPACE]
    cdir = WORKSPACE / "content"
    if cdir.is_dir():
        scan_roots += [p for p in cdir.iterdir() if p.is_dir()]
    pair_re = re.compile(r"^(.*?)-v\d+$")
    for root in scan_roots:
        try:
            names = {p.name for p in root.iterdir() if p.is_dir() and p.name not in SKIP}
        except OSError:
            continue
        for name in names:
            m = pair_re.match(name)
            if m and m.group(1) in names:
                add(findings, "warn", "version-pair",
                    f"version-scatter: '{name}' sibling of '{m.group(1)}' — use one folder + versions/ subfolder",
                    f"{root.relative_to(WORKSPACE)}/" if root != WORKSPACE else "workspace/")


def run():
    findings: list[dict] = []
    for check in (check_naming, check_skill_structure, check_quickref_parity,
                  check_stale_cursors, check_heartbeat_state, check_config,
                  check_feedback_loop, check_draft_debt, check_organs,
                  check_root_hygiene, check_content_taxonomy, check_version_pairs):
        check(findings)

    score = 100
    for f in findings:
        score -= WEIGHTS.get(f["severity"], 5)
    score = max(0, score)

    order = {"high": 0, "warn": 1, "low": 2}
    findings.sort(key=lambda f: order.get(f["severity"], 9))
    return score, findings


def write_report(score, findings):
    HEALTH_MD.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Homa Health",
        "",
        "Read-only health surface, written by `scripts/doctor.py` (the `homa-system-doctor` fast path).",
        "The janitor and any 'is it consistent?' claim gate on this. Findings are fixed by the janitor /",
        "`homa-system-reflect`, never by the doctor.",
        "",
        f"**Last run:** {NOW.isoformat(timespec='seconds')}",
        f"**Score:** {score}/100",
        f"**Findings:** {len(findings)}",
        "",
    ]
    if not findings:
        lines.append("✅ Clean — no findings. A genuine pass is a success, not a non-event.")
    else:
        lines.append("| sev | check | what | where |")
        lines.append("|-----|-------|------|-------|")
        for f in findings:
            what = f["what"].replace("|", "\\|")
            lines.append(f"| {f['severity']} | {f['check']} | {what} | `{f['where']}` |")
    HEALTH_MD.write_text("\n".join(lines) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true", help="emit JSON to stdout")
    args = ap.parse_args()

    score, findings = run()
    write_report(score, findings)

    if args.json:
        print(json.dumps({"score": score, "findings": findings}, indent=2))
    else:
        print(f"Homa doctor: {score}/100, {len(findings)} finding(s) → operations/health.md")
        for f in findings:
            print(f"  [{f['severity']:>4}] {f['check']}: {f['what']}")

    sys.exit(1 if any(f["severity"] in ("high", "warn") for f in findings) else 0)


if __name__ == "__main__":
    main()
