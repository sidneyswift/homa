# Raw · GemMiner AI visibility audit of thankshoma.com, 2026-07-06

> Historical external-tool snapshot. Search results, AI answers, sampled
> platforms, site content, and recommended fixes are not current evidence.
> Run a new bounded audit before reuse.

Transcribed from the founder's screenshots of the GemMiner "AI Visibility
Audit" report (run 2026-07-06, "4 buyer-question samples and 16 platform
checks") plus the fixes list the founder pasted alongside them. Screenshots:
`2026-07-07-gemminer-audit-screenshots/` in this folder. Transcription note:
the tool's em and en dashes are normalized to repo punctuation; wording is
otherwise verbatim. No family data involved; this is a crawl of the public
site plus sampled AI answers.

## Headline result

> thankshoma.com shows up in 0 of 16 AI checks.

AI coverage 0%, fixable gaps 5. Per platform: ChatGPT 0/4, Perplexity 0/4,
Claude 0/4, Gemini 0/4.

## Strategic read (the tool's own words)

> Test a programmatic SEO page pattern. thankshoma.com was not visible in
> this directional AI sample. The fastest path is not more generic SEO copy;
> it is becoming a quotable source for buyer questions.

> The play: thankshoma.com may have a repeatable query pattern; validate one
> page template before scaling it.

> Programmatic SEO: viable here. The sampled topics repeat solution/use-case
> modifiers that could support templated pages.

## The four buyer topics sampled (0/4 platforms each)

Section header: "When your buyers ask, AI recommends these instead. Across 4
buyer topics, AI cites sources like homeschoolfox.com, not thankshoma.com."

1. AI homeschool assistant recommendations: "What are the best AI-powered
   homeschool assistant tools that create personalized learning materials
   for..." (question truncated in the report UI)
2. Homeschool compliance tracking tools: "Which homeschool planning tools
   automatically track hours for state compliance requirements?"
3. Choosing an adaptive homeschool assistant: "How do parents choose an AI
   homeschool assistant that adapts to each child's learning style and
   generat..." (truncated)
4. Homeschool progress tracking methods: "What are the main approaches to
   tracking homeschool progress and demonstrating learning outcomes to
   sta..." (truncated)

## Who AI cites instead

> The sources AI pulls from for your topics. Get placed in these and you move.

homeschoolfox.com x4 (publisher), numaschool.com x4 (publisher), aop.com x3
(publisher), littlelit.ai x3 (publisher), reddit.com x3 (community),
theschoolhouse.org x3 (publisher), hometrail.net x2, hscoophq.com x2,
midwesthomeschoolers.org x2, aipoweredhomeschool.com x1.

Notable: no household-name incumbents in the citation set. The winners are
niche publishers plus one community source.

## Cited page blueprints

> The page patterns AI cited for your topics: the formats to emulate on your
> own site.

- Deep guides / explainers: 2 citations, 2 sources (GUIDE)
- Community discussion: 1 citation, 1 source (COMMUNITY)
- Comparison / alternatives pages: 1 citation, 1 source (COMPARISON)
- Listicles / best-of roundups: 1 citation, 1 source (ROUNDUP)

## Why pages aren't getting cited (crawl of 10 pages)

> AI assembles answers from passages it can lift: direct answers, a stat to
> quote, a named author to trust.

Crawl-level signals, strongest first: answer capsules 3 quotable blocks,
stat density 0.6 data points per 100 words, authorship 0 pages with a
byline, schema 0 pages. What that means, per the tool: weak entity and
page-type clarity; missing visible attribution and trust cues; AI is
leaning on third-party sources for this category. Health score 70/100,
17 agent-fixable issues (3 critical, 7 high, 12 medium, 3 low).

Context: the crawl predates the 2026-07-06 discoverability work (commit
8fd66eb and the canonical/robots/ai.txt/site-schema pass that followed);
the technical items below are already fixed in code.

## Recommended first step (the tool's words)

> Turn the sampled buyer questions into 3 to 5 answer-first pages with clear
> H2 questions and short direct answers.

## Technical fixes list (pasted by the founder, executed in code 2026-07-06/07)

1. Duplicate content clusters (fragment URLs /#how vs /): fixed with
   self-referencing canonicals.
2. Near-duplicate content (SimHash): same root cause, same fix.
3. No robots.txt found: existed by audit time; AI-crawler directives added.
4. Pages missing canonical tag: canonicals added to every indexable page.
5. Duplicate title tags across fragment URLs: resolved by the canonicals;
   titles were already unique per route.
