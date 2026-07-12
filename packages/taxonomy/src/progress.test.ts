import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  getProgressTaxonomyTopic,
} from "./progress";

describe("progress taxonomy metadata", () => {
  it("includes assessment topics and excludes content-only topics", () => {
    const assessmentTopic = getProgressTaxonomyTopic(
      "math.comparing-groups-more-or-fewer",
    );

    assert.deepEqual(assessmentTopic, {
      id: "math.comparing-groups-more-or-fewer",
      subject: "math",
      domain: "counting-cardinality",
      name: "Comparing groups: more or fewer",
      teachingWindowMonths: [48, 72],
    });
    assert.equal(
      getProgressTaxonomyTopic("science.dinosaur-sizes"),
      undefined,
    );
  });

  it("loads topics only from the generated progress index", () => {
    const progressSource = readFileSync(
      new URL("./progress.ts", import.meta.url),
      "utf8",
    );

    assert.match(progressSource, /from "\.\/progress\.generated"/);
    for (const forbiddenModule of [
      "./topics",
      "./assemble",
      "./graph",
      "./clusters",
      "./standards",
    ]) {
      assert.equal(
        progressSource.includes(`from "${forbiddenModule}"`),
        false,
      );
    }
  });
});
