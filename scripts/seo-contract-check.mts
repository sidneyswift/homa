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
if (sitemapSource.includes("lastModified: new Date()")) {
  fail("sitemap: dynamic lastModified values are not allowed");
}

const robotsSource = read("apps/web/app/robots.ts");
for (const crawler of ["GPTBot", "OAI-SearchBot", "Google-Extended", "Claude-SearchBot", "PerplexityBot"]) {
  requireText(robotsSource, crawler, "robots");
}
requireText(robotsSource, 'disallow: "/api/"', "robots");
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

console.log(`SEO contract passed for ${pages.length} feature pages, sitemap, robots, AI summaries, and landing links.`);
