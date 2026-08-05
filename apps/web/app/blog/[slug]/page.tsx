import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

import { BlogCard } from "../../../components/marketing/BlogCard";
import { Footer } from "../../../components/marketing/Footer";
import { Nav } from "../../../components/marketing/Nav";
import { HERO_COPY } from "../../../components/marketing/landing-content";
import {
  blogPostExists,
  getRelatedBlogPosts,
  listBlogPosts,
  readBlogPost,
} from "../../../lib/blog";
import { getBlogCluster } from "../../../lib/blog-clusters";

/**
 * /blog/[slug]: one published article, statically generated. Slugs come only
 * from files in content/blog/ (dynamicParams=false: anything else 404s).
 * SEO: metadata + OG from frontmatter, JSON-LD Article, sitemap entry via
 * app/sitemap.ts. The renderer owns the one /onboarding CTA so trial language
 * cannot drift across article MDX files.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return listBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!blogPostExists(slug)) return {};
  const post = readBlogPost(slug);
  const image = post.ogImage ?? post.hero;
  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: `/blog/${post.slug}`,
      types: { "application/rss+xml": "/blog/rss.xml" },
    },
    openGraph: {
      type: "article",
      siteName: "Homa",
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      publishedTime: `${post.date}T00:00:00.000Z`,
      modifiedTime: `${post.updated}T00:00:00.000Z`,
      section: getBlogCluster(post.cluster)?.name,
      images: image ? [{ url: image, alt: post.heroAlt }] : undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!blogPostExists(slug)) notFound();
  const post = readBlogPost(slug);
  const cluster = getBlogCluster(post.cluster);
  const relatedPosts = getRelatedBlogPosts(post);
  const pageUrl = `https://thankshoma.com/blog/${post.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${pageUrl}#article`,
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated,
    image: post.ogImage ?? post.hero,
    articleSection: cluster?.name,
    mainEntityOfPage: pageUrl,
    isPartOf: { "@id": "https://thankshoma.com/blog#blog" },
    // @id ties into the Organization node in the root layout's site-wide
    // graph; name stays inline for validators that don't resolve across
    // script blocks.
    author: { "@type": "Organization", "@id": "https://thankshoma.com/#organization", name: "Homa" },
    publisher: { "@type": "Organization", "@id": "https://thankshoma.com/#organization", name: "Homa" },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://thankshoma.com" },
      { "@type": "ListItem", position: 2, name: "Notes", item: "https://thankshoma.com/blog" },
      ...(cluster
        ? [{
            "@type": "ListItem",
            position: 3,
            name: cluster.name,
            item: `https://thankshoma.com/blog/topics/${cluster.slug}`,
          }]
        : []),
      {
        "@type": "ListItem",
        position: cluster ? 4 : 3,
        name: post.title,
        item: pageUrl,
      },
    ],
  };

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
        />
        <article>
          <header>
            <nav className="text-sm text-muted" aria-label="Breadcrumb">
              <Link className="underline underline-offset-4" href="/blog">Notes</Link>
              {cluster ? (
                <>
                  <span aria-hidden="true"> / </span>
                  <Link className="underline underline-offset-4" href={`/blog/topics/${cluster.slug}`}>
                    {cluster.shortName}
                  </Link>
                </>
              ) : null}
            </nav>
            <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-strong">
              {post.title}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-body">{post.description}</p>
            <p className="mt-4 text-sm text-muted">By Homa</p>
            {post.hero ? (
              <Image
                src={post.hero}
                alt={post.heroAlt ?? ""}
                width={1200}
                height={675}
                priority
                className="mt-8 h-auto w-full rounded-lg"
              />
            ) : null}
          </header>
          <div className="blog-prose mt-8">
            <MDXRemote source={post.body} options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }} />
          </div>
        </article>

        {relatedPosts.length > 0 ? (
          <aside className="mt-14" aria-labelledby="related-notes-heading">
            <h2 id="related-notes-heading" className="font-display text-2xl font-semibold text-strong">
              Keep going
            </h2>
            <ul className="mt-6 grid gap-6">
              {relatedPosts.map((relatedPost) => (
                <BlogCard key={relatedPost.slug} post={relatedPost} />
              ))}
            </ul>
          </aside>
        ) : null}

        <aside
          className="mt-14 rounded-lg bg-brand-soft p-8 text-center"
          style={{ border: "1px solid var(--border-brand)" }}
        >
          <p className="font-display text-xl font-semibold text-strong">
            Homa can take the prep from here.
          </p>
          <p className="mt-2 text-body">
            {HERO_COPY.primaryActionNote}
          </p>
          <Link
            href="/onboarding"
            className="mt-5 inline-block rounded-pill bg-brand px-6 py-3 font-semibold text-on-brand transition-colors duration-(--dur-base) ease-out hover:bg-brand-hover"
          >
            {HERO_COPY.primaryAction}
          </Link>
        </aside>
      </main>
      <Footer />
    </>
  );
}
