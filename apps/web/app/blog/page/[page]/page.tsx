import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlogIndexContent } from "../../../../components/marketing/BlogIndexContent";
import { Footer } from "../../../../components/marketing/Footer";
import { Nav } from "../../../../components/marketing/Nav";
import { getBlogPage, getBlogPageCount, listBlogPosts } from "../../../../lib/blog";

export const dynamicParams = false;

export function generateStaticParams() {
  const pageCount = getBlogPageCount();
  return Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => ({
    page: String(index + 2),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ page: string }>;
}): Promise<Metadata> {
  const page = Number((await params).page);
  if (!Number.isInteger(page) || page < 2 || page > getBlogPageCount()) return {};

  return {
    title: `Homeschool guides, page ${page}`,
    description:
      "More practical homeschool guides for planning, records, progress, and personalized practice.",
    alternates: {
      canonical: `/blog/page/${page}`,
      types: { "application/rss+xml": "/blog/rss.xml" },
    },
  };
}

export default async function PaginatedBlogPage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const page = Number((await params).page);
  const posts = listBlogPosts();
  const pageCount = getBlogPageCount(posts);
  const pagePosts = getBlogPage(page, posts);

  if (!Number.isInteger(page) || page < 2 || page > pageCount || pagePosts.length === 0) {
    notFound();
  }

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <header>
          <p className="text-sm font-semibold text-brand">Notes from Homa</p>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-strong">
            More homeschool guides
          </h1>
          <p className="mt-3 text-body">Page {page} of practical help for the week in front of you.</p>
        </header>
        <BlogIndexContent posts={pagePosts} page={page} pageCount={pageCount} />
      </main>
      <Footer />
    </>
  );
}
