import { listBlogPosts } from "../../../lib/blog";

/**
 * RSS 2.0 feed for the blog, snapshotted at build time like the blog pages
 * themselves (git is the CMS; a publish redeploys). Linked from the blog
 * pages via alternates.types so feed readers and crawlers can discover it.
 */

export const dynamic = "force-static";

const BASE = "https://thankshoma.com";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function GET() {
  const posts = listBlogPosts();

  const items = posts
    .map((post) => {
      const url = `${BASE}/blog/${post.slug}`;
      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <description>${escapeXml(post.description)}</description>`,
        `      <pubDate>${new Date(`${post.date}T00:00:00Z`).toUTCString()}</pubDate>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    "    <title>Notes from Homa</title>",
    `    <link>${BASE}/blog</link>`,
    '    <atom:link href="https://thankshoma.com/blog/rss.xml" rel="self" type="application/rss+xml"/>',
    "    <description>Notes from Homa: calm, practical writing for homeschool families, one idea at a time.</description>",
    "    <language>en-US</language>",
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
