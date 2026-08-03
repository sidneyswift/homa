import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SOURCES = {
  report: readFileSync(new URL("./report-view.tsx", import.meta.url), "utf8"),
  button: readFileSync(new URL("./report-button.ts", import.meta.url), "utf8"),
  nav: readFileSync(new URL("./report-nav.tsx", import.meta.url), "utf8"),
  actions: readFileSync(new URL("./report-actions.tsx", import.meta.url), "utf8"),
  snapshot: readFileSync(new URL("./report-snapshot.tsx", import.meta.url), "utf8"),
  onePager: readFileSync(new URL("./one-pager/page.tsx", import.meta.url), "utf8"),
  evidence: readFileSync(new URL("./evidence/page.tsx", import.meta.url), "utf8"),
};

describe("Quiet report surface contract", () => {
  it("marks the shared renderer and both report contexts", () => {
    assert.match(SOURCES.report, /data-brand-surface="report"/u);
    assert.match(SOURCES.report, /data-brand-context="app"/u);
    assert.match(SOURCES.report, /data-brand-context="standalone"/u);
    assert.match(SOURCES.report, /quiet-report__hero/u);
    assert.match(SOURCES.report, /quiet-report__subjects/u);
    assert.match(SOURCES.report, /quiet-report__footer/u);
  });

  it("keeps report actions and buttons on the shared Quiet contract", () => {
    assert.match(SOURCES.button, /quiet-action--primary/u);
    assert.match(SOURCES.button, /quiet-action--secondary/u);
    assert.match(SOURCES.nav, /data-brand-layer="report-nav"/u);
    assert.match(SOURCES.actions, /data-brand-layer="report-actions"/u);
    assert.match(SOURCES.snapshot, /data-brand-layer="report-snapshot"/u);
  });

  it("marks print-first renditions as Quiet report surfaces", () => {
    assert.match(SOURCES.onePager, /data-brand-surface="report-one-pager"/u);
    assert.match(SOURCES.onePager, /quiet-print-surface/u);
    assert.match(SOURCES.evidence, /data-brand-surface="report-evidence"/u);
    assert.match(SOURCES.evidence, /quiet-print-surface/u);
  });
});
