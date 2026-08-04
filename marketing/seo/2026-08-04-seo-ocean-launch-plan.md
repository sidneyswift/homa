# Homa SEO ocean launch plan

Status: implementation and staged-content plan
Research date: 2026-08-04
Evidence window: guidance and market evidence available through 2026-07-31
Market: United States, English

## Outcome

Make Homa the clearest, most useful source for the parent-side questions that
lead into Homa's five current feature areas: planning, hours, records,
progress, and personalized practice.

Leadership does not mean publishing the most URLs. It means owning the best
canonical answer, example, template, product proof, and internal path for every
high-value intent the ideal parent brings to search or an answer engine.

## Inventory at the start of this sprint

| Asset | Count | State |
| --- | ---: | --- |
| Live feature owners | 5 | Public |
| Live articles | 1 | Public |
| Previously gated article drafts | 8 | Staged, not approved |
| New full article drafts | 12 | Staged, reader, editor, and final cold-read gates passed |
| Canonical intent graph | 100 | Mapped |
| Topic clusters | 5 | Implemented; a hub becomes public only when it has a public article |
| Legal and comparison opportunities | 9 | Research required |

The exact inventory lives in `marketing/seo/topic-graph.json`. The graph is the
only place a new page receives a canonical intent. A keyword variation joins an
existing row unless it represents a different parent decision.

## The first 90 days

### Week 0: make every future article discoverable

- Ship topic hubs for planning, records, progress, practice, and getting
  started. Empty hubs do not render or enter the sitemap.
- Add crawlable numbered pagination to the blog archive.
- Require cluster, updated date, related slugs, and descriptive hero alt text in
  every published article.
- Render visible authorship, publication and update dates, breadcrumbs, and
  related articles.
- Use `BlogPosting`, `CollectionPage`, `ItemList`, and `BreadcrumbList` schema
  only where the same information is visible on the page.
- Include every live article and occupied topic hub in the sitemap and public
  AI summaries.
- Fail `pnpm check:seo` on broken intent ownership, staged paths, article links,
  missing metadata, or AI-summary coverage.

### Weeks 1 to 4: publish coordinated cluster pairs

Maximum pace: four articles per week, grouped as two pairs. This is a ceiling,
not a quota. Each pair needs final human approval, real hero assets, current
product verification, and a live reciprocal link path.

Recommended order:

1. Planning: multi-child schedule plus weekly planner template.
2. Progress: report examples plus knowing whether homeschooling is working.
3. Records: portfolio checklist plus record organization.
4. Hours: tracker app versus spreadsheet plus the live hours guide refresh.
5. Planning: flexible schedule plus lessons that run long.
6. Practice: lesson-based practice page plus generated worksheet check.
7. Records: daily log plus choosing work samples.
8. Progress: reading progress plus math progress.

The pair should enter the sitemap together when each article depends on the
other. Do not ship a body link to a draft URL.

### Weeks 5 to 8: add assets articles cannot replace

Build the useful objects that can earn links and citations on their own:

1. A printable and copyable homeschool hours log.
2. A progress-report template with family-planning and outside-reader versions
   clearly separated.
3. One consent-safe product walkthrough for each P0 feature page, with a full
   transcript and a nearby text summary.
4. A real output gallery for personalized practice pages, including the lesson
   brief and parent check beside each page.
5. A source-backed record-keeping hub that routes state-specific questions to
   research-gated pages instead of answering them generically.

Every asset receives one canonical URL, a visible explanation, a relevant
feature link, and a place in its topic hub. A PDF or video without a useful HTML
page is harder for a crawler, answer engine, and parent to understand.

### Weeks 9 to 12: improve winners and earn authority

- Refresh pages that receive relevant impressions but weak clicks.
- Add examples, screenshots, or tools to pages that receive clicks but weak
  qualified onboarding starts.
- Correct any AI citation that describes a Homa capability inaccurately.
- Consolidate pages if Search Console shows that two owners are competing for
  the same intent.
- Offer genuinely useful templates or source summaries to homeschool groups,
  co-ops, curriculum reviewers, and parent newsletters. Outreach remains human
  controlled and must lead with the resource, not a link demand.
- Publish named-product comparisons only after current firsthand testing and a
  dated method. Show where Homa is weaker as well as different.
- Publish state pages only after primary-source research, visible review dates,
  a correction path, and qualified review.

## The content shape that wins both readers and answer engines

Every article should contain these in a natural reader journey:

1. A specific moment that makes the search feel understood.
2. A self-contained direct answer near the top.
3. One useful distinction or decision rule that competing summaries do not
   provide.
4. A concrete example, table, template, or before-and-after comparison when it
   materially improves understanding.
5. The important limitation beside the claim it limits.
6. A current product fact linked to the canonical feature owner.
7. One related guide and one honest next step.

Do not add FAQ blocks, headings, or schema only to manufacture search shape.
The page should remain valuable if Homa's product paragraph is removed.

## Automation boundary

| Work | Automate | Human stays responsible for |
| --- | --- | --- |
| Intent inventory | Detect duplicate queries, owners, and paths | Deciding whether two searches are truly different parent decisions |
| Technical publishing | Sitemap, metadata, schema syntax, internal-link, robots, and status checks | Public approval and final live verification |
| Draft preparation | Source resolution, word-count floor, banned language, link presence, frontmatter, and duplicate-text checks | Thesis, story movement, truth, empathy, and usefulness |
| Internal links | Suggest cluster and sibling links, reject broken public links | Choosing whether the link helps at that exact reading moment |
| Search measurement | Pull page and query exports, calculate deltas, flag anomalies | Choosing which page to improve and why |
| AI visibility | Run fixed prompts, store citations and descriptions, diff results | Judging accuracy and correcting misleading product language |
| Freshness | Flag old product claims, old review dates, and legal-source changes | Verifying the current source and approving the correction |
| Index notification | Submit approved changed URLs to Bing through IndexNow | Treating crawl or index status as verified |

No routine publishes. No routine writes legal conclusions, capability claims,
competitor rankings, or testimonials. A model may propose a cluster or draft;
deterministic code verifies the owner, source, path, and required fields.

## Measurement that separates four different wins

Track by canonical URL and cluster:

1. **Rank:** impressions, clicks, position, and indexation for the owned intent.
2. **Citation:** an answer engine links the page as a source.
3. **Recommendation:** Homa is named when a parent asks which solution to use.
4. **Accuracy:** the answer describes Homa's capability and limitation correctly.

Also track the product outcome:

- qualified organic sessions
- feature-page engagement
- onboarding starts
- progress-report completion
- trial and paid conversion where current product policy makes those events
  relevant

A citation without qualified use is not leadership. A recommendation that
misstates the product is a content bug.

## Weekly operating meeting

The weekly review should answer five questions:

1. Which canonical owners gained or lost relevant impressions?
2. Which pages were cited, recommended, or described inaccurately?
3. Did a new query belong to an existing intent or reveal a genuinely new one?
4. Which single page will receive a meaningful improvement this week?
5. Which zero, one, or two cluster pairs have complete gates and human approval?

The output is one improvement decision and a small approved publication queue,
not a demand for more drafts.

## Stop conditions

Do not publish when:

- the source is missing or the source no longer supports the claim
- the Homa capability has not been verified against the current product
- the article duplicates an existing owner's decision
- the reader gate loses attention or meaning
- the editor has a must-fix finding
- a related public link would return a 404
- the hero does not exist or its alt text describes a different image
- the page handles law, compliance, health, safety, or a named competitor
  without its required research and reviewer

Speed comes from preparing the system and queue ahead of approval. It does not
come from lowering the public bar.
