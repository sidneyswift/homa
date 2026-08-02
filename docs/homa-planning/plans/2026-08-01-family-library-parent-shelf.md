# Family Library parent shelf implementation plan

> **For Codex:** Use the executing-plans skill to implement this plan in bounded batches.

**Goal:** Finish issue #580 with a responsive, tenant-scoped Family Library shelf and item detail experience that remains readable and downloadable after cancellation.

**Architecture:** The server page reads family assets, child associations, and assertion-backed subject tags under the caller's JWT and hands a plain view model to one client shelf. Exact writes go through authenticated API routes that re-scope every asset and child ID to the resolved family. An authenticated download redirect owns both the access check and the download event. The app shell reads setup identity without deciding billing access, while each product page keeps its own action gate. This gives Library a narrow records exception without opening other paid surfaces.

**Tech stack:** Next.js App Router, React, TypeScript, Zod, Supabase Postgres with RLS, Vercel Blob, Homa's typed event registry, Node test runner.

## Blindspot-adjusted scope

### What already exists

- `/app/library` is already in signed-in navigation.
- Direct multipart uploads support 500 MB, persist progress, resume after refresh, and finalize idempotently.
- Originals are stored on the founder-approved public-by-URL Blob store. Product copy must not call them private.
- `family_assets`, `family_asset_children`, and `family_asset_tags` already carry the data needed for the shelf.
- The ingestion judgment contract and measured eval bank exist. This plan now
  connects that contract to a bounded metadata processor so retry can perform a
  real effect instead of changing a status label.

### What #580 must add

- A stable parent-facing view model for resource kind, children, subjects, source, and processing state.
- Combined search and kind, child, subject, and status filters.
- A responsive item detail panel with edit, download, recovery, and deletion consequences.
- Tenant-scoped update and download routes.
- Typed events for upload start and completion, reopen, search, download, delete, and use by Homa.
- A narrow lapsed-family access path for existing Library records.

### Dependency boundary

- `library.asset_used` is defined and emitted through a shared helper. Issue #577 will call that helper from the first real retrieval boundary, because UI interaction is not evidence that Homa used a source.
- Asset recovery only offers an action that exists. Interrupted uploads resume
  through the existing multipart flow. A failed Blob deletion retries deletion.
  Metadata retry re-runs extraction, model judgment, deterministic evidence
  verification, and persistence. It is offered only for transient or stale work,
  never for an unchanged encrypted, corrupt, unsupported, unreadable, or
  over-limit original.
- Binder provenance and planner links remain #579. Deletion copy says generated Binder work stays, but does not claim a source-link behavior that has not shipped.

## Task 1: Build the shelf and mutation contracts

**Files:**

- Create: `apps/web/lib/library/family-asset-shelf.ts`
- Create: `apps/web/lib/library/family-asset-shelf.test.ts`
- Modify: `apps/web/lib/library/family-assets.ts`
- Modify: `apps/web/lib/library/family-asset-upload-store.ts`
- Modify: `apps/web/app/app/library/page.tsx`
- Modify: `apps/web/app/api/library/assets/route.ts`
- Create: `apps/web/app/api/library/assets/[id]/download/route.ts`

**Step 1: Write failing pure-contract tests**

Cover combined filters, option derivation, status labels, source labels, stable dates, and consequence copy. Add route-source assertions for family and child re-scoping where direct route tests are impractical.

**Step 2: Expand the parent view model**

Include source IDs, resource metadata, child associations, subject assertions, processing error and timestamps. Keep direct family identity out of the client model.

**Step 3: Read associations in one bounded server query set**

Load at most 300 assets plus their visible child and tag rows under RLS. Join in memory by asset ID. Pass the live child and subject catalogs as selectable options.

**Step 4: Add exact update behavior**

Validate title, resource kind, child IDs, and subject IDs. Re-scope the asset and every child to the authenticated family inside one transaction. Replace only subject tags when the parent changes subjects, preserving all other model assertions.

**Step 5: Add the authenticated download redirect**

Resolve the caller, re-scope the asset, emit the typed download event, and redirect to the original Blob download URL. Never accept a URL from the client.

## Task 2: Build the responsive shelf and item detail

**Files:**

- Modify: `apps/web/app/app/library/library-view.tsx`
- Create: `apps/web/app/app/library/library-detail-panel.tsx`
- Modify: `apps/web/app/app/library/library-view.test.tsx`
- Create: `apps/web/app/app/library/library-detail-panel.test.tsx`

**Step 1: Add filter and state tests**

Cover kind, child, subject, and status controls; combined empty results; ready, processing, needs-attention, and failed cards; and lapsed read-only behavior.

**Step 2: Build filter controls from present data**

Use Homa's existing pill vocabulary and mobile-first wrapping. Search title, original filename, subjects, and child names without sending content into analytics.

**Step 3: Build the detail panel on the shared SidePanel chassis**

Show source, original filename, file kind, size, added date, processing result, child and subject associations, and exact parent actions. Use one edit mode with explicit save and cancel actions.

**Step 4: Replace browser confirmation with consequence preview**

Deletion first names what leaves Homa and what does not: the saved original and its Library organization leave, the device file stays, and generated Binder work stays. A failed delete remains visible and retryable.

**Step 5: Preserve upload recovery priority**

Interrupted upload cards stay above the shelf. New upload is secondary while recovery work exists, and every control keeps a 44 px minimum hit target.

## Task 3: Add events and the records-access exception

**Files:**

- Modify: `packages/core/src/events.ts`
- Modify: `packages/core/src/events.test.ts`
- Create: `apps/web/lib/library/family-asset-events.ts`
- Create: `apps/web/lib/library/family-asset-events.test.ts`
- Modify: `apps/web/app/api/library/uploads/route.ts`
- Modify: `apps/web/app/api/library/assets/route.ts`
- Modify: `apps/web/lib/app-data.ts`
- Modify: `apps/web/app/app/layout.tsx`
- Modify: `apps/web/app/app/library/page.tsx`

**Step 1: Register content-free Library events**

Events carry family and asset IDs, closed status or surface enums, and counts. First-family milestones are derived from the earliest matching event instead of a mutable flag. Events never carry titles, filenames, search text, URLs, child names, or extracted content.

**Step 2: Emit server-owned effects at their authoritative boundaries**

Reserve emits upload start, finalization emits completion, download redirect emits download, mutation emits delete, and a shared helper owns the future Homa-use event. Client beacons cover reopen and search with bounded non-content properties.

**Step 3: Split shell setup data from paid product access**

Extract a cached setup-complete shell read. The layout uses it for identity and navigation. Existing product pages continue using the billed `getAppData` gate. Library uses shell data, redirects never-subscribed empty accounts to the trial, and gives lapsed families read, download, organization, and delete access without a new-upload action.

**Step 4: Verify the whole contract**

Run focused Library tests, `pnpm check:isolation`, `pnpm check:events`, `pnpm typecheck`, `pnpm lint`, `pnpm check:em-dash`, and the CI-defined relevant guards. Render phone and desktop screenshots and run the Homa copy reader, copy editor, and UX review gates before shipping.

**Step 5: Ship and record evidence**

Commit, push, open a PR with `Closes #580`, wait for required checks and Vercel Ready, probe `/app/library`, then update epic #352 with the exact evidence and next dependency.

## Task 4: Connect real processing and recovery

**Files:**

- Create: `apps/web/lib/library/family-asset-processing.ts`
- Create: `apps/web/lib/library/family-asset-processing.test.ts`
- Create: `apps/web/app/api/library/assets/[id]/process/route.ts`
- Modify: `apps/web/lib/library/family-asset-upload-store.ts`
- Modify: `apps/web/app/api/library/upload/route.ts`
- Modify: `apps/web/app/api/library/assets/route.ts`
- Modify: `apps/web/app/app/library/library-view.tsx`
- Modify: `apps/web/app/app/library/library-detail-panel.tsx`

**Step 1: Extract only through proven lanes**

Read bounded text, PDF text layers, Word, spreadsheet, and supported image
inputs. Record exact permanent outcomes for encrypted, corrupt, unreadable,
unsupported, and over-limit files while preserving the original.

**Step 2: Run the existing judgment and verifier contract**

Pass extracted text to the measured ingestion model, verify every proposal
against the extracted source and live catalogs, then persist only verified
fields and assertions. Parent-authored metadata always wins.

**Step 3: Make processing queued, idempotent, and recoverable**

Finalization queues metadata processing after the response. One database claim
owns each attempt. A stale claim or transient failure can be queued again;
repeating a permanent failure is refused.

**Step 4: Keep the detail panel current**

Poll only while an asset is processing, refresh its family-scoped view, and
offer the real retry action only when the server says another attempt is
meaningful.
