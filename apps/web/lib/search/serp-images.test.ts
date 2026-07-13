import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  isAllowedPhotoType,
  normalizeImagesResponse,
  verifyPhotoToken,
} from "./serp-images";

const FAMILY_A = "11111111-1111-4111-8111-111111111111";
const FAMILY_B = "22222222-2222-4222-8222-222222222222";

function sampleResponse() {
  return {
    images_results: [
      {
        title: "Monarch butterfly on milkweed",
        source: "nps.gov",
        original: "https://example.org/monarch.jpg",
        original_width: 2400,
        original_height: 1600,
      },
      {
        title: "Blocked result",
        source: "example.com",
        original: "https://example.com/blocked.jpg",
        original_width: 800,
        original_height: 600,
        unsafe: true,
      },
      {
        title: "Insecure host",
        source: "example.net",
        original: "http://example.net/insecure.jpg",
        original_width: 800,
        original_height: 600,
      },
      {
        title: "Missing dimensions",
        source: "example.io",
        original: "https://example.io/nodims.jpg",
      },
      {
        title: "x".repeat(400),
        source: "very-long-titles.example",
        original: "https://example.org/second.png",
        original_width: 1200,
        original_height: 900,
      },
    ],
  };
}

describe("serp-images", () => {
  beforeEach(() => {
    process.env.SERPAPI_API_KEY = "test-serpapi-key";
  });

  it("keeps safe https results with dimensions, in order, capped titles", () => {
    const photos = normalizeImagesResponse(sampleResponse(), FAMILY_A, 8);
    assert.equal(photos.length, 2);
    assert.equal(photos[0].photoNumber, 1);
    assert.equal(photos[0].title, "Monarch butterfly on milkweed");
    assert.equal(photos[0].source, "nps.gov");
    assert.equal(photos[0].width, 2400);
    assert.equal(photos[1].photoNumber, 2);
    assert.equal(photos[1].title.length, 120);
  });

  it("respects the requested count", () => {
    const photos = normalizeImagesResponse(sampleResponse(), FAMILY_A, 1);
    assert.equal(photos.length, 1);
  });

  it("never exposes raw urls in results", () => {
    const photos = normalizeImagesResponse(sampleResponse(), FAMILY_A, 8);
    const serialized = JSON.stringify(photos);
    assert.ok(!serialized.includes("example.org/monarch.jpg"));
  });

  it("round-trips a token for the signing family", () => {
    const [photo] = normalizeImagesResponse(sampleResponse(), FAMILY_A, 1);
    const verified = verifyPhotoToken(photo.photoToken, FAMILY_A);
    assert.deepEqual(verified, {
      url: "https://example.org/monarch.jpg",
      width: 2400,
      height: 1600,
    });
  });

  it("rejects a token presented by another family", () => {
    const [photo] = normalizeImagesResponse(sampleResponse(), FAMILY_A, 1);
    assert.equal(verifyPhotoToken(photo.photoToken, FAMILY_B), null);
  });

  it("rejects tampered payloads and signatures", () => {
    const [photo] = normalizeImagesResponse(sampleResponse(), FAMILY_A, 1);
    const [body, signature] = photo.photoToken.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({
        v: 1,
        f: FAMILY_A,
        u: "https://attacker.example/steal.jpg",
        w: 1,
        h: 1,
      }),
    ).toString("base64url");
    assert.equal(verifyPhotoToken(`${forgedBody}.${signature}`, FAMILY_A), null);
    assert.equal(verifyPhotoToken(`${body}.${signature.slice(0, -2)}aa`, FAMILY_A), null);
  });

  it("rejects malformed tokens", () => {
    for (const bad of ["", "abc", "a.b.c", "!!.!!"]) {
      assert.equal(verifyPhotoToken(bad, FAMILY_A), null);
    }
  });

  it("rejects every token when the key is unset", () => {
    const [photo] = normalizeImagesResponse(sampleResponse(), FAMILY_A, 1);
    delete process.env.SERPAPI_API_KEY;
    assert.equal(verifyPhotoToken(photo.photoToken, FAMILY_A), null);
  });

  it("signs nothing when the key is unset", () => {
    delete process.env.SERPAPI_API_KEY;
    assert.equal(normalizeImagesResponse(sampleResponse(), FAMILY_A, 8).length, 0);
  });

  it("allows raster media types only", () => {
    assert.equal(isAllowedPhotoType("image/jpeg"), true);
    assert.equal(isAllowedPhotoType("image/png; charset=binary"), true);
    assert.equal(isAllowedPhotoType("IMAGE/WEBP"), true);
    assert.equal(isAllowedPhotoType("image/svg+xml"), false);
    assert.equal(isAllowedPhotoType("text/html"), false);
    assert.equal(isAllowedPhotoType(""), false);
  });
});
