#!/bin/sh
# Snapshot Homa's brain (skills, scripts, rules, ops surface) into the LOCAL git safety net.
# The rollback net for autonomous nightly self-modification: each build/groom is a discrete
# commit, so a bad night is `git -C ~/.openclaw/workspace revert <sha>` or `git reset --hard`.
#
# Usage:  scripts/brain-snapshot.sh "what changed this commit"
# Only the brain is tracked (see .gitignore). LOCAL ONLY — never add a remote without scrubbing
# secrets/PII (SerpAPI key in TOOLS.md, family details in USER.md/MEMORY.md).

set -eu
WS="$HOME/.openclaw/workspace"
cd "$WS" || exit 1

if [ ! -d .git ]; then
  echo "brain-snapshot: no git repo at $WS — safety net NOT armed" >&2
  exit 1
fi

git add -A
if git diff --cached --quiet; then
  echo "brain-snapshot: nothing changed"
  exit 0
fi

msg="${1:-brain snapshot}"
git commit -q -m "$msg"
echo "brain-snapshot: committed $(git rev-parse --short HEAD) — $msg"
