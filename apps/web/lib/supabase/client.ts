"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components. createBrowserClient is a singleton
 * under the hood, so calling this per-component is fine.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
