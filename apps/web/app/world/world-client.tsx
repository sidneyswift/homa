"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Logo } from "../../components/brand/Logo";
import { mountScrollWorld } from "./scroll-world-engine";
import { WORLD_CONFIG } from "./world-config";

/**
 * Client mount for the /world scroll experiment. The engine owns everything
 * inside the container (scenes, copy, route rail, scrub loop); this component
 * owns the Homa chrome above it: the real Logo lockup and the one pill CTA,
 * fixed over the world. Theme overrides live in the style tag below; they are
 * unlayered on purpose so they beat the engine's @layer sw defaults.
 */
export function WorldClient() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    return mountScrollWorld(host, WORLD_CONFIG);
  }, []);

  return (
    <div style={{ background: "var(--bg-page)" }}>
      <style>{`
        .sw-root{
          --sw-bg: #FBF7F0;
          --sw-ink: var(--text-strong, #221E1A);
          --sw-ink-soft: var(--text-muted, #6B6157);
          --sw-font-display: var(--font-display, system-ui, sans-serif);
          --sw-font-body: var(--font-sans, system-ui, sans-serif);
        }
        .sw-btn{font-family: var(--font-sans, system-ui, sans-serif);}
        .sw-btn--primary{background: var(--brand, #E7602F); box-shadow: var(--shadow-sm, 0 4px 14px rgba(90,62,40,.14));}
        .sw-btn--primary:hover{background: var(--brand-hover, #C44C22);}
        .wx-topbar{
          position: fixed; top: 0; left: 0; right: 0; z-index: 70;
          display: flex; align-items: center; justify-content: space-between;
          padding: calc(14px + env(safe-area-inset-top)) clamp(18px, 5vw, 64px) 14px;
          pointer-events: none;
        }
        .wx-topbar > *{pointer-events: auto;}
        .wx-cta{
          font-family: var(--font-sans, system-ui, sans-serif);
          font-weight: 600; font-size: .9rem; text-decoration: none;
          color: #fff; background: var(--brand, #E7602F);
          padding: 10px 20px; border-radius: 999px; white-space: nowrap;
          box-shadow: var(--shadow-sm, 0 4px 14px rgba(90,62,40,.14));
          transition: background .2s, transform .2s;
        }
        .wx-cta:hover{background: var(--brand-hover, #C44C22); transform: translateY(-1px);}
        .wx-cta:active{transform: scale(.97);}
        .wx-noscript{
          min-height: 60vh; display: grid; place-items: center;
          padding: 96px 24px; text-align: center;
          font-family: var(--font-sans, system-ui, sans-serif);
        }
      `}</style>
      <header className="wx-topbar">
        <Link href="/" aria-label="Homa home" style={{ textDecoration: "none" }}>
          <Logo size={30} />
        </Link>
        <a className="wx-cta" href="/onboarding">
          Get your free report
        </a>
      </header>
      <div ref={hostRef} />
      <noscript>
        <div className="wx-noscript">
          <p>
            This page is an interactive flight through what Homa does. With JavaScript off, the
            short version: Homa plans the week, makes practice pages for each child, and keeps the
            record. Start with the free progress report at <a href="/onboarding">thankshoma.com/onboarding</a>.
          </p>
        </div>
      </noscript>
    </div>
  );
}
