# State requirements snapshots

Normalized per-jurisdiction homeschool compliance snapshots (50 states + DC),
pulled from HomeschoolLeap's public API and passed through the narrow reviewed
corrections in `scripts/state-requirements-reviewed-corrections.mts`. The dated
manifest records applied corrections plus the CC BY-SA 4.0 license and
attribution requirement. Re-verify the current upstream API, license,
attribution language, and correction sources before a new pull.

Do not hand-edit these files. They are written only by
`pnpm pull:state-requirements` and exist so every upstream change lands as
a reviewable git diff before
`pnpm seed:state-requirements -- --confirm-prod` upserts it into
the `state_requirements` table. Procedure and cadence:
`docs/homa-planning/runbooks/state-requirements-refresh.md`.

- `states/XX.json`: recursively key-sorted reviewed document for one jurisdiction (pathways
  with statute citations, notification deadlines, assessment rules,
  instructional time, recordkeeping, instructor qualifications, sources).
- `index.json`: upstream listing with per-state summary flags.
- `manifest.json`: when we pulled, from where, under what license, and which
  reviewed upstream corrections were applied.

These snapshots are legal reference data, not legal advice. Product surfaces display the reviewed snapshot and its verification date. They do not re-verify statutes on every render. Refresh and review are separate human gates defined in the runbook.
