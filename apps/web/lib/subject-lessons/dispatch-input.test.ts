import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAP_SUBJECTS } from "@homa/core";

import {
  attachSubjectLessonMaterialForTrustedSession,
  attachSubjectLessonMaterialInputSchema,
} from "../../agent/tools/attach_subject_lesson_material";
import {
  buildPrintableGenerationInput,
  createPrintableInputSchema,
  subjectLessonPrintableRestriction,
} from "../../agent/tools/create_printable";
import { subjectLessonMaterialFinalOnly } from "../../agent/tools/find_materials";
import { subjectLessonImageGenerationRestriction } from "../../agent/tools/generate_image";
import { subjectLessonMaterialFinalizationRestriction } from "../../agent/tools/mark_material_final";
import {
  saveSubjectLessonContentForTrustedSession,
  saveSubjectLessonContentInputSchema,
} from "../../agent/tools/save_subject_lesson_content";
import {
  buildSubjectLessonAuth,
  buildSubjectLessonMessage,
  readSubjectLessonTrustedContext,
  type SubjectLessonSessionInput,
} from "./dispatch-input";

const LESSON_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FAMILY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CHILD_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const FOREIGN_FAMILY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const MATERIAL_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function sessionInput(
  overrides: Partial<SubjectLessonSessionInput> = {}
): SubjectLessonSessionInput {
  return {
    lessonId: LESSON_ID,
    familyId: FAMILY_ID,
    childId: CHILD_ID,
    childName: "Maya",
    subjectId: "literacy",
    subjectName: "Literacy",
    targetItemId: "literacy.reads-short-vowel-words",
    targetStatement: "Reads short-vowel words",
    startingLine: null,
    attempt: 2,
    hasContent: false,
    materialId: null,
    modelUsageSurface: "subject_lesson",
    ...overrides,
  };
}

describe("subject lesson trusted session identity", () => {
  it("allowlists string-only auth attributes without spreading client fields", () => {
    const input = {
      ...sessionInput(),
      clientFamilyId: FOREIGN_FAMILY_ID,
    };

    const auth = buildSubjectLessonAuth(input);

    assert.equal(auth.authenticator, "subject-lesson");
    assert.equal(auth.principalId, `subject-lesson:${LESSON_ID}`);
    assert.equal(auth.principalType, "user");
    assert.deepEqual(auth.attributes, {
      channel: "subject_lesson",
      lessonId: LESSON_ID,
      familyId: FAMILY_ID,
      childId: CHILD_ID,
      childName: "Maya",
      subjectId: "literacy",
      subjectName: "Literacy",
      targetItemId: "literacy.reads-short-vowel-words",
      targetStatement: "Reads short-vowel words",
      startingLine: "",
      buildAttempt: "2",
      hasContent: "false",
      materialId: "",
      modelUsageSurface: "subject_lesson",
    });
    assert.equal(
      Object.values(auth.attributes).every(
        (attribute) => typeof attribute === "string"
      ),
      true
    );
    assert.equal(
      Object.values(auth.attributes).includes(FOREIGN_FAMILY_ID),
      false
    );
    assert.equal("clientFamilyId" in auth.attributes, false);
  });
});

describe("subject lesson model message", () => {
  it("names the reviewed target exactly without exposing run identity", () => {
    const targetStatement = "Blends and reads short-vowel words";
    const message = buildSubjectLessonMessage(
      sessionInput({
        targetStatement,
        startingLine: "Names each short-vowel sound",
      })
    );

    assert.match(message, /Load the subject-lesson-builder skill FIRST/u);
    assert.match(message, /The targetStatement is the exact reviewed target/u);
    assert.equal(message.split(targetStatement).length - 1, 1);
    assert.match(
      message,
      /"targetStatement":"Blends and reads short-vowel words"/u
    );
    assert.doesNotMatch(message, new RegExp(LESSON_ID, "u"));
    assert.doesNotMatch(message, new RegExp(FAMILY_ID, "u"));
  });
});

describe("subject lesson trusted tool context", () => {
  it("accepts only exact channel, UUID, and string attempt attributes", () => {
    const attributes = buildSubjectLessonAuth(sessionInput()).attributes;

    assert.deepEqual(readSubjectLessonTrustedContext(attributes), {
      familyId: FAMILY_ID,
      lessonId: LESSON_ID,
      childId: CHILD_ID,
      childName: "Maya",
      subjectId: "literacy",
      subjectName: "Literacy",
      targetStatement: "Reads short-vowel words",
      attempt: 2,
    });

    const invalidAttributes = [
      { ...attributes, channel: "subject-lesson" },
      { ...attributes, familyId: "not-a-uuid" },
      { ...attributes, lessonId: "not-a-uuid" },
      { ...attributes, childId: "not-a-uuid" },
      { ...attributes, childName: "" },
      { ...attributes, subjectId: "" },
      { ...attributes, subjectName: "" },
      { ...attributes, targetStatement: "" },
      { ...attributes, buildAttempt: "0" },
      { ...attributes, buildAttempt: "2.5" },
      { ...attributes, buildAttempt: 2 },
      { ...attributes, modelUsageSurface: "materials_image" },
    ];
    for (const invalid of invalidAttributes) {
      assert.equal(readSubjectLessonTrustedContext(invalid), null);
    }
  });
});

describe("subject lesson deterministic material restrictions", () => {
  const attributes = buildSubjectLessonAuth(sessionInput()).attributes;
  const validHtmlInput = createPrintableInputSchema.parse({
    title: "Short-vowel practice",
    kind: "worksheet",
    childId: CHILD_ID,
    childName: "Maya",
    subject: "literacy",
    skill: "Reads short-vowel words",
    html: "<main><p>Read and build each short-vowel word.</p></main>",
  });

  it("requires exact trusted child, subject, target, kind, and HTML", () => {
    assert.equal(
      subjectLessonPrintableRestriction(validHtmlInput, attributes),
      null
    );

    for (const invalidInput of [
      { ...validHtmlInput, childId: FOREIGN_FAMILY_ID },
      { ...validHtmlInput, childName: undefined },
      { ...validHtmlInput, childName: "Mia" },
      { ...validHtmlInput, subject: undefined },
      { ...validHtmlInput, subject: "Literacy" },
      { ...validHtmlInput, subject: "math" },
      { ...validHtmlInput, skill: undefined },
      { ...validHtmlInput, skill: "A different target" },
      { ...validHtmlInput, kind: "coloring" as const },
      {
        ...validHtmlInput,
        html: '<main><img src="https://example.com/reference.jpg" alt="" /></main>',
      },
      {
        ...validHtmlInput,
        html:
          '<main style="background: url(https://example.com/child.jpg)">Practice</main>',
      },
      {
        ...validHtmlInput,
        html:
          '<main style="background-image: url(data:image/png;base64,AAAA)">Practice</main>',
      },
      {
        ...validHtmlInput,
        html:
          '<svg><image href="https://example.com/child.jpg" /></svg>',
      },
      {
        ...validHtmlInput,
        html:
          '<style>.photo { mask-image: url("https://example.com/child.jpg"); }</style><main class="photo">Practice</main>',
      },
      {
        ...validHtmlInput,
        html:
          '<meta http-equiv="refresh" content="0;url=https://example.com/child-photo.jpg"><main>Practice</main>',
      },
      {
        ...validHtmlInput,
        html:
          '<meta content="0; url=https://example.com/child-photo.jpg" http-equiv="REFRESH"><main>Practice</main>',
      },
      {
        ...validHtmlInput,
        html:
          '<base href="https://example.com/family/"><main>Practice</main>',
      },
      {
        ...validHtmlInput,
        html:
          '<iframe src="https://example.com/child-photo"></iframe>',
      },
      {
        ...validHtmlInput,
        html: undefined,
        pageImageUrl: "https://example.com/full-page.jpg",
      },
    ]) {
      assert.match(
        subjectLessonPrintableRestriction(invalidInput, attributes) ?? "",
        /HTML-only subject lesson worksheet/u
      );
    }
  });

  it("accepts every canonical subject id without normalizing its display name", () => {
    for (const subject of MAP_SUBJECTS) {
      const target = subject.items[0];
      assert.ok(target);
      const subjectAttributes = buildSubjectLessonAuth(
        sessionInput({
          subjectId: subject.id,
          subjectName: subject.displayName,
          targetItemId: target.id,
          targetStatement: target.statement,
        }),
      ).attributes;
      const input = createPrintableInputSchema.parse({
        title: `${subject.displayName} practice`,
        kind: "worksheet",
        childId: CHILD_ID,
        childName: "Maya",
        subject: subject.id,
        skill: target.statement,
        html:
          "<main><p>Practice the exact reviewed target with clear text.</p></main>",
      });

      assert.equal(
        subjectLessonPrintableRestriction(input, subjectAttributes),
        null,
        subject.id,
      );
      if (subject.displayName !== subject.id) {
        assert.match(
          subjectLessonPrintableRestriction(
            { ...input, subject: subject.displayName },
            subjectAttributes,
          ) ?? "",
          /exact trusted child, subject, and target/iu,
          subject.id,
        );
      }
    }
  });

  it("rejects every generated-image path for the automatic lesson channel", () => {
    assert.match(
      subjectLessonImageGenerationRestriction(
        { referenceImageUrls: [] },
        attributes
      ) ?? "",
      /HTML-only subject lesson worksheet/u
    );
    assert.match(
      subjectLessonImageGenerationRestriction(
        { referenceImageUrls: ["https://example.com/child.jpg"] },
        attributes
      ) ?? "",
      /HTML-only subject lesson worksheet/u
    );
    assert.equal(
      subjectLessonImageGenerationRestriction(
        { referenceImageUrls: ["https://example.com/ordinary.jpg"] },
        { ...attributes, channel: "web" }
      ),
      null
    );
  });

  it("forces saved-material lookup to final-only for the automatic lesson channel", () => {
    assert.equal(subjectLessonMaterialFinalOnly(attributes), true);
    assert.equal(
      subjectLessonMaterialFinalOnly({
        ...attributes,
        channel: "web",
      }),
      false,
    );
  });

  it("rejects material finalization from only the internal lesson channel", () => {
    assert.match(
      subjectLessonMaterialFinalizationRestriction(attributes) ?? "",
      /parent approval/u
    );
    assert.equal(
      subjectLessonMaterialFinalizationRestriction({
        ...attributes,
        channel: "web",
      }),
      null
    );
  });
});

describe("save subject lesson content input", () => {
  it("accepts only bounded lesson content and trims every string", () => {
    const parsed = saveSubjectLessonContentInputSchema.parse({
      title: "  Short vowels at home  ",
      materials: ["  letter tiles  "],
      steps: [
        "  Name each sound.  ",
        "  Build one word.  ",
        "  Read the word together.  ",
      ],
      practice: "  Build and read two new words tomorrow.  ",
    });

    assert.deepEqual(parsed, {
      title: "Short vowels at home",
      materials: ["letter tiles"],
      steps: ["Name each sound.", "Build one word.", "Read the word together."],
      practice: "Build and read two new words tomorrow.",
    });

    const invalidInputs = [
      { ...parsed, steps: parsed.steps.slice(0, 2) },
      { ...parsed, materials: Array.from({ length: 9 }, () => "paper") },
      { ...parsed, practice: "" },
      { ...parsed, familyId: FAMILY_ID },
      { ...parsed, lessonId: LESSON_ID },
      { ...parsed, buildAttempt: "2" },
    ];
    for (const invalid of invalidInputs) {
      assert.equal(
        saveSubjectLessonContentInputSchema.safeParse(invalid).success,
        false
      );
    }
  });

  it("combines model content with trusted lesson identity at the write seam", async () => {
    const input = saveSubjectLessonContentInputSchema.parse({
      title: "Short vowels at home",
      materials: ["letter tiles"],
      steps: ["Name each sound.", "Build one word.", "Read the word together."],
      practice: "Build and read two new words tomorrow.",
    });
    let captured: unknown;

    const result = await saveSubjectLessonContentForTrustedSession(
      input,
      buildSubjectLessonAuth(sessionInput()).attributes,
      async (trustedWrite) => {
        captured = trustedWrite;
        return true;
      }
    );

    assert.deepEqual(captured, {
      familyId: FAMILY_ID,
      lessonId: LESSON_ID,
      attempt: 2,
      content: input,
    });
    assert.equal(result.saved, true);
    assert.equal(
      result.note,
      "The lesson content is saved. Continue with its worksheet."
    );
    assert.equal(JSON.stringify(result).includes(FAMILY_ID), false);
    assert.equal(JSON.stringify(result).includes(LESSON_ID), false);
  });
});

describe("attach subject lesson material input", () => {
  it("accepts one material UUID and no model-owned lesson identity", () => {
    assert.deepEqual(
      attachSubjectLessonMaterialInputSchema.parse({
        materialId: MATERIAL_ID,
      }),
      { materialId: MATERIAL_ID }
    );

    const invalidInputs = [
      { materialId: "not-a-uuid" },
      { materialId: MATERIAL_ID, familyId: FAMILY_ID },
      { materialId: MATERIAL_ID, lessonId: LESSON_ID },
      { materialId: MATERIAL_ID, buildAttempt: "2" },
    ];
    for (const invalid of invalidInputs) {
      assert.equal(
        attachSubjectLessonMaterialInputSchema.safeParse(invalid).success,
        false
      );
    }
  });

  it("combines the material UUID with trusted lesson identity", async () => {
    let captured: unknown;

    const result = await attachSubjectLessonMaterialForTrustedSession(
      { materialId: MATERIAL_ID },
      buildSubjectLessonAuth(sessionInput()).attributes,
      async (trustedWrite) => {
        captured = trustedWrite;
        return true;
      }
    );

    assert.deepEqual(captured, {
      familyId: FAMILY_ID,
      lessonId: LESSON_ID,
      attempt: 2,
      materialId: MATERIAL_ID,
    });
    assert.equal(result.attached, true);
    assert.equal(result.note, "The worksheet is attached to the lesson.");
    assert.equal(JSON.stringify(result).includes(FAMILY_ID), false);
    assert.equal(JSON.stringify(result).includes(LESSON_ID), false);
  });
});

describe("trusted printable lesson provenance", () => {
  it("stamps lessonId from auth while removing it from model input", () => {
    const modelInput = createPrintableInputSchema.parse({
      title: "Short-vowel practice",
      kind: "worksheet",
      childId: CHILD_ID,
      childName: "Maya",
      subject: "literacy",
      skill: "Reads short-vowel words",
      html: "<main><p>Read and build each short-vowel word.</p></main>",
      lessonId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    });

    assert.equal("lessonId" in modelInput, false);
    assert.deepEqual(
      buildPrintableGenerationInput(
        modelInput,
        "html",
        buildSubjectLessonAuth(sessionInput()).attributes
      ),
      {
        title: "Short-vowel practice",
        kind: "worksheet",
        skill: "Reads short-vowel words",
        subject: "literacy",
        curriculum: null,
        theme: null,
        characters: [],
        childName: "Maya",
        requestSummary: null,
        revisesId: null,
        path: "html",
        lessonId: LESSON_ID,
      }
    );
    assert.equal(
      "lessonId" in
        buildPrintableGenerationInput(modelInput, "html", {
          ...buildSubjectLessonAuth(sessionInput()).attributes,
          channel: "web",
        }),
      false
    );
  });
});
