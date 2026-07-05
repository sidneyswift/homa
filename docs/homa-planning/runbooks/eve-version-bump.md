# Runbook: bumping the pinned eve version

> Early exception to M4-09 (`planning/runbooks/` is a post-Deliverable-0
> ticket): this one exists now because the need is real now, not later. See
> `docs/homa-planning/eve-churn-log.md` (2026-07-04) for why: a session
> parked in HITL corrupted on resume across an eve patch bump, and the
> resume API returned `ok: true` naming a different session instead of
> erroring. Follow this runbook every time the `eve` version in
> `apps/web/package.json` changes, no exceptions, including patch bumps.

## Why this exists

`eve` is pinned to an exact version (no `^`) specifically so upgrades are
always a deliberate act, never a silent `pnpm install` surprise. This runbook
is what "deliberate" means in practice. Semver patch does not imply
workflow-replay-safe for eve: the bug that motivated this runbook shipped in
a patch release.

## Steps, in order

### 1. Read the changelog first

Check `node_modules/eve/CHANGELOG.md` (or the release notes) for the target
version and everything between it and the current pin. Flag anything
mentioning "tool", "replay", "workflow", "event log", or "durable" — those
are the categories that have already broken a parked session once.

### 2. Run the automated regression check

```bash
node scripts/eve-upgrade-check.mjs --to <candidate-version>
```

This reproduces the exact failure mode from 2026-07-04: park a session in
HITL, bump the version, try to resume it, check that the same session comes
back and actually processes the answer, with no replay divergence or
corrupted event log in the server logs. **Do not bump the pin if this
script exits non-zero.** If it fails, log the result in `eve-churn-log.md`
with the same rigor as the original finding, and treat the candidate version
as unsafe until eve fixes it.

### 3. Check for live parked sessions before deploying

Once real families exist (post Phase B), query for anything currently
parked in HITL before shipping the version bump:

```sql
-- TODO(M1-02): once the conversations/session table exists, this becomes:
-- select session_id, family_id, parked_since from conversations
--   where status = 'waiting_on_human';
```

If anything is parked: either wait for it to clear naturally, or resolve it
gracefully (send a "let's pick this back up" message that starts a fresh
turn) before changing the pin. Never let a real, in-flight HITL pause sit
across a version-changing deploy — that's the exact condition that broke.

Today (pre-Phase B, no real sessions exist), this step is a no-op; it
becomes real the moment M1-02's conversations table ships.

### 4. Deploy, then verify

After deploying the new pin, run a quick smoke check against production
(start a session, park it deliberately via `ask_question`, confirm it parks
and can resume normally) before considering the bump done. This is cheap
insurance beyond the local regression check, since production is the only
environment that's fully representative.

### 5. Log the outcome

One line in `eve-churn-log.md` either way: version, date, changelog flags (if
any), regression check result. The log's whole purpose is giving the eject
tripwire (`12-roadmap-okrs.md` §tripwires) real data — a bump with nothing to
report is still worth a line ("clean bump, no issues").

## What this runbook does not solve

It does not fix the underlying eve bug. It makes the bug survivable by
never letting the exact trigger condition (a real, in-flight HITL pause
during a version-changing deploy) occur, and by refusing to ship a version
that fails the regression check. Report the bug upstream separately; that
timeline is independent of this runbook.
