#!/usr/bin/env python3
"""
score_bundle.py: the deterministic quality floor for staged marketing bundles.

The AI gates (marketing-copy-reviewer, marketing-copy-editor) are the bar;
this script only catches regressions mechanically, per spec
docs/homa-planning/14-marketing-demand-engine.md section 14. Checks:

  1. grounding      meta.yml source resolves to a real signal whose own
                    source.ref resolves; banned paths appear nowhere
  2. voice          em/en dash, anti-slop banlist (parsed from
                    marketing/voice/house-style.md), HOMA in prose,
                    "behind" framing, sibling comparisons
  3. duplication    title/body similarity vs drafts, published, and the blog
  4. completeness   every meta.yml format file exists; platform length
                    limits; email subject; video present when the lane ran

Usage:
  python3 marketing/evals/score_bundle.py <bundle-dir>
      [--signals-dir marketing/signals]
      [--scorecards-dir marketing/evals/scorecards]

Exit code 0 = floor passed, 1 = findings (or bundle unreadable).
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
HOUSE_STYLE = REPO_ROOT / "marketing" / "voice" / "house-style.md"

BANNED_PATHS = ("homa-macmini/", "homa-research/", "homa-template/")

DASH_RE = re.compile(r"[\u2014\u2013]")
HOMA_CAPS_RE = re.compile(r"\bHOMA\b")
BEHIND_RE = re.compile(r"falling behind|\bis behind\b", re.IGNORECASE)
SIBLING_RE = re.compile(
    r"than (his|her|their) (brother|sister|sibling)", re.IGNORECASE
)

# Platform limits mirror the format-rules table in voice/house-style.md.
# If that table changes, change these together (the janitor flags drift).
CHAR_LIMITS = {
    "captions/tiktok.md": 2200,
    "captions/instagram.md": 2200,
    "captions/youtube.md": 5100,  # title 100 + description 5000
    "x.md": 280,
}
EMAIL_SUBJECT_MAX = 50
PIN_TITLE_MAX = 100
PIN_DESCRIPTION_MAX = 500
DUP_RATIO = 0.7


def load_banlist() -> list[str]:
    """Parse backtick-quoted phrases from house-style's anti-slop section."""
    if not HOUSE_STYLE.exists():
        return []
    text = HOUSE_STYLE.read_text(encoding="utf-8")
    match = re.search(r"## Anti-slop banlist\n(.*?)(?:\n## |\Z)", text, re.DOTALL)
    if not match:
        return []
    return re.findall(r"^- `(.+?)`$", match.group(1), re.MULTILINE)


def parse_meta(meta_path: Path) -> dict:
    """Parse the small meta.yml subset the scorer needs, no yaml dependency."""
    text = meta_path.read_text(encoding="utf-8")
    meta = {"formats": []}
    for key in ("id", "source"):
        m = re.search(rf"^{key}:\s*(\S+)", text, re.MULTILINE)
        meta[key] = m.group(1) if m else None
    lanes = re.search(r"^lanes:\s*\[(.*?)\]", text, re.MULTILINE)
    meta["lanes"] = (
        [x.strip() for x in lanes.group(1).split(",") if x.strip()] if lanes else []
    )
    for m in re.finditer(
        r"\{file:\s*([^,}]+),\s*channel:\s*([^,}]+),\s*status:\s*([^,}]+)\}", text
    ):
        meta["formats"].append(
            {"file": m.group(1).strip(), "channel": m.group(2).strip(),
             "status": m.group(3).strip()}
        )
    return meta


def bundle_text_files(bundle: Path) -> list[Path]:
    return sorted(
        p for p in bundle.rglob("*") if p.suffix in (".md", ".mdx") and p.is_file()
    )


def normalize_title(title: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", "", title.lower())).strip()


def read_frontmatter_title(mdx: Path) -> str:
    m = re.search(r'^title:\s*"?(.*?)"?\s*$', mdx.read_text(encoding="utf-8"),
                  re.MULTILINE)
    return m.group(1) if m else ""


def body_of(mdx: Path) -> str:
    text = mdx.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    return parts[2] if len(parts) == 3 else text


def is_published_blog_mirror(article: Path, other: Path) -> bool:
    """Ignore the exact web copy created by the blog distributor."""
    published_root = REPO_ROOT / "marketing" / "content" / "published"
    blog_root = REPO_ROOT / "apps" / "web" / "content" / "blog"
    if article.parent.parent != published_root or other.parent != blog_root:
        return False
    slug = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", article.parent.name)
    return other == blog_root / f"{slug}.mdx"


class Findings:
    def __init__(self) -> None:
        self.items: list[dict] = []

    def fail(self, check: str, file: str, detail: str) -> None:
        self.items.append({"check": check, "file": file, "detail": detail})

    def by_check(self) -> dict:
        out: dict[str, int] = {}
        for item in self.items:
            out[item["check"]] = out.get(item["check"], 0) + 1
        return out


def check_grounding(bundle: Path, meta: dict, signals_dir: Path, f: Findings) -> None:
    source = meta.get("source")
    if not source:
        f.fail("grounding", "meta.yml", "no source field")
        return
    candidates = [REPO_ROOT / source, signals_dir / Path(source).name]
    signal = next((c for c in candidates if c.exists()), None)
    if signal is None:
        f.fail("grounding", "meta.yml", f"source signal not found: {source}")
    else:
        ref = re.search(r"^\s*ref:\s*(\S+)", signal.read_text(encoding="utf-8"),
                        re.MULTILINE)
        if not ref:
            f.fail("grounding", str(signal), "signal has no source.ref")
        elif not (REPO_ROOT / ref.group(1)).exists():
            f.fail("grounding", str(signal),
                   f"signal source.ref does not resolve: {ref.group(1)}")
    for path in bundle_text_files(bundle) + [bundle / "meta.yml"]:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        for banned in BANNED_PATHS:
            if banned in text:
                f.fail("grounding", str(path.relative_to(bundle)),
                       f"banned source path mentioned: {banned}")


def check_voice(bundle: Path, banlist: list[str], f: Findings) -> None:
    for path in bundle_text_files(bundle):
        rel = str(path.relative_to(bundle))
        text = path.read_text(encoding="utf-8")
        lower = text.lower()
        for i, line in enumerate(text.splitlines(), 1):
            if DASH_RE.search(line):
                f.fail("voice", rel, f"L{i}: em/en dash")
            if HOMA_CAPS_RE.search(line):
                f.fail("voice", rel, f"L{i}: HOMA all-caps in prose")
            if BEHIND_RE.search(line):
                f.fail("voice", rel, f'L{i}: "behind" framing')
            if SIBLING_RE.search(line):
                f.fail("voice", rel, f"L{i}: sibling comparison")
        for phrase in banlist:
            if phrase.lower() in lower:
                f.fail("voice", rel, f"banlist phrase: {phrase}")


def check_duplication(bundle: Path, f: Findings) -> None:
    article = bundle / "article.mdx"
    if not article.exists():
        return
    title = normalize_title(read_frontmatter_title(article))
    body = body_of(article)
    corpus_dirs = [
        REPO_ROOT / "marketing" / "content" / "drafts",
        REPO_ROOT / "marketing" / "content" / "published",
        REPO_ROOT / "apps" / "web" / "content" / "blog",
    ]
    for corpus in corpus_dirs:
        if not corpus.exists():
            continue
        for other in corpus.rglob("*.mdx"):
            if other.resolve() == article.resolve():
                continue
            if is_published_blog_mirror(article, other):
                continue
            if title and normalize_title(read_frontmatter_title(other)) == title:
                f.fail("duplication", "article.mdx",
                       f"same title as {other.relative_to(REPO_ROOT)}")
            ratio = SequenceMatcher(None, body, body_of(other)).ratio()
            if ratio > DUP_RATIO:
                f.fail("duplication", "article.mdx",
                       f"body {ratio:.0%} similar to {other.relative_to(REPO_ROOT)}")


def check_completeness(bundle: Path, meta: dict, f: Findings) -> None:
    for fmt in meta["formats"]:
        if not (bundle / fmt["file"]).exists():
            f.fail("completeness", fmt["file"], "listed in meta.yml but missing")
    for rel, limit in CHAR_LIMITS.items():
        path = bundle / rel
        if path.exists() and len(path.read_text(encoding="utf-8").strip()) > limit:
            f.fail("completeness", rel, f"over {limit} char limit")
    email = bundle / "email" / "email.md"
    if email.exists():
        m = re.search(r"^subject:\s*(.+)$", email.read_text(encoding="utf-8"),
                      re.MULTILINE)
        if m and len(m.group(1).strip()) >= EMAIL_SUBJECT_MAX:
            f.fail("completeness", "email/email.md",
                   f"subject is {len(m.group(1).strip())} chars, max {EMAIL_SUBJECT_MAX - 1}")
    pin = bundle / "pin" / "pin.md"
    if pin.exists():
        text = pin.read_text(encoding="utf-8")
        title = re.search(r"^title:\s*(.+)$", text, re.MULTILINE)
        desc = re.search(r"^description:\s*(.+)$", text, re.MULTILINE)
        if title and len(title.group(1).strip()) > PIN_TITLE_MAX:
            f.fail("completeness", "pin/pin.md", f"title over {PIN_TITLE_MAX} chars")
        if desc and len(desc.group(1).strip()) > PIN_DESCRIPTION_MAX:
            f.fail("completeness", "pin/pin.md",
                   f"description over {PIN_DESCRIPTION_MAX} chars")
    if "video" in meta["lanes"] and not (bundle / "video" / "video.mp4").exists():
        f.fail("completeness", "video/video.mp4", "video lane ran but no mp4")


def write_scorecard(scorecards_dir: Path, bundle_id: str, f: Findings) -> Path:
    scorecards_dir.mkdir(parents=True, exist_ok=True)
    passed = not f.items
    payload = {
        "bundle": bundle_id,
        "ran_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "passed": passed,
        "failures_by_check": f.by_check(),
        "findings": f.items,
    }
    json_path = scorecards_dir / f"{bundle_id}.json"
    json_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    lines = [f"# Scorecard: {bundle_id}", "",
             f"Result: {'PASS' if passed else 'FAIL'} ({len(f.items)} findings)"]
    if f.items:
        lines.append("")
        for item in f.items:
            lines.append(f"- [{item['check']}] {item['file']}: {item['detail']}")
    (scorecards_dir / f"{bundle_id}.md").write_text("\n".join(lines) + "\n",
                                                    encoding="utf-8")
    return json_path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--signals-dir", type=Path,
                        default=REPO_ROOT / "marketing" / "signals")
    parser.add_argument("--scorecards-dir", type=Path,
                        default=REPO_ROOT / "marketing" / "evals" / "scorecards")
    args = parser.parse_args()

    bundle = args.bundle.resolve()
    meta_path = bundle / "meta.yml"
    if not meta_path.exists():
        print(f"FAIL: no meta.yml in {bundle}", file=sys.stderr)
        return 1
    meta = parse_meta(meta_path)
    bundle_id = meta.get("id") or bundle.name

    findings = Findings()
    check_grounding(bundle, meta, args.signals_dir.resolve(), findings)
    check_voice(bundle, load_banlist(), findings)
    check_duplication(bundle, findings)
    check_completeness(bundle, meta, findings)

    card = write_scorecard(args.scorecards_dir.resolve(), bundle_id, findings)
    if findings.items:
        print(f"FAIL: {len(findings.items)} findings "
              f"({', '.join(f'{k}: {v}' for k, v in findings.by_check().items())})")
        for item in findings.items:
            print(f"  [{item['check']}] {item['file']}: {item['detail']}")
        print(f"scorecard: {card}")
        return 1
    print(f"PASS: floor clean. scorecard: {card}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
