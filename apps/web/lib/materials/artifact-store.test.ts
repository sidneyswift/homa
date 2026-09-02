import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FLEET_ANCHOR_BLOB_PATH_PREFIX,
  isFamilyArtifactUrl,
  isFleetAnchorUrl,
} from "./artifact-store";

const STORE = "https://pkvvudjdhxk33dig.public.blob.vercel-storage.com";
const FAMILY = "00000000-0000-4000-8000-00000000fam1";
const ANCHOR_URL = `${STORE}${FLEET_ANCHOR_BLOB_PATH_PREFIX}foldable-9a7ee48eeff3.jpg`;

describe("isFleetAnchorUrl", () => {
  it("accepts a public Blob URL under the fleet anchor prefix", () => {
    assert.equal(isFleetAnchorUrl(ANCHOR_URL), true);
  });

  it("refuses anything that is not https on our public store", () => {
    assert.equal(
      isFleetAnchorUrl(ANCHOR_URL.replace("https://", "http://")),
      false,
      "http",
    );
    assert.equal(
      isFleetAnchorUrl(
        `https://evil.example.com${FLEET_ANCHOR_BLOB_PATH_PREFIX}foldable-9a7ee48eeff3.jpg`,
      ),
      false,
      "another host",
    );
    assert.equal(
      isFleetAnchorUrl(
        `https://public.blob.vercel-storage.com.evil.example.com${FLEET_ANCHOR_BLOB_PATH_PREFIX}x.jpg`,
      ),
      false,
      "a host that merely contains the suffix",
    );
    assert.equal(
      isFleetAnchorUrl(
        `https://pkvvudjdhxk33dig.private.blob.vercel-storage.com${FLEET_ANCHOR_BLOB_PATH_PREFIX}x.jpg`,
      ),
      false,
      "the private store",
    );
  });

  it("refuses credentials and ports in the URL", () => {
    assert.equal(
      isFleetAnchorUrl(ANCHOR_URL.replace("https://", "https://user:pass@")),
      false,
    );
    assert.equal(
      isFleetAnchorUrl(ANCHOR_URL.replace("https://", "https://user@")),
      false,
    );
    assert.equal(
      isFleetAnchorUrl(ANCHOR_URL.replace(".com/", ".com:8443/")),
      false,
    );
  });

  it("refuses paths outside the fleet anchor prefix", () => {
    assert.equal(isFleetAnchorUrl(`${STORE}/fleet/other/x.jpg`), false);
    assert.equal(isFleetAnchorUrl(`${STORE}/fleet/material-anchors`), false);
    assert.equal(isFleetAnchorUrl(`${STORE}/families/${FAMILY}/images/x.png`), false);
    assert.equal(isFleetAnchorUrl(`${STORE}/inspo/ref-2026-07-17-x/page.pdf`), false);
  });

  it("refuses garbage", () => {
    assert.equal(isFleetAnchorUrl(""), false);
    assert.equal(isFleetAnchorUrl("not a url"), false);
    assert.equal(isFleetAnchorUrl("foldable"), false);
    assert.equal(isFleetAnchorUrl("data:image/jpeg;base64,/9j/"), false);
  });

  it("is disjoint from the family artifact space", () => {
    // An anchor is nobody's family artifact, and a family's own file is
    // never an anchor: the two trust checks cannot be confused for each
    // other by moving a file between prefixes.
    assert.equal(isFamilyArtifactUrl(ANCHOR_URL, FAMILY), false);
    const familyUrl = `${STORE}/families/${FAMILY}/images/abc.png`;
    assert.equal(isFamilyArtifactUrl(familyUrl, FAMILY), true);
    assert.equal(isFleetAnchorUrl(familyUrl), false);
  });
});
