"use client";

import { createContext, useContext } from "react";

/** Optional presentation adapter. Existing app routes retain their original behavior. */
export const WorkspaceSurfaceContext = createContext<{
  askHoma(text: string): void;
  childName?(childId: string): string | undefined;
  openProgress(childId: string): void;
} | null>(null);
export const useWorkspaceSurface = () => useContext(WorkspaceSurfaceContext);
