#!/usr/bin/env python3
"""
Deploy the freshly-generated Homa Dashboard.html to Vercel.

Reads:
  - ~/Documents/Homeschool/Homa Dashboard.html (output of generate_dashboard.py)
  - ~/.openclaw/.env (for VERCEL_TOKEN)

Writes (via vercel CLI):
  - https://homa-dashboard-recoup.vercel.app

Idempotent. Each call produces a new deployment + promotes to production.
The stable URL always points to the latest production deploy.

Designed to be:
  - The 7th step of regenerate_vault.py
  - Safely skipped if no token / network / vercel CLI (logs warning, exits 0)
"""

import os
import shutil
import subprocess
import pathlib
import sys

VAULT_HTML = pathlib.Path.home() / "Documents" / "Homeschool" / "Homa Dashboard.html"
DEPLOY_DIR = pathlib.Path.home() / ".openclaw" / "workspace" / "dashboard-deploy"
ENV_FILE = pathlib.Path.home() / ".openclaw" / ".env"

VERCEL_SCOPE = "recoup"
PROJECT_NAME = "homa-dashboard"
STABLE_URL = "https://homa-dashboard-recoup.vercel.app"


def load_env_var(key):
    if not ENV_FILE.exists():
        return None
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip()
    return None


def main():
    if not VAULT_HTML.exists():
        print(f"⚠️  Source HTML missing: {VAULT_HTML} — run generate_dashboard.py first.")
        return 1

    if not shutil.which("vercel"):
        print("⚠️  vercel CLI not installed — skipping deploy. (npm install -g vercel)")
        return 0  # don't fail the regen pipeline

    token = load_env_var("VERCEL_TOKEN")
    if not token:
        print("⚠️  VERCEL_TOKEN missing in ~/.openclaw/.env — skipping deploy.")
        return 0

    DEPLOY_DIR.mkdir(parents=True, exist_ok=True)
    # Copy fresh HTML as index.html
    target = DEPLOY_DIR / "index.html"
    shutil.copy2(VAULT_HTML, target)
    print(f"  Copied {VAULT_HTML.name} → {target}")

    # Ensure vercel.json exists (idempotent)
    vercel_json = DEPLOY_DIR / "vercel.json"
    if not vercel_json.exists():
        vercel_json.write_text('''{
  "version": 2,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Robots-Tag", "value": "noindex, nofollow" },
        { "key": "Cache-Control", "value": "no-cache, max-age=0" }
      ]
    }
  ]
}
''')

    # Deploy
    cmd = [
        "vercel", "deploy",
        "--prod",
        "--token", token,
        "--yes",
        "--scope", VERCEL_SCOPE,
    ]
    proc = subprocess.run(cmd, cwd=DEPLOY_DIR, capture_output=True, text=True, timeout=120)
    if proc.returncode != 0:
        print(f"  ❌ Deploy failed (exit {proc.returncode})")
        print(f"  STDERR: {proc.stderr[-500:]}")
        return 1

    # Last line of stdout is usually the deployment URL
    out = proc.stdout.strip()
    last_url = ""
    for line in out.split("\n"):
        if line.startswith("https://"):
            last_url = line.strip()
    print(f"  ✅ Deployed: {last_url or '(see vercel CLI output)'}")
    print(f"  🌐 Stable URL: {STABLE_URL}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
