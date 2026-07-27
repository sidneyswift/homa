import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  selectParentVisibleMaterialRevisions,
  type MaterialRevisionCandidate,
} from "./parent-visible";

const source = readFileSync(
  new URL("../../agent/tools/create_printable.ts", import.meta.url),
  "utf8",
);

/**
 * 2026-07-27, co-founder family 304f0003: "Homa is lagging i have asked
 * her about things multiple times and it doesnt show up in our chat."
 *
 * She asked for the same packet edit five times and a Spanish version
 * three times. Every build passed its quality check, and Homa said "It's
 * ready" and "Right there above" each time. She was looking at the
 * 13:00Z version the whole afternoon.
 *
 * Cause: promotion to 'final' was a separate mark_material_final call the
 * model had to remember. It fired once in her entire day, at 13:39Z, and
 * only because she said her binder was empty. Six later passing builds
 * stayed 'draft', and a draft is invisible in both parent surfaces: the
 * binder is pinned to status 'final' (app/app/binder/page.tsx), and
 * selectParentVisibleMaterialRevisions gives a chain's final an
 * unconditional win, so the reload path (chat-history-model.ts) kept
 * serving the older kept row and discarding every newer draft.
 *
 * These are structural checks on the wiring (create_printable renders
 * PDFs and uploads blobs, so it is not straightforwardly unit-mountable;
 * same convention as chat-client-session-fork.test.ts) plus one pure test
 * pinning the masking behaviour that makes deterministic promotion
 * load-bearing rather than a nice-to-have.
 */
describe("create_printable auto-finalize (2026-07-27 invisible-edits report)", () => {
  it("promotes a passing build in code rather than leaving it to the model", () => {
    assert.match(source, /if \(reviewPassed && !trustedLesson\) \{/u);
    assert.match(
      source,
      /access\.mode === "pinned"\s*\?\s*await finalizeMaterialPinned\(/u,
    );
    assert.match(source, /await finalizeMaterialCaller\(/u);
  });

  it("reports the row's real status, so a promoted card is not labelled draft", () => {
    assert.match(source, /status: finalized \? "final" : "draft"/u);
    assert.doesNotMatch(source, /^\s*status: "draft",$/mu);
  });

  it("never claims the card is visible when promotion did not happen", () => {
    // The false claim that produced the report. It may only appear on the
    // finalized branch.
    const visibleClaim = /already visible in chat/u;
    assert.match(source, visibleClaim);
    const finalizedBranch =
      /\? finalized\s*\n\s*\? `The card with the preview and print button is already visible in chat\./u;
    assert.match(source, finalizedBranch);
    assert.match(source, /is NOT the one she sees: promoting it failed/u);
    assert.match(source, /Do NOT tell her it is updated or ready/u);
  });

  it("skips lesson-linked chains, which finalize only via the lesson Keep action", () => {
    assert.match(source, /reviewPassed && !trustedLesson/u);
  });

  it("stops telling the model to finalize a row that is already final", () => {
    assert.match(
      source,
      /: finalized\s*\n\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*\? `\$\{deliveryNote\}\$\{reviewNote\}`/u,
    );
  });
});

describe("why deterministic promotion is load-bearing", () => {
  function revision(
    id: string,
    revisesId: string | null,
    status: MaterialRevisionCandidate["status"],
    order: number,
  ): MaterialRevisionCandidate {
    return { id, revisesId, status, reviewPass: true, order };
  }

  it("masks every newer passing draft behind an older final (her exact chain)", () => {
    // Her real rows: 56b99d51 went final at 13:00Z, then four passing
    // drafts revised it at 13:43, 13:50, 13:53 and 16:14. She saw the
    // 13:00 one every time she reloaded.
    const selected = selectParentVisibleMaterialRevisions([
      revision("kept-1300", null, "final", 1),
      revision("draft-1343", "kept-1300", "draft", 2),
      revision("draft-1350", "kept-1300", "draft", 3),
      revision("draft-1353", "draft-1350", "draft", 4),
      revision("draft-1614", "kept-1300", "draft", 5),
    ]);

    assert.deepEqual(
      selected.map((row) => row.id),
      ["kept-1300"],
      "a stale final still wins its chain, which is exactly why a passing "
        + "build has to become final in code and not on the model's initiative",
    );
  });

  it("serves the newest kept row once promotion is deterministic", () => {
    const selected = selectParentVisibleMaterialRevisions([
      revision("kept-1300", null, "superseded", 1),
      revision("kept-1614", "kept-1300", "final", 5),
    ]);

    assert.deepEqual(
      selected.map((row) => row.id),
      ["kept-1614"],
    );
  });
});
