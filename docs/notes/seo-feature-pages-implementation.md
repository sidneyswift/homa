# SEO feature pages implementation notes

Started: 2026-08-03
Scope: first-class marketing pages for Homa's five highest-priority search jobs

## Entries

### 2026-08-03, Plan-confirmed

- Build feature pages outside the editorial blog so search intent, product proof, and conversion paths can be owned separately.
- Reuse existing marketing components and design tokens. Do not introduce a new page-level design system.
- Keep the first pass text and workflow focused on product language already present on the public landing page.

### 2026-08-03, Copy and UX gates

- The fresh-parent reader and senior copy editor gates required concrete outputs, explicit parent control, and no unverified pricing or efficacy promises. The feature data was revised to name the planner, hours record, progress report, digital binder, and practice-page outputs directly.
- A rendered UX review covered all five mobile routes and the planner at desktop width. No clipping, overlap, horizontal overflow, or broken responsive ordering was found.
- The UX review found the pages are still text-led. Keep them out of the publication set until each route has a verified representative product screen, report, record, hours view, or practice output. Do not create illustrative evidence from copy alone.
- The hours page now surfaces the state-rules reference boundary in the hero. The reference lists sources and last-checked dates, does not decide which requirement applies to a family, and directs the parent to check local requirements.

### 2026-08-03, AI-readable surfaces and FAQ boundary

- `public/llms.txt` and `public/llms-full.txt` now link each feature query family to its canonical feature page. `robots.ts` already allows `OAI-SearchBot`, and the sitemap contains all five feature URLs.
- The landing FAQ answer for state standards now begins with a direct “No” and distinguishes reviewed state-law sources from determining whether a family meets a legal requirement. The answer is shared by visible FAQ copy and `FAQPage` JSON-LD through `FAQ_ITEMS`.
- The SEO and AI-search cadence, prompt test, automation boundary, and decision rules live in `marketing/seo/operating-plan.md`.
- Local production-shaped probes returned 200 for robots, sitemap, both AI-readable summaries, blog, and all five feature routes. The homepage probe confirmed the corrected FAQ answer in rendered HTML and no stale “Yes” answer.

### 2026-08-03, Technical SEO contract

- Feature metadata now relies on the site title template for the Homa brand suffix, avoiding duplicated brand text in page titles. Open Graph cards use the shared Homa image endpoint with feature-specific alt text.
- `pnpm check:seo` verifies canonical feature paths, title and description limits, related-page integrity, static generation hooks, WebPage and BreadcrumbList JSON-LD, crawler allow rules, sitemap inclusion, AI-readable summaries, landing reachability, and the absence of synthetic `last-modified` metadata.

### 2026-08-03, Todo for human

- Add real, consent-safe screenshots or output examples before treating these pages as publication-ready.
- Connect authenticated keyword and Search Console data before changing priority based on volume or difficulty.
- Have a qualified reviewer check each state-specific page before any state-law route is created.

## Revisit for the next pass

- Decide whether feature pages should use a shared proof gallery once current product screenshots are available.
- Add intent-specific analytics events before evaluating feature-page conversion.
