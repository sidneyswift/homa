#!/usr/bin/env bash
# session-start.sh: Cosmo's mandatory preflight before any ingestion work.
#
# Fixes the three machine-hygiene failures observed in production:
#   1. Stale checkout (live .cosmo was days behind main; the verifier judged
#      against a deleted repo shape).
#   2. Stranded commits (work pushed to already-merged PR branches).
#   3. Clock skew (~4 days slow, producing wrongly dated ref ids; dates must
#      come from Slack ts, but the skew also corrupts commit timestamps).
#
# Usage, from the repo root at the start of EVERY ingestion session:
#   bash .cosmo/scripts/session-start.sh
# Exits nonzero when the session must not proceed.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "== Cosmo session preflight =="

# 1. Sync with origin and start from current main on a FRESH branch.
git fetch origin main
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "BLOCKED: working tree is dirty. Commit to a branch or stash before starting."
  exit 1
fi
BRANCH="cosmo/ingest-$(date -u +%Y%m%d-%H%M%S)"
git checkout -q -B "$BRANCH" origin/main
echo "OK: fresh branch $BRANCH at $(git rev-parse --short HEAD) (origin/main)"

# 2. Warn about stranded Cosmo commits that never reached main.
STRAY=$(git log --all --not origin/main --author=cosmo --oneline 2>/dev/null | head -5 || true)
if [ -n "$STRAY" ]; then
  echo "WARNING: Cosmo commits exist outside origin/main. Recover or report them:"
  echo "$STRAY"
fi

# 3. Clock-skew check against Slack's HTTP Date header. The machine clock has
#    run about 4 days slow; ref ids and droppedAt must use Slack ts anyway,
#    but a skewed clock also corrupts commit timestamps and branch names.
REMOTE=$(curl -sI --max-time 10 https://slack.com/ | grep -i '^date:' | cut -d' ' -f2- | tr -d '\r' || true)
if [ -n "$REMOTE" ]; then
  REMOTE_EPOCH=$(date -j -f "%a, %d %b %Y %T %Z" "$REMOTE" +%s 2>/dev/null || date -d "$REMOTE" +%s 2>/dev/null || echo 0)
  LOCAL_EPOCH=$(date +%s)
  if [ "$REMOTE_EPOCH" != "0" ]; then
    SKEW=$(( LOCAL_EPOCH - REMOTE_EPOCH ))
    ABS_SKEW=${SKEW#-}
    if [ "$ABS_SKEW" -gt 300 ]; then
      echo "BLOCKED: machine clock is ${SKEW}s off real time. Fix the clock"
      echo "(System Settings -> General -> Date & Time -> set automatically)"
      echo "before ingesting; skewed clocks have corrupted ref ids before."
      exit 1
    fi
    echo "OK: clock skew ${SKEW}s"
  fi
else
  echo "WARNING: could not reach slack.com to check clock skew; proceed with care."
fi

# 4. Confirm the post-restructure surfaces this session will write against.
test -d apps/web/agent/skills/materials-studio/references/recipes \
  || { echo "BLOCKED: recipes/ missing; this checkout predates PR #57."; exit 1; }
test -f .cosmo/scripts/verify-ingestion.py \
  || { echo "BLOCKED: verify-ingestion.py missing from this checkout."; exit 1; }

echo "== Preflight complete. Work on $BRANCH, ship by PR, never push main. =="
