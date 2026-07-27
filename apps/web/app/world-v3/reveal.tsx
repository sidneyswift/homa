"use client";

import { useEffect } from "react";

/**
 * Arms the scroll-reveal system for /world-v3, same pattern as the marketing
 * RevealObserver: html.w3-armed hides [data-w3-reveal] targets, and this
 * observer adds .w3-in as they enter the viewport. JS-armed on purpose so
 * no-JS, print, and reduced-motion always see the full content. The chart
 * draw and planner-card slide are CSS transitions keyed off .w3-in, so this
 * one observer drives every beat's motion. Renders nothing.
 */
export function W3Reveal() {
  useEffect(() => {
    document.documentElement.classList.add("w3-armed");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("w3-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.25, rootMargin: "0px 0px -8% 0px" },
    );
    document.querySelectorAll("[data-w3-reveal]").forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      document.documentElement.classList.remove("w3-armed");
    };
  }, []);
  return null;
}
