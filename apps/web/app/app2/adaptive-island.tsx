"use client";

import { motion as contract } from "@homa/design/motion";
import { MotionConfig, motion, type HTMLMotionProps } from "motion/react";
import { useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from "react";

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
  view: string;
  placement?: Placement | "auto";
  regionRef?: RefObject<HTMLElement | null>;
}

/** Presentation only. Activity state, editable drafts and audio ownership stay with the caller. */
export function AdaptiveIsland({ children, size, view, placement = "auto", regionRef, className, ...props }: AdaptiveIslandProps) {
  const host = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLFormElement>(null);
  const previousPlacement = useRef<Placement | undefined>(undefined);
  const [geometry, setGeometry] = useState({ placement: "center" as Placement, offsetX: 0, offsetY: 0, maxWidth: 780, shellMaxWidth: 780, shellMaxHeight: 10000, maxHeight: 10000 });
  const reducedMotion = useLiveReducedMotion();
  const [dimensions, setDimensions] = useState({ width: 214, height: 62, minimumWidth: 0 });

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
      const content = form.querySelector<HTMLElement>('[data-active="true"]');
      const css = getComputedStyle(form);
      const insetX = parseFloat(css.paddingLeft) + parseFloat(css.paddingRight) + parseFloat(css.borderLeftWidth) + parseFloat(css.borderRightWidth);
      const insetY = parseFloat(css.paddingTop) + parseFloat(css.paddingBottom) + parseFloat(css.borderTopWidth) + parseFloat(css.borderBottomWidth);
      const targetWidth = size === "fill" ? anchor.width : (content?.offsetWidth ?? 196) + insetX;
      const targetHeight = (content?.offsetHeight ?? 44) + insetY;
      // Measure natural content, never the spring's intermediate shell dimensions.
      const bounds = {
        left: Math.max(regionBounds?.left ?? viewportLeft, viewportLeft),
        top: Math.max(regionBounds?.top ?? viewportTop, viewportTop),
        right: Math.min(regionBounds?.right ?? viewportRight, viewportRight),
        bottom: Math.min(regionBounds?.bottom ?? viewportBottom, viewportBottom),
      };
      const fitted = fitIsland({
        x: anchor.left + anchor.width / 2, y: anchor.top + anchor.height * origin,
        width: targetWidth, height: targetHeight, origin, bounds,
      });
      // Overshoot may use only the room around the fitted anchor, never cross a region edge.
      const centerX = anchor.left + anchor.width / 2 + fitted.offsetX;
      const originY = anchor.top + anchor.height * origin + fitted.offsetY;
      const shellMaxWidth = Math.max(0, 2 * Math.min(centerX - bounds.left, bounds.right - centerX));
      const shellMaxHeight = Math.max(0, origin === 0 ? bounds.bottom - originY : origin === 1 ? originY - bounds.top : 2 * Math.min(originY - bounds.top, bounds.bottom - originY));
      const nextDimensions = { width: Math.min(targetWidth, anchor.width, fitted.maxWidth), height: Math.min(targetHeight, fitted.maxHeight) };
      setDimensions(current => current.width === nextDimensions.width && current.height === nextDimensions.height ? current : {
        ...nextDimensions,
        // Keep the smaller endpoint as a floor: expansion can spring, contraction cannot crush controls.
        minimumWidth: Math.min(form.getBoundingClientRect().width, nextDimensions.width),
      });
      const next = { ...fitted, shellMaxWidth, shellMaxHeight, maxWidth: Math.min(anchor.width, fitted.maxWidth), placement: resolved };
      setGeometry(current => Object.keys(next).every(key => current[key as keyof typeof next] === next[key as keyof typeof next]) ? current : next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    observer.observe(form);
    form.querySelectorAll<HTMLElement>("[data-active]").forEach(view => observer.observe(view));
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
  }, [placement, regionRef, size, view]);

  const resolved = geometry.placement;
  const origin = resolved === "top" ? 0 : resolved === "bottom" ? 1 : 0.5;

  return (
    <div ref={host} className={styles.host} data-island-placement={resolved}>
      {/* The live subscription and CSS own reduced motion, including hydration and preference changes. */}
      <MotionConfig reducedMotion="never" transition={{
        duration: reducedMotion ? 0 : contract.durations.base / 1000,
        ease,
        width: reducedMotion ? { duration: 0 } : islandSpring,
        height: reducedMotion ? { duration: 0 } : islandSpring,
      }}>

          <motion.form
            {...props}
            ref={surface}
            initial={false}
            animate={{ width: dimensions.width, height: dimensions.height }}
            className={`${styles.surface} ${className ?? ""}`}
            style={{
              ...props.style,
              "--island-max-width": `${geometry.maxWidth}px`,
              "--island-target-width": `${dimensions.width}px`,
              "--island-target-height": `${dimensions.height}px`,
              minWidth: Math.min(dimensions.minimumWidth, geometry.shellMaxWidth),
              maxWidth: geometry.shellMaxWidth,
              maxHeight: geometry.shellMaxHeight,
              left: `calc(50% + ${geometry.offsetX}px)`,
              top: `calc(${origin * 100}% + ${geometry.offsetY}px)`,
              "--island-y": `${-origin * 100}%`,
              x: "-50%",
              y: `${-origin * 100}%`,
              originX: 0.5,
              originY: origin,
              // Only the shell dimensions spring; text and icons are never scaled.
              borderRadius: 999,
              boxShadow: "0 8px 24px rgba(32, 36, 43, 0.08)",
            } as CSSProperties}
          >
            {children}
          </motion.form>

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
  const [visible, setVisible] = useState(active);
  const reducedMotion = useLiveReducedMotion();

  useLayoutEffect(() => {
    const element = view.current;
    if (!element || !active) return;
    setVisible(true);
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
      initial={false}
      animate={{ opacity: active ? 1 : 0 }}
      transition={{ opacity: { duration: reducedMotion ? 0 : active ? 0.18 : 0.08, delay: reducedMotion || !active ? 0 : 0.09 } }}
      onAnimationComplete={() => { if (!active) setVisible(false); }}
      data-active={active}
      data-visible={active || visible}
      aria-hidden={!active}
      inert={!active}
      className={`${styles.view} ${className ?? ""}`}
    >
      {children}
    </motion.div>
  );
}
