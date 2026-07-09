"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query from React via useSyncExternalStore, the
 * primitive built for reading external sources. SSR-safe: the server snapshot
 * is `false`, so the first render matches the server and then swaps to the
 * live value after hydration (no hydration mismatch, no setState-in-effect).
 *
 * The ds/* components drive hover, press, and focus with JS state + inline
 * styles, which cannot express `@media (hover: hover)`,
 * `@media (prefers-reduced-motion)`, or `:focus-visible` on their own. These
 * hooks give those inline-styled components the same capability-awareness the
 * emil-design-eng rules ask for.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * True only on devices that genuinely hover (mouse or trackpad), never on
 * touch. Gate hover effects on this so they never stick after a tap.
 */
export function useCanHover(): boolean {
  return useMediaQuery("(hover: hover) and (pointer: fine)");
}

/** True when the user asked for reduced motion. Gate transforms on it. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
