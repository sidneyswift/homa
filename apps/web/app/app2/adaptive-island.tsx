"use client";

import { motion as contract } from "@homa/design/motion";
import { LayoutGroup, MotionConfig, motion, type HTMLMotionProps } from "motion/react";
import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from "react";

import { fitIsland, resolveIslandPlacement, type IslandPlacement as Placement } from "./island-geometry";
import styles from "./adaptive-island.module.css";

const ease = contract.easeOut.match(/[\d.]+/g)!.map(Number) as [number, number, number, number];
// #1158: founder-requested slower spring experiment, scoped to the local island.
const islandSpring = { type: "spring", stiffness: 180, damping: 25, mass: 1.6 } as const;
const reducedQuery = "(prefers-reduced-motion: reduce)";
function subscribeToReducedMotion(notify: () => void) {
  const media = window.matchMedia(reducedQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}
function useLiveReducedMotion() {
  return useSyncExternalStore(subscribeToReducedMotion, () => window.matchMedia(reducedQuery).matches, () => true);
}

interface AdaptiveIslandProps extends HTMLMotionProps<"form"> {
  size: "content" | "fill";
  placement?: Placement | "auto";
  regionRef?: RefObject<HTMLElement | null>;
}

/** Presentation only. Activity state, editable drafts and audio ownership stay with the caller. */
export function AdaptiveIsland({ children, size, placement = "auto", regionRef, className, ...props }: AdaptiveIslandProps) {
  const host = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLFormElement>(null);
  const previousPlacement = useRef<Placement | undefined>(undefined);
  const [geometry, setGeometry] = useState({ placement: "center" as Placement, offsetX: 0, offsetY: 0, maxWidth: 780, maxHeight: 10000 });
  const reducedMotion = useLiveReducedMotion();
  const groupId = useId();

  useLayoutEffect(() => {
    const element = host.current;
    const form = surface.current;
    if (!element || !form) return;
    const region = regionRef?.current;
    const update = () => {
      const anchor = element.getBoundingClientRect();
      const regionBounds = region?.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportRight = viewportLeft + (viewport?.width ?? document.documentElement.clientWidth);
      const viewportBottom = viewportTop + (viewport?.height ?? document.documentElement.clientHeight);
      const resolved = placement === "auto" ? resolveIslandPlacement(
        anchor.top + anchor.height / 2, regionBounds?.top ?? 0,
        regionBounds?.height ?? document.documentElement.clientHeight, previousPlacement.current,
      ) : placement;
      previousPlacement.current = resolved;
      const origin = resolved === "top" ? 0 : resolved === "bottom" ? 1 : 0.5;
      // Keyboard changes affect available space, not which edge of this host is anchored.
      const fitted = fitIsland({
        x: anchor.left + anchor.width / 2, y: anchor.top + anchor.height * origin,
        width: form.offsetWidth, height: form.offsetHeight, origin,
        bounds: {
          left: Math.max(regionBounds?.left ?? viewportLeft, viewportLeft),
          top: Math.max(regionBounds?.top ?? viewportTop, viewportTop),
          right: Math.min(regionBounds?.right ?? viewportRight, viewportRight),
          bottom: Math.min(regionBounds?.bottom ?? viewportBottom, viewportBottom),
        },
      });
      const next = { ...fitted, maxWidth: Math.min(anchor.width, fitted.maxWidth), placement: resolved };
      setGeometry(current => Object.keys(next).every(key => current[key as keyof typeof next] === next[key as keyof typeof next]) ? current : next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    observer.observe(form);
    if (region) observer.observe(region);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [placement, regionRef, size]);

  const resolved = geometry.placement;
  const origin = resolved === "top" ? 0 : resolved === "bottom" ? 1 : 0.5;

  return (
    <div ref={host} className={styles.host} data-island-placement={resolved}>
      {/* The live subscription and CSS own reduced motion, including hydration and preference changes. */}
      <MotionConfig reducedMotion="never" transition={{
        duration: reducedMotion ? 0 : contract.durations.base / 1000,
        ease,
        layout: reducedMotion ? { duration: 0 } : islandSpring,
      }}>
        <LayoutGroup id={groupId}>
          <motion.form
            {...props}
            ref={surface}
            layoutScroll
            layout
            initial={false}
            className={`${styles.surface} ${className ?? ""}`}
            style={{
              ...props.style,
              width: size === "fill" ? "100%" : "max-content",
              maxWidth: geometry.maxWidth,
              maxHeight: geometry.maxHeight,
              left: `calc(50% + ${geometry.offsetX}px)`,
              top: `calc(${origin * 100}% + ${geometry.offsetY}px)`,
              "--island-y": `${-origin * 100}%`,
              x: "-50%",
              y: `${-origin * 100}%`,
              originX: 0.5,
              originY: origin,
              // Numeric styles let Motion correct the pill and shadow during transforms.
              borderRadius: 999,
              boxShadow: "0 8px 24px rgba(32, 36, 43, 0.08)",
            } as CSSProperties}
          >
            {children}
          </motion.form>
        </LayoutGroup>
      </MotionConfig>
    </div>
  );
}

/** Keep one live input instance; inactive views can fade but cannot receive focus or clicks. */
export function IslandView({ active, children, className, id }: {
  active: boolean;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const view = useRef<HTMLDivElement>(null);
  const reducedMotion = useLiveReducedMotion();

  useLayoutEffect(() => {
    const element = view.current;
    if (!element || !active) return;
    const rememberWidth = () => {
      // The outgoing view keeps its own width and never contributes to target measurement.
      element.style.setProperty("--island-view-width", `${element.offsetWidth}px`);
    };
    rememberWidth();
    const observer = new ResizeObserver(rememberWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [active]);

  return (
    <motion.div
      ref={view}
      id={id}
      layout="position"
      layoutScroll
      initial={false}
      animate={{ opacity: active ? 1 : 0 }}
      transition={{ opacity: { duration: reducedMotion ? 0 : active ? 0.18 : 0.08, delay: reducedMotion || !active ? 0 : 0.09 } }}
      data-active={active}
      aria-hidden={!active}
      inert={!active}
      className={`${styles.view} ${className ?? ""}`}
    >
      {children}
    </motion.div>
  );
}
