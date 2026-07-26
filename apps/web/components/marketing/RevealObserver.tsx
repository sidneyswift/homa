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
 */
export function RevealObserver() {
  useEffect(() => {
    document.documentElement.classList.add("rv-armed");
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
    const targets = document.querySelectorAll("[data-reveal], [data-reveal-kids]");
    targets.forEach((el) => io.observe(el));
    // Safety sweep: under fast programmatic scroll the observer can miss an
    // element that is already inside the viewport, leaving it hidden forever.
    // Anything above the reveal line without .rv-in gets it directly, once
    // after arming and again whenever a scroll settles.
    const sweep = () => {
      targets.forEach((el) => {
        if (el.classList.contains("rv-in")) return;
        if (el.getBoundingClientRect().top < window.innerHeight * 0.94) {
          el.classList.add("rv-in");
          io.unobserve(el);
        }
      });
    };
    const raf = requestAnimationFrame(sweep);
    window.addEventListener("scrollend", sweep);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scrollend", sweep);
      io.disconnect();
      document.documentElement.classList.remove("rv-armed");
    };
  }, []);
  return null;
}
