import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";

import { WorldRealClient } from "./world-real-client";
import { WORLD_REAL_CONFIG } from "./world-config";

test("the real-world route enters through the Quiet contract", () => {
  const html = renderToStaticMarkup(<WorldRealClient />);

  assert.match(html, /data-brand-era="quiet-authority-v1"/u);
  assert.match(html, /data-brand-surface="world-real"/u);
  assert.match(html, /quiet-action quiet-action--primary/u);
  assert.match(html, /aria-label="Homa home"/u);
  assert.match(html, /var\(--homa-midnight-action\)/u);
  assert.doesNotMatch(html, /#FBF7F0|#221E1A|var\(--brand|border-radius: 999px/u);
});

test("the real-world accents use semantic Quiet state roles", () => {
  assert.deepEqual(WORLD_REAL_CONFIG.sections.map(({ accent }) => accent), [
    "var(--homa-brand-text)",
    "var(--homa-constructive-ink)",
    "var(--homa-info-ink)",
    "var(--homa-midnight-action)",
    "var(--homa-highlight-ink)",
    "var(--homa-visual-coral)",
  ]);
});
