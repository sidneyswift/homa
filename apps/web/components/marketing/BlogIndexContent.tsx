import Link from "next/link";

import type { BlogPost } from "../../lib/blog";
import { BlogCard } from "./BlogCard";

type BlogIndexContentProps = {
  posts: BlogPost[];
  page: number;
  pageCount: number;
};

function pagePath(page: number): string {
  return page === 1 ? "/blog" : `/blog/page/${page}`;
}

export function BlogIndexContent({ posts, page, pageCount }: BlogIndexContentProps) {
  return (
    <>
      <ul className="mt-10 grid gap-6">
        {posts.map((post) => (
          <BlogCard key={post.slug} post={post} />
        ))}
      </ul>

      {pageCount > 1 ? (
        <nav className="mt-10 flex items-center justify-between gap-4" aria-label="Blog pages">
          {page > 1 ? (
            <Link className="font-semibold text-brand underline underline-offset-4" href={pagePath(page - 1)}>
              Newer notes
            </Link>
          ) : (
            <span />
          )}
          <p className="text-sm text-muted">
            Page {page} of {pageCount}
          </p>
          {page < pageCount ? (
            <Link className="font-semibold text-brand underline underline-offset-4" href={pagePath(page + 1)}>
              Older notes
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
