import type { ReactNode } from "react";

/**
 * The scrolling content column inside the app frame: the padding and
 * centered max-width that used to live on the shell's <main>. Pages own
 * it now so chat can skip it and fill the viewport edge to edge.
 */
export function PageColumn({ children }: { children: ReactNode }) {
  return (
    <div className="px-5 py-7 lg:px-10 lg:py-8">
      <div className="mx-auto w-full max-w-[1040px]">{children}</div>
    </div>
  );
}
