import type { Metadata } from "next";
import { BinderContent } from "./binder-content";

export const metadata: Metadata = { title: "Binder", robots: { index: false } };
export default function BinderPage(props: { searchParams: Promise<{ source?: string | string[] }> }) {
  return <BinderContent {...props} />;
}
