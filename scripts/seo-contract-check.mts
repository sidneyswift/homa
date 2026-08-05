import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function fail(message: string): never {
  throw new Error(message);
}

function requireText(source: string, needle: string, context: string): void {
  if (!source.includes(needle)) fail(`${context}: missing ${needle}`);
}

function countText(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

function frontmatter(source: string, context: string): string {
  const parts = source.split("---", 3);
  if (parts.length !== 3) fail(`${context}: missing YAML frontmatter`);
  return parts[1];
}

function scalarField(source: string, field: string): string | undefined {
  const match = source.match(new RegExp(`^${field}:\\s*(.+?)\\s*$`, "m"));
  if (!match) return undefined;
  return match[1].replace(/^['"]|['"]$/g, "");
}

function inlineListField(source: string, field: string): string[] {
  const value = scalarField(source, field);
  if (!value?.startsWith("[") || !value.endsWith("]")) return [];
  return value
    .slice(1, -1)
    .split(",")
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

const featureModule = await import(
  pathToFileURL(path.join(ROOT, "apps/web/lib/feature-pages.ts")).href,
);
const pages = featureModule.FEATURE_PAGES as ReadonlyArray<{
  slug: string;
  path: string;
  metadataTitle: string;
  metadataDescription: string;
  related: readonly string[];
}>;

const clusterModule = await import(
  pathToFileURL(path.join(ROOT, "apps/web/lib/blog-clusters.ts")).href,
);
const clusters = clusterModule.BLOG_CLUSTERS as ReadonlyArray<{
  slug: string;
  featurePath: string;
}>;
const clusterSlugs = clusters.map((cluster) => cluster.slug);

if (!pages.length) fail("feature pages: no canonical pages found");

const slugs = pages.map((page) => page.slug);
if (new Set(slugs).size !== slugs.length) fail("feature pages: duplicate slug");

for (const page of pages) {
  if (page.path !== `/features/${page.slug}`) {
    fail(`feature pages: ${page.slug} has a non-canonical path ${page.path}`);
  }
  if (!page.metadataTitle || page.metadataTitle.length > 70) {
    fail(`feature pages: ${page.slug} title must be non-empty and <= 70 characters`);
  }
  if (page.metadataTitle.includes("| Homa")) {
    fail(`feature pages: ${page.slug} duplicates the site title template brand`);
  }
  if (!page.metadataDescription || page.metadataDescription.length > 160) {
    fail(`feature pages: ${page.slug} description must be non-empty and <= 160 characters`);
  }
  for (const relatedSlug of page.related) {
    if (!slugs.includes(relatedSlug)) {
      fail(`feature pages: ${page.slug} links to unknown related slug ${relatedSlug}`);
    }
  }
}

const featureRouteSource = read("apps/web/app/features/[slug]/page.tsx");
for (const required of [
  "generateStaticParams",
  "canonical: page.path",
  '"@type": "WebPage"',
  '"@type": "BreadcrumbList"',
  "openGraph",
  "page.answer",
  "page.steps",
]) {
  requireText(featureRouteSource, required, "feature route");
}

const sitemapSource = read("apps/web/app/sitemap.ts");
requireText(sitemapSource, "FEATURE_PAGE_SLUGS", "sitemap");
requireText(sitemapSource, "listPublishedBlogClusters", "sitemap");
requireText(sitemapSource, "getBlogPageCount", "sitemap");
if (sitemapSource.includes("lastModified: new Date()")) {
  fail("sitemap: dynamic lastModified values are not allowed");
}

const robotsSource = read("apps/web/app/robots.ts");
for (const crawler of ["GPTBot", "OAI-SearchBot", "Google-Extended", "Claude-SearchBot", "PerplexityBot"]) {
  requireText(robotsSource, crawler, "robots");
}
requireText(robotsSource, 'disallow: "/api/"', "robots");
requireText(
  robotsSource,
  '{ userAgent: AI_CRAWLERS, allow: "/", disallow: "/api/" }',
  "robots named-crawler API exclusion",
);
requireText(robotsSource, "sitemap", "robots");

for (const relativePath of [
  "apps/web/public/ai.txt",
  "apps/web/public/llms.txt",
  "apps/web/public/llms-full.txt",
]) {
  const llms = read(relativePath);
  for (const page of pages) {
    const canonicalUrl = `https://thankshoma.com${page.path}`;
    if (countText(llms, canonicalUrl) === 0) {
      fail(`${relativePath}: missing ${canonicalUrl}`);
    }
  }
}

const blogDir = path.join(ROOT, "apps/web/content/blog");
const blogFiles = fs
  .readdirSync(blogDir)
  .filter((file) => file.endsWith(".mdx"))
  .sort();
const blogSlugs = blogFiles.map((file) => file.replace(/\.mdx$/, ""));
const publishedClusters = new Set<string>();

for (const file of blogFiles) {
  const slug = file.replace(/\.mdx$/, "");
  const relativePath = `apps/web/content/blog/${file}`;
  const source = read(relativePath);
  const meta = frontmatter(source, relativePath);
  const title = scalarField(meta, "title");
  const description = scalarField(meta, "description");
  const date = scalarField(meta, "date");
  const updated = scalarField(meta, "updated");
  const cluster = scalarField(meta, "cluster");
  const hero = scalarField(meta, "hero");
  const heroAlt = scalarField(meta, "heroAlt");

  if (!title || title.length > 75) fail(`${relativePath}: title must be non-empty and <= 75 characters`);
  if (!description || description.length > 160) {
    fail(`${relativePath}: description must be non-empty and <= 160 characters`);
  }
  if (!date?.match(/^\d{4}-\d{2}-\d{2}$/) || !updated?.match(/^\d{4}-\d{2}-\d{2}$/)) {
    fail(`${relativePath}: date and updated must use yyyy-mm-dd`);
  }
  if (updated! < date!) fail(`${relativePath}: updated cannot be earlier than date`);
  if (!cluster || !clusterSlugs.includes(cluster)) fail(`${relativePath}: unknown cluster ${cluster}`);
  publishedClusters.add(cluster!);
  if (hero && !heroAlt) fail(`${relativePath}: heroAlt is required when hero is present`);
  if (!source.includes("](/features/")) fail(`${relativePath}: missing feature-page link`);
  if (source.includes("](/onboarding)")) fail(`${relativePath}: MDX duplicates the shared renderer CTA`);

  for (const relatedSlug of inlineListField(meta, "related")) {
    if (!blogSlugs.includes(relatedSlug)) {
      fail(`${relativePath}: related article is not published: ${relatedSlug}`);
    }
  }
  for (const match of source.matchAll(/\]\(\/blog\/([a-z0-9-]+)\)/g)) {
    if (!blogSlugs.includes(match[1])) {
      fail(`${relativePath}: body links to unpublished article ${match[1]}`);
    }
  }
}

const blogRouteSource = read("apps/web/app/blog/[slug]/page.tsx");
for (const required of [
  '"@type": "BlogPosting"',
  "dateModified: post.updated",
  "articleSection",
  'aria-label="Breadcrumb"',
  "getRelatedBlogPosts",
  "post.heroAlt",
  "HERO_COPY.primaryAction",
  "HERO_COPY.primaryActionNote",
]) {
  requireText(blogRouteSource, required, "blog article route");
}
if (blogRouteSource.includes("formatBlogDate") || blogRouteSource.includes("Published {")) {
  fail("blog article route: publication dates must stay out of visible copy");
}
requireText(blogRouteSource, ">By Homa<", "blog article byline");

const blogCardSource = read("apps/web/components/marketing/BlogCard.tsx");
if (blogCardSource.includes("formatBlogDate") || blogCardSource.includes("post.date")) {
  fail("blog card: publication dates must stay out of visible copy");
}

const topicRouteSource = read("apps/web/app/blog/topics/[cluster]/page.tsx");
for (const required of ['"@type": "CollectionPage"', '"@type": "ItemList"', '"@type": "BreadcrumbList"']) {
  requireText(topicRouteSource, required, "blog topic route");
}
requireText(read("apps/web/app/blog/page/[page]/page.tsx"), "BlogIndexContent", "blog pagination route");

const topicGraph = JSON.parse(read("marketing/seo/topic-graph.json")) as {
  topics: Array<{
    id: string;
    query: string;
    cluster: string;
    owner: string;
    pageType: string;
    status: string;
    featureOwner: string;
  }>;
};
if (!topicGraph.topics.length) fail("topic graph: no topics");

for (const field of ["id", "query", "owner"] as const) {
  const values = topicGraph.topics.map((topic) => topic[field]);
  if (new Set(values).size !== values.length) fail(`topic graph: duplicate ${field}`);
}

const validStatuses = ["live", "staged", "brief", "research-required"];
const draftDirectories = fs
  .readdirSync(path.join(ROOT, "marketing/content/drafts"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

for (const topic of topicGraph.topics) {
  if (!clusterSlugs.includes(topic.cluster)) fail(`topic graph ${topic.id}: unknown cluster ${topic.cluster}`);
  if (!validStatuses.includes(topic.status)) fail(`topic graph ${topic.id}: unknown status ${topic.status}`);
  if (!slugs.some((slug) => topic.featureOwner === `/features/${slug}`)) {
    fail(`topic graph ${topic.id}: unknown feature owner ${topic.featureOwner}`);
  }
  if (topic.status === "live" && topic.pageType === "article") {
    const slug = topic.owner.replace(/^\/blog\//, "");
    if (!blogSlugs.includes(slug)) fail(`topic graph ${topic.id}: live article is missing ${topic.owner}`);
  }
  if (topic.status === "staged") {
    const slug = topic.owner.replace(/^\/blog\//, "");
    const draft = draftDirectories.find((directory) => directory.endsWith(`-${slug}`));
    if (!draft || !fs.existsSync(path.join(ROOT, "marketing/content/drafts", draft, "article.mdx"))) {
      fail(`topic graph ${topic.id}: staged article is missing ${topic.owner}`);
    }
  }
}

for (const slug of blogSlugs) {
  const owner = `/blog/${slug}`;
  if (!topicGraph.topics.some((topic) => topic.owner === owner && topic.status === "live")) {
    fail(`topic graph: published article has no live owner ${owner}`);
  }
}

for (const relativePath of ["apps/web/public/llms.txt", "apps/web/public/llms-full.txt"]) {
  const llms = read(relativePath);
  for (const slug of blogSlugs) {
    requireText(llms, `https://thankshoma.com/blog/${slug}`, relativePath);
  }
  for (const cluster of publishedClusters) {
    requireText(llms, `https://thankshoma.com/blog/topics/${cluster}`, relativePath);
  }
}

const landingSource = [
  read("apps/web/components/marketing/landing-content.ts"),
  read("apps/web/components/marketing/QuietLanding.tsx"),
  read("apps/web/components/design/QuietFooter.tsx"),
].join("\n");
for (const page of pages) {
  requireText(landingSource, `"${page.path}"`, "landing feature links");
}

const landingPageSource = read("apps/web/app/page.tsx");
if (landingPageSource.includes('"last-modified"')) {
  fail("landing metadata: synthetic last-modified must not be emitted");
}

console.log(
  `SEO contract passed for ${pages.length} feature pages, ${blogFiles.length} published articles, ` +
    `${topicGraph.topics.length} canonical topics, sitemap, robots, AI summaries, and internal discovery.`,
);
