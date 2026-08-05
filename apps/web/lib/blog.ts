import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";

import { BLOG_CLUSTER_SLUGS, type BlogClusterSlug } from "./blog-clusters";

/**
 * File-based blog content (git is the CMS). Published articles are MDX files
 * in apps/web/content/blog/, copied there from a staged marketing bundle by
 * the marketing-distributor skill after per-format human approval. Spec:
 * docs/homa-planning/14-marketing-demand-engine.md §9.
 */

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

export const BLOG_POSTS_PER_PAGE = 12;

const dateSchema = z
  .union([z.string(), z.date()])
  .transform((value) =>
    value instanceof Date ? value.toISOString().slice(0, 10) : value,
  )
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

/**
 * The frontmatter contract marketing-article-writer emits. Violations fail
 * the production build on purpose: that failure is the publish gate.
 */
const frontmatterSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1).max(160),
    // gray-matter's YAML parser turns an unquoted date into a Date object.
    date: dateSchema,
    updated: dateSchema.optional(),
    cluster: z.enum(BLOG_CLUSTER_SLUGS),
    tags: z.array(z.string()).default([]),
    related: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).default([]),
    hero: z.string().optional(),
    heroAlt: z.string().optional(),
    ogImage: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.hero && !value.heroAlt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["heroAlt"],
        message: "heroAlt is required when hero is present",
      });
    }
    if (value.updated && value.updated < value.date) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["updated"],
        message: "updated cannot be earlier than date",
      });
    }
  })
  .transform((value) => ({ ...value, updated: value.updated ?? value.date }));

export type BlogPost = z.infer<typeof frontmatterSchema> & {
  slug: string;
  body: string;
};

export function blogPostExists(slug: string): boolean {
  return fs.existsSync(path.join(BLOG_DIR, `${slug}.mdx`));
}

export function readBlogPost(slug: string): BlogPost {
  const raw = fs.readFileSync(path.join(BLOG_DIR, `${slug}.mdx`), "utf8");
  const { data, content } = matter(raw);
  return { ...frontmatterSchema.parse(data), slug, body: content };
}

export function listBlogPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => readBlogPost(file.replace(/\.mdx$/, "")))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function listBlogPostsByCluster(cluster: BlogClusterSlug): BlogPost[] {
  return listBlogPosts().filter((post) => post.cluster === cluster);
}

export function listPublishedBlogClusters(): BlogClusterSlug[] {
  return [...new Set(listBlogPosts().map((post) => post.cluster))];
}

export function getBlogPageCount(posts = listBlogPosts()): number {
  return Math.max(1, Math.ceil(posts.length / BLOG_POSTS_PER_PAGE));
}

export function getBlogPage(page: number, posts = listBlogPosts()): BlogPost[] {
  if (!Number.isInteger(page) || page < 1) return [];
  const start = (page - 1) * BLOG_POSTS_PER_PAGE;
  return posts.slice(start, start + BLOG_POSTS_PER_PAGE);
}

export function getRelatedBlogPosts(post: BlogPost, limit = 3): BlogPost[] {
  const posts = listBlogPosts();
  const bySlug = new Map(posts.map((candidate) => [candidate.slug, candidate]));
  const related: BlogPost[] = [];

  for (const slug of post.related) {
    const candidate = bySlug.get(slug);
    if (candidate && candidate.slug !== post.slug) related.push(candidate);
  }

  for (const candidate of posts) {
    if (
      related.length >= limit ||
      candidate.slug === post.slug ||
      candidate.cluster !== post.cluster ||
      related.some((item) => item.slug === candidate.slug)
    ) {
      continue;
    }
    related.push(candidate);
  }

  return related.slice(0, limit);
}

export function formatBlogDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
