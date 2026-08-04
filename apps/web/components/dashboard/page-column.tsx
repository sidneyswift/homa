import type { ReactNode } from "react";

import { WorkStage } from "../design/WorkStage";
import { Workspace } from "../design/Workspace";

/**
 * The scrolling content column inside the app frame: the padding and
 * centered max-width that used to live on the shell's <main>. Pages own
 * it now so chat can skip it and fill the viewport edge to edge.
 */
export function PageColumn({ children }: { children: ReactNode }) {
  return (
    <Workspace className="quiet-workspace--page">
      <WorkStage as="div" className="quiet-work-stage--page">
        <div className="quiet-workspace__content">{children}</div>
      </WorkStage>
    </Workspace>
  );
}
