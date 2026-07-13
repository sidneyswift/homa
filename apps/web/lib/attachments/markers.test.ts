import assert from "node:assert/strict";
import { test } from "node:test";

import {
  composeFileMarker,
  composePhotoMarker,
  isFamilyChatAttachmentUrl,
  parseAttachmentMarkers,
} from "./markers";

const BLOB_URL =
  "https://x1y2.public.blob.vercel-storage.com/families/fam-1/chat/page-abc123.jpg";

test("photo markers round-trip through compose and parse", () => {
  const marker = composePhotoMarker({
    caption: "A handwriting page with g and y traced in pencil.",
    url: BLOB_URL,
  });
  const parsed = parseAttachmentMarkers(`Maya's copywork\n${marker}`);
  assert.equal(parsed.visibleText, "Maya's copywork");
  assert.deepEqual(parsed.markers, [
    {
      kind: "photo",
      caption: "A handwriting page with g and y traced in pencil.",
      url: BLOB_URL,
    },
  ]);
});

test("file markers round-trip and keep the filename", () => {
  const marker = composeFileMarker({ name: "co-op-schedule.pdf", url: BLOB_URL });
  const parsed = parseAttachmentMarkers(marker);
  assert.equal(parsed.visibleText, "");
  assert.deepEqual(parsed.markers, [
    { kind: "file", name: "co-op-schedule.pdf", url: BLOB_URL },
  ]);
});

test("captions containing the separator or brackets cannot corrupt the line", () => {
  const marker = composePhotoMarker({
    caption: "tricky · [caption] with structure",
    url: BLOB_URL,
  });
  const parsed = parseAttachmentMarkers(marker);
  assert.equal(parsed.markers.length, 1);
  assert.equal(parsed.markers[0]?.url, BLOB_URL);
  assert.equal(parsed.markers[0]?.kind, "photo");
});

test("empty captions fall back to a plain word", () => {
  const marker = composePhotoMarker({ caption: null, url: BLOB_URL });
  assert.equal(marker, `[Photo attached · photo · ${BLOB_URL}]`);
});

test("eve part placeholders leave the visible text", () => {
  const parsed = parseAttachmentMarkers(
    "Here it is\n[image: image/jpeg]\n[file: notes.pdf (application/pdf)]",
  );
  assert.equal(parsed.visibleText, "Here it is");
  assert.deepEqual(parsed.markers, []);
});

test("ordinary bracketed SMS blocks stay visible", () => {
  const text = "[Voice note, transcribed]: we finished the maze page";
  const parsed = parseAttachmentMarkers(text);
  assert.equal(parsed.visibleText, text);
  assert.deepEqual(parsed.markers, []);
});

test("non-https marker urls do not parse", () => {
  const parsed = parseAttachmentMarkers(
    "[Photo attached · sneaky · javascript:alert(1)]",
  );
  assert.deepEqual(parsed.markers, []);
});

test("the render wall only accepts this family's own chat space", () => {
  assert.equal(isFamilyChatAttachmentUrl(BLOB_URL, "fam-1"), true);
  assert.equal(isFamilyChatAttachmentUrl(BLOB_URL, "fam-2"), false);
  assert.equal(isFamilyChatAttachmentUrl(BLOB_URL, null), false);
  assert.equal(
    isFamilyChatAttachmentUrl(
      "https://x1y2.public.blob.vercel-storage.com/families/fam-1/videos/a.mp4",
      "fam-1",
    ),
    false,
  );
  assert.equal(
    isFamilyChatAttachmentUrl("https://evil.example.com/families/fam-1/chat/a.jpg", "fam-1"),
    false,
  );
});
