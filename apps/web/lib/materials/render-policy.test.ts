import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  isPrintableRequestAllowed,
  SUBJECT_LESSON_RENDER_POLICY,
} from "./render-page";

describe("subject lesson Chromium render policy", () => {
  it("blocks every image request while retaining safe font resources", () => {
    for (const imageUrl of [
      "https://homa.example/families/family/materials/child.jpg",
      "https://fonts.gstatic.com/child.png",
      "data:image/png;base64,AAAA",
      "blob:https://homa.example/child-image",
    ]) {
      assert.equal(
        isPrintableRequestAllowed(
          "image",
          imageUrl,
          SUBJECT_LESSON_RENDER_POLICY,
        ),
        false,
        imageUrl,
      );
    }

    assert.equal(
      isPrintableRequestAllowed(
        "stylesheet",
        "https://fonts.googleapis.com/css2?family=Nunito",
        SUBJECT_LESSON_RENDER_POLICY,
      ),
      true,
    );
    assert.equal(
      isPrintableRequestAllowed(
        "font",
        "https://fonts.gstatic.com/s/nunito/font.woff2",
        SUBJECT_LESSON_RENDER_POLICY,
      ),
      true,
    );
    assert.equal(
      isPrintableRequestAllowed(
        "image",
        "data:image/png;base64,AAAA",
      ),
      true,
    );
  });

  it("blocks non-initial documents and navigation requests", () => {
    assert.equal(
      isPrintableRequestAllowed(
        "document",
        "about:blank",
        SUBJECT_LESSON_RENDER_POLICY,
        false,
      ),
      true,
    );
    for (const [resourceType, url, navigation] of [
      [
        "document",
        "https://example.com/child-photo",
        false,
      ],
      [
        "document",
        "https://example.com/child-photo",
        true,
      ],
      [
        "stylesheet",
        "https://fonts.googleapis.com/css2?family=Nunito",
        true,
      ],
    ] as const) {
      assert.equal(
        isPrintableRequestAllowed(
          resourceType,
          url,
          SUBJECT_LESSON_RENDER_POLICY,
          navigation,
        ),
        false,
      );
    }
  });

  it("applies the policy inside request interception before rendering", async () => {
    const [renderSource, toolSource] = await Promise.all([
      readFile(new URL("./render-page.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../../agent/tools/create_printable.ts", import.meta.url),
        "utf8",
      ),
    ]);

    const interception = renderSource.indexOf(
      "page.setRequestInterception(true)",
    );
    const policyCall = renderSource.indexOf(
      "isPrintableRequestAllowed(",
      interception,
    );
    const setContent = renderSource.indexOf("page.setContent(", policyCall);
    assert.ok(interception >= 0);
    assert.ok(policyCall > interception);
    assert.ok(setContent > policyCall);
    assert.match(renderSource, /request\.isNavigationRequest\(\)/u);
    assert.match(
      toolSource,
      /renderPrintableHtml\(\s*document,\s*SUBJECT_LESSON_RENDER_POLICY/u,
    );
  });
});
