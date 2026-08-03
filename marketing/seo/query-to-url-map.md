# Homa search map

Status: research map, not publication approval
Date: 2026-08-03
Scope: parent-side homeschool planning, records, progress, and practice

This file turns the July 2026 SEO and AI-search research into a first query-to-URL map. It is deliberately a map rather than a keyword-volume report. No authenticated Google Keyword Planner, Search Console, Ahrefs, or Semrush export was available during this pass, so monthly volume, CPC, and difficulty are not invented here. Re-score these rows after the first-party and paid-search data are connected.

## Operating rules

- One primary intent gets one canonical owner. Do not create a page for every word-order variant.
- A feature page must prove the Homa workflow with real screenshots, output, limits, and a clear next step. A guide must answer the question even when the reader does not start a trial.
- A state page needs a current official source, jurisdiction-specific review, a visible review date, and a correction path. It must not promise compliance unless the product and the source support that exact claim.
- A comparison page requires current firsthand research on every product named. If that research is not complete, keep the page in the brief queue.
- A model may cluster queries and draft an explanation. Deterministic checks must verify source presence, approved product claims, links, dates, schema, and canonical ownership before publication.
- No automated publication. The marketing engine stops at a staged bundle; human approval is required for every public format.

## Priority query map

| Priority | Search language to validate | Proposed canonical owner | Stage | First supporting assets | Publication gate |
| --- | --- | --- | --- | --- | --- |
| P0 | homeschool hours tracker; homeschool hours tracker app; how to track homeschool hours | /features/homeschool-hours-tracker | Decision | free hours log; how-to guide; product demonstration | Verify exact tracking behavior and output in the current product |
| P0 | homeschool record keeping app; how to keep homeschool records; homeschool records checklist | /features/homeschool-record-keeping | Decision and implementation | records hub; portfolio checklist; record-retention guide | Distinguish record capture from legal advice and verify the product workflow |
| P0 | homeschool progress tracker; homeschool progress report example; homeschool progress report template | /features/homeschool-progress-tracker | Decision and implementation | report examples; progress-without-more-testing guide; video walkthrough | Show a real, consent-safe example and validate every progress claim |
| P0 | homeschool planner app; weekly homeschool planner; homeschool planner for multiple kids | /features/homeschool-planner | Decision | weekly template; multiple-child schedule guide; flexible-week guide | Show the current planner flow and avoid promising capabilities not shipped |
| P1 | homeschool portfolio app; homeschool portfolio checklist; homeschool portfolio examples | /features/homeschool-record-keeping plus a portfolio resource | Implementation | printable checklist; binder walkthrough; selected state guide | Confirm the binder and export behavior before using app or portfolio language |
| P1 | homeschool worksheet generator; homeschool math worksheet generator | /features/personalized-practice-pages | Decision and implementation | context-to-practice guide; real output gallery; video walkthrough | Explain how Homa uses the child's actual learning context; do not imply an unlimited generic generator |
| P1 | AI homeschool assistant; best AI homeschool app; AI tools for homeschooling | Homepage category section, then a buyer guide | Consideration | honest comparison; selection criteria; independent reviews | Do not publish a best ranking without a dated method and tested alternatives |
| P1 | ChatGPT for homeschooling; ChatGPT homeschool prompts; AI homeschool planner versus ChatGPT | /compare/chatgpt-for-homeschooling | Consideration | reproducible task comparison; privacy and continuity guide | Test both workflows and disclose where Homa is weaker or different |
| P1 | Missouri homeschool hours requirements; Missouri homeschool hours log | /homeschool-laws/missouri/hours | Implementation | official-source summary; printable log; hours feature link | Use current Missouri primary sources and a dated legal-content review |
| P1 | New York homeschool quarterly report; NY homeschool progress report example | /homeschool-laws/new-york/quarterly-reports | Implementation | official-source summary; report example; records feature link | Use current New York primary sources and a dated legal-content review |
| P1 | Florida homeschool portfolio requirements; Florida homeschool portfolio examples | /homeschool-laws/florida/portfolio | Implementation | official-source summary; portfolio checklist; records feature link | Use current Florida primary sources and a dated legal-content review |
| P2 | how to know if homeschooling is working; am I doing enough homeschool | /guides/homeschool-progress | Awareness and reassurance | evidence guide; progress examples; parent-friendly checklist | Use supportive, non-verdict language and avoid invented parent stories |

## Initial content sequence

### Foundation pages

Create these outside the blog. They are product and search landing pages, not short editorial posts:

1. Homeschool hours tracker
2. Homeschool record keeping
3. Homeschool progress tracker
4. Homeschool planner
5. Personalized practice pages

Each page should link to one hub, one useful free resource, one proof asset, and the appropriate onboarding path. The homepage remains the category page for “AI homeschool assistant.”

### First three hubs

1. /guides/homeschool-record-keeping
2. /guides/homeschool-progress
3. /guides/homeschool-planning

Do not create the fourth AI-specific hub until the product page and at least one tested comparison can support it with more than generic AI language.

### First supporting assets

- Free homeschool hours log
- How to track homeschool hours without losing the week
- Homeschool progress report examples
- How to know whether homeschooling is working
- Homeschool schedule for multiple children
- Weekly homeschool planner template
- Homeschool portfolio checklist
- One real product walkthrough video per P0 feature cluster

## Product-claim ledger for content review

The following are research prompts, not approved marketing claims. Before a page moves from brief to draft, record the exact current product evidence for each statement.

| Claim family | Evidence needed | Failure condition |
| --- | --- | --- |
| Homa creates a weekly plan | Current planner flow and a representative output | The flow requires manual work not described on the page |
| Homa makes personalized practice | Current generation path and a real output sample | The sample is generic or the feature is not available for the promised input |
| Homa helps with hours and state rules | Current hours/state workflow plus official state sources | The page turns assistance into a legal or compliance guarantee |
| Homa shows progress | Current progress view or report with provenance | The page implies a standardized assessment or outcome that the product does not provide |
| Homa supports multiple children | Current account and planning behavior | The page assumes cross-child scheduling or pricing that has not been verified |

## Data required before scoring

Add these fields to the eventual keyword inventory:

- Query and normalized intent
- Country, state, and language
- Monthly volume and 12-month trend from an authenticated source
- Current SERP type and top competing URLs
- Buyer stage
- Product-fit score
- ICP-pain score
- Attainability score
- Citation and recommendation potential
- Canonical URL owner
- Last research date
- Next refresh date

The initial ordering uses product fit, parent pain, buyer intent, attainability, and citation usefulness. Once real volume and conversion data exist, those are inputs to the score, not a replacement for product truth.

## Measurement loop

Before publication, baseline the priority queries in Search Console and a fixed AI prompt set. Repeat the AI prompts at least three times per run because model answers vary by prompt, time, and platform. Track:

- non-brand impressions and clicks by canonical URL
- indexation and crawl status
- Google AI-surface visibility where the property has the report
- Bing AI citations and grounding queries
- whether Homa is cited, mentioned, recommended, and represented accurately
- qualified trial starts, activation, and paid conversion by landing page

Review weekly. Merge or rewrite a page that is indexed but receives no relevant impressions after the agreed test window. Fix the title or intent when it gets impressions without clicks. Fix proof, offer, or product alignment when it gets clicks without qualified activation.

## Source record

- Current Homa capability language: apps/web/components/marketing/landing-content.ts
- Existing blog contract: apps/web/lib/blog.ts
- Current blog route: apps/web/app/blog/[slug]/page.tsx
- Historical AI visibility snapshot: marketing/raw/2026-07-07-gemminer-ai-visibility-audit.md
- Google AI-search guidance: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Google people-first guidance: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- OpenAI publisher guidance: https://help.openai.com/en/articles/12627856-publishers-and-developers-faq
- Bing AI Performance: https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview
