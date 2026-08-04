import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ContextPanel } from "./ContextPanel";
import { PageHeader } from "./PageHeader";
import { ToolShelf } from "./ToolShelf";
import { VoiceSafeSlot } from "./VoiceSafeSlot";
import { WorkStage } from "./WorkStage";
import { Workspace } from "./Workspace";

const PRIMITIVES_CSS = readFileSync(
  new URL("./quiet-primitives.css", import.meta.url),
  "utf8",
);

describe("Quiet composition contracts", () => {
  it("keeps orientation, stage, context, local tools, and Voice slots semantic", () => {
    const html = renderToStaticMarkup(
      <Workspace layout="stage-context">
        <WorkStage labelledBy="heading">
          <PageHeader heading="Planner" headingId="heading" description="A useful week." />
        </WorkStage>
        <ContextPanel mode="overlay" labelledBy="heading">
          <p>Selected plan</p>
        </ContextPanel>
        <ToolShelf label="Planner views">
          <a href="/app/planner">Day</a>
        </ToolShelf>
        <VoiceSafeSlot>
          <button type="button">Listen</button>
        </VoiceSafeSlot>
      </Workspace>,
    );

    assert.match(html, /data-workspace-layout="stage-context"/u);
    assert.match(html, /data-page-header=""/u);
    assert.match(html, /<h1 id="heading"[^>]*>Planner<\/h1>/u);
    assert.match(html, /data-work-stage=""/u);
    assert.match(html, /data-context-panel="" data-context-mode="overlay"/u);
    assert.match(html, /<nav aria-label="Planner views"[^>]*data-tool-shelf=""/u);
    assert.match(html, /role="region" aria-label="Voice controls"[^>]*data-voice-safe-slot=""/u);
  });

  it("defines docked, overlay, phone detent, and Voice-safe geometry", () => {
    assert.match(PRIMITIVES_CSS, /grid-template-columns: minmax\(0, 1fr\) minmax\(300px, 360px\)/u);
    assert.match(PRIMITIVES_CSS, /quiet-context-panel--overlay/gu);
    assert.match(PRIMITIVES_CSS, /quiet-context-sheet\[data-detent="resting"\]/u);
    assert.match(PRIMITIVES_CSS, /quiet-context-sheet\[data-detent="expanded"\]/u);
    assert.match(PRIMITIVES_CSS, /quiet-voice-safe-slot--bottom/gu);
    assert.match(PRIMITIVES_CSS, /prefers-reduced-motion: reduce/gu);
  });
});
