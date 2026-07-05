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

9. **Deployed to production; canonical project is `homa`.** Sidney bought
   **thankshoma.com** and attached it (via the dashboard) to a Vercel project
   named `homa` (team Homa) rather than the agent-created `homa-web`; both
   pointed at the same repo/rootDirectory. Consolidated on `homa`: copied the
   env vars over (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
   VERCEL_USE_EXPERIMENTAL_FRAMEWORKS=1), redeployed from main, added
   www.thankshoma.com as a 308 redirect to apex, deleted the duplicate
   `homa-web` project, relinked the local checkout. Verified on the domain:
   /, /conference, www redirect, and a waitlist POST that landed in Supabase
   (then cleaned). Nameservers were already on Vercel DNS. eve's /eve routes
   fail closed (no auth policy configured yet), which is correct until FR-1.
10. **Deliverable 0 definition-of-done status:** deployed ✓, waitlist rows
   verified in Supabase ✓, phone test ☐ (Sidney), Alessa read-aloud ☐
   (Sidney + design pass).

11. **No booth at the conference (founder correction, 2026-07-04).** Alessa
   tells moms "thankshoma.com" in conversation; there is no QR banner. So `/`
   is the primary conference capture surface (spoken-word signups arrive as
   source=organic), and `/conference` is repurposed as the link Alessa texts
   a mom mid-conversation, keeping clean source=conference attribution when a
   link can carry the path. Post-conference, conference-weekend organic rows
   can be classified in SQL at invite time. Booth-presuming copy removed from
   the page.
12. **`/conference` renamed to `/waitlist` (founder call, 2026-07-04:
   "waitlist instead of conference, let's not overcomplicate it").** One
   generic direct-to-form page, source=organic, channel attribution via utm
   params if a shared link ever carries them, plus created_at time windows.
   `/conference` 308-redirects to `/waitlist` so anything already shared
   keeps working. The `conference` value stays in the source enum for future
   use.
13. **Wireframe carries no drafted copy (founder correction, 2026-07-04).**
   The first wireframe pass drafted voice-level copy (hero, trust points,
   form microcopy, SEO metadata); founder ruled the wireframe must be
   non-opinionated. Now: voice-level copy renders as labeled
   `WireframeSlot` placeholders pointing at the copy kit (journeys/07 §5);
   headings, form labels, buttons, and validation messages use neutral
   functional text (best-practice defaults: visible labels, optional
   marking, plain error text, form-adjacent privacy note); metadata is
   neutral. The one voice sentence kept is the vetted always-true privacy
   line (entry #1). Copy kit + design pass fill the slots.

## 2026-07-04 · Blindspot pass + grilling session (finding-unknowns skill)

A full BUILD.md/planning review (blindspot pass on the plan corpus + repo-state
audit, then a one-question-at-a-time grilling interview) surfaced 9 gaps.
Decisions made, in the order asked:

1. **July 13 copy/design path:** agents draft final landing copy from the
   `journeys/07 §5` kit (variant B) and apply the homa-design v2 pass,
   replacing the wireframe slots; founder + Alessa do the read-aloud + phone
   test after. BUILD.md's Deliverable 0 DoD line corrected to drop the
   "at a booth" framing (there is no booth, per entry #11).
2. **M0-07 conference kit:** re-scoped for no-booth reality, question card +
   phone-based capture (no printed sheets), commitment ladder stops at the
   waitlist-email rung, the $29/$19 Stripe preorder rung dropped (no Stripe
   account exists yet, no booth to run a QR off). Entity/LLC filing deferred
   until it actually blocks (Stripe activation, ahead of invite #1) rather
   than done tonight. See `journeys/09 §2, §6.2` (re-scoped M0-07 spec).
3. **IC-10 vs D4 photo contradiction resolved:** `journeys/05` IC-10 ("no
   child-likeness uploads") is superseded by D4 (photo personalization ships
   day one with consent). IC-10's decline copy now applies only to the
   consent-declined path. Amended in `journeys/05` directly (the row + §4
   example 8).
4. **CI added now**, before any Phase A code: `.github/workflows/ci.yml` runs
   typecheck + build + `check:isolation` on every push/PR to `main`. Required
   secrets (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   — both public-safe publishable values) set on the GitHub repo. Satisfies
   BUILD.md law #1 ("isolation tests green in CI always") for the first time;
   extend with the MJ-08 events-registry check once that registry covers more
   than `waitlist.joined`.
5. **M0-01 timing:** next major agent task after the copy/design pass, not
   run in parallel and not skipped. `eve` pinned to an exact version (`0.19.0`,
   was `^0.19.0`) in `apps/web/package.json` so upgrades are always a
   deliberate, logged decision; started `docs/homa-planning/eve-churn-log.md`
   to feed the eject tripwire (`12-roadmap-okrs.md` §tripwires) with real data.
6. **Email/invite bridge named explicitly:** BUILD.md's Phase B bullet list now
   names **M1-08 minimal** (Resend transactional email: welcome, journal-prompt,
   weekly-note, receipt templates + the opens/clicks/unsubscribes webhook
   bridge that `journeys/06 §7` requires for the anti-guilt ratio law) and
   **MJ-09** (waitlist read path + invite codes + invite email — today's
   waitlist is write-only with no way to invite anyone off it) — previously
   both were only implicit under FR-1/FR-3.
7. **Cost-telemetry timing (Gateway `ai-reporting-*` headers + per-key budget
   caps moved into Phase B vs staying in Phase C with FR-11): left open,
   question skipped.** BUILD.md's Phase A section gained a platform-ceilings
   summary (sandbox region/rate/snapshot limits, Workflow event/step caps,
   function duration) so the next agent designing M0-01/M0-03 sees them, but
   the FR-11/T2 telemetry sequencing itself was not changed.
8. **Resend domain live:** `mail.thankshoma.com` verified in Resend (DKIM, SPF
   MX+TXT, DMARC, tracking CNAME all green; click+open tracking on per
   `journeys/06 §7`'s explicit opens/clicks webhook requirement; inbound
   receiving deliberately left off — `journeys/02` line 890 defers
   reply-to-email to POST-GA, v1 is deep-link-to-chat only).
   `RESEND_API_KEY` is in `apps/web/.env.local` (gitignored) and in Vercel
   production env (added via CLI, type Sensitive).

## 2026-07-04 · Deliverable 0 copy + design pass (grilling decision Q1)

Replaced the wireframe's placeholder slots with final copy and the homa-design
v2 visual system, closing the loop the grilling session opened.

1. **Copy**: hero is variant B verbatim from `journeys/07 §5` ("Know exactly
   where your child stands. Without ever testing them."). How-it-works,
   trust, and paperwork bands pull from pillars A/B/C one-liners. Trust point
   #3 uses the vetted honest claim from entry #1 ("we'll publish our full
   privacy policy before the first family joins"), not the gated "never
   trains AI" line. Waitlist band uses "Founding families" framing per
   BUILD.md's hard constraint (no pricing, T2). CTA stays functional ("Join
   the waitlist") rather than the kit's more evocative "Meet your child's
   map" — no product exists yet for that CTA to honestly lead to.
2. **Design**: homa-design v2 tokens (colors, radius, shadows, fonts) copied
   into `apps/web/app/globals.css` and wired through Tailwind v4's
   `@theme inline`, so classes like `bg-brand`, `text-strong`, `rounded-pill`
   work directly. Fonts (Newsreader, Hanken Grotesk, Caveat, JetBrains Mono)
   load via `next/font/google` instead of the design system's raw `@import`,
   for self-hosting and zero layout shift. `Logo` component ported from
   `docs/homa-design/components/brand/Logo.jsx`. This is a hand-copied
   subset, not the formal `packages/design` workspace package; M1-17 still
   owns porting the full component library.
3. **Verification**: typecheck + production build green; rendered and
   screenshotted at desktop and mobile (390px) widths via Playwright for
   both `/` and `/waitlist` — readable, on-brand, touch-friendly. Founder
   phone test + Alessa read-aloud (build-log #10's two remaining DoD boxes)
   are next.
4. Deleted `wireframe-slot.tsx` (no slots remain, per its own comment).

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
- `apps/web/app/page.tsx`: landing page (hero variant B, efficacy lead; final
  copy + homa-design v2 styling as of the copy/design pass above).
- `apps/web/components/brand/Logo.tsx`: brand lockup, ported from
  `docs/homa-design/components/brand/Logo.jsx`.
- `apps/web/app/conference/page.tsx`: QR conference variant (`/conference`).
- `apps/web/app/api/waitlist/route.ts`: validated capture endpoint; duplicate
  email = success (idempotent retries).
- `apps/web/components/waitlist-form.tsx`: optimistic form, offline queue.
- `apps/web/components/wireframe-slot.tsx`: labeled placeholder primitives
  for undecided copy/media (deleted when the copy kit lands).
- `apps/web/lib/waitlist-client.ts`: timeout + retry + localStorage queue +
  online-event flush (bad conference wifi survival).
- `scripts/isolation-check.mjs`: anon-key isolation smoke checks (M1-07 seed);
  run with `pnpm check:isolation`.
- `.github/workflows/ci.yml`: typecheck + build + isolation check on every
  push/PR to `main` (see entry #14 above).
- `docs/homa-planning/eve-churn-log.md`: dated log of eve version bumps and
  breaking changes, feeding the eject tripwire.
