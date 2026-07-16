# Category-leader landing page implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the public landing narrative around Homa's category advantage, prove the product with fixture-safe UI, and keep every public claim inside verified product boundaries.

**Architecture:** Keep `/` server-rendered and preserve the existing signup provider, sticky navigation, reveal observer, ribbons, and waves. Split the new narrative into focused marketing components. Centralize new parent-facing strings in one typed content module so copy and claim tests cannot drift.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Lucide, Homa design tokens, native Node tests through `tsx --test`, Playwright for browser E2E.

## Global constraints

- No em dash anywhere.
- Homa in prose, HOMA only in the wordmark and existing UI-surface treatments.
- No real family data in fixtures, screenshots, tests, or copy gates.
- The report uses national standards and research. State data is a separate homeschool-rules reference.
- Do not claim App Store availability, community, local discovery, curriculum comparison, curriculum import, or state academic mapping.
- Do not show pricing, founding rates, testimonials, family counts, or founder photos.
- Keep the parent as the AI user. Never imply a child chats with Homa.
- Use existing design tokens and components. Add no dependency.

---

### Task 1: Add typed landing content and claim guards

**Files:**
- Create: `apps/web/components/marketing/landing-content.ts`
- Create: `apps/web/components/marketing/landing-content.test.ts`

**Interfaces:**
- Produces: `HERO_COPY`, `PLATFORM_ITEMS`, `PAIN_ITEMS`, `CAPABILITY_ITEMS`, `SAMPLE_REPORT_COPY`, and `FOUNDER_STORY_COPY`.
- Each item has a stable `id`, `title`, and `body`; platform items also have a stable `kind`.

- [ ] Write a failing test asserting the approved titles, four pain items, four capability items, sample-report path, and forbidden-claim absence.
- [ ] Run `pnpm exec tsx --test apps/web/components/marketing/landing-content.test.ts` and confirm the module-not-found failure.
- [ ] Implement the typed content module with the exact approved product boundaries.
- [ ] Re-run the focused test and confirm zero failures.

### Task 2: Build the category hero and product conversation

**Files:**
- Create: `apps/web/components/marketing/PlatformStrip.tsx`
- Create: `apps/web/components/marketing/HeroProductDemo.tsx`
- Modify: `apps/web/components/marketing/Hero.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- `PlatformStrip()` consumes `PLATFORM_ITEMS`.
- `HeroProductDemo()` renders a fixture-labeled parent conversation and printable card.
- `Hero()` preserves `useSignupPopup()` and the existing link fallback.

- [ ] Add source-level assertions to `landing-content.test.ts` for the hero category line, sample link, and platform terms.
- [ ] Run the test and confirm it fails on the missing component contracts.
- [ ] Implement `PlatformStrip` with Lucide icons, 44px-friendly layout, and no native-store claim.
- [ ] Implement `HeroProductDemo` with fixture label, parent message, Homa reply, binder state, and printable preview.
- [ ] Refactor `Hero` to the approved headline, two-sentence explanation, primary CTA, sample-report link, platform strip, and product proof.
- [ ] Add only the responsive classes required for the phone proof to `globals.css`.
- [ ] Re-run the focused test and `pnpm --filter web typecheck`.

### Task 3: Add the parent-pain bridge

**Files:**
- Create: `apps/web/components/marketing/PainBridge.tsx`
- Modify: `apps/web/app/page.tsx`

**Interfaces:**
- `PainBridge()` consumes `PAIN_ITEMS`.
- The landing order becomes Hero, Ribbon, PainBridge, Features.

- [ ] Extend `landing-content.test.ts` to assert the four approved pain IDs and absence of `You need help`.
- [ ] Run the test and confirm the expected failure.
- [ ] Implement the restrained four-item section with one section heading and a concrete closing line.
- [ ] Insert it after the hero ribbon.
- [ ] Re-run the focused test and typecheck.

### Task 4: Replace abstract feature cards with product capability proof

**Files:**
- Create: `apps/web/components/marketing/CapabilityProof.tsx`
- Modify: `apps/web/components/marketing/Features.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- `CapabilityProof({ capabilityId })` renders one of four exhaustive proof states.
- `Features()` consumes `CAPABILITY_ITEMS` and renders exactly four capabilities.

- [ ] Extend the focused test to assert all four capability titles and ban current overclaims such as `Your town, in the plan`, `Compare curriculums`, `right fit the first time`, and `actual gaps`.
- [ ] Run the test and confirm failure against the current feature content.
- [ ] Implement four fixture-safe proofs: printable page, weekly-plan rows, binder items, and hours plus state-rules rows.
- [ ] Rewrite `Features` around the four plain nouns and the proof component.
- [ ] Keep each body to two sentences and each proof labeled `Example`.
- [ ] Add only the responsive capability-grid rules needed below 880px.
- [ ] Re-run the focused test and typecheck.

### Task 5: Promote the free progress report

**Files:**
- Create: `apps/web/components/marketing/SampleReportProof.tsx`
- Modify: `apps/web/app/page.tsx`

**Interfaces:**
- `SampleReportProof()` reuses `ReportPreview` from `app/onboarding/report-preview.tsx`.
- Both section actions point to `/onboarding/sample` or preserve the signup popup through a client child.

- [ ] Extend the focused test to assert that hero, proof section, and final CTA all expose `/onboarding/sample`.
- [ ] Run the test and confirm the proof-section assertion fails.
- [ ] Implement a dedicated two-column sample section with mechanism-first copy and the existing report preview.
- [ ] Insert it after `Features` and before `HowThread`.
- [ ] Re-run the focused test and typecheck.

### Task 6: Tighten and sign the founder story

**Files:**
- Modify: `apps/web/components/marketing/Stories.tsx`
- Modify: `apps/web/components/marketing/landing-content.ts`
- Test: `apps/web/components/marketing/landing-content.test.ts`

**Interfaces:**
- `Stories()` consumes `FOUNDER_STORY_COPY`.
- The story closes with `Alessa & Carolyng`.

- [ ] Add a failing test for the public signature and bans on retired whole-child statuses, `curriculum` as Homa's identity, and invented social proof.
- [ ] Run the test and confirm failure.
- [ ] Rewrite the story in short, concrete paragraphs about the kitchen-table origin and the work Homa handles.
- [ ] Add the public co-founder signature without a photo placeholder.
- [ ] Re-run the focused test and typecheck.

### Task 7: Run both copy gates

**Files:**
- Modify only the source files that own accepted copy fixes.

- [ ] Assemble the entire rendered landing copy in reading order.
- [ ] Dispatch `homa-copy-reviewer` to a fresh read-only subagent with no chat context.
- [ ] Apply accepted comprehension fixes at their source.
- [ ] Dispatch `homa-copy-editor` on the post-reader copy with the full rulebook and marketing house style.
- [ ] Apply every accepted must-fix and deliberate craft suggestions.
- [ ] Re-run `landing-content.test.ts`, typecheck, and lint on changed files.

### Task 8: Responsive browser E2E and visual repair loop

**Files:**
- Create: `.tmp-category-landing-e2e/verify.py`
- Create: `.tmp-category-landing-e2e/*.png`
- Do not commit temporary browser artifacts.

- [ ] Start or reuse the web development server after checking existing terminals.
- [ ] At 1440 by 900 and 390 by 844, load `/`, wait for network idle, and scroll through every section to trigger reveals.
- [ ] Assert no horizontal overflow and no uncaught page or console errors.
- [ ] Assert the hero headline, platform terms, four capability titles, and sample-report links are visible.
- [ ] Click the primary hero CTA and assert the signup dialog opens.
- [ ] Press Escape and assert the dialog closes.
- [ ] Open a sample-report link and assert `/onboarding/sample` renders.
- [ ] Repeat the page visibility pass with reduced motion.
- [ ] Capture hero, product-proof, and full-page screenshots at both viewports.
- [ ] Inspect screenshots and repeat implementation plus E2E until no overlap, clipping, hidden content, or unreadable text remains.

### Task 9: Final verification and shipping

**Files:**
- Update: `docs/notes/category-leader-landing-implementation.md`

- [ ] Record every plan confirmation, discovery, deviation, and deferred founder ticket.
- [ ] Run `pnpm exec tsx --test apps/web/components/marketing/landing-content.test.ts`.
- [ ] Run `pnpm --filter web typecheck`.
- [ ] Run `pnpm --filter web lint` for the changed files or the full web package if file scoping is unavailable.
- [ ] Run `pnpm --filter web build`.
- [ ] Review `git diff` and stage only landing-page spec, plan, notes, components, page, and CSS files.
- [ ] Commit with a message describing the category and proof improvement.
- [ ] Push the current branch.
- [ ] Wait for the intended Vercel deployment to become READY and probe `https://thankshoma.com/` at desktop and phone widths before making a live-completion claim.
