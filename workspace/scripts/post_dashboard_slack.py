#!/usr/bin/env python3
"""
Post a daily dashboard snapshot to Slack #homa-dashboard.

Renders:
  - A status block with current numbers (using ASCII bars + emoji)
  - A trajectory chart as PNG (matplotlib) attached to the message

Reads:
  - ~/.openclaw/workspace/children/*.json (current state)
  - ~/.openclaw/workspace/profile-history/*.json (trajectory)
  - ~/.openclaw/.env (for SLACK_BOT_TOKEN)

Posts to:
  - Slack channel {{DASHBOARD_CHANNEL}} (#homa-dashboard)

Idempotent in a soft sense: each call posts a new message. The cron runs
once a day so we get one post/day. (Slack chat.update is possible later
if we want a single living post per day.)
"""

import datetime
import json
import os
import pathlib
import sys
import urllib.request
import urllib.parse
from collections import Counter

CHILDREN_DIR = pathlib.Path.home() / ".openclaw" / "workspace" / "children"


def load_first_child():
    """Load the first child profile. Multi-child dashboard views coming in a future update."""
    for f in sorted(CHILDREN_DIR.glob("*.json")):
        if f.name.startswith("_"):
            continue
        try:
            return json.loads(f.read_text())
        except (json.JSONDecodeError, OSError):
            continue
    return None


def load_all_children():
    """Load all child profiles."""
    children = []
    for f in sorted(CHILDREN_DIR.glob("*.json")):
        if f.name.startswith("_"):
            continue
        try:
            children.append(json.loads(f.read_text()))
        except (json.JSONDecodeError, OSError):
            continue
    return children
HISTORY_DIR = pathlib.Path.home() / ".openclaw" / "workspace" / "profile-history"
ENV_FILE = pathlib.Path.home() / ".openclaw" / ".env"
CHART_PATH = pathlib.Path("/tmp/homa-dashboard-trajectory.png")
CHANNEL_ID = "{{DASHBOARD_CHANNEL}}"  # #homa-dashboard
DASHBOARD_URL = "https://homa-dashboard-recoup.vercel.app"


def load_env_var(key):
    if not ENV_FILE.exists():
        return None
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip()
    return None


DOMAIN_DISPLAY = {
    "math": "Math", "literacy": "Literacy", "phonics": "Phonics",
    "writing_fine_motor": "Writing", "spanish": "Spanish",
    "science": "Science", "social_studies": "Social Studies",
    "art_creative": "Art", "gross_motor": "Gross Motor",
    "fine_motor_general": "Fine Motor", "social_emotional": "Social-Emotional",
    "self_care_independence": "Self-Care", "executive_function": "Exec Fn",
    "language_oral_english": "Language", "music": "Music",
}

DOMAIN_COLORS = {
    "math": "#3b82f6", "literacy": "#8b5cf6", "phonics": "#a855f7",
    "writing_fine_motor": "#f97316", "spanish": "#ec4899",
    "science": "#10b981", "social_studies": "#14b8a6",
    "art_creative": "#ef4444", "gross_motor": "#f59e0b",
    "fine_motor_general": "#eab308", "social_emotional": "#d946ef",
    "self_care_independence": "#06b6d4", "executive_function": "#6366f1",
    "language_oral_english": "#22c55e", "music": "#84cc16",
}

POSITION_MONTHS = {"24mo_ahead": 24, "12mo_ahead": 12, "at_age": 0, "below_age": -12}


def count_positions(profile):
    c = Counter()
    for dom in profile.get("domains", {}).values():
        for sd in dom.get("subdomains", {}).values():
            pos = sd.get("story_position", "unknown")
            if pos == "unknown_pending_measurement":
                pos = "unknown"
            c[pos] += 1
    return c


def domain_avg_months(snapshot, dom_key):
    domain = snapshot.get("domains", {}).get(dom_key, {})
    subs = domain.get("subdomains", {})
    if not subs:
        return None
    values = [POSITION_MONTHS[sd.get("story_position", "")] for sd in subs.values() if sd.get("story_position") in POSITION_MONTHS]
    if not values:
        return None
    return sum(values) / len(values)


def trajectory_by_domain():
    """Return {domain_key: [(date, value), ...]} ordered by date.
    Leading None values are replaced with 0 (at-age baseline) so each domain's
    line starts visibly at the at-age line on the chart."""
    if not HISTORY_DIR.exists():
        return {}
    snapshots = sorted(HISTORY_DIR.glob("*.json"))
    if not snapshots:
        return {}
    latest = json.loads(snapshots[-1].read_text())
    domain_keys = list(latest.get("domains", {}).keys())
    series = {dk: [] for dk in domain_keys}
    for snap_file in snapshots:
        try:
            snap = json.loads(snap_file.read_text())
        except Exception:
            continue
        for dk in domain_keys:
            v = domain_avg_months(snap, dk)
            series[dk].append((snap_file.stem, v))

    # Replace leading None values with 0 (baseline assumption)
    for dk, points in series.items():
        first_real_idx = next((i for i, (d, v) in enumerate(points) if v is not None), None)
        if first_real_idx is not None and first_real_idx > 0:
            for i in range(first_real_idx):
                d, _ = points[i]
                points[i] = (d, 0)
    return series


def trajectory_data():
    if not HISTORY_DIR.exists():
        return []
    snapshots = sorted(HISTORY_DIR.glob("*.json"))
    out = []
    for snap_file in snapshots:
        try:
            snap = json.loads(snap_file.read_text())
            counts = count_positions(snap)
            out.append({
                "date": snap_file.stem,
                "ahead_24mo": counts.get("24mo_ahead", 0),
                "ahead_12mo": counts.get("12mo_ahead", 0),
                "at_age": counts.get("at_age", 0),
                "below_age": counts.get("below_age", 0),
                "unknown": counts.get("unknown", 0),
            })
        except Exception:
            continue
    return out


def render_chart(domain_traj_dict, profile):
    """Render per-domain trajectory chart as PNG. Returns path or None.
    Each line = one domain. Y = average months ahead/behind age."""
    if not domain_traj_dict:
        return None
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.dates import DateFormatter
        import datetime as dt

        # Sort domains by current value (highest first) so legend matches importance
        # Use latest snapshot's value for ordering
        ranked = []
        for dk, points in domain_traj_dict.items():
            current = next((v for d, v in reversed(points) if v is not None), None)
            ranked.append((dk, points, current if current is not None else float("-inf")))
        ranked.sort(key=lambda r: -r[2])

        fig, ax = plt.subplots(figsize=(11, 6.5), dpi=120)
        fig.patch.set_facecolor("#fafaf9")
        ax.set_facecolor("#ffffff")

        # Reference lines at +24, +12, 0 (age line bold)
        ax.axhline(0, color="#64748b", linewidth=1.8, zorder=0, label="_at age_")
        ax.axhline(12, color="#fb923c", linewidth=1.2, linestyle="--", alpha=0.65, zorder=0, label="_12mo target_")
        ax.axhline(24, color="#a78bfa", linewidth=1.2, linestyle="--", alpha=0.65, zorder=0, label="_24mo target_")

        for dk, points, _ in ranked:
            label = DOMAIN_DISPLAY.get(dk, dk)
            color = DOMAIN_COLORS.get(dk, "#94a3b8")
            dates = [dt.date.fromisoformat(d) for d, v in points]
            values = [v for d, v in points]
            ax.plot(dates, values, label=label, color=color, marker="o", linewidth=2.2, markersize=6, alpha=0.9)

        # Reference line annotations are added below after xlim is set

        ax.set_title("Progress by domain — months ahead of age", fontsize=14, fontweight="bold", pad=14)
        ax.set_ylabel("Months ahead / behind age", fontsize=11)
        ax.legend(loc="center left", bbox_to_anchor=(1.01, 0.5), fontsize=8.5, framealpha=0.95, ncol=1)
        ax.grid(True, alpha=0.3, linestyle="--")
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        ax.set_ylim(-6, 30)

        # Extend x-axis to the upcoming Saturday (next scoring cron run)
        all_dates = sorted({dt.date.fromisoformat(d) for dk, pts, _ in ranked for d, v in pts})
        if all_dates:
            first = all_dates[0]
            today = dt.date.today()
            days_until_sat = (5 - today.weekday()) % 7 or 7
            xmax_dt = today + dt.timedelta(days=days_until_sat)
            ax.set_xlim(first, xmax_dt)
            ax.xaxis.set_major_formatter(DateFormatter("%b %d"))
            # Reference line annotations on the right edge
            ax.text(xmax_dt, 24.6, "24mo target", color="#a78bfa", fontsize=8, ha="right", fontweight="bold")
            ax.text(xmax_dt, 12.6, "12mo target", color="#fb923c", fontsize=8, ha="right", fontweight="bold")
            ax.text(xmax_dt, 0.6, "at age", color="#64748b", fontsize=8, ha="right", fontweight="bold")
            # Vertical line marking "today" so the eye separates past from future
            ax.axvline(today, color="#94a3b8", linewidth=0.8, linestyle=":", alpha=0.7, zorder=0)
            ax.text(today, 29, "today", color="#64748b", fontsize=8, ha="center", fontweight="bold",
                    bbox=dict(boxstyle="round,pad=0.2", facecolor="white", edgecolor="none"))
        fig.tight_layout()
        fig.savefig(CHART_PATH, format="png", facecolor=fig.get_facecolor(), bbox_inches="tight")
        plt.close(fig)
        return CHART_PATH
    except Exception as e:
        print(f"  ⚠️  Chart render failed: {e}")
        return None


def build_status_text(profile, counts, domain_traj_dict):
    """Build the Slack message text using mrkdwn."""
    age = profile["age"]
    age_str = f"{age['years']}y {age['months']}m {age['days']}d"
    today = datetime.date.today()

    # Compute current avg per domain + delta from previous snapshot if any
    current_per_domain = []
    for dk, points in domain_traj_dict.items():
        curr_val = next((v for d, v in reversed(points) if v is not None), None)
        prev_val = None
        # Find the second-most-recent snapshot's value
        seen_current = False
        for d, v in reversed(points):
            if v is not None:
                if not seen_current:
                    seen_current = True
                    continue
                prev_val = v
                break
        if curr_val is None:
            continue
        delta = curr_val - prev_val if prev_val is not None else None
        current_per_domain.append((dk, curr_val, delta))
    current_per_domain.sort(key=lambda x: -x[1])

    lines = []
    lines.append(f"📊 *Snapshot — {today.strftime('%A, %B %-d')}*")
    lines.append(f"_{age_str} · {sum(counts.values())} subdomains tracked_")
    lines.append("")

    # Strengths (top 3) and gaps (bottom 3)
    if current_per_domain:
        lines.append("🏆 *Strengths (avg months ahead):*")
        for dk, val, delta in current_per_domain[:3]:
            arrow = ""
            if delta is not None and abs(delta) >= 0.1:
                arrow = f" {'↑' if delta > 0 else '↓'}{abs(delta):.1f}"
            sign = "+" if val >= 0 else ""
            lines.append(f"   • *{DOMAIN_DISPLAY.get(dk, dk)}* — {sign}{val:.1f} mo{arrow}")
        lines.append("")

        gap_count = min(3, len(current_per_domain))
        if len(current_per_domain) >= 4:
            lines.append("⚠️ *Lowest standing:*")
            for dk, val, delta in current_per_domain[-3:]:
                arrow = ""
                if delta is not None and abs(delta) >= 0.1:
                    arrow = f" {'↑' if delta > 0 else '↓'}{abs(delta):.1f}"
                sign = "+" if val >= 0 else ""
                lines.append(f"   • *{DOMAIN_DISPLAY.get(dk, dk)}* — {sign}{val:.1f} mo{arrow}")
            lines.append("")

    # Active interventions — removed from daily post per Sidney's feedback
    # (2026-05-15: "scissors, ball" repeating daily = noise).
    # Interventions now surface only when they change (weekly scoring cron).

    next_due = profile.get("next_measurement_protocol_due")
    if next_due:
        lines.append(f"📐 Next measurement check-in: *{next_due}*")
        lines.append("")

    lines.append(f"🌐 Full dashboard: <{DASHBOARD_URL}|open in browser>")

    return "\n".join(lines)


def slack_post_message(token, channel, text):
    """Post a text message to Slack."""
    req = urllib.request.Request(
        "https://slack.com/api/chat.postMessage",
        data=json.dumps({"channel": channel, "text": text, "mrkdwn": True}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=utf-8",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def slack_upload_file(token, channel, file_path, title, initial_comment):
    """Upload a file to Slack via files.upload (legacy but still works for now).
    Falls back to two-step files.getUploadURLExternal if needed in the future."""
    # Step 1: get upload URL
    req = urllib.request.Request(
        f"https://slack.com/api/files.getUploadURLExternal?filename={urllib.parse.quote(file_path.name)}&length={file_path.stat().st_size}",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        info = json.loads(resp.read())
    if not info.get("ok"):
        return info
    upload_url = info["upload_url"]
    file_id = info["file_id"]

    # Step 2: PUT the file bytes
    with file_path.open("rb") as f:
        body = f.read()
    put_req = urllib.request.Request(upload_url, data=body, method="POST")
    with urllib.request.urlopen(put_req, timeout=60) as resp:
        resp.read()

    # Step 3: complete the upload
    complete_payload = {
        "files": [{"id": file_id, "title": title}],
        "channel_id": channel,
        "initial_comment": initial_comment,
    }
    complete_req = urllib.request.Request(
        "https://slack.com/api/files.completeUploadExternal",
        data=json.dumps(complete_payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=utf-8",
        },
    )
    with urllib.request.urlopen(complete_req, timeout=30) as resp:
        return json.loads(resp.read())


def main():
    if not PROFILE.exists():
        print(f"❌ profile.json not found at {PROFILE}")
        return 1
    token = load_env_var("SLACK_BOT_TOKEN")
    if not token:
        print("⚠️  SLACK_BOT_TOKEN missing in ~/.openclaw/.env — skipping post.")
        return 0

    profile = load_first_child()
    counts = count_positions(profile)
    domain_traj_dict = trajectory_by_domain()
    text = build_status_text(profile, counts, domain_traj_dict)
    chart = render_chart(domain_traj_dict, profile)

    if chart and chart.exists():
        result = slack_upload_file(
            token,
            CHANNEL_ID,
            chart,
            title=f"Progress trajectory — {datetime.date.today().isoformat()}",
            initial_comment=text,
        )
        if result.get("ok"):
            print(f"  ✅ Posted to Slack with chart")
        else:
            print(f"  ⚠️  Chart upload failed: {result.get('error', 'unknown')} — falling back to text-only")
            r2 = slack_post_message(token, CHANNEL_ID, text)
            if r2.get("ok"):
                print(f"  ✅ Posted text-only to Slack")
            else:
                print(f"  ❌ Slack post failed: {r2.get('error')}")
                return 1
    else:
        result = slack_post_message(token, CHANNEL_ID, text)
        if result.get("ok"):
            print(f"  ✅ Posted to Slack (text-only, no chart)")
        else:
            print(f"  ❌ Slack post failed: {result.get('error')}")
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
