import type { MetadataRoute } from "next";
import { listBlogPosts } from "../lib/blog";

/**
 * Sitemap for thankshoma.com: static marketing routes + every published blog
 * article. /waitlist is deliberately absent (its page sets robots noindex).
 */

const BASE = "https://thankshoma.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = ["", "/conference", "/blog"].map(
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
