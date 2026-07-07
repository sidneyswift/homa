import type { MetadataRoute } from "next";
import { listBlogPosts } from "../lib/blog";

/**
 * Sitemap for thankshoma.com: static marketing routes + every published blog
 * article. Report pages (/onboarding/r/*) are deliberately absent and noindex.
 */

const BASE = "https://thankshoma.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = ["", "/onboarding", "/onboarding/sample", "/onboarding/method", "/privacy", "/terms", "/blog"].map(
    (route) => ({
      url: `${BASE}${route}`,
      lastModified: new Date(),
    }),
  );

  const posts: MetadataRoute.Sitemap = listBlogPosts().map((post) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: new Date(`${post.date}T00:00:00Z`),
  }));

  return [...staticRoutes, ...posts];
}
