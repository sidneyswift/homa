import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("./calendar-view.tsx", import.meta.url), "utf8");

/**
 * Drag-to-reschedule (issue #176) has no mountable unit test: it lives in
 * window pointer listeners plus React state, and calendar-view.tsx is not
 * straightforwardly mountable (same reason and convention as
 * chat-client-session-fork.test.ts). It was verified by hand in a browser
 * once, which is exactly the kind of coverage that rots the next time
 * somebody restructures the wiring, so the load-bearing structure gets
 * pinned here.
 *
 * The specific bug being guarded against: attaching the listeners from a
 * useEffect keyed on drag state subscribes only AFTER React commits,
 * which silently drops the first pointermove of every drag. They must be
 * attached synchronously by the block's own pointerdown instead.
 */
describe("calendar drag wiring (issue #176)", () => {
  it("attaches the pointer listeners inside beginDrag, not from an effect", () => {
    const beginDrag = source.slice(
      source.indexOf("function beginDrag("),
      source.indexOf("async function deleteDetailsEvent("),
    );
    assert.ok(beginDrag.length > 0, "beginDrag should exist");
    for (const event of ["pointermove", "pointerup", "pointercancel"]) {
      assert.match(
        beginDrag,
        new RegExp(`window\\.addEventListener\\("${event}"`, "u"),
        `${event} must be subscribed inside beginDrag`,
      );
    }
  });

  it("never re-subscribes the drag listeners from an effect keyed on drag state", () => {
    // The regression shape: `useEffect(... , [drag, ...])` around the
    // listener attach. Any effect that mentions drag must not add them.
    const effects = source.match(/useEffect\(\(\)[\s\S]*?\}, \[[^\]]*\]\);/gu) ?? [];
    for (const effect of effects) {
      if (!/\bdrag\b/u.test(effect)) continue;
      assert.doesNotMatch(
        effect,
        /addEventListener\("pointer/u,
        "drag listeners must not be attached from a drag-keyed effect",
      );
    }
  });

  it("detaches on pointerup and on unmount, so no listener outlives a drag", () => {
    assert.match(source, /function detach\(\)/u, "a detach helper should exist");
    assert.match(
      source,
      /async function onPointerUp\(\) \{\s*detach\(\);/u,
      "pointerup must detach first",
    );
    assert.match(
      source,
      /useEffect\(\(\) => \(\) => detachDragRef\.current\?\.\(\), \[\]\)/u,
      "unmount must detach a drag still in flight",
    );
  });

  it("keeps the tap-versus-drag threshold, so a plain tap still opens details", () => {
    assert.match(source, /Math\.abs\(deltaY\) > 4/u);
    assert.match(source, /suppressClickRef\.current = true/u);
  });

  it("drives the block's pointerdown through beginDrag with the block's own origin", () => {
    assert.match(source, /onPointerDown=\{\(pointerEvent\) => \{[\s\S]*?beginDrag\(\{/u);
    assert.match(source, /pointerStartY: pointerEvent\.clientY/u);
  });
});

/**
 * A failed drag write must be VISIBLE (issue #256): composerError only
 * renders inside the details and composer dialogs, and both are closed
 * by the time a drag ends, so an error parked there left the block
 * snapping back with no explanation. The failure now lands in its own
 * dragError state, rendered as a notice right above the grid.
 */
describe("drag failure visibility (issue #256)", () => {
  it("parks a failed drag write in dragError, never the closed dialogs' composerError", () => {
    const onPointerUp = source.slice(
      source.indexOf("async function onPointerUp("),
      source.indexOf("function detach()"),
    );
    assert.ok(onPointerUp.length > 0, "onPointerUp should exist");
    assert.match(onPointerUp, /setDragError\(result\.error\)/u);
    assert.doesNotMatch(onPointerUp, /setComposerError/u);
  });

  it("renders the drag error as a live notice near the grid", () => {
    const notice = source.slice(
      source.indexOf("{dragError ? ("),
      source.indexOf("{dragError ? (") + 900,
    );
    assert.ok(notice.length > 0, "the dragError notice should exist");
    assert.match(notice, /role="status"/u, "the notice must announce itself");
    assert.match(notice, /\{dragError\}/u, "the notice must show the action's own error");
    assert.match(notice, /Dismiss/u, "the notice must be dismissable");
  });

  it("clears the previous drag error when a new drag starts", () => {
    const beginDrag = source.slice(
      source.indexOf("function beginDrag("),
      source.indexOf("function onPointerMove("),
    );
    assert.match(beginDrag, /setDragError\(null\)/u);
  });

  it("styles the notice from existing danger tokens, inventing no colors", () => {
    const notice = source.slice(
      source.indexOf("{dragError ? ("),
      source.indexOf("{dragError ? (") + 900,
    );
    assert.match(notice, /var\(--danger\)/u);
    assert.match(notice, /var\(--danger-soft\)/u);
  });
});

/**
 * calendar-view.tsx once styled tone-less text with `var(--ink,
 * inherit)`, a token defined nowhere in the design system (issue #256).
 * The real token for text on the pastel family stripe is --text-strong.
 */
describe("design tokens (issue #256)", () => {
  it("never references the phantom --ink token", () => {
    assert.doesNotMatch(source, /var\(--ink/u);
  });
});

/**
 * The chips and the floating view-context switcher were two "who am I
 * viewing" systems that could disagree (the switcher said "whole family"
 * while a kid chip was active). One source of truth now.
 */
describe("calendar view-context coherence (issue #176)", () => {
  it("routes both chip handlers through selectKid", () => {
    assert.match(source, /onClick=\{\(\) => selectKid\(null\)\}/u);
    assert.match(source, /onClick=\{\(\) => selectKid\(active \? null : kid\.id\)\}/u);
  });

  it("selectKid writes the shared view-context, not just local state", () => {
    const selectKid = source.slice(
      source.indexOf("function selectKid("),
      source.indexOf("function selectKid(") + 400,
    );
    assert.match(selectKid, /setSelectedKidId\(kidId\)/u);
    assert.match(selectKid, /setViewContextAction\(kidId \?\? VIEW_CONTEXT_FAMILY\)/u);
  });
});
