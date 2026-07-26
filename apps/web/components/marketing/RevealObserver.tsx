"use client";

import { useEffect } from "react";

/**
 * Drives the scroll-reveal system: html.rv-armed hides [data-reveal]
 * targets, and this IntersectionObserver adds .rv-in as they enter the
 * viewport. Arming itself happens pre-paint via an inline script in
 * page.tsx (arming here, post-hydration, made the painted page blink to
 * opacity 0 and re-animate); the classList.add below is an idempotent
 * fallback. JS-armed on purpose so no-JS, print, and reduced-motion (see
 * globals.css) always see content. Renders nothing.
 *
 * Found by measurement, not by report alone (2026-07-26): a synthetic fast
 * scroll across the whole page left every target still at opacity 0 the
 * entire way, and `scrollend` never fired once in the run. So the sweep
 * cannot be the only path to visible, and when it does fire late (a real
 * flick scroll that outruns the observer, then a `scrollend` that only
 * lands after the reader has already stopped) it must not animate: an
 * element sliding up 14px while someone is mid-read of the section above
 * or below it is exactly the "page snaps" feel this fixes. The primary
 * observer path keeps its animated reveal (that's the intended
 * fade-up-as-you-scroll effect at normal scroll speed); every catch-up
 * path (the sweep, whichever trigger runs it) reveals instantly instead.
 */
export function RevealObserver() {
  useEffect(() => {
    document.documentElement.classList.add("rv-armed");
    const targets = document.querySelectorAll("[data-reveal], [data-reveal-kids]");
    const revealInstantly = (el: Element) => {
      el.classList.add("rv-no-anim", "rv-in");
      io.unobserve(el);
    };
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("rv-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
    );
    targets.forEach((el) => io.observe(el));
    // Safety sweep: under fast scroll the observer can miss an element
    // that is already inside the viewport, leaving it hidden forever.
    // Anything above the reveal line without .rv-in gets it directly, on
    // a throttled scroll tick (so a fast flick still catches up mid-scroll
    // rather than only once it stops), once after arming, and once more on
    // scrollend for browsers where that event lands.
    const sweep = () => {
      targets.forEach((el) => {
        if (el.classList.contains("rv-in")) return;
        if (el.getBoundingClientRect().top < window.innerHeight * 0.94) revealInstantly(el);
      });
    };
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        sweep();
        ticking = false;
      });
    };
    const raf = requestAnimationFrame(sweep);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scrollend", sweep);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("scrollend", sweep);
      io.disconnect();
      document.documentElement.classList.remove("rv-armed");
    };
  }, []);
  return null;
}
