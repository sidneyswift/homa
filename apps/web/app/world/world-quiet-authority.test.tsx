import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";

import { WorldClient } from "./world-client";
import { WORLD_CONFIG } from "./world-config";

test("the world route enters through the Quiet contract", () => {
  const html = renderToStaticMarkup(<WorldClient />);

  assert.match(html, /data-brand-era="quiet-authority-v1"/u);
  assert.match(html, /data-brand-surface="world"/u);
  assert.match(html, /quiet-action quiet-action--primary/u);
  assert.match(html, /aria-label="Homa home"/u);
  assert.match(html, /var\(--homa-canvas\)/u);
  assert.doesNotMatch(html, /#FBF7F0|#221E1A|var\(--brand|border-radius: 999px/u);
});

test("world accents use semantic Quiet state roles", () => {
  assert.deepEqual(WORLD_CONFIG.sections.map(({ accent }) => accent), [
    "var(--homa-brand-text)",
    "var(--homa-constructive-ink)",
    "var(--homa-info-ink)",
    "var(--homa-midnight-action)",
    "var(--homa-highlight-ink)",
    "var(--homa-visual-coral)",
  ]);
});

test("scroll-world actions and motion have Quiet fallbacks", () => {
  const source = readFileSync(new URL("./scroll-world-engine.ts", import.meta.url), "utf8");
  assert.match(source, /quiet-action--primary/u);
  assert.match(source, /prefers-reduced-motion:reduce/u);
  assert.match(source, /var\(--homa-motion-fast\)/u);
  assert.doesNotMatch(source, /#FBF7F0|#221E1A|border-radius:999px|font-mono/u);
});
