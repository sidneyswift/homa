export const BLOG_CLUSTERS = [
  {
    slug: "planning",
    name: "Homeschool planning",
    shortName: "Planning",
    description:
      "Flexible weekly plans, daily rhythms, and practical ways to decide what happens next.",
    featurePath: "/features/homeschool-planner",
  },
  {
    slug: "records",
    name: "Homeschool records",
    shortName: "Records",
    description:
      "Hours, daily logs, portfolios, and records that are useful when you need them later.",
    featurePath: "/features/homeschool-record-keeping",
  },
  {
    slug: "progress",
    name: "Homeschool progress",
    shortName: "Progress",
    description:
      "Clear examples and gentle ways to notice what is solid, what is growing, and what to try next.",
    featurePath: "/features/homeschool-progress-tracker",
  },
  {
    slug: "practice",
    name: "Practice and printables",
    shortName: "Practice",
    description:
      "How to make useful practice for the lesson in front of you, then check it before printing.",
    featurePath: "/features/personalized-practice-pages",
  },
  {
    slug: "getting-started",
    name: "Getting started with homeschooling",
    shortName: "Getting started",
    description:
      "Calm, specific help for beginning, resetting, and finding a rhythm that fits your family.",
    featurePath: "/features/homeschool-planner",
  },
] as const;

export type BlogCluster = (typeof BLOG_CLUSTERS)[number];
export type BlogClusterSlug = BlogCluster["slug"];

export const BLOG_CLUSTER_SLUGS = BLOG_CLUSTERS.map((cluster) => cluster.slug) as [
  BlogClusterSlug,
  ...BlogClusterSlug[],
];

export function getBlogCluster(slug: string): BlogCluster | undefined {
  return BLOG_CLUSTERS.find((cluster) => cluster.slug === slug);
}
