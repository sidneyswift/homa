import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import {
  buildShelf,
  classifyOrigin,
  classifyShelfStatus,
  countShelf,
  coverLiveryKey,
  coverPathForRecord,
  dateFromRecordId,
  needsWork,
  parseLibraryRecord,
  parseLibraryShelfRecords,
  recordIdFromBlobPath,
  SHELF_STATUS_BLURB,
  SHELF_STATUS_LABEL,
  SHELF_STATUS_ORDER,
  SHELF_STATUS_TODO,
  subjectAccent,
  type BlobOriginal,
} from "./library-shelf";

/**
 * The library shelf's pure layer (/admin/library, founder ask
 * 2026-07-31). The corpus fixtures at the bottom run against the real
 * .cosmo documents, because the whole point of this surface is that the
 * analysis JSONs have no schema: a rule that only holds for a
 * hand-written fixture proves nothing about the 195 real ones.
 */

describe("classifyOrigin", () => {
  it("reads the atlas scrape droppers as scrapes", () => {
    assert.equal(classifyOrigin("cosmo-atlas-scrape"), "scrape");
    assert.equal(classifyOrigin("atlas-scrape"), "scrape");
  });

  it("treats every founder as a real Slack drop", () => {
    for (const dropper of ["sid", "aless", "carolyng", "Sidney"]) {
      assert.equal(classifyOrigin(dropper), "slack");
    }
  });
});

describe("classifyShelfStatus", () => {
  it("calls bytes without analysis unread, whatever the origin", () => {
    assert.equal(classifyShelfStatus("slack", false, true), "unread");
    assert.equal(classifyShelfStatus("scrape", false, true), "unread");
  });

  it("calls analysis plus bytes complete", () => {
    assert.equal(classifyShelfStatus("slack", true, true), "complete");
  });

  it("separates a lost Slack original from a scrape that never had one", () => {
    assert.equal(classifyShelfStatus("slack", true, false), "original-lost");
    assert.equal(classifyShelfStatus("scrape", true, false), "analysis-only");
  });

  it("shows a requested missing original as waiting while letting a full recovery win", () => {
    assert.equal(classifyShelfStatus("slack", true, false, "requested"), "awaiting-source");
    assert.equal(classifyShelfStatus("slack", true, true, "requested"), "complete");
  });

  it("keeps a partial original waiting when source completeness requests more bytes", () => {
    assert.equal(
      classifyShelfStatus("slack", true, true, null, "requested"),
      "awaiting-source",
    );
    assert.equal(
      classifyShelfStatus("slack", true, true, null, "awaiting-source"),
      "awaiting-source",
    );
  });
});

describe("needsWork", () => {
  it("leaves complete and externally waiting records non-actionable", () => {
    assert.equal(needsWork("complete"), false);
    assert.equal(needsWork("unread"), true);
    assert.equal(needsWork("original-lost"), true);
    assert.equal(needsWork("analysis-only"), true);
    assert.equal(needsWork("awaiting-source"), false);
  });

  it("labels the externally waiting shelf in plain language", () => {
    assert.equal(SHELF_STATUS_LABEL["awaiting-source"], "Re-share requested");
    assert.match(SHELF_STATUS_BLURB["awaiting-source"], /already been requested/i);
  });

  it("gives every actionable status a to-do a person can act on", () => {
    for (const status of SHELF_STATUS_ORDER) {
      const todo = SHELF_STATUS_TODO[status];
      if (status === "complete" || status === "awaiting-source") assert.equal(todo, null);
      else assert.ok(todo && todo.length > 8, `${status} needs a real to-do`);
    }
  });
});

describe("recordIdFromBlobPath", () => {
  it("pulls the record id out of inspo/<id>/<file>", () => {
    assert.equal(
      recordIdFromBlobPath("inspo/ref-2026-07-20-outdoor-toddler-activity-book/book.pdf"),
      "ref-2026-07-20-outdoor-toddler-activity-book",
    );
  });

  it("ignores anything that is not a two-deep inspo path", () => {
    assert.equal(recordIdFromBlobPath("inspo/loose-file.pdf"), null);
    assert.equal(recordIdFromBlobPath("materials/family/x.pdf"), null);
    assert.equal(recordIdFromBlobPath(""), null);
  });

  it("round-trips with the cover path", () => {
    assert.equal(coverPathForRecord("ref-a"), "inspo-covers/ref-a.jpg");
  });
});

describe("dateFromRecordId", () => {
  it("recovers the drop date an unread record has no JSON for", () => {
    assert.equal(dateFromRecordId("ref-2026-07-18-worm-unit-study"), "2026-07-18T00:00:00Z");
  });

  it("returns null when the id carries no date", () => {
    assert.equal(dateFromRecordId("loose-record"), null);
  });
});

describe("subjectAccent", () => {
  it("gives each subject a stable cloth colour", () => {
    assert.equal(subjectAccent("math"), "clay");
    assert.equal(subjectAccent("science"), "sage");
    assert.equal(subjectAccent("Social Studies"), "gold");
  });

  it("falls back to stone rather than throwing on an unknown subject", () => {
    assert.equal(subjectAccent("underwater basket weaving"), "stone");
    assert.equal(subjectAccent(null), "stone");
    assert.equal(subjectAccent(""), "stone");
  });

  it("gives one publisher one colour when the subject is unknown", () => {
    // The 102 scraped records carry no subject, and a hundred identical
    // dark rectangles is a wall, not a shelf.
    const oak = subjectAccent(null, "Oak Meadow");
    assert.equal(subjectAccent(null, "Oak Meadow"), oak, "colour must not change per render");
    assert.equal(subjectAccent("", "  oak meadow  "), oak, "case and padding must not matter");
    assert.notEqual(subjectAccent(null, "Beast Academy"), oak);
  });

  it("still lets a known subject win over the publisher", () => {
    assert.equal(subjectAccent("science", "Oak Meadow"), "sage");
  });
});

describe("coverLiveryKey", () => {
  const book = (over: Partial<{ publisher: string | null; series: string | null; title: string }>) => ({
    publisher: null,
    series: null,
    title: "",
    ...over,
  });

  it("prefers publisher, then series", () => {
    assert.equal(coverLiveryKey(book({ publisher: "Oak Meadow", series: "S", title: "T" })), "Oak Meadow");
    assert.equal(coverLiveryKey(book({ series: "Beast Academy", title: "T" })), "Beast Academy");
  });

  it("falls back to the title's leading words, which carry the publisher", () => {
    // 69 scraped records have neither field, but every title leads with
    // the publisher's name.
    assert.equal(
      coverLiveryKey(book({ title: "Oak Meadow 1 Beginning Recorder Sample Lesson 2020" })),
      "Oak Meadow",
    );
    assert.equal(coverLiveryKey(book({ title: "Beast Academy 3A Angle Mazes" })), "Beast Academy");
  });

  it("gives one livery per publisher across their whole catalogue", () => {
    const one = subjectAccent(null, coverLiveryKey(book({ title: "Oak Meadow 1 Recorder" })));
    const two = subjectAccent(null, coverLiveryKey(book({ title: "Oak Meadow Algebra 2 Coursebook" })));
    assert.equal(one, two);
    assert.notEqual(subjectAccent(null, coverLiveryKey(book({ title: "Beast Academy 4A" }))), one);
  });
});

describe("parseLibraryRecord", () => {
  it("requires only an id, and shows the rest as gaps", () => {
    const parsed = parseLibraryRecord({ id: "ref-x" }, "reference");
    assert.ok(parsed);
    assert.equal(parsed.id, "ref-x");
    assert.equal(parsed.title, "ref-x");
    assert.equal(parsed.publisher, null);
    assert.equal(parsed.droppedBy, "unknown");
  });

  it("rejects a document with no id", () => {
    assert.equal(parseLibraryRecord({ title: "no id" }, "reference"), null);
    assert.equal(parseLibraryRecord(null, "reference"), null);
    assert.equal(parseLibraryRecord("string", "reference"), null);
  });

  it("finds the subject wherever the writer happened to put it", () => {
    assert.equal(parseLibraryRecord({ id: "a", subject: "math" }, "reference")?.subject, "math");
    assert.equal(
      parseLibraryRecord({ id: "b", skillTargeting: { subject: "ela" } }, "reference")?.subject,
      "ela",
    );
    assert.equal(
      parseLibraryRecord({ id: "c", overallSkillTargeting: { subject: "science" } }, "reference")
        ?.subject,
      "science",
    );
  });

  it("keeps non-shelf analysis for reconciliation, then excludes it from the shelf", () => {
    const catalog = {
      id: "ref-catalog-summary",
      libraryVisibility: "catalog-only",
      sourceUrl: "https://example.com/catalog",
    };
    const duplicate = {
      id: "ref-stale-analysis",
      libraryVisibility: "analysis-only",
      duplicateOf: "ref-real-file",
    };
    const realFile = { id: "ref-real-file" };

    assert.equal(parseLibraryRecord(catalog, "reference")?.id, catalog.id);
    assert.equal(parseLibraryRecord(duplicate, "reference")?.id, duplicate.id);
    const records = parseLibraryShelfRecords([catalog, duplicate, realFile], "reference");
    assert.deepEqual(records.map((record) => record.id), [catalog.id, duplicate.id, realFile.id]);
    assert.deepEqual(buildShelf(records, [], new Map()).map((record) => record.id), [realFile.id]);
  });
});

describe("buildShelf", () => {
  const blobUrl = (recordId: string, name: string) =>
    `https://pkvvudjdhxk33dig.public.blob.vercel-storage.com/inspo/${recordId}/${encodeURIComponent(name)}`;
  const original = (
    recordId: string,
    size: number,
    name = "f.pdf",
    url = blobUrl(recordId, name),
  ): BlobOriginal => ({ recordId, url, name, size });

  it("synthesises an unread book for bytes with no analysis", () => {
    const shelf = buildShelf([], [original("ref-2026-07-30-mystery", 1000, "Scan 7.pdf")], new Map());
    assert.equal(shelf.length, 1);
    assert.equal(shelf[0].status, "unread");
    assert.equal(shelf[0].analysis, null);
    // The filename is the only title we have, minus its extension.
    assert.equal(shelf[0].title, "Scan 7");
    assert.equal(shelf[0].droppedAt, "2026-07-30T00:00:00Z");
  });

  it("picks the largest file as the cover source and counts the rest", () => {
    const records = [parseLibraryRecord({ id: "ref-a", droppedBy: "aless" }, "reference")];
    const shelf = buildShelf(
      records,
      [original("ref-a", 100, "part2.pdf"), original("ref-a", 900, "part1.pdf")],
      new Map(),
    );
    assert.equal(shelf[0].originalName, "part1.pdf");
    assert.equal(shelf[0].extraFileCount, 1);
    assert.equal(shelf[0].status, "complete");
  });

  it("does not double-count a record that has both analysis and bytes", () => {
    const records = [parseLibraryRecord({ id: "ref-a", droppedBy: "sid" }, "reference")];
    const shelf = buildShelf(records, [original("ref-a", 10)], new Map());
    assert.equal(shelf.length, 1);
  });

  it("attaches a cover only when one was generated", () => {
    const records = [parseLibraryRecord({ id: "ref-a", droppedBy: "sid" }, "reference")];
    const covers = new Map([["ref-a", "https://blob/inspo-covers/ref-a.jpg"]]);
    assert.equal(buildShelf(records, [], covers)[0].coverUrl, covers.get("ref-a"));
    assert.equal(buildShelf(records, [], new Map())[0].coverUrl, null);
  });

  it("puts a requested missing original on its own waiting shelf", () => {
    const records = [
      parseLibraryRecord(
        {
          id: "ref-waiting",
          droppedBy: "aless",
          originalRecovery: { status: "requested" },
        },
        "reference",
      ),
    ];

    const shelf = buildShelf(records, [], new Map());
    assert.equal(shelf[0].status, "awaiting-source");
    assert.equal(needsWork(shelf[0].status), false);
  });

  it("keeps retained partial bytes on the waiting shelf", () => {
    const records = [
      parseLibraryRecord(
        {
          id: "cur-partial",
          droppedBy: "carolyng",
          sourceCompleteness: { status: "awaiting-source" },
        },
        "curriculum",
      ),
    ];

    const shelf = buildShelf(records, [original("cur-partial", 10)], new Map());
    assert.equal(shelf[0].status, "awaiting-source");
    assert.equal(shelf[0].originalFiles.length, 1);
    assert.equal(needsWork(shelf[0].status), false);
  });

  it("matches a drop- prefixed upload to its ref- analysis", () => {
    // Five real uploads landed under drop- instead of ref-/cur-, and
    // one disagrees with its analysis about the date by a day. An exact
    // join reports the same book twice, as unread bytes and as a lost
    // original, and both halves are wrong.
    const records = [
      parseLibraryRecord({ id: "ref-2026-07-21-one-potato", droppedBy: "aless" }, "reference"),
    ];
    const shelf = buildShelf(
      records,
      [original("drop-2026-07-20-one-potato", 500, "potato.pdf")],
      new Map([["drop-2026-07-20-one-potato", "https://blob/cover.jpg"]]),
    );
    assert.equal(shelf.length, 1, "the book was double-counted");
    assert.equal(shelf[0].status, "complete");
    assert.equal(shelf[0].originalName, "potato.pdf");
    assert.equal(shelf[0].coverUrl, "https://blob/cover.jpg", "cover is keyed by the Blob dir");
  });

  it("refuses an ambiguous slug match rather than merging the wrong books", () => {
    // The corpus genuinely holds two five-paragraph-essay-outline
    // references from different days. Guessing between them would be a
    // silent data error, so neither may claim the orphan bytes.
    const records = [
      parseLibraryRecord({ id: "ref-2026-07-12-essay-outline", droppedBy: "sid" }, "reference"),
      parseLibraryRecord({ id: "ref-2026-07-16-essay-outline", droppedBy: "sid" }, "reference"),
    ];
    const shelf = buildShelf(records, [original("drop-2026-07-14-essay-outline", 500)], new Map());
    assert.equal(shelf.length, 3, "the ambiguous pair should stay unmatched and visible");
    assert.equal(shelf.filter((b) => b.status === "unread").length, 1);
    assert.equal(shelf.filter((b) => b.status === "original-lost").length, 2);
  });

  it("leaves a genuinely orphaned upload unread", () => {
    const records = [parseLibraryRecord({ id: "ref-2026-07-21-alpha" }, "reference")];
    const shelf = buildShelf(records, [original("drop-2026-07-21-beta", 100)], new Map());
    assert.equal(shelf.length, 2);
    assert.equal(shelf.find((b) => b.id === "drop-2026-07-21-beta")?.status, "unread");
  });

  it("collapses the same file uploaded under two directories", () => {
    // Five real files sit in Blob twice, once under the record id and
    // once under a drop- directory, identical name and size. Counted
    // separately they read as material nobody analysed, and a founder
    // would go re-ingest a book that is already done.
    const records = [
      parseLibraryRecord({ id: "cur-2026-07-21-artists", droppedBy: "aless" }, "curriculum"),
    ];
    const shelf = buildShelf(
      records,
      [
        original("cur-2026-07-21-artists", 109_000_000, "artists.pdf"),
        original("drop-2026-07-21-artists", 109_000_000, "artists.pdf"),
      ],
      new Map(),
    );
    assert.equal(shelf.length, 1, "the duplicate upload became a phantom book");
    assert.equal(shelf[0].status, "complete");
    assert.equal(shelf[0].extraFileCount, 0, "a duplicate is not an extra part");
  });

  it("keeps two genuinely different files under one record as parts", () => {
    const records = [parseLibraryRecord({ id: "cur-a", droppedBy: "aless" }, "curriculum")];
    const shelf = buildShelf(
      records,
      [original("cur-a", 500, "front.pdf"), original("cur-a", 400, "back.pdf")],
      new Map(),
    );
    assert.equal(shelf[0].extraFileCount, 1);
  });

  it("counts every unique multipart original while keeping the primary file size", () => {
    const records = [parseLibraryRecord({ id: "cur-a", droppedBy: "aless" }, "curriculum")];
    const back = original("cur-a", 400, "back.pdf");
    const shelf = buildShelf(
      records,
      [original("cur-a", 500, "front.pdf"), back, { ...back }],
      new Map(),
    );

    assert.equal(shelf[0].originalBytes, 500, "the detail view still reports the primary file");
    assert.equal(countShelf(shelf).originalBytes, 900, "the shelf aggregate includes both parts");
    assert.equal(
      shelf[0].totalOriginalBytes,
      900,
      "the book retains its complete unique-file byte total",
    );
    assert.deepEqual(
      shelf[0].originalFiles.map((file) => file.url),
      [blobUrl("cur-a", "front.pdf"), blobUrl("cur-a", "back.pdf")],
      "the detail model retains both exact links, primary first",
    );
  });

  it("does not fold suffix-shaped directories without exact provenance", () => {
    const records = [
      parseLibraryRecord({ id: "cur-2026-07-19-harcourt-science", droppedBy: "aless" }, "curriculum"),
    ];
    const shelf = buildShelf(
      records,
      [
        original("cur-2026-07-19-harcourt-science-pt1", 84_000_000, "pt1.pdf"),
        original("cur-2026-07-19-harcourt-science-pt2", 61_000_000, "pt2.pdf"),
      ],
      new Map(),
    );
    assert.equal(shelf.length, 3);
    assert.equal(
      shelf.find((book) => book.id === "cur-2026-07-19-harcourt-science")?.status,
      "original-lost",
    );
    assert.equal(shelf.filter((book) => book.status === "unread").length, 2);
  });

  it("folds exact source URLs that equal live objects on Homa's pinned Blob host", () => {
    const first = original("cur-2026-07-19-hwt-pt1", 1_000, "handwriting-pt1.pdf");
    const second = original("cur-2026-07-19-hwt-pt2", 900, "handwriting-pt2.pdf");
    const records = [
      parseLibraryRecord(
        {
          id: "cur-2026-07-19-handwriting-without-tears",
          droppedBy: "aless",
          sourceFiles: [
            { blobUrl: first.url },
            { blobUrl: second.url },
          ],
        },
        "curriculum",
      ),
    ];
    const shelf = buildShelf(records, [first, second], new Map());

    assert.equal(shelf.length, 1);
    assert.equal(shelf[0].status, "complete");
    assert.deepEqual(shelf[0].originalFiles, [
      { url: first.url, name: first.name, size: first.size },
      { url: second.url, name: second.name, size: second.size },
    ]);
  });

  it("rejects an exact foreign-host lookalike provenance URL", () => {
    const part = original(
      "cur-a-pt1",
      500,
      "part.pdf",
      "https://pkvvudjdhxk33dig.public.blob.vercel-storage.com.evil.example/inspo/cur-a-pt1/part.pdf",
    );
    const records = [
      parseLibraryRecord(
        { id: "cur-a", sourceFiles: [{ blobUrl: part.url }] },
        "curriculum",
      ),
    ];

    const shelf = buildShelf(records, [part], new Map());
    assert.equal(shelf.length, 2);
    assert.equal(shelf.find((book) => book.id === "cur-a")?.status, "original-lost");
    assert.equal(shelf.find((book) => book.id === "cur-a-pt1")?.status, "unread");
  });

  it("rejects a pinned-host provenance URL absent from the live listing", () => {
    const listed = original("cur-a-pt1", 500, "listed.pdf");
    const claimedUrl = blobUrl("cur-a-pt1", "claimed-but-not-listed.pdf");
    const records = [
      parseLibraryRecord(
        { id: "cur-a", sourceFiles: [{ blobUrl: claimedUrl }] },
        "curriculum",
      ),
    ];

    const shelf = buildShelf(records, [listed], new Map());
    assert.equal(shelf.length, 2);
    assert.equal(shelf.find((book) => book.id === "cur-a")?.status, "original-lost");
    assert.equal(shelf.find((book) => book.id === "cur-a-pt1")?.status, "unread");
  });

  it("inherits a real cover from the leading part of a multipart curriculum", () => {
    const canonicalId = "cur-2026-07-20-blossom-root-level0";
    const leadingPartId = `${canonicalId}-la-notebook`;
    const leading = original(leadingPartId, 500, "language-arts-notebook.pdf");
    const math = original(`${canonicalId}-math-notebook`, 900, "math-notebook.pdf");
    const records = [
      parseLibraryRecord(
        {
          id: canonicalId,
          droppedBy: "aless",
          sourceFiles: [{ blobUrl: leading.url }, { blobUrl: math.url }],
        },
        "curriculum",
      ),
    ];
    const coverUrl = "https://blob.vercel-storage.com/inspo-covers/blossom-la-notebook.jpg";
    const shelf = buildShelf(
      records,
      [leading, math],
      new Map([[leadingPartId, coverUrl]]),
    );

    assert.equal(shelf.length, 1);
    assert.equal(shelf[0].status, "complete");
    assert.equal(shelf[0].coverUrl, coverUrl);
  });

  it("does not resurrect a hidden analysis Blob as an unread book", () => {
    const records = parseLibraryShelfRecords(
      [{
        id: "ref-hidden",
        droppedBy: "atlas",
        libraryVisibility: "analysis-only",
      }],
      "reference",
    );
    const shelf = buildShelf(records, [original("ref-hidden", 500)], new Map());

    assert.deepEqual(shelf, []);
  });

  it("does not infer ownership from the longest matching record prefix", () => {
    const records = [
      parseLibraryRecord({ id: "cur-a", droppedBy: "x" }, "curriculum"),
      parseLibraryRecord({ id: "cur-a-level0", droppedBy: "x" }, "curriculum"),
    ];
    const shelf = buildShelf(records, [original("cur-a-level0-notebook", 10)], new Map());
    assert.equal(shelf.find((b) => b.id === "cur-a-level0")?.status, "original-lost");
    assert.equal(shelf.find((b) => b.id === "cur-a")?.status, "original-lost");
    assert.equal(shelf.find((b) => b.id === "cur-a-level0-notebook")?.status, "unread");
  });

  it("sorts newest drop first", () => {
    const records = [
      parseLibraryRecord({ id: "ref-old", droppedAt: "2026-07-01T00:00:00Z" }, "reference"),
      parseLibraryRecord({ id: "ref-new", droppedAt: "2026-07-29T00:00:00Z" }, "reference"),
    ];
    assert.deepEqual(
      buildShelf(records, [], new Map()).map((b) => b.id),
      ["ref-new", "ref-old"],
    );
  });
});

describe("countShelf", () => {
  it("counts needsWork as everything that is not complete", () => {
    const records = [
      parseLibraryRecord({ id: "ref-a", droppedBy: "sid" }, "reference"),
      parseLibraryRecord({ id: "ref-b", droppedBy: "sid" }, "reference"),
      parseLibraryRecord({ id: "ref-c", droppedBy: "cosmo-atlas-scrape" }, "reference"),
      parseLibraryRecord(
        {
          id: "ref-d",
          droppedBy: "aless",
          originalRecovery: { status: "requested" },
        },
        "reference",
      ),
    ];
    const counts = countShelf(
      buildShelf(records, [{ recordId: "ref-a", url: "u", name: "n.pdf", size: 500 }], new Map()),
    );
    assert.equal(counts.total, 4);
    assert.equal(counts.byStatus.complete, 1);
    assert.equal(counts.byStatus["original-lost"], 1);
    assert.equal(counts.byStatus["analysis-only"], 1);
    assert.equal(counts.byStatus["awaiting-source"], 1);
    assert.equal(counts.needsWork, 2);
    assert.equal(counts.originalBytes, 500);
  });
});

/**
 * The real corpus. These are the cases a hand-written fixture cannot
 * reach: every document was written by a model following the ingestion
 * skill, so the shape varies per drop and the parser has to survive all
 * of it.
 */
describe("the real .cosmo corpus", () => {
  const requestedRecoveryIds = [
    "ref-2026-07-18-ab-pattern-worksheets",
    "ref-2026-07-18-beginning-sounds-worksheets",
    "ref-2026-07-18-beginning-sounds-worksheets-2",
    "ref-2026-07-18-christmas-tree-playdough-counting",
    "ref-2026-07-18-compound-word-puzzles",
    "ref-2026-07-18-compound-words-playdough-mats",
    "ref-2026-07-18-file-folder-presidents-money-match",
    "ref-2026-07-18-hair-salon-scissor-cutting",
    "ref-2026-07-18-health-human-body-unit",
    "ref-2026-07-18-hole-punch-fine-motor",
    "ref-2026-07-18-i-have-who-has-compound-words",
    "ref-2026-07-18-layers-of-earth-labeling",
    "ref-2026-07-18-numbers-0-10-counting-ordering",
    "ref-2026-07-18-phoneme-substitution-cards",
    "ref-2026-07-18-phonics-letter-sounds-cvc",
    "ref-2026-07-18-snowball-fight-compound-word-game",
    "ref-2026-07-18-solar-system-activity-packet",
    "ref-2026-07-18-solar-system-cut-paste",
    "ref-2026-07-18-solar-system-worksheets-prek",
    "ref-2026-07-18-spanish-minibook-numeros-colores",
    "ref-2026-07-18-volcano-labelling-worksheet",
    "ref-2026-07-18-volcanoes-vocab-cards-test",
    "ref-2026-07-18-winter-activities-centers-crafts",
    "ref-2026-07-18-winter-animal-tracks-montessori",
    "ref-2026-07-18-winter-patterns-cut-paste",
    "ref-2026-07-19-listen-and-color-spring",
    "ref-2026-07-19-presidents-day-coloring-pages",
    "ref-2026-07-19-volcanoes-and-lava-workbook",
  ].sort();

  function cosmoDir(): string | null {
    for (const candidate of [
      path.join(process.cwd(), ".cosmo"),
      path.join(process.cwd(), "..", "..", ".cosmo"),
    ]) {
      if (existsSync(candidate)) return candidate;
    }
    return null;
  }

  async function loadAll(dir: string, prefix: string) {
    const names = (await readdir(dir)).filter(
      (name) => name.startsWith(prefix) && name.endsWith(".json"),
    );
    const docs: { name: string; doc: unknown }[] = [];
    for (const name of names) {
      docs.push({ name, doc: JSON.parse(await readFile(path.join(dir, name), "utf8")) });
    }
    return docs;
  }

  it("parses every reference and curriculum without throwing or dropping one", async (t) => {
    const root = cosmoDir();
    if (!root) return t.skip("no .cosmo corpus on this checkout");

    const refs = await loadAll(path.join(root, "references"), "ref-");
    const curs = await loadAll(path.join(root, "curriculums"), "cur-");
    assert.ok(refs.length > 100, "expected the real reference corpus");

    for (const { name, doc } of refs) {
      const parsed = parseLibraryRecord(doc, "reference");
      assert.ok(parsed, `${name} failed to parse`);
      assert.ok(parsed.title.trim().length > 0, `${name} produced an empty title`);
      assert.ok(["slack", "scrape"].includes(parsed.origin));
    }
    for (const { name, doc } of curs) {
      const parsed = parseLibraryRecord(doc, "curriculum");
      assert.ok(parsed, `${name} failed to parse`);
      assert.ok(parsed.title.trim().length > 0, `${name} produced an empty title`);
    }
  });

  it("keeps catalog summaries and analysis-only provenance out of the real file shelf", async (t) => {
    const root = cosmoDir();
    if (!root) return t.skip("no .cosmo corpus on this checkout");

    const refs = await loadAll(path.join(root, "references"), "ref-");
    const curs = await loadAll(path.join(root, "curriculums"), "cur-");
    const catalogIds = refs
      .filter(
        ({ doc }) =>
          doc !== null &&
          typeof doc === "object" &&
          (doc as Record<string, unknown>).libraryVisibility === "catalog-only",
      )
      .map(({ doc }) => (doc as Record<string, unknown>).id)
      .sort();
    assert.deepEqual(catalogIds, [
      "ref-2026-07-13-beast-academy-printables",
      "ref-2026-07-13-bookshark-samples",
      "ref-2026-07-13-dimensions-math-samples",
      "ref-2026-07-13-oak-meadow-samples",
    ]);

    const analysisOnlyIds = [...refs, ...curs]
      .filter(
        ({ doc }) =>
          doc !== null &&
          typeof doc === "object" &&
          (doc as Record<string, unknown>).libraryVisibility === "analysis-only",
      )
      .map(({ doc }) => (doc as Record<string, unknown>).id)
      .sort();
    assert.deepEqual(analysisOnlyIds, [
      "cur-2026-07-18-harcourt-trophies-2nd",
      "ref-2026-07-12-five-paragraph-essay-outline",
      "ref-2026-07-12-pemdas-foldable",
    ]);

    const records = [
      ...parseLibraryShelfRecords(
        refs.map(({ doc }) => doc),
        "reference",
      ),
      ...parseLibraryShelfRecords(
        curs.map(({ doc }) => doc),
        "curriculum",
      ),
    ];
    const shelf = buildShelf(records, [], new Map());
    const counts = countShelf(shelf);

    assert.equal(
      counts.total,
      refs.length + curs.length - catalogIds.length - analysisOnlyIds.length,
    );
    assert.equal(counts.byStatus["awaiting-source"], 31);
    const summed = SHELF_STATUS_ORDER.reduce((sum, s) => sum + counts.byStatus[s], 0);
    assert.equal(summed, counts.total, "a book fell outside every shelf section");
  });

  it("records the exact TPT re-share request receipt on all 28 affected analyses", async (t) => {
    const root = cosmoDir();
    if (!root) return t.skip("no .cosmo corpus on this checkout");

    const refs = await loadAll(path.join(root, "references"), "ref-");
    const requested = refs
      .filter(({ doc }) => {
        if (!doc || typeof doc !== "object") return false;
        const recovery = (doc as Record<string, unknown>).originalRecovery;
        return (
          recovery !== null &&
          typeof recovery === "object" &&
          (recovery as Record<string, unknown>).status === "requested"
        );
      })
      .map(({ doc }) => doc as Record<string, unknown>);

    const tptRequested = requested.filter((doc) => requestedRecoveryIds.includes(String(doc.id)));
    assert.deepEqual(
      tptRequested.map((doc) => doc.id).sort(),
      requestedRecoveryIds,
    );
    for (const doc of tptRequested) {
      assert.deepEqual(doc.originalRecovery, {
        status: "requested",
        requestChannel: "C0BHQDC033M",
        requestTs: "1785640462.608219",
        requestedFrom: "Alessa",
        reason: "expired private TPT URL",
      });
    }

    const peaceful = requested.find(
      (doc) => doc.id === "ref-2026-07-18-peaceful-press-playful-pioneers-coop",
    );
    assert.ok(peaceful);
    assert.deepEqual(peaceful.originalRecovery, {
      status: "requested",
      requestChannel: "C0BHQDC033M",
      requestTs: "1785644411.819469",
      requestMode:
        "top-level replacement because the historical source timestamp is not a valid Slack thread",
      supersedesUnverifiableRequestTs: "1785640773.308319",
      requestedFrom: "Alessa",
      reason:
        "The official product is free but its file is delivered only through checkout and email. No Homa inbox was authorized for that checkout, so Alessa was asked in a verified new channel thread to attach the original or identify the approved inbox.",
    });
    assert.equal(requested.length, 29);
  });

  it("keeps duplicate and shared-source provenance pointed at canonical records", async (t) => {
    const root = cosmoDir();
    if (!root) return t.skip("no .cosmo corpus on this checkout");

    const refs = await loadAll(path.join(root, "references"), "ref-");
    const curs = await loadAll(path.join(root, "curriculums"), "cur-");
    const documents = [...refs, ...curs].map(({ doc }) => doc as Record<string, unknown>);
    const byId = new Map<string, Record<string, unknown>>();
    for (const doc of documents) {
      if (typeof doc.id === "string") byId.set(doc.id, doc);
    }
    const duplicateTargets = new Map<string, string>([
      [
        "ref-2026-07-12-five-paragraph-essay-outline",
        "ref-2026-07-16-five-paragraph-essay-outline",
      ],
      ["ref-2026-07-12-pemdas-foldable", "ref-2026-07-16-pemdas-foldable"],
    ]);

    for (const [duplicateId, canonicalId] of duplicateTargets) {
      const duplicate = byId.get(duplicateId);
      assert.ok(duplicate, `${duplicateId} is missing`);
      assert.equal(duplicate.libraryVisibility, "analysis-only");
      assert.equal(duplicate.duplicateOf, canonicalId);
      assert.ok(byId.has(canonicalId), `${canonicalId} is missing`);
    }

    const harcourt = byId.get("cur-2026-07-18-harcourt-trophies-2nd");
    const sharedId = "ref-2026-07-18-harcourt-trophies-2nd-lesson-planner";
    const shared = byId.get(sharedId);
    assert.ok(harcourt);
    assert.ok(shared);
    assert.equal(harcourt.libraryVisibility, "analysis-only");
    assert.equal(harcourt.sharedSourceRecordId, sharedId);
    assert.deepEqual(harcourt.sourceFiles, shared.sourceFiles);
  });
});
