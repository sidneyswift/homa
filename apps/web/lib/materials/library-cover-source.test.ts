import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  blobEtagsMatch,
  blobPathnamesMatch,
  blobReportedSizeMatches,
  chooseZipPrintableEntry,
  inspectLibraryCoverJpeg,
  isSupportedLibraryCoverSource,
  libraryCoverReceiptMatches,
  parseUnzipList,
  renderLibraryCover,
  renderPptxFirstSlide,
  retryLibraryCoverReadBack,
  selectLibraryCoverSource,
  shouldPreserveLegacyLibraryCover,
} from "./library-cover-source";

describe("blobPathnamesMatch", () => {
  it("accepts Vercel get pathnames whose spaces are URL-encoded", () => {
    assert.equal(
      blobPathnamesMatch(
        "inspo/ref-a/Atmosphere Unit Activities.pdf",
        "inspo/ref-a/Atmosphere%20Unit%20Activities.pdf",
      ),
      true,
    );
  });

  it("rejects malformed or genuinely different read-back paths", () => {
    assert.equal(blobPathnamesMatch("inspo/ref-a/source.pdf", "%E0%A4%A"), false);
    assert.equal(
      blobPathnamesMatch("inspo/ref-a/source.pdf", "inspo/ref-b/source.pdf"),
      false,
    );
  });
});

describe("Blob read-back metadata normalization", () => {
  it("matches weak and strong forms of the same ETag", () => {
    assert.equal(blobEtagsMatch('"abc"', 'W/"abc"'), true);
    assert.equal(blobEtagsMatch('"abc"', '"def"'), false);
    assert.equal(blobEtagsMatch(undefined, undefined), false);
  });

  it("accepts zero as an unavailable reported size but rejects other drift", () => {
    assert.equal(blobReportedSizeMatches(1069, 0), true);
    assert.equal(blobReportedSizeMatches(1069, 1069), true);
    assert.equal(blobReportedSizeMatches(1069, 1068), false);
  });
});

describe("retryLibraryCoverReadBack", () => {
  it("retries transient provider reads with bounded backoff", async () => {
    let calls = 0;
    const waits: number[] = [];
    const value = await retryLibraryCoverReadBack(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("not visible yet");
        return "verified";
      },
      {
        attempts: 4,
        wait: async (milliseconds) => {
          waits.push(milliseconds);
        },
      },
    );
    assert.equal(value, "verified");
    assert.deepEqual(waits, [250, 500]);
  });

  it("fails with the final provider error after exhausting attempts", async () => {
    await assert.rejects(
      retryLibraryCoverReadBack(
        async () => {
          throw new Error("still missing");
        },
        { attempts: 2, wait: async () => undefined },
      ),
      /still missing/,
    );
  });
});

describe("selectLibraryCoverSource", () => {
  const originals = [
    {
      pathname: "inspo/cur-a/volume-2.pdf",
      url: "https://blob.example/cur-a/volume-2.pdf",
      size: 20_000,
    },
    {
      pathname: "inspo/cur-a/volume-1.pdf",
      url: "https://blob.example/cur-a/volume-1.pdf",
      size: 10_000,
    },
    {
      pathname: "inspo/cur-a/source-package.docx",
      url: "https://blob.example/cur-a/source-package.docx",
      size: 100_000,
    },
    {
      pathname: "inspo/cur-b/volume-1.pdf",
      url: "https://blob.example/cur-b/volume-1.pdf",
      size: 30_000,
    },
  ];

  it("selects an exact live URL instead of the largest record object", () => {
    const selected = selectLibraryCoverSource(
      originals,
      "cur-a",
      "https://blob.example/cur-a/volume-1.pdf",
    );

    assert.equal(selected.pathname, "inspo/cur-a/volume-1.pdf");
  });

  it("fails closed when the URL is absent from the live listing", () => {
    assert.throws(
      () =>
        selectLibraryCoverSource(
          originals,
          "cur-a",
          "https://blob.example/cur-a/not-live.pdf",
        ),
      /match exactly one live inspo object/i,
    );
  });

  it("fails closed when the exact URL belongs to another record", () => {
    assert.throws(
      () =>
        selectLibraryCoverSource(
          originals,
          "cur-a",
          "https://blob.example/cur-b/volume-1.pdf",
        ),
      /does not belong to record cur-a/i,
    );
  });

  it("allows a cross-directory part only when committed provenance claims it", () => {
    const sourceUrl = "https://blob.example/cur-b/volume-1.pdf";
    const selected = selectLibraryCoverSource(
      originals,
      "cur-a",
      sourceUrl,
      new Set([sourceUrl]),
    );

    assert.equal(selected.url, sourceUrl);
  });

  it("selects the largest renderable sibling when a larger file is unsupported", () => {
    const selected = selectLibraryCoverSource(originals, "cur-a");

    assert.equal(selected.pathname, "inspo/cur-a/volume-2.pdf");
  });

  it("rejects an explicit source that the cover renderer cannot use", () => {
    assert.throws(
      () =>
        selectLibraryCoverSource(
          originals,
          "cur-a",
          "https://blob.example/cur-a/source-package.docx",
        ),
      /not renderable for record cur-a/i,
    );
  });

  it("fails when a record has live originals but no renderable source", () => {
    assert.throws(
      () =>
        selectLibraryCoverSource(
          [
            {
              pathname: "inspo/cur-notes/source.docx",
              url: "https://blob.example/cur-notes/source.docx",
              size: 100_000,
            },
          ],
          "cur-notes",
        ),
      /no renderable live inspo objects found for record cur-notes/i,
    );
  });
});

describe("library cover receipts", () => {
  const source = {
    pathname: "inspo/ref-a/source.pdf",
    url: "https://blob.example/inspo/ref-a/source.pdf",
    size: 100,
    etag: "source-v1",
  };
  const cover = {
    pathname: "inspo-covers/ref-a.jpg",
    url: "https://blob.example/inspo-covers/ref-a.jpg",
    size: 50,
    etag: "cover-v1",
  };
  const receipt = {
    version: 1 as const,
    recordId: "ref-a",
    source: { ...source, etag: "source-v1" },
    cover: { ...cover, etag: "cover-v1", sha256: "a".repeat(64) },
    renderedFrom: "source.pdf",
  };

  it("binds a cover to the exact live source and cover objects", () => {
    assert.equal(libraryCoverReceiptMatches(receipt, "ref-a", source, cover), true);
    assert.equal(
      libraryCoverReceiptMatches(
        receipt,
        "ref-a",
        { ...source, etag: "source-v2" },
        cover,
      ),
      false,
    );
    assert.equal(
      libraryCoverReceiptMatches(
        receipt,
        "ref-a",
        source,
        { ...cover, etag: "cover-corrupt" },
      ),
      false,
    );
  });

  it("rejects empty or non-JPEG cover bytes", async () => {
    await assert.rejects(inspectLibraryCoverJpeg(Buffer.alloc(0)), /empty/i);
    await assert.rejects(
      inspectLibraryCoverJpeg(Buffer.from("not an image")),
    );
  });

  it("preserves receiptless legacy covers unless the run explicitly scopes or forces them", () => {
    const cover = {
      pathname: "inspo-covers/ref-a.jpg",
      url: "https://blob.example/inspo-covers/ref-a.jpg",
      size: 50,
      etag: "cover-v1",
    };
    assert.equal(
      shouldPreserveLegacyLibraryCover({
        force: false,
        exactRecord: false,
        cover,
      }),
      true,
    );
    assert.equal(
      shouldPreserveLegacyLibraryCover({
        force: false,
        exactRecord: true,
        cover,
      }),
      false,
    );
    assert.equal(
      shouldPreserveLegacyLibraryCover({
        force: true,
        exactRecord: false,
        cover,
      }),
      false,
    );
  });
});

describe("isSupportedLibraryCoverSource", () => {
  it("routes ZIP and PPTX originals into cover rendering", () => {
    assert.equal(isSupportedLibraryCoverSource("curriculum.zip"), true);
    assert.equal(isSupportedLibraryCoverSource("slides.pptx"), true);
    assert.equal(isSupportedLibraryCoverSource("notes.docx"), false);
  });
});

describe("chooseZipPrintableEntry", () => {
  it("selects the materially dominant printable from the Italy archive shape", () => {
    const selected = chooseZipPrintableEntry([
      {
        name: "HomeCEOAge3-4Week10Italy/READ ME FIRST - How to Open Age 3-4.pdf",
        uncompressedSize: 406_789,
      },
      {
        name: "HomeCEOAge3-4Week10Italy/Week 10 - Italy.pdf",
        uncompressedSize: 51_120_327,
      },
    ]);

    assert.equal(
      selected.name,
      "HomeCEOAge3-4Week10Italy/Week 10 - Italy.pdf",
    );
  });

  it("refuses comparable printable files as ambiguous", () => {
    assert.throws(
      () =>
        chooseZipPrintableEntry([
          { name: "student.pdf", uncompressedSize: 8_000_000 },
          { name: "teacher.pdf", uncompressedSize: 6_000_000 },
        ]),
      /ambiguous archive/i,
    );
  });

  it("refuses archives with no supported printable content", () => {
    assert.throws(
      () =>
        chooseZipPrintableEntry([
          { name: "notes.txt", uncompressedSize: 20 },
          { name: "source.docx", uncompressedSize: 40 },
        ]),
      /no supported printable content/i,
    );
  });

  it("ignores directories and structural metadata", () => {
    const selected = chooseZipPrintableEntry([
      { name: "packet/", uncompressedSize: 0 },
      { name: "__MACOSX/._packet.pdf", uncompressedSize: 80_000_000 },
      { name: "packet/cover.png", uncompressedSize: 300_000 },
    ]);

    assert.equal(selected.name, "packet/cover.png");
  });
});

describe("parseUnzipList", () => {
  it("keeps filenames with spaces and their exact uncompressed sizes", () => {
    const entries = parseUnzipList(`Archive: source.zip
  Length      Date    Time    Name
---------  ---------- -----   ----
   406789  05-07-2022 12:17   folder/READ ME FIRST.pdf
 51120327  10-20-2019 22:26   folder/Week 10 - Italy.pdf
---------                     -------
 51527116                     2 files
`);

    assert.deepEqual(entries, [
      {
        name: "folder/READ ME FIRST.pdf",
        uncompressedSize: 406_789,
      },
      {
        name: "folder/Week 10 - Italy.pdf",
        uncompressedSize: 51_120_327,
      },
    ]);
  });
});

describe("renderPptxFirstSlide", () => {
  it("converts the original presentation and rasterizes only slide 1", async () => {
    const pptx = Buffer.from("original-pptx");
    const pdf = Buffer.from("converted-pdf");
    const firstSlide = Buffer.from("first-slide-jpeg");
    const calls: string[] = [];

    const rendered = await renderPptxFirstSlide(pptx, {
      convertPptxToPdf: async (input) => {
        assert.equal(input, pptx);
        calls.push("convert");
        return pdf;
      },
      rasterizePdfToJpegs: async (input, maxPages) => {
        assert.equal(input, pdf);
        assert.equal(maxPages, 1);
        calls.push("rasterize");
        return { pageJpegs: [firstSlide], pageCount: 7 };
      },
    });

    assert.equal(rendered, firstSlide);
    assert.deepEqual(calls, ["convert", "rasterize"]);
  });

  it("refuses a conversion that yields no slide", async () => {
    await assert.rejects(
      renderPptxFirstSlide(Buffer.from("pptx"), {
        convertPptxToPdf: async () => Buffer.from("pdf"),
        rasterizePdfToJpegs: async () => ({
          pageJpegs: [],
          pageCount: 0,
        }),
      }),
      /no slides rendered/i,
    );
  });
});

describe("renderLibraryCover", () => {
  it("normalizes direct image originals to real JPEG bytes", async () => {
    const onePixelPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    );

    const rendered = await renderLibraryCover("cover.png", onePixelPng);

    assert.deepEqual([...rendered.jpeg.subarray(0, 2)], [0xff, 0xd8]);
    assert.deepEqual([...rendered.jpeg.subarray(-2)], [0xff, 0xd9]);
    assert.equal(rendered.renderedFrom, "cover.png");
  });
});
