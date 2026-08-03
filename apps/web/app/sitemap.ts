import type { MetadataRoute } from "next";
import { listBlogPosts } from "../lib/blog";
import { FEATURE_PAGE_SLUGS } from "../lib/feature-pages";

/**
 * Sitemap for thankshoma.com: static marketing routes + every published blog
 * article. Report pages (/onboarding/r/*) are deliberately absent and noindex.
 */

const BASE = "https://thankshoma.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = ["", "/onboarding", "/onboarding/sample", "/onboarding/method", "/privacy", "/terms", "/blog"].map(
    (route) => ({
      url: `${BASE}${route}`,
    }),
  );

  const featureRoutes: MetadataRoute.Sitemap = FEATURE_PAGE_SLUGS.map((slug) => ({
    url: `${BASE}/features/${slug}`,
  }));

  const posts: MetadataRoute.Sitemap = listBlogPosts().map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: new Date(`${post.date}T00:00:00Z`),
  }));

  return [...staticRoutes, ...featureRoutes, ...posts];
}
