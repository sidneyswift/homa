"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useWorkspaceSurface } from "./surface-context";

/** Primary child navigation stays beside chat; secondary legacy flows preserve this tab. */
export function WorkspaceLink(props: ComponentProps<typeof Link>) {
  const workspace = useWorkspaceSurface();
  if (!workspace || typeof props.href !== "string") return <Link {...props} />;
  const progress = /^\/app\/([^/?]+)\/progress$/.exec(props.href);
  if (progress) return <Link {...props} href="#" onClick={event => { event.preventDefault(); workspace.openProgress(progress[1]); }} />;
  if (props.href === "/app") return <Link {...props} href="#" onClick={event => { event.preventDefault(); workspace.askHoma("Help me make something for our family."); }} />;
  return <Link {...props} target="_blank" rel="noreferrer">{props.children}<span className="sr-only"> (opens in a new tab)</span></Link>;
}
