import type { Metadata } from "next";
import Link from "next/link";

import { BlogIndexContent } from "../../components/marketing/BlogIndexContent";
import { Footer } from "../../components/marketing/Footer";
import { Nav } from "../../components/marketing/Nav";
import { HERO_COPY } from "../../components/marketing/landing-content";
import { getBlogPage, getBlogPageCount, listBlogPosts } from "../../lib/blog";
import { getBlogCluster } from "../../lib/blog-clusters";

/**
 * /blog: notes from Homa. Index of published articles (git is the CMS; files
 * land in content/blog/ via the marketing-distributor skill only). Empty
 * state ships honestly: no fabricated posts, ever.
 */

export const metadata: Metadata = {
  title: "Homeschool planning, records, and progress guides",
  description:
    "Practical homeschool guides for planning flexible weeks, keeping useful records, noticing progress, and making practice pages.",
  alternates: {
    canonical: "/blog",
    types: { "application/rss+xml": "/blog/rss.xml" },
  },
};

export default function BlogIndexPage() {
  const posts = listBlogPosts();
  const pageCount = getBlogPageCount(posts);
  const firstPage = getBlogPage(1, posts);
  const clusters = [...new Set(posts.map((post) => post.cluster))]
    .map((slug) => getBlogCluster(slug))
    .filter((cluster) => cluster !== undefined);

  const blogJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": "https://thankshoma.com/blog#blog",
    name: "Notes from Homa",
    url: "https://thankshoma.com/blog",
    description:
      "Notes from Homa: calm, practical writing for homeschool families, one idea at a time.",
    publisher: { "@type": "Organization", "@id": "https://thankshoma.com/#organization", name: "Homa" },
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      datePublished: post.date,
      dateModified: post.updated,
      articleSection: getBlogCluster(post.cluster)?.name,
      url: `https://thankshoma.com/blog/${post.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogJsonLd).replace(/</g, "\\u003c") }}
      />
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <header>
          <h1 className="font-display text-3xl font-semibold leading-tight text-strong">
            Notes from Homa
          </h1>
          <p className="mt-3 text-body">
            Practical help for planning the week, keeping the record, noticing progress,
            and choosing what to try next.
          </p>
        </header>

        {clusters.length > 0 ? (
          <nav className="mt-8" aria-label="Blog topics">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">Browse by topic</p>
            <ul className="mt-3 flex flex-wrap gap-3">
              {clusters.map((cluster) => (
                <li key={cluster.slug}>
                  <Link
                    href={`/blog/topics/${cluster.slug}`}
                    className="inline-flex rounded-pill bg-brand-soft px-4 py-2 font-semibold text-brand transition-colors duration-(--dur-base) ease-out hover:bg-brand-soft-2"
                  >
                    {cluster.shortName}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {posts.length === 0 ? (
          <div
            className="mt-10 rounded-lg bg-card p-8 text-center shadow-sm"
            style={{ border: "1px solid var(--border-subtle)" }}
          >
            <p className="font-display text-xl font-semibold text-strong">
              Notes are on their way
            </p>
            <p className="mt-2 text-body">
              We&rsquo;re writing. {HERO_COPY.primaryActionNote}
            </p>
            <Link
              href="/onboarding"
              className="mt-5 inline-block rounded-pill bg-brand px-6 py-3 font-semibold text-on-brand transition-colors duration-(--dur-base) ease-out hover:bg-brand-hover"
            >
              {HERO_COPY.primaryAction}
            </Link>
          </div>
        ) : (
          <BlogIndexContent posts={firstPage} page={1} pageCount={pageCount} />
        )}
      </main>
      <Footer />
    </>
  );
}
