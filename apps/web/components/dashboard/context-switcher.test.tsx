import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SOURCE = readFileSync(new URL("./context-switcher.tsx", import.meta.url), "utf8");
const PRIMITIVES = readFileSync(
  new URL("../design/quiet-primitives.css", import.meta.url),
  "utf8",
);

describe("Quiet context selector contract", () => {
  it("keeps the server-owned selection path and adds a deterministic fixture seam", () => {
    assert.match(SOURCE, /setViewContextAction\(target\)/u);
    assert.match(SOURCE, /onSelect\?: ViewContextPickHandler/u);
    assert.match(SOURCE, /kidSwitchTargetPath\(pathname, target\)/u);
  });

  it("publishes the phone sheet lifecycle and both detents", () => {
    assert.match(SOURCE, /data-context-selection="sheet"/u);
    assert.match(SOURCE, /data-context-mode="sheet"/u);
    assert.match(SOURCE, /data-detent=\{detent\}/u);
    assert.match(SOURCE, /__homaContextSheet/u);
    assert.match(SOURCE, /window\.history\.back\(\)/u);
    assert.match(SOURCE, /onPopState/u);
    assert.match(SOURCE, /surfaceState.*closing/u);
    assert.match(SOURCE, /CONTEXT_SURFACE_EXIT_MS/u);
    assert.match(SOURCE, /data-closing=/u);
    assert.match(SOURCE, /setPointerCapture/u);
    assert.match(SOURCE, /delta > 48/u);
    assert.match(SOURCE, /delta < -48/u);
    assert.match(SOURCE, /aria-modal="true"/u);
    assert.match(SOURCE, /triggerRef\.current/u);
  });

  it("keeps sheet geometry bounded, safe-area aware, and motion-reduced", () => {
    assert.match(PRIMITIVES, /\.quiet-context-selection\[data-detent="expanded"\]/u);
    assert.match(PRIMITIVES, /@starting-style \{ \.quiet-context-selection/u);
    assert.match(PRIMITIVES, /\.quiet-context-selection\[data-closing="true"\]/u);
    assert.match(PRIMITIVES, /env\(safe-area-inset-bottom\)/u);
    assert.match(PRIMITIVES, /overscroll-behavior: contain/u);
    assert.match(PRIMITIVES, /\.quiet-context-selection__grabber\s*\{/u);
    assert.match(PRIMITIVES, /@media \(min-width: 64rem\)[\s\S]*\.quiet-context-selection/u);
    assert.match(PRIMITIVES, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.quiet-context-selection/u);
  });

  it("is mounted by the rendered authenticated composition fixture", () => {
    const fixture = readFileSync(
      new URL("../../app/design/quiet-authority/authenticated-context-fixture.tsx", import.meta.url),
      "utf8",
    );
    assert.match(fixture, /data-brand-fixture="quiet-authenticated-context-v1"/u);
    assert.match(fixture, /<ContextSwitcher/u);
    assert.match(fixture, /<Workspace layout="stage-context"/u);
    assert.match(fixture, /<VoiceSafeSlot/u);
  });

  it("portals the phone sheet out of the sticky mobile bar", () => {
    // quiet-shell__mobile-bar (the sheet's DOM ancestor) is position:
    // sticky, which Chromium treats as a containing block for position:
    // fixed descendants: left inline, the sheet resolved its fixed
    // offsets against the ~55px header instead of the viewport and
    // rendered almost entirely off-screen above it (gh#1015
    // live-verification session, 2026-08-27). document.body is the only
    // safe portal target since quiet-context-selection's CSS assumes a
    // true-viewport containing block.
    assert.match(SOURCE, /import \{ createPortal \} from "react-dom"/u);
    assert.match(
      SOURCE,
      /open && isPhone \? createPortal\(\s*<>\s*<div\s*\n\s*className="quiet-context-selection__scrim"/u,
    );
    assert.match(SOURCE, /<\/>,\s*\n\s*document\.body,\s*\n\s*\) : null\}/u);
  });
});
