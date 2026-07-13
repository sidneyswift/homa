import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { EveMessage } from "eve/react";

import { MessageView } from "./message-parts";
import { workedForSteps } from "./worked-for";

const FAMILY_ID = "fam-1";
const PHOTO_URL = `https://x1.public.blob.vercel-storage.com/families/${FAMILY_ID}/chat/page-abc.jpg`;
const FILE_URL = `https://x1.public.blob.vercel-storage.com/families/${FAMILY_ID}/chat/schedule-def.pdf`;
const FOREIGN_URL =
  "https://x1.public.blob.vercel-storage.com/families/fam-other/chat/steal.jpg";

function userMessage(text: string): EveMessage {
  return {
    id: "turn_1:user",
    role: "user",
    parts: [{ type: "text", text }],
  } as unknown as EveMessage;
}

function assistantMessage(parts: unknown[]): EveMessage {
  return {
    id: "turn_1:assistant",
    role: "assistant",
    parts,
  } as unknown as EveMessage;
}

describe("MessageView attachment markers", () => {
  it("renders the photo big with its handwritten caption, and hides the marker line", () => {
    const html = renderToStaticMarkup(
      <MessageView
        timeZone="America/Chicago"
        familyId={FAMILY_ID}
        message={userMessage(
          `Maya's copywork\n[Photo attached · A handwriting page with g and y · ${PHOTO_URL}]`,
        )}
      />,
    );
    assert.match(html, new RegExp(`src="${PHOTO_URL}"`, "u"));
    assert.match(html, /A handwriting page with g and y/u);
    assert.match(html, /Maya(&#x27;|')s copywork/u);
    assert.doesNotMatch(html, /Photo attached ·/u);
  });

  it("renders files as chips and strips eve part placeholders", () => {
    const html = renderToStaticMarkup(
      <MessageView
        timeZone="America/Chicago"
        familyId={FAMILY_ID}
        message={userMessage(
          `Here it is\n[File attached · co-op-schedule.pdf · ${FILE_URL}]\n[file: co-op-schedule.pdf (application/pdf)]`,
        )}
      />,
    );
    assert.match(html, /co-op-schedule\.pdf/u);
    assert.match(html, new RegExp(`href="${FILE_URL}"`, "u"));
    assert.doesNotMatch(html, /\[file:/u);
  });

  it("never renders media from another family's space", () => {
    const html = renderToStaticMarkup(
      <MessageView
        timeZone="America/Chicago"
        familyId={FAMILY_ID}
        message={userMessage(
          `Look\n[Photo attached · sneaky · ${FOREIGN_URL}]`,
        )}
      />,
    );
    assert.doesNotMatch(html, /src=/u);
    assert.doesNotMatch(html, /sneaky/u);
    assert.match(html, /Look/u);
  });

  it("shows save receipts with an Undo beside the user message", () => {
    const html = renderToStaticMarkup(
      <MessageView
        timeZone="America/Chicago"
        familyId={FAMILY_ID}
        childNameById={new Map([["kid-1", "Maya"]])}
        attachmentReceipts={[
          {
            id: "att-1",
            kind: "image",
            outcome: "model_native",
            caption: "A handwriting page",
            childId: "kid-1",
          },
        ]}
        message={userMessage(
          `[Photo attached · A handwriting page · ${PHOTO_URL}]`,
        )}
      />,
    );
    assert.match(html, /Photo saved in Maya(&#x27;|')s binder/u);
    assert.match(html, />Undo</u);
  });
});

describe("worked-for line", () => {
  it("maps tool calls to plain-word steps with the fallback for unknown tools", () => {
    const steps = workedForSteps(
      assistantMessage([
        {
          type: "dynamic-tool",
          state: "output-available",
          toolName: "create_printable",
          output: { material: { title: "Tails practice", previewUrl: "x", pdfUrl: "y" } },
        },
        {
          type: "dynamic-tool",
          state: "output-available",
          toolName: "show_material",
          output: { material: { title: "Tails practice", previewUrl: "x", pdfUrl: "y" } },
        },
        {
          type: "dynamic-tool",
          state: "output-available",
          toolName: "some_new_tool",
          output: {},
        },
        {
          type: "dynamic-tool",
          state: "input-streaming",
          toolName: "recall",
        },
      ]),
    );
    assert.deepEqual(
      steps.map((step) => step.label),
      ["Made the page", "Brought the page back", "Worked on it"],
    );
    assert.equal(steps[0]?.detail, "Tails practice");
    assert.equal(steps[1]?.detail, "Tails practice");
  });

  it("renders one collapsed line with the seconds count", () => {
    const html = renderToStaticMarkup(
      <MessageView
        timeZone="America/Chicago"
        workedForSeconds={41}
        message={assistantMessage([
          {
            type: "dynamic-tool",
            state: "output-available",
            toolName: "get_children",
            output: { children: [] },
          },
          { type: "text", text: "Here you go." },
        ])}
      />,
    );
    assert.match(html, /Worked for 41 seconds/u);
    assert.match(html, /aria-expanded="false"/u);
    assert.doesNotMatch(html, /Checked your family(&#x27;|')s info/u);
    assert.match(html, /Here you go\./u);
  });
});

describe("re-shown material", () => {
  it("renders a show_material result as the same material card", () => {
    const html = renderToStaticMarkup(
      <MessageView
        timeZone="America/Chicago"
        message={assistantMessage([
          {
            type: "dynamic-tool",
            state: "output-available",
            toolName: "show_material",
            output: {
              shown: true,
              material: {
                title: "Mateo's Letter M Tracing",
                kind: "worksheet",
                skill: "letter M tracing",
                childName: "Mateo",
                previewUrl: "https://blob.example/preview.jpg",
                pdfUrl: "https://blob.example/page.pdf",
              },
            },
          },
          { type: "text", text: "Here it is again." },
        ])}
      />,
    );
    assert.match(html, /Worksheet ready/u);
    assert.match(html, /Mateo(&#x27;|')s Letter M Tracing/u);
    assert.match(html, /src="https:\/\/blob\.example\/preview\.jpg"/u);
    assert.match(html, />Print it</u);
    assert.match(html, /Here it is again\./u);
  });

  it("renders no card when show_material found nothing", () => {
    const html = renderToStaticMarkup(
      <MessageView
        timeZone="America/Chicago"
        message={assistantMessage([
          {
            type: "dynamic-tool",
            state: "output-available",
            toolName: "show_material",
            output: { shown: false, note: "not in this family" },
          },
          { type: "text", text: "Let me look again." },
        ])}
      />,
    );
    assert.doesNotMatch(html, /Print it/u);
    assert.match(html, /Let me look again\./u);
  });
});

describe("snap card", () => {
  const snapPart = {
    type: "dynamic-tool",
    state: "output-available",
    toolName: "ask_for_photo",
    output: {
      requested: true,
      question: "Can you show me the page Maya finished yesterday?",
      hint: "The copywork page with the g and y rows.",
    },
  };

  it("renders camera buttons only while it is the live ask", () => {
    const active = renderToStaticMarkup(
      <MessageView
        timeZone="America/Chicago"
        message={assistantMessage([snapPart])}
        activeSnapPartKey="turn_1:assistant:0"
        onSnapAddFiles={() => {}}
        onSnapTypeInstead={() => {}}
      />,
    );
    assert.match(active, /One question/u);
    assert.match(active, /Snap the page/u);
    assert.match(active, /Choose from my photos/u);
    assert.match(active, /Type instead/u);

    const settled = renderToStaticMarkup(
      <MessageView
        timeZone="America/Chicago"
        message={assistantMessage([snapPart])}
      />,
    );
    assert.match(settled, /Can you show me the page Maya finished yesterday\?/u);
    assert.doesNotMatch(settled, /Snap the page/u);
  });
});
