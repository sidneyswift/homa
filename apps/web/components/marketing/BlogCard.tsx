import Image from "next/image";
import Link from "next/link";

import type { BlogPost } from "../../lib/blog";
import { getBlogCluster } from "../../lib/blog-clusters";

export function BlogCard({ post }: { post: BlogPost }) {
  const cluster = getBlogCluster(post.cluster);

  return (
    <li>
      <Link
        href={`/blog/${post.slug}`}
        className="block h-full overflow-hidden rounded-lg bg-card shadow-sm transition-shadow duration-(--dur-base) ease-out hover:shadow-lg"
        style={{ border: "1px solid var(--border-subtle)" }}
      >
        {post.hero ? (
          <Image
            src={post.hero}
            alt={post.heroAlt ?? ""}
            width={1200}
            height={675}
            className="h-auto w-full"
          />
        ) : null}
        <div className="p-6">
          <p className="text-sm font-semibold text-brand">
            {cluster?.shortName ?? post.cluster}
          </p>
          <h2 className="mt-2 font-display text-xl font-semibold leading-snug text-strong">
            {post.title}
          </h2>
          <p className="mt-2 text-body">{post.description}</p>
        </div>
      </Link>
    </li>
  );
}
