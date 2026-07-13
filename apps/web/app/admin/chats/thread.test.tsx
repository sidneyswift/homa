import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { ThreadMessage } from "../../../lib/admin/chats-data";
import { ChatThread } from "./thread";

/**
 * The founder chat reader shows each bubble as the parent experienced
 * it: Homa's web replies and family-visible task output render through
 * the same markdown component as the parent's chat; texts, emails, the
 * parent's own words, and internal prompts stay verbatim.
 */

const TIME_ZONE = "America/New_York";

function message(overrides: Partial<ThreadMessage>): ThreadMessage {
  return {
    id: "msg-1",
    sessionId: "session-1",
    channel: "web",
    role: "assistant",
    content: "Hello",
    visibility: "family",
    taskRunId: null,
    memberName: null,
    createdAt: "2026-07-13T17:11:00Z",
    ...overrides,
  };
}

describe("ChatThread markdown rendering", () => {
  it("renders Homa's web replies as markdown, as the parent saw them", () => {
    const html = renderToStaticMarkup(
      <ChatThread
        timeZone={TIME_ZONE}
        messages={[
          message({
            content:
              "1. **Structure feels like a cage.** She can talk for ten minutes.\n2. **Stamina, not skill.** One paragraph took real effort.",
          }),
        ]}
      />,
    );
    assert.match(html, /<strong[^>]*>Structure feels like a cage\.<\/strong>/u);
    assert.match(html, /<ol[^>]*>/u);
    assert.doesNotMatch(html, /\*\*/u);
  });

  it("renders family-visible task output as markdown, like the web transcript's task bubbles", () => {
    const html = renderToStaticMarkup(
      <ChatThread
        timeZone={TIME_ZONE}
        messages={[
          message({ channel: "dispatch", content: "Today: **math first**." }),
        ]}
      />,
    );
    assert.match(html, /<strong[^>]*>math first<\/strong>/u);
  });

  it("keeps texts verbatim: the phone showed raw characters, and a markdown slip should stay visible", () => {
    const html = renderToStaticMarkup(
      <ChatThread
        timeZone={TIME_ZONE}
        messages={[
          message({ channel: "sms", content: "Try **this** tomorrow." }),
        ]}
      />,
    );
    assert.match(html, /Try \*\*this\*\* tomorrow\./u);
    assert.doesNotMatch(html, /<strong/u);
  });

  it("keeps the parent's own messages and internal prompts verbatim", () => {
    const html = renderToStaticMarkup(
      <ChatThread
        timeZone={TIME_ZONE}
        messages={[
          message({
            id: "msg-parent",
            role: "user",
            content: "She wrote **one** paragraph.",
            memberName: "Marisol",
          }),
          message({
            id: "msg-internal",
            channel: "dispatch",
            visibility: "internal",
            content: "Compose the **morning brief** for this family.",
          }),
        ]}
      />,
    );
    assert.match(html, /She wrote \*\*one\*\* paragraph\./u);
    assert.match(html, /Compose the \*\*morning brief\*\* for this family\./u);
    assert.doesNotMatch(html, /<strong/u);
  });
});
