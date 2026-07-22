"use client";

import { useEffect } from "react";

/**
 * The v4 scroll controller.
 *
 * The original scroll-world engine owns the whole page: one continuous clip
 * chain, full-bleed, copy pinned in one corner. v4 breaks that into
 * self-contained scenes so static sections can be interleaved between them,
 * which is what gives the page rhythm.
 *
 * Each [data-v4-scene] is a tall section holding a sticky viewport. Scroll
 * distance through the section maps to that scene's own clip time, and to a
 * 0..1 progress value written onto every [data-v4-w] waypoint inside it as a
 * --w custom property. Copy, UI cards, and the chart draw all read --w, so
 * one number drives every animation in the scene and nothing needs its own
 * observer.
 *
 * Clips load as Blobs (always seekable, independent of byte-range support),
 * only when a scene is near, and seeks are coalesced so a fast flick on a
 * phone cannot pile up decodes.
 */
export function V4Scrub() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

    const scenes = Array.from(document.querySelectorAll<HTMLElement>("[data-v4-scene]")).map((el) => ({
      el,
      video: el.querySelector<HTMLVideoElement>("video"),
      waypoints: Array.from(el.querySelectorAll<HTMLElement>("[data-v4-w]")),
      loading: false,
      ready: false,
      objectUrl: null as string | null,
      cur: 0,
      target: 0,
      visible: false,
    }));

    // Static sections use a plain reveal, same contract as v3.
    document.documentElement.classList.add("v4-armed");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("v4-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" },
    );
    document.querySelectorAll("[data-v4-reveal]").forEach((el) => io.observe(el));

    const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));

    function loadClip(s: (typeof scenes)[number]) {
      const v = s.video;
      if (reduce || !v || s.loading) return;
      const src = v.dataset.src;
      if (!src) return;
      s.loading = true;
      fetch(src)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then((blob) => {
          s.objectUrl = URL.createObjectURL(blob);
          v.src = s.objectUrl;
          v.addEventListener("loadedmetadata", () => {
            s.ready = true;
          });
          // Only hide the poster once a real frame painted: iOS keeps a
          // seeked-but-never-played muted video blank otherwise.
          v.addEventListener("seeked", () => s.el.classList.add("v4-painted"), { once: true });
          v.addEventListener("loadeddata", () => {
            try {
              v.pause();
            } catch {
              /* ignore */
            }
          });
        })
        .catch(() => {
          s.loading = false;
        });
    }

    let ticking = false;
    function read() {
      const vh = window.innerHeight;
      const y = window.scrollY;
      for (const s of scenes) {
        const top = s.el.offsetTop;
        const span = Math.max(1, s.el.offsetHeight - vh);
        const p = clamp((y - top) / span);
        s.target = p;
        const near = y > top - vh * 1.5 && y < top + s.el.offsetHeight + vh * 0.5;
        s.visible = near;
        if (near) loadClip(s);
        for (const w of s.waypoints) {
          const from = parseFloat(w.dataset.from || "0");
          const to = parseFloat(w.dataset.to || "1");
          const fade = parseFloat(w.dataset.fade || "0.12");
          // Ramp up over `fade`, hold, ramp down over `fade`.
          const inW = clamp((p - from) / fade);
          const outW = 1 - clamp((p - (to - fade)) / fade);
          w.style.setProperty("--w", String(Math.min(inW, outW)));
        }
      }
      ticking = false;
    }

    let raf = 0;
    function loop() {
      const eps = coarse ? 0.02 : 0.008;
      for (const s of scenes) {
        const v = s.video;
        if (!v || !s.ready) continue;
        if (v.seeking) continue;
        if (!s.visible && Math.abs(s.cur - s.target) < 0.002) continue;
        s.cur += (s.target - s.cur) * 0.2;
        const dur = v.duration || 1;
        const t = clamp(s.cur, 0, 0.999) * dur;
        if (Math.abs(v.currentTime - t) > eps) {
          try {
            v.currentTime = t;
          } catch {
            /* ignore */
          }
        }
      }
      raf = requestAnimationFrame(loop);
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(read);
      }
    }

    // iOS will not paint a muted video that has never played; prime on first touch.
    let primed = false;
    function prime() {
      if (primed) return;
      primed = true;
      scenes.forEach((s) => {
        const v = s.video;
        if (!v || !coarse) return;
        try {
          const pr = v.play();
          if (pr && typeof pr.then === "function") pr.then(() => v.pause()).catch(() => {});
        } catch {
          /* ignore */
        }
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", read);
    window.addEventListener("touchstart", prime, { once: true, passive: true });
    window.addEventListener("pointerdown", prime, { once: true, passive: true });
    read();
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", read);
      window.removeEventListener("touchstart", prime);
      window.removeEventListener("pointerdown", prime);
      scenes.forEach((s) => {
        if (s.objectUrl) URL.revokeObjectURL(s.objectUrl);
      });
      document.documentElement.classList.remove("v4-armed");
    };
  }, []);

  return null;
}
