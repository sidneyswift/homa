import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogCard } from "../../../../components/marketing/BlogCard";
import { Footer } from "../../../../components/marketing/Footer";
import { Nav } from "../../../../components/marketing/Nav";
import { listBlogPostsByCluster, listPublishedBlogClusters } from "../../../../lib/blog";
import { getBlogCluster } from "../../../../lib/blog-clusters";

export const dynamicParams = false;

export function generateStaticParams() {
  return listPublishedBlogClusters().map((cluster) => ({ cluster }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cluster: string }>;
}): Promise<Metadata> {
  const { cluster: slug } = await params;
  const cluster = getBlogCluster(slug);
  if (!cluster || !listPublishedBlogClusters().includes(cluster.slug)) return {};

  return {
    title: `${cluster.name} guides`,
    description: cluster.description,
    alternates: { canonical: `/blog/topics/${cluster.slug}` },
    openGraph: {
      type: "website",
      title: `${cluster.name} guides`,
      description: cluster.description,
      url: `/blog/topics/${cluster.slug}`,
    },
  };
}

export default async function BlogTopicPage({
  params,
}: {
  params: Promise<{ cluster: string }>;
}) {
  const { cluster: slug } = await params;
  const cluster = getBlogCluster(slug);
  if (!cluster || !listPublishedBlogClusters().includes(cluster.slug)) notFound();

  const posts = listBlogPostsByCluster(cluster.slug);
  const pageUrl = `https://thankshoma.com/blog/topics/${cluster.slug}`;
  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${cluster.name} guides`,
    description: cluster.description,
    url: pageUrl,
    isPartOf: { "@id": "https://thankshoma.com/blog#blog" },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: posts.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: post.title,
        url: `https://thankshoma.com/blog/${post.slug}`,
      })),
    },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://thankshoma.com" },
      { "@type": "ListItem", position: 2, name: "Notes", item: "https://thankshoma.com/blog" },
      { "@type": "ListItem", position: 3, name: cluster.name, item: pageUrl },
    ],
  };

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd).replace(/</g, "\\u003c") }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
        />

        <nav className="text-sm text-muted" aria-label="Breadcrumb">
          <Link className="underline underline-offset-4" href="/blog">Notes</Link>
          <span aria-hidden="true"> / </span>
          <span>{cluster.shortName}</span>
        </nav>

        <header className="mt-6">
          <h1 className="font-display text-3xl font-semibold leading-tight text-strong">
            {cluster.name} guides
          </h1>
          <p className="mt-3 max-w-2xl text-body">{cluster.description}</p>
          <Link
            href={cluster.featurePath}
            className="mt-5 inline-flex font-semibold text-brand underline underline-offset-4"
          >
            See how Homa helps with {cluster.shortName.toLowerCase()}
          </Link>
        </header>

        <ul className="mt-10 grid gap-6">
          {posts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}
