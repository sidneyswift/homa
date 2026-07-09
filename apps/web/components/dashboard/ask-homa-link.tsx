"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The phone top bar's Ask Homa pill. Client-side for the same reason as
 * SidebarNav: the frame renders once and stays mounted, so the pill
 * hides itself on /chat instead of offering the page it's already on.
 */
export function AskHomaLink() {
  const pathname = usePathname();
  if (pathname === "/chat" || pathname.startsWith("/chat/")) return null;
  return (
    <Link
      href="/chat"
      className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover"
    >
      Ask Homa
    </Link>
  );
}
