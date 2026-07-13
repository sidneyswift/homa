"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The family file's chapters (deep view direction 1). Client only for
 * the active state, same reason as admin-nav.tsx.
 */

const TABS = [
  { slug: "", label: "Overview" },
  { slug: "/tasks", label: "Tasks" },
  { slug: "/chats", label: "Chats" },
  { slug: "/brain", label: "Brain" },
  { slug: "/materials", label: "Materials" },
  { slug: "/progress", label: "Progress" },
  { slug: "/screen", label: "Her screen" },
] as const;

export function FamilyTabs({ familyId }: { familyId: string }) {
  const pathname = usePathname();
  const base = `/admin/families/${familyId}`;
  return (
    <nav aria-label="Family file tabs" className="mt-4 flex flex-wrap gap-1.5">
      {TABS.map((tab) => {
        const href = `${base}${tab.slug}`;
        const active = tab.slug === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={tab.slug}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "inline-flex min-h-9 items-center rounded-pill border border-[var(--clay-400)] bg-brand-soft px-3.5 py-1 text-sm font-bold text-[var(--clay-700)]"
                : "inline-flex min-h-9 items-center rounded-pill border border-border-subtle bg-card px-3.5 py-1 text-sm font-medium text-muted transition-colors hover:border-[var(--clay-300)] hover:text-body"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
