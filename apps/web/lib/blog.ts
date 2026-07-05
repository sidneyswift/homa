import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";

/**
 * File-based blog content (git is the CMS). Published articles are MDX files
 * in apps/web/content/blog/, copied there from a staged marketing bundle by
 * the marketing-distributor skill after per-format human approval. Spec:
 * docs/homa-planning/14-marketing-demand-engine.md §9.
 */

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

/**
 * The frontmatter contract marketing-article-writer emits. Violations fail
 * the production build on purpose: that failure is the publish gate.
 */
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

export function formatBlogDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
