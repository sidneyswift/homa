import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAX_PAGE_CHARS,
  isFetchableUrl,
  normalizeScrapeResponse,
} from "./firecrawl";

const REQUESTED = "https://example.org/curriculum/alpha";

function sampleResponse(markdown: string, metadata: Record<string, unknown> = {}) {
  return {
    success: true,
    data: {
      markdown,
      metadata: {
        title: "Alpha scope and sequence",
        sourceURL: REQUESTED,
        url: "https://example.org/curriculum/alpha/",
        statusCode: 200,
        ...metadata,
      },
    },
  };
}

describe("firecrawl", () => {
  it("returns the page with title and redirect-resolved url", () => {
    const outcome = normalizeScrapeResponse(sampleResponse("# Alpha\n\nSingle-digit addition."), REQUESTED);
    assert.ok(outcome.ok);
    assert.equal(outcome.page.title, "Alpha scope and sequence");
    assert.equal(outcome.page.url, "https://example.org/curriculum/alpha/");
    assert.equal(outcome.page.markdown, "# Alpha\n\nSingle-digit addition.");
    assert.equal(outcome.page.truncated, false);
  });

  it("falls back to the requested url when metadata urls are unusable", () => {
    const outcome = normalizeScrapeResponse(
      sampleResponse("content", { url: "http://insecure.example", sourceURL: 42 }),
      REQUESTED,
    );
    assert.ok(outcome.ok);
    assert.equal(outcome.page.url, REQUESTED);
  });

  it("caps oversized markdown at a line boundary and flags it", () => {
    const line = "curriculum unit line\n";
    const outcome = normalizeScrapeResponse(
      sampleResponse(line.repeat(Math.ceil((MAX_PAGE_CHARS * 2) / line.length))),
      REQUESTED,
    );
    assert.ok(outcome.ok);
    assert.equal(outcome.page.truncated, true);
    assert.ok(outcome.page.markdown.length <= MAX_PAGE_CHARS);
    assert.ok(outcome.page.markdown.endsWith("curriculum unit line"));
  });

  it("bounds runaway titles", () => {
    const outcome = normalizeScrapeResponse(
      sampleResponse("content", { title: "x".repeat(500) }),
      REQUESTED,
    );
    assert.ok(outcome.ok);
    assert.equal(outcome.page.title.length, 200);
  });

  it("rejects vendor failures and missing markdown", () => {
    assert.equal(normalizeScrapeResponse({ success: false }, REQUESTED).ok, false);
    assert.equal(normalizeScrapeResponse({ success: true, data: {} }, REQUESTED).ok, false);
    assert.equal(normalizeScrapeResponse({}, REQUESTED).ok, false);
  });

  it("rejects error-status pages with the status in the note", () => {
    const outcome = normalizeScrapeResponse(
      sampleResponse("Not found", { statusCode: 404 }),
      REQUESTED,
    );
    assert.equal(outcome.ok, false);
    assert.ok(!outcome.ok && outcome.note.includes("404"));
  });

  it("rejects empty pages", () => {
    const outcome = normalizeScrapeResponse(sampleResponse("   \n  "), REQUESTED);
    assert.equal(outcome.ok, false);
  });

  it("accepts only https urls", () => {
    assert.equal(isFetchableUrl("https://example.org/page"), true);
    assert.equal(isFetchableUrl("http://example.org/page"), false);
    assert.equal(isFetchableUrl("file:///etc/passwd"), false);
    assert.equal(isFetchableUrl("not a url"), false);
  });
});
