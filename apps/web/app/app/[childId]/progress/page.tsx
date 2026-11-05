import type { Metadata } from "next";
import { ChildProgressContent } from "./progress-content";

export const metadata: Metadata = { title: "Progress", robots: { index: false } };
export default function ChildProgressPage(props: { params: Promise<{ childId: string }>; searchParams: Promise<{ subject?: string }> }) {
  return <ChildProgressContent {...props} />;
}
