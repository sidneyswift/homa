import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { EveMessage } from "eve/react";

import { MessageView } from "./message-parts";
import { buildTranscript } from "./transcript-days";
import { spokenTurnMessage } from "./voice-transcript";

/**
 * A spoken turn has to reach the screen as an ordinary bubble (founder
 * direction 2026-07-29: "when the user speaks, it gets added as one of their
 * messages; when the AI speaks, it gets added as a Homa response").
 *
 * The pure tests next door prove the ordering and the surface pill. This one
 * proves the thing those cannot: that what the voice panel hands up actually
 * renders as readable text through the same component every typed message
 * goes through, rather than as an empty bubble or a dropped part.
 */

const TIME_ZONE = "America/Chicago";
const FAMILY_ID = "fam-1";

describe("a spoken turn on screen", () => {
  it("renders the parent's spoken words in her own bubble", () => {
    const html = renderToStaticMarkup(
      <MessageView
        timeZone={TIME_ZONE}
        familyId={FAMILY_ID}
        message={
          spokenTurnMessage(
            { role: "user", text: "Finn finally got the fractions page." },
            0,
          ) as unknown as EveMessage
        }
      />,
    );
    assert.match(html, /Finn finally got the fractions page\./u);
  });

  it("renders Homa's spoken reply through the same component as a typed one", () => {
    const html = renderToStaticMarkup(
      <MessageView
        timeZone={TIME_ZONE}
        familyId={FAMILY_ID}
        message={
          spokenTurnMessage(
            { role: "assistant", text: "That is a real jump from last week." },
            1,
          ) as unknown as EveMessage
        }
      />,
    );
    assert.match(html, /That is a real jump from last week\./u);
  });

  it("keeps spoken ids clear of eve's per-session turn ids", () => {
    // eve restarts turn ids every session ("turn_1:user" exists in all of
    // them), and a spoken turn belongs to no eve turn. A collision would
    // make React reuse one bubble for two different messages.
    const first = spokenTurnMessage({ role: "user", text: "one" }, 0);
    const second = spokenTurnMessage({ role: "user", text: "two" }, 1);
    assert.notEqual(first.id, second.id);
    assert.doesNotMatch(first.id, /^turn_/u);
  });

  it("puts a whole conversation in the thread in the order it was said", () => {
    const now = Date.UTC(2026, 6, 29, 15, 0);
    const lines = [
      { role: "assistant" as const, text: "Hi, what are you two up to?" },
      { role: "user" as const, text: "Reading, mostly." },
      { role: "assistant" as const, text: "Anything he asked to reread?" },
    ];
    const items = buildTranscript({
      archived: [],
      live: [],
      liveTimes: {},
      spoken: lines.map((line, index) => ({
        at: now + index * 1000,
        channel: "web",
        modality: "voice" as const,
        message: spokenTurnMessage(line, index) as unknown as EveMessage,
      })),
      now,
    });

    const texts = items
      .filter((item) => item.kind === "message")
      .map((item) =>
        renderToStaticMarkup(
          <MessageView
            timeZone={TIME_ZONE}
            familyId={FAMILY_ID}
            message={item.kind === "message" ? item.message : ({} as EveMessage)}
          />,
        ),
      );
    assert.equal(texts.length, 3);
    assert.match(texts[0], /what are you two up to/u);
    assert.match(texts[1], /Reading, mostly/u);
    assert.match(texts[2], /asked to reread/u);
  });
});
