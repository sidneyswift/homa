import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";

import { VoiceWorkspacePreview } from "./voice-workspace-preview";

export const metadata: Metadata = {
  title: "App2 design preview",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#FFFFFF" };

export default function App2Page() {
  // #1158: a local design surface until the product behavior is designed.
  if (process.env.NODE_ENV !== "development") notFound();
  return <VoiceWorkspacePreview />;
}
