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

## 2026-07-04 · M0-01 GO/NO-GO criteria written (not yet run)

Per the council re-scope's requirement ("GO/NO-GO criteria written BEFORE
starting"), wrote `docs/homa-planning/m0-01-adversarial-prototype-gate.md`
covering the five adversarial tests from `03-backlog.md` (eve upgrade drill,
deploy+rollback mid-run, dispatcher kill mid-fan-out, HITL-parked rotation,
100-family fan-out), each with a concrete pass/fail bar, plus: a strict
2-session/≤2-day timebox distinct from BUILD.md's no-calendar-estimates
roadmap stance, a contained-blast-radius environment plan (Vercel preview
branch, real homa-prod schema with tagged+cleaned-up synthetic rows, never
production), and a verdict rule (any leakage/data-loss/stuck-state = NO-GO
regardless of the other four; eject to M0-02 on failure). BUILD.md now links
it. **The spike itself has not been run yet** — this session only produced
the criteria, per the gate's own requirement that they exist first.

## 2026-07-04 · M0-01 test (a) run: NO-GO

Ran the eve upgrade drill (test a of `m0-01-adversarial-prototype-gate.md`)
locally, isolated on a throwaway `spike/m0-01` branch (deleted after, no code
diff to keep — this was a pure test, nothing to merge). Parked a session in
HITL under eve 0.18.2, bumped to 0.19.0 (today's `latest`; no newer version
exists to test a true forward upgrade), and tried to resume it.

**Result: reproducible failure.** The parked session's event log corrupts on
replay (`CorruptedEventLogError`, 3 failed recovery attempts, confirmed on
retry), and the resume API silently opens a fresh, memoryless session instead
of erroring, `{"ok": true}` with no indication anything went wrong. The
original question and its answer are permanently lost. Likely cause: a
patch-level (not flagged breaking) change to how 0.19.0 records tool-call
results in the durable workflow log. Full evidence in `eve-churn-log.md`;
gate writeup in `m0-01-adversarial-prototype-gate.md`.

**Per the gate's own verdict rule, this single failure is enough: NO-GO.**
Tests (b)–(e) were not run — the verdict doesn't change once (a) fails this
decisively, and they remain available for a custom-harness retest later.
**This is now an open decision for Sidney**, not resolved here: eject to
M0-02 (custom harness) per the rule as written, treat it as a narrower
operational risk (drain HITL-parked sessions before every upgrade) and
re-test, or report upstream and wait for a fix. Phase B work should not
proceed on eve, as-is, until this is decided.

## 2026-07-04 · Mitigations for the M0-01 finding (fix without diverging)

Asked "what would fix this without diverging too much" after the NO-GO.
Built three things, all in our own code/process, none touching eve
internals:

1. `apps/web/lib/harness/resume-session.ts` — narrow seed of M1-14. Every
   resume of an eve session must go through this. It doesn't trust eve's
   synchronous `ok: true` alone (the finding showed that's not confirmation);
   it watches the event stream for a real new turn or an explicit failure
   before calling a resume successful, and throws a typed error otherwise.
   Verified against the live bug: 2/2 correctly caught the real corruption,
   1/1 correctly passed a healthy same-version control (no false positive).
2. `scripts/eve-upgrade-check.mjs` — automates the exact repro against any
   candidate version pair. Verified: correctly passes a same-version no-op,
   correctly fails the known-bad 0.18.2→0.19.0 pair (twice).
3. `docs/homa-planning/runbooks/eve-version-bump.md` — the procedure: read
   the changelog for tool/replay/workflow language, run the script, check
   for live parked sessions (stubbed until M1-02), deploy, smoke-test, log
   the outcome in `eve-churn-log.md` either way.

This does not resolve the open decision (eject to M0-02 vs. stay on eve with
these mitigations vs. report upstream and wait) — that's still Sidney's call.
It does mean Phase B is no longer flatly blocked: BUILD.md now says
"mitigated, not resolved" instead of "blocked."

## 2026-07-05 (later) · Test (b) retested for real: "let's test on real Vercel builds"

Resolved the local-vs-production caveat on the deploy/rollback finding.
Deployed two separate real Vercel previews (fixing a genuine gap along the
way: no `.vercelignore` existed, so a local `vercel deploy` tried to upload
the multi-gigabyte `homa-research/`/`homa-macmini/` folders and failed —
added `.vercelignore` mirroring `.gitignore`'s exclusions). Started a
session on the first deployment, let it complete, deployed the second, sent
a follow-up to the second deployment's URL using the first's session and
token.

**Result: clean pass.** The second deployment correctly resumed the exact
session with real context intact (recalled a secret code from the first
turn). This is strong evidence the earlier "stuck forever" finding was a
limitation specific to `eve dev`'s local disk-backed workflow world, not a
production-relevant risk — Vercel Workflow (the managed service actual
production uses) handles cross-deployment continuity correctly.

Still open, narrower: this tests session portability across deployments,
not literal mid-step crash recovery, which is much harder to replicate
against real Vercel infra (deploys take far longer than a model turn, and a
preview-to-preview deploy doesn't tear down the first one). De-risked, not
fully closed. Full detail: `eve-churn-log.md`,
`m0-01-adversarial-prototype-gate.md`.

Also: enabled Vercel's Protection Bypass for Automation on the project
(`vercel project protection enable --protection-bypass`) to make this kind
of preview-deployment testing possible; documented the mechanism for reuse.
Cleaned up both throwaway preview deployments and the test branch after.

## 2026-07-05 · Founder decision: stay on eve; spike continued

Sidney: "stay and continue." Resolved the open M0-01 decision — not
ejecting to M0-02, staying on eve with the mitigations from 2026-07-04.
Continued the spike since committing to eve means the other adversarial
tests should actually be checked against it:

- **Adapted test (e)** (concurrent sessions, no schedule dispatcher exists
  yet to test the original version): 12 concurrent synthetic-tenant
  sessions, zero cross-session leakage, confirmed twice. Clean pass on the
  single most safety-critical property.
- **Test (b)** (deploy + rollback mid-turn): failed, reproducibly, across
  three variants (hard kill, graceful stop, explicit nudge) — a step killed
  between start and completion never resumes, with zero server-side error
  logged. **Important caveat**: this is against the local dev workflow
  world, not real Vercel Workflow, which the docs describe as a different,
  managed durability substrate. Needs a Vercel-preview retest before being
  trusted as production-relevant. Logged in full in `eve-churn-log.md` and
  `m0-01-adversarial-prototype-gate.md`.
- Tests (c) and (d) stay deferred — they need a schedule dispatcher and a
  session-rotation state machine that don't exist yet (M3-10/M1-02, M1-15).
  Not skipped, just correctly sequenced.
- Relocated `resume-session.ts` from `apps/web/agent/harness/` to
  `apps/web/lib/harness/` — the old path is an eve-discovered directory
  convention and eve's discovery warned on it; the module is app code
  calling eve's API, not an eve capability.

Phase B is clear to start with the mitigations in place and the deploy/
rollback finding tracked as an open risk, not a blocker.

## 2026-07-05 · Playable MVP: auth → family → child → chat → worksheet

Founder asked "can we get an mvp shipped so i can start playing with it" —
built the trimmed walking-skeleton slice end to end, real code not hacks:

1. **Auth (minimal M1-01):** Supabase Auth email/password via @supabase/ssr.
   `lib/supabase/{server,client}.ts` helpers, `proxy.ts` (Next 16's renamed
   middleware) refreshes sessions per request and gates /home + /chat with
   `getClaims()` (JWT-verified, not spoofable). /signin page with a
   founding-family gate: signup requires the invite code in
   `HOMA_SIGNUP_CODE` (set in Vercel prod env; unset locally = open signup
   for dev). MJ-09's real invite codes replace this.
2. **Family creation (migration #6):** `create_my_family()` RPC — an
   authenticated user with no membership creates exactly one family
   atomically; the one-family rule lives in the function body. RLS advisor
   warning is intentional (documented in the migration).
3. **Child intake (minimal M2-03i):** /home shows create-family → add-child
   → children list; children write to `children.profile` jsonb (interests,
   focus) under the existing "members add children" RLS policy.
4. **eve auth (FR-1 slice):** `agent/channels/eve.ts` custom AuthFn — chat
   sends the caller's Supabase access token as a bearer (resolved fresh per
   request by useEveAgent), the channel verifies it via `auth.getUser()`,
   resolves familyId under the caller's OWN RLS, and stamps
   `{ principalId: userId, attributes: { familyId, supabaseAccessToken } }`.
   The raw token in attributes is server-custody state, never model-visible,
   refreshed per turn; M1-02's SET LOCAL pattern replaces it.
5. **Agent tools (first two):** `get_children` (reads the family's kids +
   profiles as the caller — RLS is the wall inside tools too, no service
   key exists in the app) and `create_worksheet` (schema-validates the
   worksheet the model composes; the UI renders it as a printable card).
   `lib/agent-db.ts` is the shared caller-scoped DB helper. Instructions
   updated: call get_children at conversation start, worksheet composition
   rules, voice laws.
6. **Chat UI (trimmed M1-04):** /chat with useEveAgent, on-brand bubbles,
   suggestion chips, worksheet card with a print button (browser print
   dialog → paper/PDF; v0 of MJ-01). shadcn integration stays with M1-04
   proper.

**Verified end to end with Playwright against the real stack** (Next dev +
eve dev + homa-prod Supabase + real model calls): unauthenticated /chat
bounces to /signin; sign in lands on /home; create family; add child (Maya,
5, dinosaurs+drawing, letter sounds); chat "make Maya a worksheet" →
get_children + create_worksheet tool calls → on-brand printable "Maya's
Dino Letter Sounds" card with 5 themed exercises. Test rows deleted from
homa-prod after. Typecheck, production build, and isolation checks green.

Known deferrals: voice, photo personalization, conversation persistence
(chat history resets on reload — eve session is durable server-side but the
UI doesn't rehydrate it yet), real invite codes (MJ-09), the reportlab/fal
worksheet pipeline (M0-03/M2-05 — current output is text-exercise layouts),
proper session-tracking table.

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
- `docs/homa-planning/m0-01-adversarial-prototype-gate.md`: GO/NO-GO criteria
  for the M0-01 spike, written before the spike runs.
- `apps/web/lib/harness/resume-session.ts`: resume-identity + forward-
  progress guard (M1-14 seed), mitigating the M0-01 finding. Lives in
  `lib/`, not `agent/` — it calls eve's API, it isn't an eve capability.
- `scripts/eve-upgrade-check.mjs`: automated pre-bump regression check for
  any eve version change.
- `docs/homa-planning/runbooks/eve-version-bump.md`: the procedure for
  bumping the pinned eve version safely.
