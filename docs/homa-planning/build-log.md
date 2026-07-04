# Build log — decisions agents made alone

Per BUILD.md: anything an agent was forced to decide without a founder ruling is
logged here so decisions stay auditable. Newest entries first.

## 2026-07-04 · Deliverable 0 build session

1. **"Never used to train AI" claim withheld from the landing page.** The
   journeys/02 landing spec includes the no-training privacy line, but claim
   rule 6.6 (journeys/07 §6) says data promises ship only when the DPAs are
   executed. The DPAs do not exist yet, so the page says only what is already
   true: "we'll only use your email to send your invite" and "we'll publish our
   full privacy policy before the first family joins." Swap in the strong claim
   the day the DPAs are signed.
2. **No pricing anywhere on the page**, including the "$29 when you're ready"
   line the journeys/02 conference spec suggests. BUILD.md Deliverable 0 hard
   constraint ("no pricing on the page," decision T2) outranks the older
   journey doc per the documented precedence order.
3. **Waitlist storage pattern: write-only RLS with the publishable key.** The
   anon role can INSERT a pending waitlist row and waitlist.* events, and can
   never SELECT/UPDATE/DELETE (verified by scripts/isolation-check.mjs). No
   service-role secret exists in the app at all yet. When the invite service
   (MJ-09) needs to read the list, it gets a server-only secret key via env.
4. **Age bands on the waitlist form:** under 2, 2–3, 4–5, 6–7, 8–10, 11+.
   Chosen to cover the full boil-the-ocean range (D3) while keeping the proven
   2–7 core visible as distinct bands for cohort prioritization.
5. **Typed event registry (MJ-08) lives in `packages/core`** and writes to
   `public.events` over the Data API, best-effort (analytics never break the
   feature). First registered event: `waitlist.joined`. Event props carry no
   PII; the email lives only in the waitlist row.
6. **UI is deliberately wireframe.** Sidney is running the design pass; copy,
   structure, and behavior are binding, visuals are placeholders. The
   worksheet-sample slot on the landing page is an empty dashed box on purpose
   (no fabricated artifacts, ruling C2).
7. **Tenancy v0 (M0-05) shipped read-side only.** families/family_members/
   children tables exist with deny-by-default RLS and member-scoped SELECT
   (plus children INSERT/UPDATE for members). Family creation policies land
   with FR-1's server-side invite flow, so nothing can create a family from
   the public surface today.
8. **Advisor fix applied to a project-level helper:** revoked Data API EXECUTE
   on `public.rls_auto_enable()` (Supabase auto-RLS trigger helper) plus our
   `is_family_member()`, per security advisors 0028/0029.

## File additions this session

- `supabase/migrations/20260704033725_waitlist_and_events.sql`: waitlist +
  events tables, write-only RLS for public traffic.
- `supabase/migrations/20260704033742_tenancy_v0.sql`: families,
  family_members, children + deny-by-default RLS + `is_family_member()`.
- `supabase/migrations/20260704033812_function_grant_hygiene.sql`: EXECUTE
  grant hygiene per security advisors.
- `packages/core/src/waitlist.ts`: waitlist submission schema + age bands +
  sources (shared by form, API, future invite service).
- `packages/core/src/events.ts`: typed event registry (MJ-08) + `emitEvent()`.
- `packages/core/src/us-states.ts`: US state list for the form.
- `apps/web/app/page.tsx`: landing page (hero variant B, efficacy lead).
- `apps/web/app/conference/page.tsx`: QR conference variant (`/conference`).
- `apps/web/app/api/waitlist/route.ts`: validated capture endpoint; duplicate
  email = success (idempotent retries).
- `apps/web/components/waitlist-form.tsx`: optimistic form, offline queue.
- `apps/web/lib/waitlist-client.ts`: timeout + retry + localStorage queue +
  online-event flush (bad conference wifi survival).
- `scripts/isolation-check.mjs`: anon-key isolation smoke checks (M1-07 seed);
  run with `pnpm check:isolation`.
