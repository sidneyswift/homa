"use client";

import { useEffect } from "react";

/**
 * Arms the scroll-reveal system, ported verbatim from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx: html.rv-armed hides
 * [data-reveal] targets, and this IntersectionObserver adds .rv-in as they
 * enter the viewport. JS-armed on purpose so no-JS, print, and
 * reduced-motion (see globals.css) always see content. Renders nothing.
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
    document.querySelectorAll("[data-reveal], [data-reveal-kids]").forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      document.documentElement.classList.remove("rv-armed");
    };
  }, []);
  return null;
}
