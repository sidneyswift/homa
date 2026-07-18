import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const skillSourcePromise = readFile(
  new URL(
    "../../agent/skills/subject-lesson-builder/SKILL.md",
    import.meta.url
  ),
  "utf8"
);
const positiveRoutingSourcePromise = readFile(
  new URL(
    "../../evals/subject-lesson-builder/internal-build-routing.eval.ts",
    import.meta.url
  ),
  "utf8"
);
const negativeRoutingSourcePromise = readFile(
  new URL(
    "../../evals/subject-lesson-builder/adjacent-negative-routing.eval.ts",
    import.meta.url
  ),
  "utf8"
);

function indexAfter(
  source: string,
  token: string,
  previousIndex: number
): number {
  const index = source.indexOf(token, previousIndex + 1);
  assert.ok(index > previousIndex, `${token} must appear after the prior step`);
  return index;
}

describe("subject lesson builder routing fixtures", () => {
  it("routes a trusted internal build to subject-lesson-builder", async () => {
    const source = await positiveRoutingSourcePromise;
    assert.match(source, /trusted internal subject lesson build/iu);
    assert.match(source, /loadedSkill\("subject-lesson-builder"\)/u);
  });

  it("keeps an ordinary parent material request out of the internal builder", async () => {
    const source = await negativeRoutingSourcePromise;
    assert.match(source, /loadedSkill\("materials-studio"\)/u);
    assert.match(source, /subject-lesson-builder/u);
    assert.match(source, /every\(/u);
  });
});

describe("subject lesson builder workflow contract", () => {
  it("advertises only the trusted internal build intent", async () => {
    const source = await skillSourcePromise;
    const description = /^description:\s*(.+)$/mu.exec(source)?.[1] ?? "";
    assert.match(description, /^Use when /u);
    assert.match(description, /trusted internal subject lesson build/iu);
    assert.match(description, /Do not use for ordinary parent chat/iu);
  });

  it("orders save, studio loading, HTML creation, revision, and attachment", async () => {
    const source = await skillSourcePromise;
    let index = -1;
    index = indexAfter(source, "save_subject_lesson_content", index);
    index = indexAfter(source, "Load `materials-studio`", index);
    index = indexAfter(source, "HTML-only", index);
    index = indexAfter(source, "create_printable", index);
    index = indexAfter(source, "revisesId", index);
    indexAfter(source, "attach_subject_lesson_material", index);
  });

  it("requires fidelity, safety, review, and honest stops", async () => {
    const source = await skillSourcePromise;
    assert.match(source, /three to five/iu);
    assert.match(source, /one practice suggestion/iu);
    assert.match(source, /exact reviewed target/iu);
    assert.match(
      source,
      /improve[\s\S]*raise[\s\S]*increase[\s\S]*boost[\s\S]*guarantee[\s\S]*score/iu
    );
    assert.match(source, /at most two revisions/iu);
    assert.match(source, /review\.pass[\s\S]*true/iu);
    assert.match(source, /review[\s\S]*null/iu);
    assert.match(source, /Never call `mark_material_final`/u);
    assert.match(source, /Never use.*child photo/iu);
    assert.match(source, /HTML-only[\s\S]*never call `generate_image`/iu);
    assert.match(source, /never pass `pageImageUrl`/iu);
    assert.match(
      source,
      /create_printable[\s\S]*skill[\s\S]*targetStatement[\s\S]*verbatim/iu
    );
    assert.match(
      source,
      /trusted canonical `subjectId`, not the display name/iu,
    );
    assert.match(source, /saved: false[\s\S]*do not load `materials-studio`/iu);
    assert.match(source, /must not contain image-bearing markup/iu);
    assert.match(source, /CSS `url\(\.\.\.\)`/u);
    const frontmatter = source.slice(0, source.indexOf("---", 4) + 3);
    assert.doesNotMatch(frontmatter, /generate_image/u);
    assert.match(frontmatter, /find_materials/u);
    assert.match(source, /Stop honestly/iu);
    assert.doesNotMatch(source, /\u2014/u);
  });
});
