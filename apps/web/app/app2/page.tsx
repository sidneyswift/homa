import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { WorkspacePage } from "./workspace-page";
import { readWorkspaceLocation, workspaceSelectionKey } from "./workspace-location";

export const metadata: Metadata = { title: "App2 design preview", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#FFFFFF" };

export default async function App2Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const selection = readWorkspaceLocation(new URLSearchParams(Object.entries(params).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : [])).toString());
  if (!selection || selection.kind === "planner") return null;
  return <Suspense key={workspaceSelectionKey(selection)} fallback={<p role="status">Loading {selection.kind}…</p>}><WorkspacePage selection={selection} /></Suspense>;
}
