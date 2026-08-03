import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { QuietChoice } from "./QuietChoice";
import { QuietFeedback } from "./QuietFeedback";
import { QuietField } from "./QuietField";
import { QuietIdentity } from "./QuietIdentity";
import { QuietMedia } from "./QuietMedia";

const PRIMITIVES_CSS = readFileSync(new URL("./quiet-primitives.css", import.meta.url), "utf8");

test("QuietField keeps the native control and connects label, hint, and error", () => {
  const html = renderToStaticMarkup(
    <QuietField
      id="parent-name"
      label="What should Homa call you?"
      hint="Use the name you like to see in your plan."
      error="Please add a name."
      required
      disabled
      readOnly
    >
      <input type="text" aria-describedby="existing-help" />
    </QuietField>,
  );

  assert.match(html, /<label[^>]+for="parent-name"/u);
  assert.match(html, /class="quiet-field__control"/u);
  assert.match(html, /id="parent-name"/u);
  assert.match(html, /aria-describedby="existing-help parent-name-hint parent-name-error"/u);
  assert.match(html, /aria-errormessage="parent-name-error"/u);
  assert.match(html, /aria-invalid="true"/u);
  assert.match(html, /disabled=""/u);
  assert.match(html, /readOnly=""/u);
  assert.match(html, /id="parent-name-error"[^>]+role="alert"/u);
  assert.match(html, /data-state="error"/u);
});

test("QuietChoice renders a native group with selected and disabled options", () => {
  const html = renderToStaticMarkup(
    <QuietChoice
      name="pace"
      label="What feels right this week?"
      value="steady"
      required
      hint="You can change this later."
      error="Choose one pace to continue."
      onChange={() => {}}
      options={[{ value: "steady", label: "A steady week" }]}
    >
    </QuietChoice>,
  );
  assert.match(html, /<fieldset[^>]+class="quiet-choice"/u);
  assert.match(html, /<legend[^>]*><span>What feels right this week\?<\/span><span[^>]+>\*<\/span>/u);
  assert.match(html, /aria-describedby="pace-hint pace-error"/u);
  assert.match(html, /aria-invalid="true"/u);

  const optionsHtml = renderToStaticMarkup(
    <QuietChoice
      name="pace"
      label="What feels right this week?"
      value="steady"
      options={[
        { value: "steady", label: "A steady week", description: "Enough structure, room to breathe." },
        { value: "light", label: "A lighter week", disabled: true },
      ]}
      onChange={() => {}}
    />,
  );
  assert.match(optionsHtml, /type="radio"/u);
  assert.match(optionsHtml, /checked=""[^>]+value="steady"/u);
  assert.match(optionsHtml, /data-selected="true"/u);
  assert.match(optionsHtml, /disabled=""[^>]+value="light"/u);
  assert.match(optionsHtml, /data-disabled="true"/u);
  assert.match(optionsHtml, /A steady week/u);
});

test("QuietFeedback exposes a truthful live region by semantic tone", () => {
  const html = renderToStaticMarkup(
    <QuietFeedback tone="error" title="Your work is safe." busy>
      We could not save this change yet.
    </QuietFeedback>,
  );
  assert.match(html, /class="quiet-feedback quiet-feedback--error"/u);
  assert.match(html, /data-tone="error"/u);
  assert.match(html, /role="alert"/u);
  assert.match(html, /aria-live="assertive"/u);
  assert.match(html, /aria-busy="true"/u);
  assert.match(html, /Your work is safe\./u);
});

test("Quiet identity delegates to the canonical Logo adapter", () => {
  const html = renderToStaticMarkup(<QuietIdentity variant="mark" size={32} />);
  assert.match(html, /data-identity="homa"/u);
  assert.match(html, /role="img" aria-label="Homa"/u);
  assert.match(html, /viewBox="0 0 48 48"/u);
});

test("Quiet media preserves alt text and a stable loading slot", () => {
  const ready = renderToStaticMarkup(
    <QuietMedia src="/artifact.png" alt="A fractions worksheet" caption="Maya's practice" />,
  );
  assert.match(ready, /<figure[^>]+data-kind="artifact"[^>]+data-state="ready"/u);
  assert.match(ready, /<img[^>]+src="\/artifact\.png"[^>]+alt="A fractions worksheet"/u);
  assert.match(ready, /Maya&#x27;s practice/u);

  const loading = renderToStaticMarkup(<QuietMedia alt="A worksheet preview" />);
  assert.match(loading, /data-state="loading"/u);
  assert.match(loading, /class="quiet-media__placeholder"/u);
  assert.match(loading, /role="img" aria-label="A worksheet preview"/u);
  assert.match(loading, /aria-busy="true"/u);
});

test("Quiet foundation CSS has the required state and quality-mode hooks", () => {
  for (const selector of [
    ".quiet-field__control:focus-visible",
    ".quiet-field__control:disabled",
    ".quiet-field__control[readonly]",
    ".quiet-field[data-state=\"error\"]",
    ".quiet-field[data-state=\"success\"]",
    ".quiet-field[data-state=\"loading\"]",
    ".quiet-choice__option[data-selected=\"true\"]",
    ".quiet-choice[data-state=\"success\"]",
    ".quiet-choice__option[data-disabled=\"true\"]",
    ".quiet-feedback--error",
    ".quiet-media__placeholder",
    "@media (forced-colors: active)",
    "@media (prefers-contrast: more)",
    "@media (prefers-reduced-motion: reduce)",
  ]) {
    assert.ok(PRIMITIVES_CSS.includes(selector), `missing ${selector}`);
  }
  assert.match(PRIMITIVES_CSS, /min-height:\s*44px/u);
  assert.match(PRIMITIVES_CSS, /var\(--homa-control-boundary\)/u);
  assert.match(PRIMITIVES_CSS, /var\(--homa-motion-fast\)/u);
});

test("new foundation primitives do not introduce retired visual vocabulary", () => {
  const sourceFiles = [
    "QuietChoice.tsx",
    "QuietFeedback.tsx",
    "QuietField.tsx",
    "QuietIdentity.tsx",
    "QuietMedia.tsx",
    "quiet-primitives.css",
  ];
  for (const file of sourceFiles) {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /font-hand|rounded-pill|bg-brand|\bclay\b|\bsage\b|\bstone\b/u, file);
  }
});
