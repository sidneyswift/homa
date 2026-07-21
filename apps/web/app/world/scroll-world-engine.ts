/**
 * Scroll-scrubbed camera-flight engine for the /world experiment, ported from
 * the scroll-world reference engine (github.com/oso95/scroll-world,
 * references/scrub-engine.js) into typed TS with a React-friendly lifecycle.
 * The mechanic: pre-rendered clips are chained dive, connector, dive, ... and
 * scroll position scrubs video.currentTime, so scrolling flies one continuous
 * camera through the world. Clips load as Blob object URLs because blob
 * sources are always seekable, which keeps scrubbing independent of whether
 * the asset host serves HTTP byte ranges.
 *
 * Deliberate differences from the reference:
 * - mountScrollWorld returns a destroy() that unwinds every listener, the
 *   rAF loop, the injected style tag, and the blob object URLs, so the Next
 *   route can unmount cleanly.
 * - No topbar/brand/nav DOM: the route renders its own Homa header above the
 *   engine (real Logo component, brand pill button). The route rail dots
 *   remain as the in-world navigation.
 * - No html/body CSS: globals.css owns the document; the engine only styles
 *   inside its container.
 * - Phone behavior is kept verbatim: seek coalescing (never queue a seek
 *   while the decoder is mid-seek), first-touch video priming for iOS,
 *   height-only resize ignores (URL bar), safe-area-aware copy, and native
 *   9:16 mobile clips via clipMobile/stillMobile.
 */

export interface WorldCta {
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
}

export interface WorldSection {
  id: string;
  label: string;
  still: string;
  stillMobile?: string;
  clip: string;
  clipMobile?: string;
  accent: string;
  /** Viewport-heights of scroll for this scene (overrides diveScroll). */
  scroll?: number;
  /** 0..1, keep at or below 0.6: camera settles mid-scene while copy peaks. */
  linger?: number;
  eyebrow?: string;
  title: string;
  body?: string;
  tags?: string[];
  cta?: WorldCta;
}

export interface WorldConfig {
  sections: WorldSection[];
  /** Connector clip URLs, length sections-1; null skips to a plain crossfade. */
  connectors: Array<string | null>;
  connectorsMobile?: Array<string | null>;
  diveScroll?: number;
  connScroll?: number;
  crossfade?: number;
  hint?: string;
  atmosphere?: boolean;
}

interface Segment {
  kind: "dive" | "conn";
  si: number;
  clip: string | null;
  clipM?: string | null;
  still: string;
  stillM?: string;
  accent: string;
  w: number;
  linger?: number;
  start: number;
  end: number;
  el: HTMLDivElement;
  img: HTMLImageElement;
  video: HTMLVideoElement | null;
  objectUrl: string | null;
  hasClip: boolean;
  loading: boolean;
  ready: boolean;
  cur: number;
  target: number;
  visible: boolean;
}

export function mountScrollWorld(container: HTMLElement, config: WorldConfig): () => void {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // coarse is captured once (input type is stable in a session); the width
  // query is read live so a desktop resize still switches seek behavior.
  const coarse = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const smallMQ = window.matchMedia("(max-width: 860px)");
  const isMobile = () => coarse || smallMQ.matches;
  const SECTIONS = config.sections;
  const CONNECTORS = config.connectors;
  const CONNECTORS_M = config.connectorsMobile ?? [];
  const DIVE_W = config.diveScroll ?? 1.3;
  const CONN_W = config.connScroll ?? 0.9;
  const CROSSFADE = config.crossfade ?? 0.12;
  const N = SECTIONS.length;
  if (N === 0) return () => {};

  const styleTag = injectCSS();
  container.classList.add("sw-root");

  // Interleaved segment chain: dive0, conn0, dive1, ... diveN-1. A missing
  // connector (null) simply lets the neighbouring dives crossfade.
  const SEGMENTS: Segment[] = [];
  const sectionSeg: Segment[] = [];
  SECTIONS.forEach((s, i) => {
    const dive = makeSegment("dive", i, s.clip, s.clipMobile ?? null, s.still, s.stillMobile, s.accent, s.scroll ?? DIVE_W, s.linger ?? 0);
    SEGMENTS.push(dive);
    sectionSeg[i] = dive;
    const conn = i < N - 1 ? CONNECTORS[i] : null;
    if (conn) {
      const next = SECTIONS[i + 1];
      SEGMENTS.push(makeSegment("conn", i, conn, CONNECTORS_M[i] ?? null, next.still, next.stillMobile, next.accent, CONN_W, 0));
    }
  });
  const NSEG = SEGMENTS.length;

  function makeSegment(
    kind: "dive" | "conn",
    si: number,
    clip: string | null,
    clipM: string | null,
    still: string,
    stillM: string | undefined,
    accent: string,
    w: number,
    linger: number,
  ): Segment {
    const el = document.createElement("div");
    el.className = "sw-scene";
    el.style.setProperty("--sw-accent", accent);
    const img = document.createElement("img");
    img.className = "sw-scene__still";
    img.alt = "";
    img.decoding = "async";
    // Never lazy: every scene layer sits at viewport inset 0 inside the fixed
    // stage, so laziness saves nothing, and the poster is both the LCP and
    // the reduced-motion fallback.
    const wantMobilePoster = isMobile() && Boolean(stillM);
    img.src = wantMobilePoster && stillM ? stillM : still;
    if (wantMobilePoster) {
      // A missing portrait poster falls back to the landscape still rather
      // than an empty scene.
      img.addEventListener("error", () => {
        if (img.src !== still) img.src = still;
      }, { once: true });
    }
    el.appendChild(img);
    return {
      kind, si, clip, clipM, still, stillM, accent, w, linger,
      start: 0, end: 0, el, img,
      video: null, objectUrl: null, hasClip: false, loading: false, ready: false,
      cur: 0, target: 0, visible: false,
    };
  }

  // ---- DOM ----
  const sky = el("div", "sw-sky");
  if (config.atmosphere !== false) {
    sky.appendChild(el("div", "sw-sky__grad"));
    sky.appendChild(el("div", "sw-sky__glow"));
  }
  const scrollbar = el("div", "sw-scrollbar");
  const scrollbarFill = document.createElement("span");
  scrollbar.appendChild(scrollbarFill);

  const stage = el("div", "sw-stage");
  const copylayer = el("div", "sw-copylayer");
  const route = el("div", "sw-route");
  const hint = el("div", "sw-hint");
  const hintText = document.createElement("span");
  hintText.textContent = config.hint ?? "scroll";
  hint.appendChild(hintText);
  hint.appendChild(document.createElement("i"));
  const track = el("div", "sw-track");

  [sky, scrollbar, stage, copylayer, route, hint, track].forEach((n) => container.appendChild(n));
  SEGMENTS.forEach((s) => stage.appendChild(s.el));

  const copies: HTMLElement[] = [];
  const dots: HTMLButtonElement[] = [];
  SECTIONS.forEach((s, i) => {
    const c = document.createElement("article");
    c.className = "sw-copy";
    c.style.setProperty("--sw-accent", s.accent);
    c.innerHTML =
      `<span class="sw-copy__num">${pad(i + 1)} / ${pad(N)}</span>` +
      (s.eyebrow ? `<span class="sw-copy__eyebrow">${esc(s.eyebrow)}</span>` : "") +
      `<h2 class="sw-copy__title">${esc(s.title)}</h2>` +
      (s.body ? `<p class="sw-copy__body">${esc(s.body)}</p>` : "") +
      (s.tags && s.tags.length ? `<ul class="sw-copy__tags">${s.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "") +
      (s.cta ? `<div class="sw-copy__cta">${ctaBtns(s.cta)}</div>` : "");
    copylayer.appendChild(c);
    copies.push(c);

    const dot = document.createElement("button");
    dot.className = "sw-route__dot";
    dot.type = "button";
    dot.style.setProperty("--sw-accent", s.accent);
    dot.setAttribute("aria-label", s.label);
    dot.innerHTML = `<span class="sw-route__label">${esc(s.label)}</span><i></i>`;
    dot.addEventListener("click", () => jumpTo(i));
    route.appendChild(dot);
    dots.push(dot);
  });

  // ---- math ----
  const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = (x: number) => {
    const t = clamp(x);
    return t * t * (3 - 2 * t);
  };
  // Monotone scroll-to-time remap: camera settles mid-scene (where copy
  // peaks) and moves quicker near seams. f(0)=0 and f(1)=1 always, so seam
  // frames are untouched.
  const lingerEase = (x: number, L: number) => {
    const l = clamp(L);
    const c = x - 0.5;
    return (1 - l) * x + l * (4 * c * c * c + 0.5);
  };

  let vh = window.innerHeight;
  let stageX = 0;
  let totalW = 0;
  let activeIndex = -1;
  let ticking = false;
  let laidOutW = window.innerWidth;
  let destroyed = false;
  let userReady = false;

  function layout() {
    vh = window.innerHeight;
    laidOutW = window.innerWidth;
    stageX = window.innerWidth > 860 ? 4 : 0;
    let off = 0;
    SEGMENTS.forEach((s) => {
      s.start = off * vh;
      off += s.w;
      s.end = off * vh;
    });
    totalW = off;
    track.style.height = `${totalW * vh + vh}px`; // +1vh so the last flight completes
    read();
  }

  function jumpTo(i: number) {
    const seg = sectionSeg[i];
    window.scrollTo({ top: seg.start + (seg.end - seg.start) * 0.5, behavior: reduce ? "auto" : "smooth" });
  }

  function loadClip(s: Segment) {
    // Reduced motion never loads clips: stills cross-dissolve instead.
    if (reduce || s.loading || !s.clip) return;
    s.loading = true;
    const url = isMobile() && s.clipM ? s.clipM : s.clip;
    fetch(url)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => {
        if (destroyed) return;
        const v = document.createElement("video");
        v.className = "sw-scene__video";
        v.muted = true;
        v.playsInline = true;
        v.preload = "auto";
        v.setAttribute("muted", "");
        v.setAttribute("playsinline", "");
        s.objectUrl = URL.createObjectURL(blob);
        v.src = s.objectUrl;
        v.addEventListener("loadedmetadata", () => {
          s.ready = true;
          read();
        });
        // Reveal the video only after a real frame painted: on iOS a
        // seeked-but-never-played muted video stays blank, so hiding the
        // still on metadata alone would flash an empty scene.
        v.addEventListener("seeked", () => s.el.classList.add("has-clip"), { once: true });
        v.addEventListener("loadeddata", () => {
          try {
            v.pause();
          } catch {
            /* ignore */
          }
          if (userReady) primeVideo(v);
        });
        s.el.appendChild(v);
        s.video = v;
        s.hasClip = true;
      })
      .catch(() => {
        s.loading = false;
      });
  }

  function read() {
    const y = window.scrollY || window.pageYOffset;
    const fade = CROSSFADE * vh;
    let ci = 0;
    for (let i = 0; i < NSEG; i++) if (y >= SEGMENTS[i].start) ci = i;

    for (let i = 0; i < NSEG; i++) {
      const s = SEGMENTS[i];
      if (y > s.start - 1.6 * vh && y < s.end + 1.6 * vh) loadClip(s);
      const local = clamp((y - s.start) / (s.end - s.start));
      s.target = s.linger ? lingerEase(local, s.linger) : local;
      let outside = 0;
      if (y < s.start) outside = s.start - y;
      else if (y > s.end) outside = y - s.end;
      const op = smooth(1 - outside / fade);
      s.el.style.opacity = String(op);
      s.visible = op > 0.001;
      s.el.style.zIndex = i === ci ? "120" : String(100 + Math.round(op * 10));
      if (!s.hasClip || !s.ready) {
        const sc = reduce ? 1 : 1.03 + local * 0.14;
        s.img.style.transform = `translateX(${stageX - 2}vw) scale(${sc.toFixed(3)})`;
      }
    }

    for (let i = 0; i < N; i++) {
      const seg = sectionSeg[i];
      const pr = clamp((y - seg.start) / (seg.end - seg.start));
      const before = y < seg.start;
      const after = y > seg.end;
      let cop: number;
      if (i === 0) cop = after ? 0 : smooth(1 - pr / 0.62); // greets on landing
      else if (i === N - 1) cop = before ? 0 : smooth(pr / 0.4); // holds CTA at the end
      else cop = before || after ? 0 : smooth(1 - Math.abs(pr - 0.5) / 0.5);
      const c = copies[i];
      c.style.opacity = String(cop);
      c.style.transform = reduce ? "none" : `translateY(${(0.5 - pr) * 4}vh)`;
      c.style.pointerEvents = cop > 0.5 ? "auto" : "none";
    }

    const cur = SEGMENTS[ci];
    const near = clamp(
      cur.kind === "dive" ? cur.si : (y - cur.start) / (cur.end - cur.start) > 0.5 ? cur.si + 1 : cur.si,
      0,
      N - 1,
    );
    if (near !== activeIndex) {
      activeIndex = near;
      dots.forEach((d, k) => d.classList.toggle("is-active", k === near));
      container.style.setProperty("--sw-accent", SECTIONS[near].accent);
    }
    scrollbarFill.style.transform = `scaleX(${clamp(y / (totalW * vh))})`;
    hint.style.opacity = String(clamp(1 - y / (0.5 * vh)));
    ticking = false;
  }

  let rafId = 0;
  function raf() {
    if (destroyed) return;
    const eps = isMobile() ? 0.02 : 0.008; // coarser seek step on phones = fewer decodes
    for (let i = 0; i < NSEG; i++) {
      const s = SEGMENTS[i];
      if (!s.hasClip || !s.ready || !s.video) continue;
      // Never queue a seek while the decoder is still resolving the last
      // one: on phones a fast flick would pile seeks up and freeze the
      // clip. cur keeps lerping, so we snap to target the moment it frees.
      if (s.video.seeking) continue;
      if (!s.visible && Math.abs(s.cur - s.target) < 0.002) continue;
      s.cur += (s.target - s.cur) * (reduce ? 1 : 0.18);
      const dur = s.video.duration || 1;
      const t = clamp(s.cur, 0, 0.999) * dur;
      if (Math.abs(s.video.currentTime - t) > eps) {
        try {
          s.video.currentTime = t;
        } catch {
          /* ignore */
        }
      }
    }
    rafId = requestAnimationFrame(raf);
  }

  // iOS needs a user gesture before a muted video decodes reliably; prime
  // every loaded clip (muted play then pause) on the first touch.
  function primeVideo(v: HTMLVideoElement | null) {
    if (!isMobile() || !v) return;
    try {
      const p = v.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          try {
            v.pause();
          } catch {
            /* ignore */
          }
        }).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }
  function onFirstGesture() {
    if (userReady) return;
    userReady = true;
    SEGMENTS.forEach((s) => primeVideo(s.video));
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(read);
    }
  }
  // Mobile browsers fire resize when the URL bar slides: relayout there
  // would rebuild track height and yank the scroll position, so on touch
  // only a width change relayouts (rotation arrives via orientationchange).
  function onResize() {
    if (coarse && window.innerWidth === laidOutW) return;
    layout();
  }

  seedParticles(sky, reduce || coarse);
  window.addEventListener("pointerdown", onFirstGesture, { once: true, passive: true });
  window.addEventListener("touchstart", onFirstGesture, { once: true, passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", layout);
  window.addEventListener("load", layout);
  layout();
  rafId = requestAnimationFrame(raf);

  return function destroy() {
    destroyed = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener("pointerdown", onFirstGesture);
    window.removeEventListener("touchstart", onFirstGesture);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", layout);
    window.removeEventListener("load", layout);
    SEGMENTS.forEach((s) => {
      if (s.objectUrl) URL.revokeObjectURL(s.objectUrl);
    });
    styleTag.remove();
    container.classList.remove("sw-root");
    container.replaceChildren();
  };

  function el(tag: string, cls: string): HTMLDivElement {
    const n = document.createElement(tag) as HTMLDivElement;
    n.className = cls;
    return n;
  }
  function pad(n: number) {
    return String(n).padStart(2, "0");
  }
  function esc(v: string) {
    return v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
  }
  function ctaBtns(cta: WorldCta) {
    let h = "";
    if (cta.primary) h += `<a class="sw-btn sw-btn--primary" href="${esc(cta.primary.href)}">${esc(cta.primary.label)}</a>`;
    if (cta.secondary) h += `<a class="sw-btn sw-btn--ghost" href="${esc(cta.secondary.href)}">${esc(cta.secondary.label)}</a>`;
    return h;
  }
}

function seedParticles(host: HTMLElement, reduce: boolean) {
  if (reduce) return;
  const holder = document.createElement("div");
  holder.className = "sw-particles";
  host.appendChild(holder);
  const kinds = ["dot", "dot", "ring"];
  const seeds = [7, 23, 41, 58, 71, 88, 12, 34, 52, 66, 83, 95, 18, 29, 47, 63, 77, 91, 5, 38, 55, 69, 82, 97];
  for (let k = 0; k < 20; k++) {
    const s = document.createElement("span");
    s.className = `sw-pt sw-pt--${kinds[k % kinds.length]}`;
    s.style.left = `${seeds[k % seeds.length]}vw`;
    s.style.top = `${(seeds[(k * 3) % seeds.length] * 1.3) % 100}vh`;
    s.style.setProperty("--sw-sc", (0.5 + ((seeds[(k * 5) % seeds.length] % 60) / 60) * 1.1).toFixed(2));
    const dur = 14 + (seeds[(k * 7) % seeds.length] % 22);
    s.style.animationDuration = `${dur}s`;
    s.style.animationDelay = `${-(seeds[(k * 2) % seeds.length] % dur)}s`;
    holder.appendChild(s);
  }
}

function injectCSS(): HTMLStyleElement {
  const existing = document.getElementById("sw-css");
  if (existing) return existing as HTMLStyleElement;
  const css = `
  .sw-root{--sw-bg:#FBF7F0;--sw-ink:#221E1A;--sw-ink-soft:#6B6157;--sw-accent:#E7602F;
    --sw-font-display:system-ui,sans-serif;--sw-font-body:system-ui,sans-serif;
    color:var(--sw-ink);font-family:var(--sw-font-body);}
  .sw-sky{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;background:var(--sw-bg);}
  .sw-sky__grad{position:absolute;inset:-10%;background:linear-gradient(178deg,color-mix(in srgb,var(--sw-accent) 10%,var(--sw-bg)) 0%,var(--sw-bg) 55%,color-mix(in srgb,var(--sw-accent) 5%,var(--sw-bg)) 100%);}
  .sw-sky__glow{position:absolute;inset:0;background:radial-gradient(60% 42% at 74% 16%,color-mix(in srgb,var(--sw-accent) 18%,transparent),transparent 70%),radial-gradient(46% 34% at 50% 50%,color-mix(in srgb,#fff 45%,transparent),transparent 70%);}
  .sw-particles{position:absolute;inset:-6% -2%;}
  .sw-pt{position:absolute;width:13px;height:13px;transform:scale(var(--sw-sc,1));opacity:0;animation:sw-drift linear infinite;}
  .sw-pt::before{content:"";position:absolute;inset:0;border-radius:50%;}
  .sw-pt--dot::before{background:radial-gradient(circle at 34% 30%,color-mix(in srgb,var(--sw-accent) 55%,#fff),color-mix(in srgb,var(--sw-accent) 80%,#000) 82%);}
  .sw-pt--ring::before{background:transparent;border:2px solid color-mix(in srgb,var(--sw-accent) 45%,transparent);}
  @keyframes sw-drift{0%{opacity:0;transform:scale(var(--sw-sc)) translate(0,12vh) rotate(0)}12%{opacity:.4}88%{opacity:.35}100%{opacity:0;transform:scale(var(--sw-sc)) translate(4vw,-22vh) rotate(210deg)}}
  .sw-scrollbar{position:fixed;top:0;left:0;right:0;height:3px;z-index:60;background:color-mix(in srgb,var(--sw-accent) 14%,transparent);}
  .sw-scrollbar span{display:block;height:100%;width:100%;transform-origin:0 50%;transform:scaleX(0);background:var(--sw-accent);}
  .sw-stage{position:fixed;inset:0;z-index:10;pointer-events:none;}
  .sw-scene{position:absolute;inset:0;opacity:0;overflow:hidden;will-change:opacity;}
  .sw-scene__video,.sw-scene__still{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 42%;}
  .sw-scene__still{will-change:transform;}
  .sw-scene.has-clip .sw-scene__still{opacity:0;}
  .sw-scene__video{z-index:1;}
  .sw-copylayer{position:fixed;inset:0;z-index:20;pointer-events:none;}
  .sw-copylayer::before{content:"";position:absolute;inset:0;width:min(58vw,780px);background:linear-gradient(90deg,var(--sw-bg) 0%,color-mix(in srgb,var(--sw-bg) 82%,transparent) 34%,color-mix(in srgb,var(--sw-bg) 40%,transparent) 62%,transparent 100%);}
  .sw-copy{position:absolute;left:clamp(18px,5vw,64px);top:50%;transform:translateY(-50%);width:min(42vw,460px);opacity:0;will-change:opacity,transform;}
  .sw-copy__num{font-family:var(--font-mono,ui-monospace,Menlo,monospace);font-size:.74rem;letter-spacing:.12em;color:var(--sw-ink-soft);}
  .sw-copy__eyebrow{display:block;margin-top:18px;font-family:var(--sw-font-display);font-weight:700;font-size:.8rem;letter-spacing:.14em;text-transform:uppercase;color:var(--sw-accent);}
  .sw-copy__title{font-family:var(--sw-font-display);font-weight:700;color:var(--sw-ink);font-size:clamp(2rem,4.4vw,3.4rem);line-height:1.05;margin:12px 0 0;letter-spacing:-.015em;text-shadow:0 2px 20px color-mix(in srgb,var(--sw-bg) 70%,transparent);}
  .sw-copy__body{margin-top:16px;font-size:clamp(1rem,1.25vw,1.13rem);line-height:1.55;color:color-mix(in srgb,var(--sw-ink) 80%,var(--sw-ink-soft));max-width:42ch;text-shadow:0 1px 12px color-mix(in srgb,var(--sw-bg) 90%,transparent);}
  .sw-copy__tags{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin:22px 0 0;padding:0;}
  .sw-copy__tags li{font-size:.8rem;font-weight:600;color:color-mix(in srgb,var(--sw-accent) 72%,#000);padding:7px 14px;border-radius:999px;background:color-mix(in srgb,var(--sw-accent) 12%,#fff);border:1px solid color-mix(in srgb,var(--sw-accent) 28%,transparent);}
  .sw-copy__cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px;pointer-events:auto;}
  .sw-btn{text-decoration:none;font-weight:600;font-size:.95rem;padding:13px 24px;border-radius:999px;transition:transform .2s;}
  .sw-btn--primary{color:#fff;background:var(--sw-accent);}
  .sw-btn--primary:hover{transform:translateY(-2px);}
  .sw-btn--ghost{color:var(--sw-ink);border:1.5px solid color-mix(in srgb,var(--sw-ink) 25%,transparent);}
  .sw-btn--ghost:hover{transform:translateY(-2px);}
  .sw-route{position:fixed;right:clamp(14px,2.4vw,30px);top:50%;z-index:40;transform:translateY(-50%);display:flex;flex-direction:column;gap:22px;padding:18px 10px;}
  .sw-route::before{content:"";position:absolute;left:50%;top:22px;bottom:22px;width:2px;transform:translateX(-50%);background:var(--sw-accent);opacity:.28;}
  .sw-route__dot{position:relative;border:0;background:transparent;cursor:pointer;width:14px;height:14px;display:grid;place-items:center;}
  .sw-route__dot i{width:9px;height:9px;border-radius:50%;background:color-mix(in srgb,var(--sw-accent) 40%,transparent);transition:transform .3s,background .3s,box-shadow .3s;}
  .sw-route__dot:hover i{transform:scale(1.25);background:var(--sw-accent);}
  .sw-route__dot.is-active i{background:var(--sw-accent);transform:scale(1.4);box-shadow:0 0 0 5px color-mix(in srgb,var(--sw-accent) 22%,transparent);}
  .sw-route__label{position:absolute;right:24px;top:50%;transform:translateY(-50%) translateX(6px);white-space:nowrap;font-size:.78rem;font-weight:600;color:var(--sw-ink);background:color-mix(in srgb,#fff 85%,transparent);backdrop-filter:blur(6px);padding:5px 11px;border-radius:999px;opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;border:1px solid color-mix(in srgb,var(--sw-accent) 14%,transparent);}
  .sw-route__dot:hover .sw-route__label,.sw-route__dot.is-active .sw-route__label{opacity:1;transform:translateY(-50%) translateX(0);}
  .sw-hint{position:fixed;left:50%;bottom:26px;z-index:30;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:10px;font-size:.76rem;letter-spacing:.14em;text-transform:uppercase;color:var(--sw-ink-soft);transition:opacity .3s;}
  .sw-hint i{width:22px;height:34px;border-radius:12px;border:2px solid color-mix(in srgb,var(--sw-ink) 28%,transparent);position:relative;}
  .sw-hint i::after{content:"";position:absolute;left:50%;top:7px;width:4px;height:7px;border-radius:2px;background:var(--sw-accent);transform:translateX(-50%);animation:sw-wheel 1.7s ease-in-out infinite;}
  @keyframes sw-wheel{0%{opacity:0;top:6px}40%{opacity:1}100%{opacity:0;top:17px}}
  .sw-track{position:relative;z-index:1;width:100%;pointer-events:none;}
  @media (max-width:860px){
    .sw-copylayer::before{width:100%;height:60%;top:auto;bottom:0;background:linear-gradient(0deg,var(--sw-bg) 8%,color-mix(in srgb,var(--sw-bg) 70%,transparent) 46%,transparent 100%);}
    .sw-copy{left:clamp(18px,5vw,64px);right:clamp(18px,5vw,64px);top:auto;bottom:clamp(64px,14vh,120px);transform:none;width:auto;max-width:560px;}
    .sw-copy{bottom:calc(clamp(56px,12dvh,110px) + env(safe-area-inset-bottom));}
    .sw-copy__title{font-size:clamp(1.9rem,7.5vw,2.6rem);}
    .sw-copy__body{max-width:none;font-size:clamp(.98rem,3.6vw,1.1rem);}
    .sw-scene__video,.sw-scene__still{object-position:center 46%;}
    .sw-hint{bottom:calc(20px + env(safe-area-inset-bottom));}
    .sw-route{gap:16px;right:6px;}
    .sw-route__label{display:none;}
  }
  @media (max-width:860px) and (orientation:portrait){
    .sw-scene__video,.sw-scene__still{object-position:center 44%;}
  }
  @media (hover:none) and (pointer:coarse){
    .sw-route{padding:14px 6px;}
    .sw-route__dot{width:28px;height:28px;}
    .sw-btn{padding:15px 26px;}
  }
  @media (prefers-reduced-motion:reduce){ .sw-hint i::after{animation:none;} .sw-pt{display:none;} }
  `;
  const style = document.createElement("style");
  style.id = "sw-css";
  // The cascade layer keeps these defaults beneath the route's unlayered
  // theme overrides, so Homa tokens win without specificity hacks.
  style.textContent = `@layer sw {\n${css}\n}`;
  document.head.appendChild(style);
  return style;
}
