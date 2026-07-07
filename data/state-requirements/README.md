# State requirements snapshots

Raw per-jurisdiction homeschool compliance data (50 states + DC), pulled
verbatim from HomeschoolLeap's free public API. License: CC BY-SA 4.0,
attribution required: "Data by HomeschoolLeap (https://homeschoolleap.com)."

Do not hand-edit these files. They are written only by
`pnpm pull:state-requirements` and exist so every upstream change lands as
a reviewable git diff before `pnpm seed:state-requirements` upserts it into
the `state_requirements` table. Procedure and cadence:
`docs/homa-planning/runbooks/state-requirements-refresh.md`.

- `states/XX.json`: full upstream document for one jurisdiction (pathways
  with statute citations, notification deadlines, assessment rules,
  instructional time, recordkeeping, instructor qualifications, sources).
- `index.json`: upstream listing with per-state summary flags.
- `manifest.json`: when we pulled, from where, under what license.

These snapshots are legal reference data, not legal advice. Product
surfaces re-verify statutes before display, per repo law.
