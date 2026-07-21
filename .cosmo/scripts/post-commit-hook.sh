#!/usr/bin/env bash
# post-commit-hook.sh: installed as .git/hooks/post-commit by session-start.sh.
#
# Fixes the two failure modes that keep recurring on Cosmo's real machine
# even after session-start.sh's preflight, because a preflight only catches
# problems if it actually runs and blocks; this hook fires automatically on
# every commit and cannot be skipped by forgetting a step:
#
#   1. Clock skew. The OS clock has been observed running days slow, which
#      corrupts commit dates even when ref ids are correctly dated from
#      Slack ts. This hook re-dates the commit using GitHub's HTTP clock
#      (a source that must be reachable anyway, since this repo is on
#      GitHub) whenever the local clock disagrees by more than 5 minutes.
#   2. Stranded work. Cosmo has repeatedly committed real ingestion work to
#      a branch and then stopped without opening a PR, so branch protection
#      (which blocks direct pushes to main) turns that into silently lost
#      work instead of a visible pull request. This hook pushes the branch
#      and opens a PR the moment the FIRST commit lands on a cosmo/ingest-*
#      branch, so there is no longer a "forgot to ship it" failure mode:
#      the PR exists from commit one and just keeps updating.
#
# This hook only acts on branches named cosmo/ingest-* (the convention
# session-start.sh creates) so it never touches unrelated work.
#
# Every step here is best-effort: a post-commit hook cannot undo the commit
# it just observed, and a git commit must never appear to fail because a
# network call failed. Every branch below degrades to "warn and continue."

set -uo pipefail

# Recursion guard: `git commit --amend` below is itself a commit and would
# re-trigger this same hook. Without this guard that is infinite recursion.
if [ -n "${COSMO_POST_COMMIT_RUNNING:-}" ]; then
  exit 0
fi
export COSMO_POST_COMMIT_RUNNING=1

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$REPO_ROOT" || exit 0

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || exit 0
case "$BRANCH" in
  cosmo/ingest-*) ;;
  *) exit 0 ;;
esac

# --- 1. Correct the commit date if the local clock is meaningfully wrong ---
REMOTE_DATE=$(curl -sI --max-time 8 https://api.github.com/ 2>/dev/null | grep -i '^date:' | cut -d' ' -f2- | tr -d '\r')
if [ -n "$REMOTE_DATE" ]; then
  REMOTE_EPOCH=$(date -j -f "%a, %d %b %Y %T %Z" "$REMOTE_DATE" +%s 2>/dev/null || date -d "$REMOTE_DATE" +%s 2>/dev/null || echo 0)
  LOCAL_EPOCH=$(date +%s)
  if [ "$REMOTE_EPOCH" != "0" ]; then
    SKEW=$(( LOCAL_EPOCH - REMOTE_EPOCH ))
    ABS_SKEW=${SKEW#-}
    if [ "$ABS_SKEW" -gt 300 ]; then
      echo "post-commit: local clock is ${SKEW}s off; re-dating this commit to ${REMOTE_DATE}" >&2
      git commit --amend --no-edit --date="$REMOTE_DATE" -q \
        || echo "post-commit: WARNING could not re-date the commit; continuing with the original date" >&2
    fi
  fi
else
  echo "post-commit: WARNING could not reach api.github.com to check the clock; skipping date correction" >&2
fi

# --- 2. Push the branch and make sure a PR exists ---
if git push -u origin "$BRANCH" -q 2>/tmp/cosmo-post-commit-push.log; then
  :
else
  echo "post-commit: WARNING git push failed:" >&2
  cat /tmp/cosmo-post-commit-push.log >&2
fi

if command -v gh >/dev/null 2>&1; then
  if ! gh pr view "$BRANCH" >/dev/null 2>&1; then
    gh pr create --base main --head "$BRANCH" \
      --title "Cosmo ingestion: $BRANCH" \
      --body "Auto-opened by the post-commit hook the moment the first commit landed on this branch, so ingestion work can no longer strand on an unopened branch. Review before merging; branch protection requires CI plus review." \
      >/tmp/cosmo-post-commit-pr.log 2>&1 \
      || echo "post-commit: WARNING could not auto-open a PR (gh not authenticated on this machine?). Push succeeded; open one manually with: gh pr create --base main --head $BRANCH" >&2
  fi
else
  echo "post-commit: WARNING gh CLI not found; push succeeded but no PR was opened. Open one manually." >&2
fi

exit 0
