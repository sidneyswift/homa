import assert from "node:assert/strict";
import test from "node:test";

import { scanFamilyAssetTrainingContent } from "./family-asset-training-safety";

const children = [{ name: "Maya Walker", birthDate: "2019-04-07" }];

test("training safety excludes secrets without returning the secret", () => {
  const reasons = scanFamilyAssetTrainingContent({
    text: "Teacher portal password: correct-horse-battery-staple",
    children,
  });
  assert.deepEqual(reasons, ["secret_detected"]);
  assert.ok(reasons.every((reason) => !reason.includes("correct-horse")));
});

test("training safety excludes exact child names and birthday variants", () => {
  assert.deepEqual(
    scanFamilyAssetTrainingContent({
      text: "This reading log belongs to MAYA WALKER.",
      children,
    }),
    ["child_identifier_detected"],
  );
  assert.deepEqual(
    scanFamilyAssetTrainingContent({
      text: "Maya's reading practice",
      children,
    }),
    ["child_identifier_detected"],
  );
  assert.deepEqual(
    scanFamilyAssetTrainingContent({
      text: "Student birthday: April 7, 2019",
      children,
    }),
    ["child_identifier_detected"],
  );
  assert.deepEqual(
    scanFamilyAssetTrainingContent({
      text: "The Mayan calendar is not a child identifier.",
      children,
    }),
    [],
  );
});

test("training safety excludes structured sensitive records", () => {
  const reasons = scanFamilyAssetTrainingContent({
    text: "Individualized Education Program\nDiagnosis: dyslexia",
    children: [],
  });
  assert.deepEqual(reasons, ["sensitive_record_detected"]);
});

test("training safety checks filenames and titles as metadata", () => {
  const reasons = scanFamilyAssetTrainingContent({
    text: "A plain reading worksheet.",
    metadata: ["Maya Walker reading log.pdf"],
    children,
  });
  assert.deepEqual(reasons, ["child_identifier_detected"]);
});

test("copyright status is not a training exclusion", () => {
  const reasons = scanFamilyAssetTrainingContent({
    text: "Copyright 2026 Example Publisher. All rights reserved.",
    children: [],
  });
  assert.deepEqual(reasons, []);
});
