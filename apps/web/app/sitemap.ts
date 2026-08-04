import type { MetadataRoute } from "next";
import { getBlogPageCount, listBlogPosts, listPublishedBlogClusters } from "../lib/blog";
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
    lastModified: new Date(`${post.updated}T00:00:00Z`),
  }));

  const topicRoutes: MetadataRoute.Sitemap = listPublishedBlogClusters().map((cluster) => ({
    url: `${BASE}/blog/topics/${cluster}`,
  }));

  const pageCount = getBlogPageCount();
  const paginationRoutes: MetadataRoute.Sitemap = Array.from(
    { length: Math.max(0, pageCount - 1) },
    (_, index) => ({ url: `${BASE}/blog/page/${index + 2}` }),
  );

  return [...staticRoutes, ...featureRoutes, ...topicRoutes, ...paginationRoutes, ...posts];
}
