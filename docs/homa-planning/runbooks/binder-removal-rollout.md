# Binder collection removal rollout

Issue: [#1091](https://github.com/sidneyswift/homa/issues/1091).

Deleting a Binder item removes its whole connected revision chain from collection
reads. The rows, lineage, preview URLs, PDF URLs, and exact-ID history remain.
An ordinary revision of a removed version inherits removal. Explicit restoration
creates one new visible final version in a transaction; it does not revive old
rows. If deletion occurred after restoration read its source, restoration stops.

## Deployment order

1. Apply `20260906090000_material_collection_mutations.sql`. This adds passive
   caller RPCs and a collection-specific RLS marker. Existing requests retain
   their behavior. The finalization marker and status-write boundary are separate.
2. Deploy the code that calls `remove_family_material_chain` and
   `restore_family_material_version`, and confirm the Vercel deployment is READY.
   Both caller and pinned restoration must use their new atomic record writers.
3. Apply `20260906090100_material_revision_visibility.sql`. Its insertion trigger
   must follow step 2: older restore code lacks the explicit restore effect.
4. In a signed-in sandbox family, remove a revised draft with siblings, refresh
   Binder, and confirm no ancestor or sibling returns. Repeat with a kept item.
   Read exact-ID history and verify artifact references still exist. Exercise
   explicit restoration and confirm only its new version returns.
5. Repair a historical partially removed chain only after reviewing that
   family's actual connected rows and the original tombstone. Use the same
   authenticated removal RPC with the already-deleted material ID; it traverses
   the full chain even though that starting version is absent from the shelf.
   Verify before/after counts and a fresh collection read. Keep the allowlist
   and receipts in the issue's restricted operational evidence, not in this doc.

Do not bulk-hide materials by title, assume every tombstone represents a current
removal intent, or propagate all historical tombstones in an unconditional
migration. A later explicit restore may be intentional. The reviewed September 5
resurfacing case requires this bounded repair; deploying the new functions alone
does not change historical rows.

## Transaction and rollback boundaries

Removal, insertion, and restoration take the same family transaction advisory
lock before material row locks. Removal takes only connected row locks, in ID
order. Existing finalization uses sorted row locks and does not wait for the
advisory lock. Long rendering and Blob uploads happen before the restore
transaction. No external operation holds the collection lock.

Restoration compares the exact `deleted_at` snapshot, including microseconds.
Every new removal stamps all connected versions with one fresh timestamp;
an already-complete retry retains the prior timestamp. No generation metadata
grants restore authorization. Caller RPCs retain JWT/RLS and membership checks;
pinned writers re-scope the source inside their authenticated family.

Before reverting to old restore code, drop only the
`materials_inherit_collection_visibility` trigger. Keep the passive functions,
policies, historical rows, and removal timestamps. Do not clear tombstones to
roll back code: that would undo parent actions. Restore the trigger after
deploying the corrected record writers again.

## Verification

- `pnpm check:isolation` before schema/query edits.
- `pnpm check:migration-versions` before and after migration edits.
- `pnpm check:materials` covers selector, history, restore selection, and caller
  receipt contracts.
- `pnpm test:material-removal:postgres` applies all migrations to disposable
  PostgreSQL and tests RLS, chains beyond 3,000 rows, sibling branches, retained
  history, historical repair, protected lesson worksheets, explicit restoration,
  finalization, and forced insertion/restore/removal races.
- The phone shelf requires rendered checks at 320, 375, and 390 pixels, including
  long titles, confirmation, cancellation, pending, error, and empty states.
  Rendered evidence and production receipts belong with the issue; unit tests
  alone do not establish delivery.

### September 6 implementation evidence

Before deployment, the parent task independently reviewed the actual
`InProgressShelf` component through CUA using synthetic materials, the compiled
application stylesheet, a navigation stub, and controlled action receipts. This
fixture was not attached to a database and does not establish production delivery.
Screenshots covered 320, 375, 390, 768, and 1440 pixel frame widths.

- Long titles wrapped; Delete remained visible; confirmation fitted phone widths.
- Cancel retained both items. A successful receipt removed only the chosen item.
- Pending disabled material writes on both cards; completion re-enabled them.
- A failure receipt retained the draft and showed its inline error. A thrown
  Keep request also retained the draft and showed an inline error.
- The empty fixture hid the shelf. At 1440 pixels, document width and scroll
  width both measured 1440.

The independent code critic reported no remaining findings after the protected
lesson-material and timestamp-precision revisions. Local verification passed
443 materials tests, 12 disposable PostgreSQL cases, web typecheck, changed-file
ESLint, isolation, migration-version, design parity, design authoring, and the
47 brand-surface checks. Runtime screenshots are component evidence; the
production deletion/refresh and historical repair remain rollout checks above.
