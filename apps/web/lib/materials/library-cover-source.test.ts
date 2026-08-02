import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  chooseZipPrintableEntry,
  isSupportedLibraryCoverSource,
  parseUnzipList,
  renderLibraryCover,
  renderPptxFirstSlide,
  selectLibraryCoverSource,
} from "./library-cover-source";

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
