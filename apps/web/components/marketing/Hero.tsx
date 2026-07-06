"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowRight, Play, Sparkles, X } from "lucide-react";

import { Button } from "./ds/Button";
import { Doodle } from "./Doodle";

/**
 * Landing hero, ported verbatim from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx: promise headline, twin
 * CTAs (waitlist + the 15s brand film in a modal), avatar row, blob-framed
 * family photo, three scattered doodles. Film playback position persists in
 * localStorage so a reopened modal resumes. Modal motion per the
 * emil-design-eng skill: centered origin (modals are exempt from
 * origin-aware scaling), scale 0.97 to 1 + fade via @starting-style, and
 * Escape closes.
 */
export function Hero() {
  const [film, setFilm] = useState(false);

  useEffect(() => {
    if (!film) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [film]);

  return (
    <section style={{ background: "var(--band-sky)", position: "relative", overflow: "hidden" }}>
      <Doodle name="star" size={34} rotate={-12} style={{ position: "absolute", top: 46, left: "4%" }} />
      <Doodle name="sun" size={34} color="var(--gold-500)" style={{ position: "absolute", top: 40, left: "46%" }} />
      <Doodle
        name="squiggle"
        size={44}
        color="var(--pop-cobalt)"
        style={{ position: "absolute", bottom: 52, left: "44%" }}
      />
      <div
        className="lp-hero-grid lp-pad"
        style={{
          display: "grid",
          gridTemplateColumns: "1.05fr 1fr",
          gap: 48,
          alignItems: "center",
          padding: "116px 40px 108px",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <div data-reveal="">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--surface-card)",
              color: "var(--clay-600)",
              padding: "7px 16px",
              borderRadius: "var(--radius-pill)",
              fontWeight: 700,
              fontSize: "0.85rem",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <Sparkles size={15} aria-hidden="true" /> In your corner, every school day
          </span>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.6rem, 7vw, 3.9rem)",
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: "-0.015em",
              color: "var(--text-strong)",
              margin: "22px 0 0",
            }}
          >
            You&rsquo;ve got this.
            <br />
            Homa&rsquo;s got the <span style={{ color: "var(--clay-600)" }}>rest</span>.
          </h1>
          <p style={{ fontSize: "1.22rem", color: "var(--stone-700)", lineHeight: 1.55, margin: "24px 0 0", maxWidth: 470 }}>
            The planning, the tracking, the what-do-we-do-today, hand it to Homa. You get back to the part only you
            can do.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
            <Button variant="primary" size="lg" href="/map" iconRight={<ArrowRight size={18} color="#fff" aria-hidden="true" />}>
              See where your child stands
            </Button>
            <Button
              variant="ghost"
              size="lg"
              iconLeft={<Play size={16} aria-hidden="true" />}
              style={{ background: "var(--surface-card)" }}
              onClick={() => setFilm(true)}
            >
              Watch the film
            </Button>
          </div>
          {/* Honest trust line (rulings C2 + T2: no fabricated social proof,
              no pricing). The map claim is real: /map delivers it today. */}
          <div
            style={{
              marginTop: 24,
              color: "var(--stone-700)",
              fontSize: "0.9rem",
              fontWeight: 500,
              maxWidth: 440,
            }}
          >
            Free: answer a five-minute checklist and get a progress report
            showing exactly where your child stands. Built by a homeschool family.
          </div>
        </div>
        <div data-reveal="" className="rv-d1" style={{ position: "relative" }}>
          <div style={{ borderRadius: "var(--blob-1)", overflow: "hidden" }}>
            <Image
              src="/images/hero-family.png"
              alt="A mom and her son working through a workbook together at the kitchen table"
              width={760}
              height={440}
              priority
              style={{ width: "100%", height: 440, objectFit: "cover", display: "block" }}
            />
          </div>
          <Doodle
            name="heart"
            size={30}
            color="var(--pop-blush)"
            rotate={10}
            style={{ position: "absolute", bottom: -6, left: -14 }}
          />
        </div>
      </div>
      {film && (
        <div
          className="lp-film-backdrop"
          onClick={() => setFilm(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Homa brand film"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            background: "rgba(51,42,33,0.42)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div className="lp-film-card" onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "min(920px, 92vw)" }}>
            <video
              src="/videos/homa-brand-film.mp4"
              controls
              autoPlay
              playsInline
              onLoadedMetadata={(e) => {
                const video = e.currentTarget;
                const t = parseFloat(localStorage.getItem("homa-film-t") || "0");
                if (t > 0.5 && t < video.duration - 0.5) video.currentTime = t;
              }}
              onTimeUpdate={(e) => {
                try {
                  localStorage.setItem("homa-film-t", String(e.currentTarget.currentTime));
                } catch {
                  /* private mode: resume is a nicety, not a requirement */
                }
              }}
              style={{
                width: "100%",
                display: "block",
                borderRadius: "var(--radius-xl)",
                boxShadow: "var(--shadow-xl)",
                background: "#000",
              }}
            />
            <button
              onClick={() => setFilm(false)}
              aria-label="Close film"
              style={{
                position: "absolute",
                top: -14,
                right: -14,
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "none",
                background: "var(--surface-card)",
                boxShadow: "var(--shadow-md)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={18} color="var(--text-body)" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
