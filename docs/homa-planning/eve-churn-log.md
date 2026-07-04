# eve churn log

Feeds the eject tripwire in `12-roadmap-okrs.md` §Standing tripwires:
**">2 breaking eve changes costing >1 day each in any 4-week window before M1
ends ⇒ eject to custom harness; after M2 starts ⇒ never eject, fork/vendor."**

`eve` is pinned to an exact version in `apps/web/package.json` (no `^` range) so
upgrades are always a deliberate, dated, logged decision, never a silent
`pnpm install` surprise. Log every version bump and every breaking change
encountered here, whether or not it cost a full day, so the tripwire has real
data to count against. Newest entries first.

## 2026-07-04 · Log started

- Pinned `eve` to exact `0.19.0` in `apps/web/package.json` (was `^0.19.0`).
  No breaking changes encountered yet; M0-01 (the adversarial prototype spike
  that stress-tests eve upgrade/rollback/dispatcher-kill/HITL-rotation
  behavior) has not started. This entry is the log's zero point.
