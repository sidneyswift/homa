import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "../../components/brand/Logo";
import { requireFounder } from "../../lib/admin/gate";
import { AdminNav } from "./admin-nav";

/**
 * The founder console frame (MJ-14 founder dashboard v0; direction and
 * scope fixed by the 2026-07-12 lab plus the founder's "do it all"
 * instruction). Own segment outside the parent /app shell on purpose:
 * APP_NAV_ITEMS never learns about it. requireFounder() gates the layout
 * AND every page (soft navigation re-renders pages, not layouts).
 */

export const metadata: Metadata = {
  title: { default: "Founder console", template: "%s · Founder console" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const founder = await requireFounder();

  return (
    <div className="min-h-dvh bg-page lg:flex">
      <aside
        aria-label="Founder console sidebar"
        className="sticky top-3.5 m-3.5 hidden h-[calc(100dvh-28px)] w-[220px] shrink-0 flex-col rounded-[var(--radius-xl)] border border-border-subtle bg-card p-3.5 shadow-[var(--shadow-md)] lg:flex"
      >
        <div className="px-2 pb-1 pt-1">
          <Link href="/admin" aria-label="Founder console home" className="inline-flex rounded-md">
            <Logo size={24} />
          </Link>
          <p className="mt-1 font-mono text-[0.6rem] font-bold uppercase tracking-[0.13em] text-[var(--clay-600)]">
            Founder console
          </p>
        </div>
        <div className="mt-3 flex-1">
          <AdminNav />
        </div>
        <div className="border-t border-border-subtle px-2 pt-3 text-xs text-subtle">
          <p className="truncate font-semibold text-muted">{founder.email}</p>
          <Link href="/app" className="mt-1 inline-block rounded-md font-semibold text-[var(--clay-600)] hover:underline">
            Open the parent app
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-border-subtle bg-page/95 px-4 py-2.5 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <Link href="/admin" aria-label="Founder console home" className="inline-flex rounded-md">
              <Logo size={22} />
            </Link>
            <span className="rounded-pill bg-brand-soft px-2.5 py-1 font-mono text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[var(--clay-700)]">
              Founder
            </span>
          </div>
          <div className="mt-2 overflow-x-auto">
            <AdminNav />
          </div>
        </header>
        <main className="px-4 py-6 lg:px-9 lg:py-8">
          <div className="mx-auto w-full max-w-[1080px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
