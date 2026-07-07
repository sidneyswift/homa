# Codebase cleanup audit · 2026-07-06

> **STATUS (2026-07-07): EXECUTED.** Every non-destructive fix below was
> applied the same night (founder instruction "fix everything that is non
> destructive"; execution record in build-log 2026-07-07 "Cleanup audit
> executed"). Still open, deliberately: the Tracked section (privacy/method
> pages ride the LLM-report PR, resume-session stays dormant), the dead
> schema columns (MJ-09/M2-07 decisions), @homa/core unused barrel exports
> (API-surface call), applied-migration comment fixes (files stay
> byte-stable), path-alias/file-split refactors (when next touched), and
> the marketing signal top-up (content task, reservoir below 5).

A full staleness and consistency pass over the repo, run the night of 2026-07-06
after the pricing v1 and LLM-report rulings landed. Four parallel audit agents
covered apps/web, the data layer + scripts, the planning corpus, and
marketing/skills/benchmarks; every finding below was then hand-verified against
the tree (several agent claims turned out false and were dropped, see the last
section). File:line references are as of commit `faf5da6`.

Baseline health at audit time, all green: `pnpm typecheck`, `pnpm lint`,
`pnpm build`, `pnpm check:isolation` (13 checks), `pnpm check:map`,
`pnpm check:sources`, `node scripts/skills-targeting-check.mjs`, and the
marketing bundle scorer. No tracked secrets found. No `.env` files tracked.
Redirects `/map`, `/waitlist`, `/conference` to `/onboarding` all present and
correct in `apps/web/next.config.ts`.

How to read severity:

- **P0**: violates a hard law or misleads agents building right now. Fix first.
- **P1**: real drift, fix this week.
- **P2**: cosmetic, batch when convenient.
- **Tracked**: known-deliberate or owed inside an already-planned PR. Do not fix
  out of band.

---

## P0 · Law violations and contract-doc drift

### 1. Em dashes in live product surfaces (voice law #7)

The agent-discoverability commit (`8fd66eb`, merged tonight) introduced em
dashes into shipped copy. The no-em-dash law covers UI copy, docs, and commit
messages (that commit's message also contains one; history stays, but the files
must be fixed).

| Where | What |
|---|---|
| `apps/web/app/page.tsx:23` | `answer-capsule` metadata string contains an em dash ("stands \u2014 takes five minutes") |
| `apps/web/public/llms-full.txt:11` | same sentence, literal em dash |
| `apps/web/public/llms-full.txt:23` | "any curriculum \u2014 bought, borrowed, or homemade" |

Fix: replace with comma or mid-dot. One-line each.

### 2. BUILD.md still documents the retired signup gate

`BUILD.md:154-155` says signup is gated by the `HOMA_SIGNUP_CODE` env var. The
founder opened signup on 2026-07-05 (build-log; migration
`20260705202000_open_signup.sql` dropped the invite trigger; the env var was
removed from Vercel per build-log ~line 1647). Any agent reading BUILD.md today
gets the wrong signup model. Fix: rewrite that sentence to open signup, note
MJ-09 invite distribution is a separate future path.

### 3. PRD (the contract) contradicts three founder rulings

`docs/homa-planning/13-mr-prd.md` is the highest-precedence doc, so staleness
here outranks everything else:

| Line | Says | Now true |
|---|---|---|
| ~146 | "placeholder $29/mo at Payment Link" | Pricing v1: $19/mo, $99/yr, Pro $49/mo (build-log 2026-07-06 late evening) |
| ~37-38 | non-goal: "public signup (invite codes only)" | open signup since 2026-07-05 (founder override, logged) |
| ~55-58 | FR-1 "Invite code → Supabase Auth" | open signup now; MJ-09 becomes invite distribution for the waitlist cohort, not a gate |

Fix: patch the three spots with supersession notes pointing at the build-log
entries. Keep T2 (allotments derived at day 60) intact, only sticker prices
changed.

### 4. Runtime env vars missing from `apps/web/.env.example`

Code reads these; the example file never mentions them. A fresh environment
fails silently (cron 401s, report emails never send, lead writes fail):

| Var | Read in |
|---|---|
| `RESEND_API_KEY` | `apps/web/lib/map/email.ts:27` |
| `CRON_SECRET` | `apps/web/app/api/map/cron/route.ts:27` |
| `SUPABASE_DB_PASSWORD` | `apps/web/lib/map/db.ts:23` |
| `NEXT_PUBLIC_SITE_URL` | `apps/web/lib/map/email.ts:13` (optional, falls back to thankshoma.com) |

Fix: add all four with comments.

---

## P1 · Real drift, fix this week

### Code (apps/web)

| Where | Finding | Fix |
|---|---|---|
| `apps/web/lib/map/store.ts:580-595` | `plansNeedingRetest()` joins `lead_families` without `f.email is not null`, but email became nullable (migration `20260706135251_lead_email_optional.sql`). Type lies (`email: string`), and the hourly cron would hand a null email to Resend | add the null filter, mirror the reminder/band-ready queries |
| `apps/web/components/marketing/Nav.tsx:76` | button label "Sign Up", title case, voice law is sentence case | "Sign up" |
| `apps/web/app/terms/page.tsx:41` | service description leads with "the waitlist", retired framing | reword to invite-list / onboarding language |
| `apps/web/app/page.tsx:28-35` + `components/marketing/Faq.tsx:9-16` | FAQ answers duplicated between JSON-LD and the rendered component, will drift apart on next copy edit | export one FAQ array, consume in both |
| `apps/web/agent/instructions.md` | `forget_skill` tool exists (`agent/tools/`) but is never mentioned in instructions; the model discovers it only via an error string in `save_skill.ts:77` | add a line to instructions.md |
| `apps/web/public/videos/homa-brand-film.mp4` | 16 MB file ships in every deploy but nothing references it since the founder removed the hero film modal 2026-07-06 (see `Hero.tsx:10-13` comment) | delete from `public/`; canonical copy stays in `docs/homa-design/assets/videos/` |

### Scripts, CI, config

| Where | Finding | Fix |
|---|---|---|
| `packages/core/src/events.ts` + `.github/workflows/ci.yml` | registry now covers 15+ events (map.*, chat.*, waitlist.*); BUILD.md:135-136 says add the MJ-08 events-registry CI check "as soon as the registry covers more than waitlist.joined". That trigger fired long ago; no check exists | add a `check:events` script (registry vs emission parity) and a CI step |
| `scripts/skills-targeting-check.mjs` | passes when run by hand but wired to no pnpm script and not in CI, so it guards nothing | add `check:skills-targeting` to root package.json, put in CI |
| root `package.json` `test` | `turbo run test` is a no-op, no workspace defines `test` | remove the script or add a real test task, so green "tests" stop being fictional |
| `apps/web/package.json:43` vs `.github/workflows/ci.yml:26` | engines say node `24.x`, CI runs node 22 | align one to the other |
| `supabase/README.md:3-5` | says "Migrations #1-3 are applied"; there are 19 | update the count, state the GitHub integration watches the folder |

### Docs with operational consequences

| Where | Finding | Fix |
|---|---|---|
| `BUILD.md:52-54` | Deliverable-0 "Remaining before July 13" list still names the copy pass and homa-design v2 wireframe replacement, both shipped 2026-07-04 | rewrite as: founder read-aloud, phone test, D6 announce email, LLM report narrative behind flag |
| `BUILD.md:58` | superseded-surface blurb says "email first"; founder call 2026-07-06 moved email capture to signup, parent name is S1 | one-line fix |
| `HUMAN-TODO.md:50` | tells Alessa "thankshoma.com/waitlist goes straight to the signup form"; that URL now 308s to `/onboarding` | say thankshoma.com or /onboarding |
| `HUMAN-TODO.md` Stripe items | Stripe account + products went live 2026-07-06 (both environments, per build-log) but checkboxes are unticked | tick, note LLC still deferred |
| `docs/homa-planning/README.md:65` | "Next: Phase A engine proofs" · Phase A cleared 2026-07-05, Phase B started | update next-action line |
| `docs/homa-planning/m0-01-adversarial-prototype-gate.md:3-7` | header still blocks Phase B on the gate; body (~186-198) records the GO | add a supersession banner at the top |

### Planning corpus · the $29 sweep

Pricing v1 ($19/mo, $99/yr, Pro $49/mo, build-log 2026-07-06) supersedes $29/$49
placeholders across ~20 docs. Not urgent to rewrite every one; the fix is a
supersession note at the top of each touched section, full rewrites only where
copy is "binding" (journeys/07 copy kit, journeys/02, 08-billing).

Files needing at least a note: `00-product-brief.md` (44, 110),
`01-architecture.md` (243), `04-risks-and-open-questions.md` (25),
`07-deep-research-notes.md` (112), `08-billing-credits-design.md` (44, 81),
`10-real-usage-cost-model.md` (234-282), `12-roadmap-okrs.md` (42),
`journeys/02` (22, 78, 150, 1050-1053), `journeys/03` (377, 385, 443, 473, 489,
526, 550, 1088, 1139-1141: also stale "Basic plan = 2 kids" vs D9 unlimited),
`journeys/04` (459, 540), `journeys/05` (112, 197), `journeys/07` (37, 122,
191, 196, 302, 312, 383), `journeys/08` (46, 147), `journeys/09` (63, 71, 100,
203, 358-429, 591), `journeys/10-reconciliation.md:12` (C1 footnote),
`icp-research/01` (94, 180), `icp-research/06` (102, 204), `icp-research/08`
(107, 248), `icp-research/09` (7, 43, 173-186). Competitor prices ($29
ArborSlate, $99/yr Fox) are facts, leave those.

### Planning corpus · D8 overturned (LLM writes report prose)

The lead-magnet spec docs still describe the old "curated sentence banks, zero
model calls" world. New truth: numbers deterministic, all parent-facing words
LLM-written (build-log 2026-07-06 night; implementation prompt in
`plans/2026-07-06-llm-report-narrative-implementation-prompt.md`).

| Where | Stale claim |
|---|---|
| `docs/homa-planning/lead-magnet/index.html:233, 239` | D8=A recommended; "no AI provider ever sees the answers" |
| `docs/homa-planning/lead-magnet/states.html:97, 171, 198, 208, 219, 231` | zero-model-call prose, instant report, `/map` routes, `/waitlist` 308s to `/map` |
| `docs/homa-planning/lead-magnet/journey.html:239, 286` | sentence bank as the narrative layer |
| `docs/homa-planning/lead-magnet/flow.html:117, 210, 257` | "no model call, under a second"; conference texts `/map`; invite-code entry point |
| `docs/homa-planning/map-announcement-draft.md:5, 51` | "/map launch" (body link at line 32 already correct) |
| `plans/2026-07-06-llm-report-depth-exploration-prompt.md` + `-options.md` | pre-ruling artifacts; add a "D8 overturned, see build-log 2026-07-06 night" header so nobody executes the old option |

Fix: supersession banners, plus route strings `/map` to `/onboarding` where the
docs claim current behavior. Note the privacy/method page rewrites are NOT part
of this cleanup; they are owed inside the LLM implementation PR itself (see
Tracked below).

### Planning corpus · signup gate references

Same ruling as P0 item 2, lower-stakes locations: `journeys/02` (11-12, 22, 32,
1005), `03-backlog.md:12`, `09-council-synthesis.md:37-41`,
`lead-magnet/index.html:196`, `lead-magnet/flow.html:257`. Add supersession
notes distinguishing MJ-09 invite distribution from a signup wall.

### Founding families

Copy and code are clean. Two doc stragglers:

| Where | Finding |
|---|---|
| `icp-research/09-buying-psychology-seasonality.md:192` | recommends Homa offer "a founding-family rate" as July-13 advice; retired vocabulary (competitor references elsewhere in the file are fine) |
| `apps/web/components/marketing/InviteBand.tsx:9-12` | comment still quotes the retired phrase and calls the flow "the map" (P2, batch with comment sweep) |

### Benchmarks docs vs the shipped bank

Bank is v2026.07.2, 16 domains (computer_science added). Older lane docs still
say 15:

| Where | Finding |
|---|---|
| `docs/homa-benchmarks/00-synthesis.md:27` | section title "the 15 map domains" |
| `docs/homa-benchmarks/README.md:60-62` | lists 15 domains, no computer_science |
| `docs/homa-benchmarks/06-social-studies-k-10.md:462`, `09-languages-cs-digital.md:385`, `08-sel-ef-life-skills.md:381`, `01-early-childhood-2-5.md:642` | stale domain counts, "CS has no shipped domain", v2026.07.1 references |
| `docs/homa-benchmarks/10-assessment-norms.md:259, 383` | Florida "35th percentile" claim contradicted by lane 16 (no percentile in statute); verify and strike or source |
| `docs/homa-benchmarks/00-synthesis.md:113` | runbook paths missing the `docs/homa-planning/` prefix |

### Marketing engine

| Where | Finding |
|---|---|
| `marketing/content/drafts/2026-07-05-ugc-homa-intro/video/script.md:83` | founder-review note still says the lead magnet lives at `/map` |
| `marketing/signals/` | 4 signals with `status: new`, below the orchestrator's 5-signal floor; next engine run wants `marketing-idea-generator` first (operational note, not a file fix) |

---

## P2 · Cosmetic batches

**Stale comment sweep (one PR, no behavior change):**

- `apps/web/app/page.tsx:70-71` docblock says CTAs route to `/map` (they route to `/onboarding`)
- `apps/web/components/marketing/Nav.tsx:10` comment says CTA routes to waitlist
- `apps/web/app/blog/[slug]/page.tsx:15` comment says "waitlist CTA"
- `apps/web/app/onboarding/page.tsx:23` default export still named `MapPage`
- `apps/web/app/globals.css:322` comment says `MapFlow`
- `apps/web/components/marketing/InviteBand.tsx:9-12` (see founding families above)
- `supabase/migrations/20260706152009_lead_last_name.sql:1-3` comment describes the superseded capture order (entry screen name-first); founder call moved email to S1
- `apps/web/app/api/map/claim/route.ts:44-46` same stale capture-order claim
- `packages/core/src/map/schemas.ts:26-31, 40-47` same

**Dead schema surface (decide at MJ-09 / M2-07, do not migrate now):**

- `lead_families.status` check allows `complete`/`claimed`, never written
- `lead_reports.revoked_at` read in three queries, never set anywhere
- `family_memories.kind` allows `daily_note`, app writes only `fact`/`what_works` (reserved for M2-07)
- `skill_bank.provenance` never read or written
- `waitlist.kid_age_bands`/`kid_count`/status values `confirmed`/`invited`: legacy of the bare waitlist, kept for MJ-09

**Small stuff:**

- `apps/web/README.md` is still create-next-app boilerplate
- ~15 unused exports in the `@homa/core` barrel (`KID_AGE_BAND_LABELS`, `CAPTURE_MAX_MONTHS`, unused schema types, `EventSink`, etc.), unexport or use
- six-level relative imports in `onboarding/r/[token]/plan/[domainId]/page.tsx`; consider a path alias someday
- `lib/map/store.ts` (783 lines) and `report-view.tsx` (644 lines) split when next touched
- em dashes inside root docs themselves: `BUILD.md` (34), `13-mr-prd.md` (22), `DESIGN.md` (7), `README.md` (3), `AGENTS.md` (1); mechanical find-replace pass, the law applies to docs too
- `docs/homa-design/uploads/hf_20260705_003146_....mp4` is a byte-identical duplicate of `assets/videos/homa-brand-film.mp4` (same sha); the uploads folder also holds ~30 dated screenshots; prune duplicates, keep uploads out of future commits
- `docs/homa-design/ui_kits/landing/README.md:5` still documents the "Watch the film" hero; production removed it by founder call 2026-07-06 (the kit is design source, so note the divergence rather than silently differ)
- `.agents/skills/homa-design/SKILL.md:14` paths written as `app/globals.css` without the `apps/web/` prefix
- `13-mr-prd.md:107` refers to `06-harness-gap` and `11-hermes-notes`; actual files are `06-harness-gap-analysis.md` and `11-hermes-implementation-notes.md`
- CI runs `check:map` (good, but BUILD.md/AGENTS.md do not mention it) and does not run `lint`; document or add
- `plans/2026-07-05-marketing-demand-engine.md` checkboxes all unticked though the scaffold shipped; tick or archive

---

## Tracked · deliberate, do not "fix"

- **Stripe env keys + `stripe` npm package unused in code**: Phase D billing
  work; keys renamed and documented in `.env.example` tonight, wiring comes with
  the paywall PR.
- **Privacy page (`app/privacy/page.tsx:54-65`) and method page
  (`onboarding/method/page.tsx:52-53`) wording**: "No AI provider receives your
  questionnaire answers" and "No AI reads or scores your answers" become
  false when the LLM report narrative ships. The rewrite is owed IN that PR
  (founder ruling, build-log 2026-07-06 night). Listed here so the PR review
  checks it; do not edit early, the promises are true today.
- **`apps/web/lib/harness/resume-session.ts` unimported**: BUILD.md names it a
  standing mitigation ("every resume MUST go through this"); no resume flow
  exists yet. Dormant by design; wire it when session resume lands, do not
  delete.
- **`/api/map/*`, `lib/map/`, `map.*` event names**: internal names kept on
  purpose through the `/onboarding` rename; only user-visible surfaces changed.
- **`packages/design/` stub**: M1-17.
- **Blog empty state**: `apps/web/content/blog/` exists with `.gitkeep`;
  `listBlogPosts()` returns empty, pages render an honest empty state. Fills
  when the marketing distributor publishes.
- **`eve-upgrade-check.mjs` unwired**: manual-only by design (runbook).
- **`marketing/` empty dirs** (`staged/`, `published/`, `reports/`), routines
  `enabled: false`, eval fixture with a deliberate em dash: all per spec.
- **`waitlist` table + `/api/waitlist`**: still the offline fallback and MJ-09
  bridge; every lead mirrors into it. Not dead.
- **`ai` and `microsandbox` deps in apps/web**: `ai` may be an eve peer
  dependency, verify before removing; `microsandbox` is a devDependency staged
  for the M0-03 worksheet sandbox spike.

---

## Suggested execution order

1. **PR 1, product code quick pass**: em dashes (page.tsx, llms-full.txt),
   Nav "Sign up", terms wording, FAQ single-source, `plansNeedingRetest` null
   guard, `.env.example` additions, `forget_skill` instruction line, delete the
   unused public brand film. Small diff, all P0/P1 code items.
2. **PR 2, guardrails**: `check:events` script + CI step, wire
   `skills-targeting-check`, fix `pnpm test` no-op, align node versions.
3. **PR 3, contract docs**: PRD three patches, BUILD.md signup gate + D0
   remaining list + email-first line, supabase/README count, HUMAN-TODO
   updates, planning README next-action, m0-01 banner.
4. **PR 4, corpus sweep**: $29 supersession notes, D8 supersession banners,
   signup-gate notes, founding-families straggler, benchmarks domain-count
   pass, UGC script `/map` line.
5. **PR 5, cosmetic batch**: comment sweep, root-doc em dash pass, boilerplate
   README, unused exports, design-kit divergence note, uploads dedupe.

Each PR keeps `pnpm typecheck && pnpm build && pnpm check:isolation &&
pnpm check:map` green; PR 4 and 5 are docs-only.

---

## Findings from the audit agents that did NOT survive verification

Recorded so nobody re-flags them:

- "Marketing bundle mp4s and hero.png missing, scorecards stale": false. All
  media is tracked (`git ls-files`), and `score_bundle.py` passes today.
- "docs/homa-design/assets/ tree missing": false. Brand film, hero photo, and
  brand PNGs all exist there.
- "apps/web/content/blog/ missing, distributor will fail": false. Exists with
  `.gitkeep`.
- "Design token drift between globals.css and docs/homa-design tokens": none
  found; hex values, shapes, typography, spacing, radii, shadows, motion all
  match verbatim. Dark theme deliberately not copied.
- "Dead marketing components": none; every component under
  `components/marketing/` is rendered.
