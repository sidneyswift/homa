import assert from "node:assert/strict";
import test from "node:test";

import { hasTargetedLessonReadOrSourceRefusal } from "./targeted-read-path";

const ID = "00000000-0000-4000-8000-000000000103";
const opened = {name: "get_family_asset", input: {assetId: ID}, output: {found: true,
  asset: {id: ID, status: "ready", resourceKind: "curriculum"}}};
const read = {name: "read_family_curriculum", input: {assetId: ID}, output: {read: true, assetId: ID}};
const created = {name: "create_printable", input: {}, output: {created: true}};

test("a ready original followed only by a Library link fails the lesson-read gate", () => {
  assert.equal(hasTargetedLessonReadOrSourceRefusal([opened]), false);
  assert.equal(hasTargetedLessonReadOrSourceRefusal([opened, created]), false);
  assert.equal(hasTargetedLessonReadOrSourceRefusal([{...opened, output: {found: false}}, opened]), false);
});

test("requires a returned read of the same original after opening it", () => {
  assert.equal(hasTargetedLessonReadOrSourceRefusal([opened, read]), true);
  assert.equal(hasTargetedLessonReadOrSourceRefusal([opened, created, read]), false);
  assert.equal(hasTargetedLessonReadOrSourceRefusal([read, opened]), false);
  assert.equal(hasTargetedLessonReadOrSourceRefusal([opened, {...read, input: {assetId: "another"}}]), false);
  assert.equal(hasTargetedLessonReadOrSourceRefusal([opened, {...read, output: {read: true, assetId: "another"}}]), false);
  assert.equal(hasTargetedLessonReadOrSourceRefusal([opened, {...read, output: undefined}]), false);
});

test("an explicit source refusal may stop honestly but cannot justify authoring", () => {
  const refused = {...read, output: {read: false, error: "unreadable"}};
  assert.equal(hasTargetedLessonReadOrSourceRefusal([opened, refused]), true);
  assert.equal(hasTargetedLessonReadOrSourceRefusal([opened, {...read, output: {read: false, assetId: ID}}]), true);
  assert.equal(hasTargetedLessonReadOrSourceRefusal([opened, refused, created]), false);
  assert.equal(hasTargetedLessonReadOrSourceRefusal([{...opened, output: {found: false}}]), true);
  assert.equal(hasTargetedLessonReadOrSourceRefusal([{...opened, output: undefined}]), false);
  assert.equal(hasTargetedLessonReadOrSourceRefusal([{...opened, output: {found: true,
    asset: {id: ID, status: "needs_attention", resourceKind: "curriculum"}}}]), true);
});
