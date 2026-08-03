"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Logo } from "../../components/brand/Logo";
import { QuietAction } from "../../components/design/QuietAction";
import { mountScrollWorld } from "../world/scroll-world-engine";
import { WORLD_REAL_CONFIG } from "./world-config";

/**
 * Client mount for /world-real, a near-duplicate of ../world/world-client.tsx
 * kept as its own small component (not a shared abstraction) since the two
 * routes are independent experiments being compared, not one product surface.
 */
export function WorldRealClient() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    return mountScrollWorld(host, WORLD_REAL_CONFIG);
  }, []);

  return (
    <div
      data-brand-era="quiet-authority-v1"
      data-brand-surface="world-real"
      style={{ background: "var(--homa-canvas)", color: "var(--homa-ink)" }}
    >
      <style>{`
        .sw-root{
          --sw-bg: var(--homa-canvas);
          --sw-ink: var(--homa-ink);
          --sw-ink-soft: color-mix(in srgb, var(--homa-ink) 68%, var(--homa-canvas));
          --sw-font-display: var(--font-display);
          --sw-font-body: var(--font-sans);
        }
        .sw-btn{font-family: var(--font-sans);}
        .sw-btn--primary{background: var(--homa-midnight-action); color: var(--homa-paper);}
        .sw-btn--primary:hover{background: color-mix(in srgb, var(--homa-midnight-action) 88%, var(--homa-ink));}
        .wx-topbar{
          position: fixed; top: 0; left: 0; right: 0; z-index: 70;
          display: flex; align-items: center; justify-content: space-between;
          padding: calc(14px + env(safe-area-inset-top)) clamp(18px, 5vw, 64px) 14px;
          pointer-events: none;
        }
        .wx-topbar > *{pointer-events: auto;}
        .wx-cta{white-space: nowrap;}
        .wx-noscript{
          min-height: 60vh; display: grid; place-items: center;
          padding: 96px 24px; text-align: center;
          font-family: var(--font-sans);
          color: var(--homa-ink); background: var(--homa-canvas);
        }
      `}</style>
      <header className="wx-topbar">
        <Link href="/" aria-label="Homa home" style={{ textDecoration: "none" }}>
          <Logo size={30} />
        </Link>
        <QuietAction className="wx-cta" href="/onboarding" kind="primary">
          Get your free report
        </QuietAction>
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
