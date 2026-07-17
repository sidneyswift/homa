import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  citationSourceName,
  citationSourceNames,
  verifiedCitationSourceName,
} from "./citation-source";

describe("citationSourceName", () => {
  it("normalizes a supplied source name", () => {
    assert.equal(
      citationSourceName({ url: "https://example.edu/study", claim: "Claim.", sourceName: "  Example   Institute " }),
      "Example Institute",
    );
  });

  it("uses only an allowlisted publication-host fallback", () => {
    assert.equal(citationSourceName({ url: "https://pubmed.ncbi.nlm.nih.gov/1/", claim: "Claim." }), "PubMed");
    assert.equal(citationSourceName({ url: "https://untrusted.example/1", claim: "Claim." }), null);
  });

  it("does not turn an invalid URL into a provenance label", () => {
    assert.equal(citationSourceName({ url: "not a URL", claim: "Claim." }), null);
  });

  it("deduplicates resolved names without creating unnamed entries", () => {
    assert.deepEqual(
      citationSourceNames([
        { url: "https://eric.ed.gov/?id=1", claim: "First." },
        { url: "https://eric.ed.gov/?id=2", claim: "Second." },
        { url: "https://example.test", claim: "Third." },
      ]),
      ["ERIC"],
    );
  });

  it("accepts an explicit source only when normalized tokens appear in bounded page text", async () => {
    assert.equal(
      await verifiedCitationSourceName(
        {
          url: "https://readingrockets.example/article",
          claim: "Claim.",
          sourceName: "Reading Rockets",
        },
        {
          fetch: async () =>
            new Response(
              "<html><title>Reading   Rockets | Article</title></html>",
              { status: 200 },
            ),
        },
      ),
      "Reading Rockets",
    );
  });

  it("verifies an explicit source after a redirect", async () => {
    const response = new Response("Reading Rockets research", { status: 200 });
    Object.defineProperty(response, "url", {
      value: "https://www.readingrockets.org/final",
    });
    assert.equal(
      await verifiedCitationSourceName(
        {
          url: "https://short.example/source",
          claim: "Claim.",
          sourceName: "Reading Rockets",
        },
        { fetch: async () => response },
      ),
      "Reading Rockets",
    );
  });

  it("uses only an allowlisted host label when a page returns 403", async () => {
    const forbidden = async () => new Response(null, { status: 403 });
    assert.equal(
      await verifiedCitationSourceName(
        {
          url: "https://eric.ed.gov/?id=ED1",
          claim: "Claim.",
          sourceName: "ERIC",
        },
        { fetch: forbidden },
      ),
      "ERIC",
    );
    assert.equal(
      await verifiedCitationSourceName(
        {
          url: "https://untrusted.example/article",
          claim: "Claim.",
          sourceName: "Unrelated Institute",
        },
        { fetch: forbidden },
      ),
      null,
    );
  });

  it("rejects an explicit source whose tokens do not appear in a readable body", async () => {
    assert.equal(
      await verifiedCitationSourceName(
        {
          url: "https://untrusted.example/article",
          claim: "Claim.",
          sourceName: "Reading Rockets",
        },
        {
          fetch: async () =>
            new Response("<html><title>Unrelated Institute</title></html>", {
              status: 200,
            }),
        },
      ),
      null,
    );
  });

  it("times out bounded inspection and does not activate an unrelated named source", async () => {
    assert.equal(
      await verifiedCitationSourceName(
        {
          url: "https://untrusted.example/hangs",
          claim: "Claim.",
          sourceName: "Reading Rockets",
        },
        {
          timeoutMs: 5,
          fetch: async (_input, init) =>
            await new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => {
                reject(new DOMException("aborted", "AbortError"));
              });
            }),
        },
      ),
      null,
    );
  });
});
