"use client";

import { useLayoutEffect, type RefObject } from "react";
import { useWorkspaceSurface } from "./surface-context";

/** Hide only the covered workspace controls. The chat composer remains reachable. */
export function useWorkspaceDetail(ref: RefObject<HTMLElement | null>) {
  const embedded = Boolean(useWorkspaceSurface());
  useLayoutEffect(() => {
    const detail = ref.current;
    const scroll = detail?.closest<HTMLElement>("[data-workspace-scroll]");
    if (!embedded || !detail || !scroll) return;
    const previousTop = scroll.scrollTop;
    const covered: { node: HTMLElement; inert: boolean }[] = [];
    let branch: HTMLElement = detail;
    while (branch !== scroll && branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          covered.push({ node: sibling, inert: sibling.inert });
          sibling.setAttribute("inert", "");
        }
      }
      branch = branch.parentElement;
    }
    scroll.scrollTop = 0;
    return () => {
      covered.forEach(({ node, inert }) => { node.toggleAttribute("inert", inert); });
      scroll.scrollTop = previousTop;
    };
  }, [embedded, ref]);
}
