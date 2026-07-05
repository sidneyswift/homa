import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";

import { Footer } from "../../../components/marketing/Footer";
import { Nav } from "../../../components/marketing/Nav";
import { blogPostExists, formatBlogDate, listBlogPosts, readBlogPost } from "../../../lib/blog";

/**
 * /blog/[slug]: one published article, statically generated. Slugs come only
 * from files in content/blog/ (dynamicParams=false: anything else 404s).
 * SEO: metadata + OG from frontmatter, JSON-LD Article, sitemap entry via
 * app/sitemap.ts. Every article ends in the waitlist CTA.
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
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      images: image ? [{ url: image }] : undefined,
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    image: post.ogImage ?? post.hero,
    author: { "@type": "Organization", name: "Homa" },
    publisher: { "@type": "Organization", name: "Homa" },
  };

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <article>
          <header>
            <p className="text-sm text-muted">{formatBlogDate(post.date)}</p>
            <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-strong">
              {post.title}
            </h1>
            {post.hero ? (
              <Image
                src={post.hero}
                alt=""
                width={1200}
                height={675}
                priority
                className="mt-8 h-auto w-full rounded-lg"
              />
            ) : null}
          </header>
          <div className="blog-prose mt-8">
            <MDXRemote source={post.body} />
          </div>
        </article>

        <aside
          className="mt-14 rounded-lg bg-brand-soft p-8 text-center"
          style={{ border: "1px solid var(--border-brand)" }}
        >
          <p className="font-display text-xl font-semibold text-strong">
            You&rsquo;ve got this. Homa&rsquo;s got the rest.
          </p>
          <p className="mt-2 text-body">
            We invite families a few at a time. Want your invite?
          </p>
          <Link
            href="/waitlist"
            className="mt-5 inline-block rounded-pill bg-brand px-6 py-3 font-semibold text-on-brand transition-colors duration-(--dur-base) ease-out hover:bg-brand-hover"
          >
            Join the waitlist
          </Link>
        </aside>
      </main>
      <Footer />
    </>
  );
}
