# Homa SEO and AI-search operating plan

Status: operating draft
Date: 2026-08-03
Scope: Homa feature discovery, parent-side homeschool questions, Google Search, ChatGPT search, Gemini, and Microsoft Copilot

This plan turns `marketing/seo/query-to-url-map.md` into a repeatable measurement and publishing system. It is designed to increase qualified discovery without turning the site into a volume content farm.

## What the current evidence says

Google's current guidance says the normal foundations still apply to AI Overviews and AI Mode. A page must be crawlable, indexable, eligible for a snippet, linked from the site, useful in visible text, and supported by accurate structured data when structured data is used. Google says there is no special AI markup or AI text file required. See [AI features and your website](https://developers.google.com/search/docs/appearance/ai-features).

Google's people-first guidance emphasizes original value, first-hand experience, clear authorship where readers would expect it, and a real audience need. It explicitly warns against producing many pages mainly to attract search visits or using automation to manipulate rankings. See [Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).

OpenAI's publisher guidance says public sites should not block `OAI-SearchBot` if they want their content included in ChatGPT summaries and snippets. Homa's `robots.ts` names that crawler and allows it to crawl the public site. See the [Publishers and Developers FAQ](https://help.openai.com/en/articles/12627856-publishers-and-developers-faq).

Microsoft's Bing Webmaster Tools AI Performance preview reports total citations, average cited pages, grounding queries, page-level citation activity, and trends across supported AI experiences. That makes Bing the first source in this plan for recurring first-party citation measurement. See [Introducing AI Performance in Bing Webmaster Tools](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview).

Implication: the strategy is not a secret markup trick. It is a small set of canonical, useful pages with clear product evidence, strong internal linking, accessible text, and a measurement loop that treats AI citations as a separate outcome from blue-link ranking.

## The operating loop

1. **Choose one intent and one canonical owner.** Use the query map. Do not create separate pages for word-order variants.
2. **Verify the product claim.** The current product flow, output, limitation, and a consent-safe proof asset belong in the brief before drafting.
3. **Draft the answer first.** Put a direct answer near the top, then explain the workflow, choices, examples, and limits in plain language.
4. **Build the cluster.** Link the feature page to one useful guide, one proof asset, and the relevant onboarding path. Link supporting articles back to the feature page.
5. **Run the gates.** The reader gate checks usefulness and attention. The editor gate checks voice, claims, links, and CTA rules. The deterministic scorer checks mechanical floors.
6. **Stage, approve, publish.** Content remains in `marketing/content/drafts/` until a human approves each format. No model or routine publishes.
7. **Measure after recrawl.** Compare Search Console, Bing AI Performance, analytics, and fixed prompt runs. Update the page when evidence says the intent, proof, or product fit is wrong.

## Cadence

| Cadence | Automated work | Human decision | Output |
| --- | --- | --- | --- |
| Every deploy | Check the build, sitemap, robots, canonical URLs, JSON-LD validity, broken internal links, and noindex boundaries. | None unless a check fails. | Deployment gate and URL health report. |
| Daily | Pull Search Console and analytics deltas for published feature and blog URLs. Alert on a sharp indexation or organic-click change against the previous baseline. | Triage only when an alert fires. | Exception queue, not a daily content quota. |
| Weekly | Export query and page performance from Search Console. Pull Bing AI Performance citations and grounding queries. Run the fixed AI prompt set three times per engine and store the raw answers, cited URLs, mention accuracy, and date. | Choose one page to improve, merge, or leave alone. | Weekly visibility report and one prioritized action. |
| Every two weeks | Recompute the internal-link graph, identify orphaned or weakly linked URLs, check canonical ownership, and compare the query map with newly observed queries. | Approve a link change or a new brief. | Link and intent backlog. |
| Monthly | Refresh authenticated volume, trend, CPC, and difficulty data from Google Keyword Planner, Search Console, and one paid SEO source. Sample current SERPs for each P0 and P1 cluster. Review branded and non-brand conversion paths. | Re-score priorities and retire stale ideas. | Updated query map with research dates. |
| Quarterly | Recheck every product-claim ledger row. Revisit state and legal source pages with a qualified reviewer. Audit authorship, About links, privacy language, and proof assets. | Approve current claims and any jurisdiction-specific publication. | Claim ledger and content refresh decisions. |

The weekly action is deliberately small. Consistent improvements to a few canonical pages are safer and more measurable than a large batch of thin posts.

## What can be automated safely

### Safe for code or scheduled jobs

- Pull Search Console, analytics, and Bing AI Performance exports into dated snapshots.
- Check that every published canonical owner is in the sitemap and reachable with a 200 response.
- Check robots rules for `Googlebot`, `OAI-SearchBot`, `Bingbot`, and the site-wide wildcard.
- Validate canonical tags, metadata length, Open Graph URLs, JSON-LD syntax, and visible-text parity.
- Detect duplicate primary intents, orphaned pages, redirect chains, broken internal links, and accidental `noindex`.
- Run a fixed prompt set and diff cited URLs, brand mentions, feature descriptions, and limitation accuracy.
- Cluster new query strings into existing intent owners and create a brief with the evidence links. The model may propose a cluster, but a deterministic validator must require a real source, canonical owner, and approved product-claim IDs.
- Suggest internal links from the query map and render a reviewable diff.
- Notify search engines about an approved URL change through the supported indexing workflow. Never use a notification as proof that a page was indexed.

### Keep human-controlled

- Product capability, limitation, pricing, access, and outcome claims.
- State-law, compliance, safety, or jurisdiction-specific content.
- Screenshots, examples, testimonials, and any family-derived evidence.
- Comparison pages that name another product or rank alternatives.
- Final title, offer, CTA, and publication approval.
- Outreach, partnerships, link requests, and any external communication.

Automation should reduce copying, checking, and reporting. It should not decide what Homa does, whether a family meets a requirement, or whether a page is ready to publish.

## Fixed AI visibility test

Create one prompt set per P0 cluster. Each set should contain:

- the plain feature query, such as “homeschool hours tracker”
- a task query, such as “how to track homeschool hours by subject”
- a comparison query, such as “homeschool hours tracker app versus spreadsheet”
- a limitation query, such as “can a homeschool app confirm state hours requirements”
- a recommendation query, such as “what should a parent look for in a homeschool planner app”

Run each prompt three times in Google AI features where available, ChatGPT search, Gemini, and Microsoft Copilot. Store the platform, model or surface, locale, date, prompt, cited URLs, brand mention, feature mentioned, and whether the answer represents Homa accurately. Three runs are a minimum sample for direction, not a statistical estimate of market share.

Track four separate outcomes:

1. **Rank:** the canonical page's organic position and impressions.
2. **Citation:** the page is linked as a source in an AI answer.
3. **Recommendation:** Homa is named when the user asks for a solution.
4. **Accuracy:** the answer describes the feature and its limits correctly.

An increase in one outcome does not prove an increase in the others. A page can be cited without ranking in the top ten, and a brand can be mentioned inaccurately. Accuracy errors are product-content bugs and take priority over visibility gains.

## Decision rules after publication

Use the first 28 days after indexation as an observation window unless a production bug or a materially false claim requires an earlier change.

- **Not indexed:** check robots, canonical, sitemap inclusion, internal links, and the rendered page before changing copy.
- **Indexed with no relevant impressions:** revisit intent ownership, page usefulness, and internal-link context. Do not add near-duplicate pages yet.
- **Impressions without clicks:** test the title and description against the query, while keeping the page's answer honest.
- **Clicks without qualified activation:** improve proof, product fit, or the next step. Do not inflate the promise.
- **Cited or recommended inaccurately:** correct the visible source text and product boundary, then rerun the prompt set. Do not hide the page with an AI-specific file.
- **Several pages owning one intent:** choose one canonical owner, consolidate useful evidence, redirect or deindex the duplicate only after checking links and analytics.

## Minimum scorecard

Report these by canonical URL and by intent cluster:

- non-brand impressions, clicks, and click-through rate
- indexation status and crawl errors
- organic sessions and qualified waitlist or trial starts
- activation and paid conversion where the route is measurable
- AI citation count and average cited pages from Bing AI Performance
- fixed-prompt citation rate, recommendation rate, and accuracy rate by engine
- referring domains and unlinked brand mentions, reviewed for relevance rather than volume
- last product-proof review date and last state-source review date

The goal is not the largest number of pages. The goal is a small, trusted library that answers the parent's question, demonstrates the real Homa workflow, and remains accurate when an AI system reuses it.

## Source and implementation record

- Query ownership and publication gates: `marketing/seo/query-to-url-map.md`
- Feature definitions and approved current copy: `apps/web/lib/feature-pages.ts`
- AI-readable public summary: `apps/web/public/llms.txt` and `apps/web/public/llms-full.txt`
- Crawl policy: `apps/web/app/robots.ts`
- Sitemap: `apps/web/app/sitemap.ts`
- Technical contract guard: `pnpm check:seo` (`scripts/seo-contract-check.mts`)
- Blog contract: `apps/web/lib/blog.ts`
- Google AI features guidance: https://developers.google.com/search/docs/appearance/ai-features
- Google people-first guidance: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- OpenAI publisher guidance: https://help.openai.com/en/articles/12627856-publishers-and-developers-faq
- Bing AI Performance preview: https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview
