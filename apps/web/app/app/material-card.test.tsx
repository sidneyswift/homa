import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { MaterialCard, type MaterialArtifact } from "./material-card";

/**
 * The packet card contract (the Llanes incident follow-through,
 * 2026-07-17): a multi-page material must say it is one PDF of N pages
 * and page through real per-page previews; a classic single page keeps
 * the exact card it always had.
 */

function artifact(overrides: Partial<MaterialArtifact> = {}): MaterialArtifact {
  return {
    title: "Story's Sound Blending Adventure",
    kind: "worksheet",
    skill: "digraphs sh, ch, th",
    childName: "Story",
    previewUrl: "https://blob.example/p1.jpg",
    pdfUrl: "https://blob.example/packet.pdf",
    ...overrides,
  };
}

describe("MaterialCard", () => {
  it("renders the classic single-page card without a pager", () => {
    const html = renderToStaticMarkup(<MaterialCard material={artifact()} />);
    assert.match(html, /Worksheet ready/u);
    assert.match(html, /Print it/u);
    assert.doesNotMatch(html, /Page 1 of/u);
    assert.doesNotMatch(html, /pages, one PDF/u);
  });

  it("renders a packet with the page count, pager, and all-pages button", () => {
    const html = renderToStaticMarkup(
      <MaterialCard
        material={artifact({
          kind: "packet",
          pageCount: 4,
          pagePreviewUrls: [
            "https://blob.example/p1.jpg",
            "https://blob.example/p2.jpg",
            "https://blob.example/p3.jpg",
            "https://blob.example/p4.jpg",
          ],
        })}
      />,
    );
    assert.match(html, /Packet ready/u);
    assert.match(html, /4 pages, one PDF/u);
    assert.match(html, /Page 1 of 4/u);
    assert.match(html, /Print all 4 pages/u);
    assert.match(html, /aria-label="Next page"/u);
    assert.match(html, /src="https:\/\/blob\.example\/p1\.jpg"/u);
  });

  it("names the preview cap honestly when the PDF outruns the previews", () => {
    const html = renderToStaticMarkup(
      <MaterialCard
        material={artifact({
          kind: "packet",
          pageCount: 9,
          pagePreviewUrls: [
            "https://blob.example/p1.jpg",
            "https://blob.example/p2.jpg",
            "https://blob.example/p3.jpg",
            "https://blob.example/p4.jpg",
            "https://blob.example/p5.jpg",
            "https://blob.example/p6.jpg",
          ],
        })}
      />,
    );
    assert.match(html, /Page 1 of 9/u);
    assert.match(html, /previews show the first 6/u);
    assert.match(html, /Print all 9 pages/u);
  });

  it("keeps a packet payload without page previews on the single preview", () => {
    // A legacy or degraded payload (pageCount only): no pager, no lies.
    const html = renderToStaticMarkup(
      <MaterialCard material={artifact({ kind: "packet", pageCount: 4 })} />,
    );
    assert.match(html, /Packet ready/u);
    assert.match(html, /4 pages, one PDF/u);
    assert.doesNotMatch(html, /Page 1 of/u);
    assert.match(html, /Print all 4 pages/u);
  });

  it("routes both PDF links through the pdf-open beacon when a real id exists", () => {
    const html = renderToStaticMarkup(
      <MaterialCard material={artifact({ id: "material-123" })} />,
    );
    assert.match(html, /href="\/api\/materials\/material-123\/pdf"/u);
    assert.doesNotMatch(html, /href="https:\/\/blob\.example\/packet\.pdf"/u);
  });

  it("falls back to the raw Blob URL when no id is present", () => {
    const html = renderToStaticMarkup(<MaterialCard material={artifact()} />);
    assert.match(html, /href="https:\/\/blob\.example\/packet\.pdf"/u);
  });
});
