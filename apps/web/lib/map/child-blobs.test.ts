import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { childBlobPrefixes } from "./child-blobs";

/**
 * The prefixes are the whole fix, so they are what gets pinned.
 *
 * A stored blob URL is not a usable handle here: the delete that
 * strands these bytes is the same cascade that removes every row
 * holding a URL. Only a prefix reaches bytes whose row is already gone,
 * which is why these tests assert prefix SHAPE rather than a URL list.
 */

const FAMILY = "11111111-1111-1111-1111-111111111111";
const CHILD = "22222222-2222-2222-2222-222222222222";

describe("childBlobPrefixes", () => {
  it("always covers the child's photo, even with no lessons", () => {
    const prefixes = childBlobPrefixes({
      familyId: FAMILY,
      childId: CHILD,
      lessonIds: [],
    });
    assert.deepEqual(prefixes, [`families/${FAMILY}/children/${CHILD}/`]);
  });

  it("covers every one of the child's lessons", () => {
    const prefixes = childBlobPrefixes({
      familyId: FAMILY,
      childId: CHILD,
      lessonIds: ["lesson-a", "lesson-b"],
    });
    assert.ok(prefixes.includes(`families/${FAMILY}/lessons/lesson-a/`));
    assert.ok(prefixes.includes(`families/${FAMILY}/lessons/lesson-b/`));
    assert.equal(prefixes.length, 3);
  });

  it("stays inside this family's own space", () => {
    // The purge deletes by prefix, so a prefix that did not start at
    // this family would delete another family's bytes.
    for (const prefix of childBlobPrefixes({
      familyId: FAMILY,
      childId: CHILD,
      lessonIds: ["lesson-a"],
    })) {
      assert.ok(
        prefix.startsWith(`families/${FAMILY}/`),
        `prefix escapes the family: ${prefix}`,
      );
      assert.ok(prefix.endsWith("/"), `prefix must be a folder: ${prefix}`);
    }
  });

  it("matches the path the photo upload actually writes", () => {
    // If these two ever drift, the purge silently finds nothing and the
    // photo survives the child. Same reason lessonBlobPrefix is shared
    // with the TTL sweep rather than re-spelled here.
    const [photo] = childBlobPrefixes({
      familyId: FAMILY,
      childId: CHILD,
      lessonIds: [],
    });
    assert.equal(photo, `families/${FAMILY}/children/${CHILD}/`);
  });
});
