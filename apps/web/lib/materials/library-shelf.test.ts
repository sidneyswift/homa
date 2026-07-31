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
  libraryJoinKey,
  recordIdFromBlobPath,
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
});

describe("needsWork", () => {
  it("marks every status except complete", () => {
    assert.equal(needsWork("complete"), false);
    assert.equal(needsWork("unread"), true);
    assert.equal(needsWork("original-lost"), true);
    assert.equal(needsWork("analysis-only"), true);
  });

  it("gives every actionable status a to-do a person can act on", () => {
    for (const status of SHELF_STATUS_ORDER) {
      const todo = SHELF_STATUS_TODO[status];
      if (status === "complete") assert.equal(todo, null);
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
});

describe("buildShelf", () => {
  const original = (recordId: string, size: number, name = "f.pdf"): BlobOriginal => ({
    recordId,
    url: `https://blob/${recordId}/${name}`,
    name,
    size,
  });

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

  it("folds a suffixed directory into the record it is part of", () => {
    // cur-...-harcourt-science-pt1 is page range one of harcourt-science,
    // not a curriculum of its own.
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
    assert.equal(shelf.length, 1, "scan parts became phantom books");
    assert.equal(shelf[0].status, "complete");
    assert.equal(shelf[0].extraFileCount, 1, "both parts belong to the one record");
    assert.equal(shelf[0].originalName, "pt1.pdf", "largest part leads");
  });

  it("gives a part to the longest matching record, never a shorter neighbour", () => {
    const records = [
      parseLibraryRecord({ id: "cur-a", droppedBy: "x" }, "curriculum"),
      parseLibraryRecord({ id: "cur-a-level0", droppedBy: "x" }, "curriculum"),
    ];
    const shelf = buildShelf(records, [original("cur-a-level0-notebook", 10)], new Map());
    assert.equal(shelf.find((b) => b.id === "cur-a-level0")?.status, "complete");
    assert.equal(shelf.find((b) => b.id === "cur-a")?.status, "original-lost");
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
    ];
    const counts = countShelf(
      buildShelf(records, [{ recordId: "ref-a", url: "u", name: "n.pdf", size: 500 }], new Map()),
    );
    assert.equal(counts.total, 3);
    assert.equal(counts.byStatus.complete, 1);
    assert.equal(counts.byStatus["original-lost"], 1);
    assert.equal(counts.byStatus["analysis-only"], 1);
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

  it("builds a shelf where every book lands in exactly one section", async (t) => {
    const root = cosmoDir();
    if (!root) return t.skip("no .cosmo corpus on this checkout");

    const refs = await loadAll(path.join(root, "references"), "ref-");
    const records = refs.map(({ doc }) => parseLibraryRecord(doc, "reference"));
    const shelf = buildShelf(records, [], new Map());
    const counts = countShelf(shelf);

    assert.equal(counts.total, refs.length);
    const summed = SHELF_STATUS_ORDER.reduce((sum, s) => sum + counts.byStatus[s], 0);
    assert.equal(summed, counts.total, "a book fell outside every shelf section");
  });
});
