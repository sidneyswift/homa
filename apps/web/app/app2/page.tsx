import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { getPaidAppShellData } from "../../lib/app-data";
import { VoiceWorkspacePreview } from "./voice-workspace-preview";

export const metadata: Metadata = {
  title: "App2 design preview",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#FFFFFF" };

export default async function App2Page() {
  // #1158: a local design surface until the product behavior is designed.
  if (process.env.NODE_ENV !== "development") notFound();
  const app = await getPaidAppShellData();
  return <VoiceWorkspacePreview family={app ? {
    id: app.family.id,
    timeZone: app.family.time_zone ?? "America/New_York",
    children: app.children.map(child => ({ id: child.id, name: child.name })),
  } : null} />;
}
