# Marketing demand engine implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.
> **Spec (the contract):** `docs/homa-planning/14-marketing-demand-engine.md`.
> Where this plan and the spec disagree, the spec wins.

**Goal:** Build the full B2C demand-gen engine: `marketing/` scaffold, 12 pipeline
skills, deterministic scorer, `/blog` in `apps/web`, then stage one real bundle
end to end and stop for founder approval.

**Architecture:** Content and state live in `marketing/` (reservoir: `raw/` +
`signals/`; outputs: `content/drafts/` + `content/published/`). Logic lives as
`.agents/skills/marketing-*` skills. The blog is file-based MDX in `apps/web`
(git is the CMS). Nothing auto-publishes, ever.

**Tech stack:** Markdown skills + personas · Python 3 stdlib scorer ·
Next.js 16.2 App Router + `next-mdx-remote` (RSC) + `gray-matter` + zod ·
Higgsfield CLI (authed) · Postiz CLI (wired, blocked on human setup).

**Hard laws that apply to every task:** no em dash anywhere, "Homa" title case in
prose, sentence case, no "behind" framing, never compare siblings, no family data,
never auto-publish, imports at top of file. Each task ends with a commit so CI
stays green throughout.

---

## Milestone 1: the marketing/ scaffold

### Task 1: marketing/AGENTS.md (the laws) + workflow map

**Files:**
- Create: `marketing/AGENTS.md`
- Create: `marketing/workflows/demand-engine.md`

- [ ] **Step 1: Write `marketing/AGENTS.md`** with exactly these sections:
  1. "What this folder is": one paragraph pointing at the spec
     (`docs/homa-planning/14-marketing-demand-engine.md`).
  2. "The laws" (numbered, verbatim from spec §15): never auto-publish (staged +
     committed is the stop state; publishing is a human-triggered, per-format
     action); grounding is structural (no source, no signal, no draft); family
     data banned (`homa-macmini/`, `homa-research/`, `homa-template/` never
     sources; anonymize field notes at extraction; engagement aggregates only);
     voice laws (no em dash, Homa casing, sentence case, reassure-before-inform,
     offers never commands, no "behind" framing, never compare siblings); no
     secrets in `marketing/` or bundles.
  3. "Folder map": the §4 tree with one-line descriptions, plus the growth-map
     list marked "created only when the first real file arrives."
  4. "How to run things": manual triggers ("run tonight's content" runs
     `marketing-demand-engine`; "run the engagement loop" runs
     `marketing-engagement-loop`), routines are disabled, publishing needs an
     explicit founder "publish <bundle> <formats>".
- [ ] **Step 2: Write `marketing/workflows/demand-engine.md`**: the spec §5
  mermaid diagram verbatim, then a step table with columns
  `# | step | skill | status` where status is one of `works | staged-only |
  blocked-on-human | disabled`, filled per spec §11 and §13 (blog publish
  `works`; social + email publish `blocked-on-human` with the exact missing
  steps named; routines `disabled`). End with "This file names skills, it never
  re-explains their steps."
- [ ] **Step 3: Commit**

```bash
git add marketing/ && git commit -m "Marketing engine: laws (AGENTS.md) + demand-engine workflow map"
```

### Task 2: personas

**Files:**
- Create: `marketing/personas/blog-reader.md`, `marketing/personas/shortform-viewer.md`,
  `marketing/personas/pinner.md`, `marketing/personas/waitlist-subscriber.md`
- Read first: `docs/homa-planning/journeys/01-personas-jtbd.md`,
  `docs/homa-planning/journeys/07-positioning-messaging.md`

- [ ] **Step 1: Read both journey docs**, note the P1 to P5 traits (worries,
  vocabulary, objections) that transfer to marketing audiences.
- [ ] **Step 2: Write the four persona files.** Identical structure, each 40 to 70
  lines so the reviewer can inhabit it: `# <name>` · "Who you are" (composite,
  explicitly synthetic: "you are a composite; no real family") · "Context of
  reading" (blog-reader: googled a worry at 10pm; shortform-viewer: thumb
  hovering, 2 seconds to earn 2 more; pinner: planning next semester's board;
  waitlist-subscriber: already gave her email, deciding if Homa deserves her
  inbox) · "What you care about / what loses you" · "Vocabulary you use and
  vocabulary that alienates you" · "How to react" (react line by line in reading
  order, in character, first person, never edit, never summarize).
- [ ] **Step 3: Voice check**: grep the four files for the em dash character
  (pattern `\u2014`), `HOMA`, "behind", sibling comparisons. Expected: no matches.
- [ ] **Step 4: Commit**

```bash
git add marketing/personas && git commit -m "Marketing engine: four reader personas for the reviewer gate"
```

### Task 3: voice/house-style.md

**Files:**
- Create: `marketing/voice/house-style.md`
- Read first: `docs/homa-design/SKILL.md`, `docs/homa-design/guidelines/` (voice
  files), repo `AGENTS.md` § Code style & voice

- [ ] **Step 1: Write `house-style.md`** with sections: "Voice principles" (from
  design guidelines: warm, plain, reassure-before-inform, offers never commands);
  "Hard bans" (em dash; "HOMA" in prose; "behind"/"falling behind"; sibling
  comparisons; fabricated numbers/social proof; unsubstantiated claims like
  percentiles, per build-log C2 precedent); "Anti-slop banlist" (a starter list
  of 25+ phrases: "unlock", "unleash", "game-changer", "revolutionize",
  "in today's fast-paced world", "look no further", "dive in", "elevate",
  "empower" as verb of product, "seamless", "effortless", "supercharge",
  "next-level", "say goodbye to", "the best part?", "but here's the thing",
  "little did I know", "moms everywhere are", "doctors hate", "secret weapon",
  "hack" as noun, "must-have", "obsessed", "literally obsessed", "run don't
  walk", "you NEED this", plus emoji-spam rule: max 1 emoji per caption, none in
  articles or email body); "Format rules" (article 800 to 1400 words, one idea;
  video hook must land inside 2 seconds; captions within platform limits: TikTok
  2200, Instagram 2200, YouTube title 100 + description 5000, X 280; pin title
  100, pin description 500; email subject under 50 chars, one CTA per format,
  every CTA points to thankshoma.com or /waitlist); "The rule about this file"
  (the editor gate enforces this doc; the scorer asserts the banlist
  mechanically; every slip that reaches staging becomes a new banlist line).
- [ ] **Step 2: Commit**

```bash
git add marketing/voice && git commit -m "Marketing engine: house style, banlist, format rules"
```

### Task 4: routines (shipped disabled)

**Files:**
- Create: `marketing/routines/SPEC.md`, `marketing/routines/nightly-content.md`,
  `marketing/routines/weekly-engagement.md`, `marketing/routines/runner.md`

- [ ] **Step 1: Write `SPEC.md`**: a routine file = frontmatter
  (`name, schedule, enabled: false, skill, access`) + "Prompt" section holding
  the literal prompt an agent runs. Rule restated: enabling a routine is a
  deliberate human act; routines may stage and commit, never publish.
- [ ] **Step 2: Write `nightly-content.md`**: schedule `daily 04:00
  America/New_York`, `enabled: false`, skill `marketing-demand-engine`, access
  "repo + Higgsfield CLI". Prompt: read `marketing/AGENTS.md`, run
  `marketing-demand-engine` for one bundle, stage in `marketing/content/drafts/`,
  run the scorer, commit with message `Marketing: stage bundle <date>-<slug>`,
  stop, never publish.
- [ ] **Step 3: Write `weekly-engagement.md`**: schedule `Mondays 07:00
  America/New_York`, `enabled: false`, skill `marketing-engagement-loop`,
  access "Postiz CLI + Supabase MCP (aggregates only)".
- [ ] **Step 4: Write `runner.md`**: how to enable later: option A, tell the
  agent in chat to run a routine's prompt (today's mode); option B, launchd:
  a complete `com.homa.marketing.nightly.plist` example invoking the agent CLI
  with the routine prompt, plus `launchctl load` and `launchctl unload` lines,
  labeled "do not install until the founder flips DM4."
- [ ] **Step 5: Commit**

```bash
git add marketing/routines && git commit -m "Marketing engine: routines defined, shipped disabled (DM4)"
```

---

## Milestone 2: the twelve skills

Every SKILL.md: frontmatter `name` + `description` where the description states
what it does, when to use it, and what it does NOT do (naming the sibling that
does). Body ends with a "Laws" section repeating: never auto-publish; no source,
no claim; no family data; voice per `marketing/voice/house-style.md`. Keep each
under 150 lines.

### Task 5: marketing-signal-extraction + marketing-idea-generator

**Files:**
- Create: `.agents/skills/marketing-signal-extraction/SKILL.md`
- Create: `.agents/skills/marketing-idea-generator/SKILL.md`

- [ ] **Step 1: Write `marketing-signal-extraction`.** Input: one file in
  `marketing/raw/`. Procedure: read it; anonymize (strip real names of moms/kids
  to roles: "a mom of three at the conference"); split into atomic ideas; for
  each, write `marketing/signals/<yyyy-mm-dd>-<kebab-hook>.md` with the spec §5
  frontmatter (id, type, hook, formats, source{type, ref, locator}, status: new,
  used_by: null) and 2 to 5 body lines of context; `locator` is a verbatim quote
  or line range, never a paraphrase; skip ideas already in `signals/` (check
  hooks). NOT: inventing ideas with no raw source (idea-generator), drafting
  (demand-engine).
- [ ] **Step 2: Write `marketing-idea-generator`.** Use when the reservoir has
  fewer than 5 `status: new` signals. Sources allowed: `docs/homa-planning/`
  positioning/personas/journeys docs and files in `marketing/raw/` (keyword
  research). Same signal format; `source.ref` cites the planning doc + line
  range. Banned sources restated. NOT: extraction of new raw files
  (signal-extraction), drafting (demand-engine).
- [ ] **Step 3: Commit**

```bash
git add .agents/skills/marketing-signal-extraction .agents/skills/marketing-idea-generator
git commit -m "Marketing engine: signal extraction + idea generator skills"
```

### Task 6: marketing-copy-reviewer + marketing-copy-editor (the gates)

**Files:**
- Create: `.agents/skills/marketing-copy-reviewer/SKILL.md`
- Create: `.agents/skills/marketing-copy-editor/SKILL.md`

- [ ] **Step 1: Write `marketing-copy-reviewer`.** Invoked BY the orchestrator as
  a fresh-context, read-only subagent (in Cursor: Task tool, `readonly: true`,
  subagent_type generalPurpose). The dispatch prompt must contain, pasted
  verbatim: the persona file + the draft. The reviewer role-plays the persona,
  reacts line by line in reading order, in character, first person ("I'm
  skimming", "this word means nothing to me", "I'd stop scrolling here"),
  flags where attention dies, returns reactions ONLY, no edits, no rewrites,
  no summary verdict. Main agent then rewrites from accepted notes. Order law
  restated: reader gate always runs before editor gate, because editing craft
  first hides comprehension problems. NOT: style enforcement (copy-editor).
- [ ] **Step 2: Write `marketing-copy-editor`.** Second fresh-context read-only
  subagent. Dispatch prompt: `marketing/voice/house-style.md` pasted verbatim +
  the post-reviewer draft. Returns structured notes (line ref, problem, which
  rule), no rewrites. NOT: defining voice (house-style.md is the source), reader
  comprehension (copy-reviewer).
- [ ] **Step 3: Commit**

```bash
git add .agents/skills/marketing-copy-reviewer .agents/skills/marketing-copy-editor
git commit -m "Marketing engine: reader and editor gate skills, read-only by law"
```

### Task 7: marketing-article-writer + marketing-email-writer

**Files:**
- Create: `.agents/skills/marketing-article-writer/SKILL.md`
- Create: `.agents/skills/marketing-email-writer/SKILL.md`

- [ ] **Step 1: Write `marketing-article-writer`.** One SEO pillar from one
  signal: search-intent first (title answers what she typed), 800 to 1400 words,
  one idea deep, headers she can skim, claims trace to the signal's source, ends
  with the waitlist CTA. Must emit the exact frontmatter contract the blog
  consumes (spec §9): `title`, `description` (under 160 chars), `date`
  (yyyy-mm-dd), `tags` (array), `hero` (`/blog/<slug>/hero.png`), optional
  `ogImage`. File goes to the bundle as `article.mdx`. NOT: choosing the signal
  (demand-engine), social/email derivatives (demand-engine orchestrates those).
- [ ] **Step 2: Write `marketing-email-writer`.** One nurture email derived from
  the GATED article, never written independently: subject under 50 chars,
  preview line, body under 200 words, one CTA, plain warm tone. Output
  `email/email.md` with `subject:`, `preview:`, body. DM7 law restated: staged,
  never sent, until the founder rules consent scope. NOT: sending (distributor).
- [ ] **Step 3: Commit**

```bash
git add .agents/skills/marketing-article-writer .agents/skills/marketing-email-writer
git commit -m "Marketing engine: article and email writer skills"
```

### Task 8: marketing-video-producer + marketing-illustrator

**Files:**
- Create: `.agents/skills/marketing-video-producer/SKILL.md`
- Create: `.agents/skills/marketing-illustrator/SKILL.md`

- [ ] **Step 1: Write `marketing-video-producer`.** Two phases. Script phase:
  `video/script.md` with hook (must land inside 2 seconds, spoken or on-screen
  text), 3 to 5 beats, CTA, shot plan per beat; script is a pillar, it gets the
  full two-gate treatment before any generation spend. Generation phase (only
  after gates): chain to the installed `higgsfield-generate` skill; 9:16, target
  20 to 40 seconds; save `video/video.mp4` + `video/thumbnail.png` into the
  bundle; log the model + prompt used at the bottom of script.md for
  reproducibility. NOT: topic choice (demand-engine), captions (demand-engine
  derives), still images (illustrator).
- [ ] **Step 2: Write `marketing-illustrator`.** Blog hero (`images/hero.png`,
  16:9) and pin image (`pin/pin.png`, 2:3, 1000x1500) via `higgsfield-generate`
  image models, prompts constrained to the design system: warm stone/clay/sage
  palette (name the hexes from `docs/homa-design/tokens/`), no text baked into
  images except the pin (pins need a text overlay to perform; overlay copy comes
  from gated pin.md), never fabricated screenshots of the product, no real
  children's faces. NOT: video (video-producer).
- [ ] **Step 3: Commit**

```bash
git add .agents/skills/marketing-video-producer .agents/skills/marketing-illustrator
git commit -m "Marketing engine: video producer and illustrator skills"
```

### Task 9: marketing-demand-engine (the orchestrator)

**Files:**
- Create: `.agents/skills/marketing-demand-engine/SKILL.md`

- [ ] **Step 1: Write the orchestrator.** The numbered procedure, exactly spec §5:
  (1) read `marketing/AGENTS.md`; (2) pick the single strongest `status: new`
  signal, dedup hook/topic against `content/drafts/`, `content/published/`,
  `apps/web/content/blog/` (if thin, run `marketing-idea-generator` first);
  (3) mark it `queued`; (4) draft article (article-writer) and script
  (video-producer script phase); (5) gate each: reviewer with the right persona,
  then editor, rewrite between gates, record both runs; (6) derive email
  (email-writer) and gate it (waitlist-subscriber persona + editor); (7) derive
  micro-copy: captions/{tiktok,instagram,youtube,facebook}.md, x.md, pin/pin.md,
  each from the gated pillars; gate as batch: one reviewer pass per persona
  batch (shortform-viewer for captions, pinner for pin, blog-reader for x.md),
  one editor pass over the whole set; (8) generate assets: video-producer
  generation phase, illustrator; (9) write `meta.yml` exactly per the spec §6
  template, all formats `status: draft`, gates section filled with dates;
  (10) run `python3 marketing/evals/score_bundle.py marketing/content/drafts/<dir>`
  and fix mechanical failures it reports; (11) set signal `status: used`,
  `used_by: <bundle id>`; (12) commit `Marketing: stage bundle <date>-<slug>`
  and STOP. The stop is the last line of the skill, bolded: staging is the
  terminal state; a human approves per format; never call the distributor.
- [ ] **Step 2: Commit**

```bash
git add .agents/skills/marketing-demand-engine
git commit -m "Marketing engine: demand-engine orchestrator skill"
```

### Task 10: marketing-distributor + marketing-engagement-loop + marketing-janitor

**Files:**
- Create: `.agents/skills/marketing-distributor/SKILL.md`
- Create: `.agents/skills/marketing-engagement-loop/SKILL.md`
- Create: `.agents/skills/marketing-janitor/SKILL.md`

- [ ] **Step 1: Write `marketing-distributor`.** Runs ONLY on explicit founder
  "publish <bundle> <formats>". Procedure: read `meta.yml`; refuse any format not
  `approved` (say which); per channel: blog = copy `article.mdx` to
  `apps/web/content/blog/<slug>.mdx` + `images/` to
  `apps/web/public/blog/<slug>/`, run `pnpm --filter web typecheck && pnpm
  --filter web build`, commit `Blog: publish <slug>`; social = Postiz per its
  skill (`postiz auth:status` first, `postiz upload` every media file, then
  `posts:create` per channel with platform settings); if auth or an integration
  is missing, STOP and print the exact missing HUMAN-TODO steps, publish nothing
  for that channel, never half-publish a format; email = blocked until DM7 is
  ruled, say so (mechanics per spec §10 once ruled). Then write
  `distribution.md` (format, URL, timestamp) into the bundle, move it to
  `content/published/`, update the signal, commit. NOT: approving (human, via
  meta.yml), drafting (demand-engine).
- [ ] **Step 2: Write `marketing-engagement-loop`.** Weekly: for each bundle in
  `content/published/` with social URLs, `postiz analytics:post` / `platform`;
  waitlist deltas via Supabase MCP as aggregate counts only; write
  `marketing/reports/<yyyy-mm-dd>-engagement.md` (folder born now) + one
  `type: engagement` signal per real resonance finding (source.ref = the report).
  Aggregates only, no PII ever. NOT: drafting from those signals (demand-engine).
- [ ] **Step 3: Write `marketing-janitor`.** Reservoir hygiene: `used` signals
  older than 60 days get `status: archived`; `new` older than 90 days flagged
  stale in its report; duplicate hooks flagged for founder deletion (never
  auto-delete); scorecard trend summary (pass rates over time). NOT: touching
  `content/drafts/` or `content/published/`.
- [ ] **Step 4: Commit**

```bash
git add .agents/skills/marketing-distributor .agents/skills/marketing-engagement-loop .agents/skills/marketing-janitor
git commit -m "Marketing engine: distributor, engagement loop, janitor skills"
```

---

## Milestone 3: the scorer (TDD)

### Task 11: score_bundle.py against fixtures

**Files:**
- Create: `marketing/evals/score_bundle.py`
- Create: `marketing/evals/fixtures/failing-bundle/` (meta.yml + article.mdx +
  email/email.md seeded with violations; no signal file so grounding fails)
- Create: `marketing/evals/fixtures/passing-bundle/` (complete minimal bundle +
  `marketing/evals/fixtures/signals/2026-01-01-fixture-signal.md` it cites)
- Create: `marketing/evals/scorecards/.gitkeep`

- [ ] **Step 1: Build the failing fixture first.** `failing-bundle/meta.yml`
  citing `marketing/signals/does-not-exist.md`; `article.mdx` containing one em
  dash, the phrase "game-changer", the word "HOMA" in prose, and a "falling
  behind" sentence; `email/email.md` with a 70-char subject; omit
  `captions/tiktok.md` that meta.yml lists. Expected failures: grounding,
  voice x4, completeness x2 (missing file, subject length).
- [ ] **Step 2: Write `score_bundle.py`** (stdlib only: argparse, pathlib, re,
  json, difflib). CLI: `python3 score_bundle.py <bundle-dir> [--signals-dir
  marketing/signals] [--scorecards-dir marketing/evals/scorecards]`. Checks per
  spec §14: (1) grounding: meta source exists, its frontmatter `source.ref`
  exists, no banned path substrings (`homa-macmini/`, `homa-research/`,
  `homa-template/`) anywhere in the bundle; (2) voice: em dash and en dash
  regex `[\u2014\u2013]`, banlist loaded by parsing the backtick-quoted phrases
  from `marketing/voice/house-style.md` "Anti-slop banlist" section, `\bHOMA\b`
  in prose files, `falling behind|is behind`, sibling-comparison patterns;
  (3) non-duplication: normalized title + `difflib.SequenceMatcher` body ratio
  > 0.7 against drafts/published/blog; (4) completeness: every meta.yml format
  file exists; caption/limit table from house-style; email subject < 50;
  `video/video.mp4` exists when lane `video` is in meta. Parse the needed
  meta.yml subset (flat keys + the `formats:` list of `{file, channel, status}`)
  with a small regex parser, no yaml dep. Output: scorecard JSON + md to the
  scorecards dir AND stdout; exit 1 if any check fails, 0 otherwise.
- [ ] **Step 3: Run on the failing fixture, verify every seeded violation is
  caught.**

Run: `python3 marketing/evals/score_bundle.py marketing/evals/fixtures/failing-bundle --signals-dir marketing/evals/fixtures/signals --scorecards-dir /tmp/scorecards`
Expected: exit 1; report lists grounding 1, voice 4+, completeness 2.

- [ ] **Step 4: Run on the passing fixture.**

Run: `python3 marketing/evals/score_bundle.py marketing/evals/fixtures/passing-bundle --signals-dir marketing/evals/fixtures/signals --scorecards-dir /tmp/scorecards`
Expected: exit 0, all checks pass.

- [ ] **Step 5: Commit**

```bash
git add marketing/evals && git commit -m "Marketing engine: deterministic scorer with fixture bundles"
```

---

## Milestone 4: the blog in apps/web

### Task 12: blog lib + routes + sitemap

**Files:**
- Create: `apps/web/lib/blog.ts`, `apps/web/app/blog/page.tsx`,
  `apps/web/app/blog/[slug]/page.tsx`, `apps/web/app/sitemap.ts`,
  `apps/web/content/blog/` (empty, `.gitkeep`)
- Modify: `apps/web/app/globals.css` (append `.blog-prose` rules, tokens only)
- Read first: `node_modules/next/dist/docs/01-app/02-guides/mdx.md` and
  `01-getting-started/14-metadata-and-og-images.md` (Next 16 has breaking
  changes; per `apps/web/AGENTS.md` read vendored docs before coding)

- [ ] **Step 1: Install deps**

```bash
pnpm --filter web add next-mdx-remote gray-matter
```

- [ ] **Step 2: Write `apps/web/lib/blog.ts`.** Zod-validated frontmatter,
  build-time failure on bad frontmatter is the point (the distributor's publish
  gate):

```ts
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

/** Frontmatter contract, spec 14 §9. marketing-article-writer emits this. */
const frontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1).max(160),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tags: z.array(z.string()).default([]),
  hero: z.string().optional(),
  ogImage: z.string().optional(),
});

export type BlogPost = z.infer<typeof frontmatterSchema> & {
  slug: string;
  body: string;
};

export function readBlogPost(slug: string): BlogPost {
  const raw = fs.readFileSync(path.join(BLOG_DIR, `${slug}.mdx`), "utf8");
  const { data, content } = matter(raw);
  return { ...frontmatterSchema.parse(data), slug, body: content };
}

export function listBlogPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => readBlogPost(f.replace(/\.mdx$/, "")))
    .sort((a, b) => b.date.localeCompare(a.date));
}
```

- [ ] **Step 3: Write `app/blog/page.tsx`** (server component). Reuse `Nav` and
  `Footer` from `components/marketing/`. Card list from `listBlogPosts()`:
  hero image (plain `img` with the post's hero path; skip if absent), date
  formatted `new Intl.DateTimeFormat("en-US", { dateStyle: "long" })`, title,
  description, all styled inline with semantic tokens (`--surface-card`,
  `--text-strong`, `--text-muted`, `--radius-*`, `--shadow-*`) matching the
  landing page's patterns. Empty state (no posts): a single centered card,
  "Notes from Homa are on their way." + link to `/waitlist`, no fabricated
  posts. Page metadata: title "Notes · Homa", description in Homa voice.
- [ ] **Step 4: Write `app/blog/[slug]/page.tsx`**:

```tsx
import { MDXRemote } from "next-mdx-remote/rsc";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listBlogPosts, readBlogPost } from "../../../lib/blog";
// + Nav, Footer imports

export const dynamicParams = false;

export function generateStaticParams() {
  return listBlogPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; // Next 16: params is a Promise
  const post = readBlogPost(slug);
  return {
    title: `${post.title} · Homa`,
    description: post.description,
    openGraph: { title: post.title, description: post.description,
      images: post.ogImage ?? post.hero ? [{ url: post.ogImage ?? post.hero! }] : undefined },
  };
}
```

  Body: hero img, h1, date line, `<div className="blog-prose"><MDXRemote source={post.body} /></div>`,
  JSON-LD `<script type="application/ld+json">` with `@type: Article` (headline,
  description, datePublished, image, publisher "Homa"), then a waitlist CTA
  block (link styled like the landing page's primary button tokens) and
  `Footer`. Wrap `readBlogPost` in try/notFound only for the metadata/page
  entry (missing slug = `notFound()`).
- [ ] **Step 5: Append `.blog-prose` styles to `globals.css`**: h2/h3 (display
  scale, `--text-strong`), p and li (`--text-body`, comfortable measure
  `max-width: 65ch`, line-height 1.7), blockquote (left border `--brand-soft-2`,
  `--text-muted`), a (`--brand`, underline), img (`--radius-lg`), all from
  existing tokens, no new values.
- [ ] **Step 6: Write `app/sitemap.ts`**:

```ts
import type { MetadataRoute } from "next";
import { listBlogPosts } from "../lib/blog";

const BASE = "https://thankshoma.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/waitlist", "/conference", "/blog"].map((p) => ({
    url: `${BASE}${p}`,
    lastModified: new Date(),
  }));
  const posts = listBlogPosts().map((p) => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: new Date(p.date),
  }));
  return [...staticRoutes, ...posts];
}
```

- [ ] **Step 7: Verify**

Run: `pnpm --filter web typecheck && pnpm --filter web build`
Expected: both pass with zero posts (empty-state index, no [slug] pages).

- [ ] **Step 8: Smoke test with a temp post**: drop a valid `hello.mdx` into
  `apps/web/content/blog/`, `pnpm --filter web dev`, check `/blog`,
  `/blog/hello`, `/sitemap.xml` render; delete the temp post.
- [ ] **Step 9: Commit**

```bash
git add apps/web && git commit -m "Blog: file-based MDX routes, SEO metadata, JSON-LD, sitemap (spec 14 s9)"
```

---

## Milestone 5: repo docs

### Task 13: README repo map

**Files:**
- Modify: `README.md` (repo map table)

- [ ] **Step 1: Add the row** after `supabase/`:
  `| marketing/ | Demand-gen engine state: signal reservoir, staged/published bundles, personas, voice, routines (spec: docs/homa-planning/14-marketing-demand-engine.md) |`
- [ ] **Step 2: Commit**

```bash
git add README.md && git commit -m "README: add marketing/ to the repo map"
```

---

## Milestone 6: first real run, end to end

### Task 14: seed the reservoir, stage bundle one, stop

- [ ] **Step 1: Seed raw.** Write `marketing/raw/2026-07-05-planning-doc-mining.md`:
  quoted excerpts (with doc + line refs) from journeys/07 positioning and
  journeys/01 personas worth turning into content. No family data.
- [ ] **Step 2: Run `marketing-signal-extraction`** on it; then
  `marketing-idea-generator` if fewer than 5 new signals. Expected: 5+ signal
  files, each with resolvable source.
- [ ] **Step 3: Run `marketing-demand-engine`** end to end per the skill: pick,
  draft, gate (real subagent dispatches), derive, gate, generate (real
  Higgsfield spend: one video, one hero, one pin), meta.yml, scorer green,
  commit. Expected: one complete bundle in `marketing/content/drafts/`.
- [ ] **Step 4: Verify laws held**: scorer exit 0; `git log` shows stage commit;
  nothing in `apps/web/content/blog/`; no Postiz calls made; email not sent.
- [ ] **Step 5: STOP and present the bundle** to the founder for per-format
  approval. On "publish article" (or more), run `marketing-distributor` for
  approved formats only; blog publish flips acceptance criterion 4 (article live
  at thankshoma.com/blog/<slug>).

---

## Self-review (run after writing, fixed inline)

Spec coverage: §4 scaffold Tasks 1-4 · §5-§8 pipeline Tasks 5-10, 14 · §9 blog
Task 12 · §10 email Task 7 + DM7 guards in Tasks 10, 14 · §11 distribution
Task 10 · §12 engagement Task 10 · §13 routines Task 4 · §14 scorer Task 11 ·
§15 laws in every file · §16 acceptance: 1→Tasks 1-4, 2→5-10, 3→14, 4→12+14,
5→10+14, 6→13 (README) + already-committed HUMAN-TODO/build-log · §17-§18
respected (no growth folders except reports/ born by first report; human deps
stay human).
