import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Footer } from "../../components/marketing/Footer";
import { Nav } from "../../components/marketing/Nav";
import { formatBlogDate, listBlogPosts } from "../../lib/blog";

/**
 * /blog: notes from Homa. Index of published articles (git is the CMS; files
 * land in content/blog/ via the marketing-distributor skill only). Empty
 * state ships honestly: no fabricated posts, ever.
 */

export const metadata: Metadata = {
  title: "Notes",
  description:
    "Notes from Homa: calm, practical writing for homeschool families, one idea at a time.",
};

export default function BlogIndexPage() {
  const posts = listBlogPosts();

  return (
    <>
      <Nav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <header>
          <h1 className="font-display text-3xl font-semibold leading-tight text-strong">
            Notes from Homa
          </h1>
          <p className="mt-3 text-body">
            Calm, practical writing for homeschool families. One idea at a time.
          </p>
        </header>

        {posts.length === 0 ? (
          <div
            className="mt-10 rounded-lg bg-card p-8 text-center shadow-sm"
            style={{ border: "1px solid var(--border-subtle)" }}
          >
            <p className="font-display text-xl font-semibold text-strong">
              Notes are on their way
            </p>
            <p className="mt-2 text-body">
              We&rsquo;re writing. While you wait, the waitlist is open.
            </p>
            <Link
              href="/waitlist"
              className="mt-5 inline-block rounded-pill bg-brand px-6 py-3 font-semibold text-on-brand transition-colors duration-(--dur-base) ease-out hover:bg-brand-hover"
            >
              Join the waitlist
            </Link>
          </div>
        ) : (
          <ul className="mt-10 grid gap-6">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="block overflow-hidden rounded-lg bg-card shadow-sm transition-shadow duration-(--dur-base) ease-out hover:shadow-lg"
                  style={{ border: "1px solid var(--border-subtle)" }}
                >
                  {post.hero ? (
                    <Image
                      src={post.hero}
                      alt=""
                      width={1200}
                      height={675}
                      className="h-auto w-full"
                    />
                  ) : null}
                  <div className="p-6">
                    <p className="text-sm text-muted">{formatBlogDate(post.date)}</p>
                    <h2 className="mt-1 font-display text-xl font-semibold leading-snug text-strong">
                      {post.title}
                    </h2>
                    <p className="mt-2 text-body">{post.description}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </>
  );
}
