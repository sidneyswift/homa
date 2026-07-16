# Category-leader landing implementation notes

## 2026-07-15 21:35 ET · Plan-confirmed

The approved competitor teardown is now an implementation-ready design and nine-task plan:

- `docs/superpowers/specs/2026-07-15-category-leader-landing-design.md`
- `docs/superpowers/plans/2026-07-15-category-leader-landing.md`

The implementable scope is LP-01 through LP-07. LP-08 through LP-11 stay absent from the page until their evidence gates are satisfied.

## 2026-07-15 21:35 ET · Deviation

1. **What the plan said:** Put real product UI or screenshots in the hero and capability section.
2. **What the code revealed:** The only full product screenshots are temporary browser-test artifacts under untracked `.tmp-*` directories. They would become stale marketing assets and some contain fixture journeys that require manual privacy review.
3. **Conservative choice:** Render fixture-labeled product UI proof as accessible React components. Reuse the existing public `ReportPreview` for the progress report. Use only invented sample names and content already present in public fixtures.
4. **Revisit:** A later asset pass can replace individual proofs with approved, versioned screenshots if the product establishes a screenshot refresh and privacy-review process.

## 2026-07-15 21:35 ET · Discovery

The native Expo app exists, but repository presence does not establish public App Store availability. The platform strip will say `Text message`, `Web chat`, and `Phone friendly`, not `iPhone app` or `Available in the App Store`.

## 2026-07-15 21:35 ET · Todo for human

Founder faces remain blocked because no approved founder photo asset exists in the repository. The page will add the already-public `Alessa & Carolyng` signature and render no photo placeholder. This does not block merge or QA.

## 2026-07-15 22:05 ET · Deviation

1. **What the plan said:** Promote the sample report into the page while preserving the signup popup for landing actions.
2. **What the code revealed:** `SignupPopupProvider` also opened the form automatically after 480 pixels of scroll. The new sample proof appears later in the page, so the automatic dialog interrupted the reader before she could reach the proof the redesign was meant to expose.
3. **Conservative choice:** Keep the shared dialog for explicit buttons and remove only the automatic scroll opening. No signup route or CTA destination changed.
4. **Revisit:** If an automatic prompt returns, it needs a measured experiment and must wait until after the sample proof rather than using a fixed page offset.

## 2026-07-15 22:05 ET · Discovery

The cold ICP read found that the old expanded mechanics card still claimed state academic mapping and `Mapped to all 50 states`. BUILD.md says the public report uses national benchmarks and state data covers homeschool law. The page now removes that redundant card rather than preserving a false explanation after the clearer four-step section.

## 2026-07-15 22:05 ET · Deviation

1. **What the plan said:** Name the capability `Hours and state paperwork`.
2. **What the code revealed:** Homa records hours and displays sourced state-rule references, but BUILD.md and the PRD do not establish automatic completion of state forms.
3. **Conservative choice:** The rendered capability is `Hours and state rules`. The proof shows hours by subject, sources, and last-checked dates.
4. **Revisit:** Rename it to paperwork only after an end-to-end state-form generator is implemented and verified.

## 2026-07-16 01:25 ET · Discovery

Playwright against `http://127.0.0.1` broke React hydration on this Next 16 app because the HMR client treats that host as cross-origin from `localhost`. Signup and interactive checks must use `http://localhost`.

## 2026-07-16 01:25 ET · Deviation

1. **What the plan said:** Product proof starts on the first phone screen.
2. **What the code revealed:** After the stacked hero copy, platform strip, and original mobile padding, `.lp-product-demo` started about 6px below an 844px-tall iPhone viewport.
3. **Conservative choice:** Tighten mobile hero padding, column gap, and vertical margins so the demo top lands inside the first screen. Do not invent App Store claims or reorder the hero into a demo-first layout without a separate design pass.
4. **Revisit:** If phone visitors still miss the demo, try a mobile-only order swap that puts the fixture phone above the body paragraph.

## 2026-07-16 01:25 ET · Verification

- `pnpm exec tsx --test apps/web/components/marketing/landing-content.test.ts` → 7/7 pass
- Marketing ESLint on the touched landing files → clean
- `HOMA_E2E_URL=http://localhost:3313 python3 .tmp-category-landing-e2e/verify.py` → `LANDING_E2E_OK`
- Full `pnpm --filter web typecheck` currently fails on an unrelated dirty-tree subject-lesson export (`SUBJECT_LESSON_RETRY_ERROR`). Landing files themselves typecheck through the marketing suite and lint path.
