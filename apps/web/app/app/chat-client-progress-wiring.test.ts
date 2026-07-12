import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("./chat-client.tsx", import.meta.url),
  "utf8",
);
const pageSource = readFileSync(
  new URL("./page.tsx", import.meta.url),
  "utf8",
);

describe("ChatClient progress card wiring", () => {
  it("enables handlers only for the latest unconsumed live progress message", () => {
    assert.match(
      source,
      /latestProgressMessageInteraction\(\{/u,
    );
    assert.match(
      source,
      /isLiveMessage &&\s*item\.message\.id === progressInteraction\?\.messageId/u,
    );
    assert.match(
      source,
      /actionableProgressPartKey=\{\s*actionableInteraction\?\.partKey\s*\}/u,
    );
  });

  it("routes a card action through one-shot consumption and the existing send path", () => {
    assert.match(
      source,
      /beginProgressAction\(/u,
    );
    assert.match(
      source,
      /settleProgressAction\(/u,
    );
    assert.match(
      source,
      /sendMessage\(text, \{\s*kind: "progress_card",\s*progressActionKey: interaction\.actionKey/u,
    );
    assert.match(
      source,
      /if \(plan\.destination === "queue"\)/u,
    );
    assert.match(
      source,
      /appendPreparedChatSendToQueue\(current, plan\)/u,
    );
  });

  it("keeps wall-rejected actions retryable and releases cancelled queue keys", () => {
    assert.match(
      source,
      /if \(wall\) \{\s*setWallOpen\(true\);\s*return "rejected";/u,
    );
    assert.match(
      source,
      /releaseQueuedProgressAction\(entry\.progressActionKey\)/u,
    );
  });

  it("keeps archived cards read-only and invokes the real composer focus helper", () => {
    assert.match(
      source,
      /const isLiveMessage = liveMessageSet\.has\(item\.message\);/u,
    );
    assert.match(
      source,
      /onFocusComposer=\{\s*actionableInteraction/u,
    );
    assert.match(source, /ref=\{composerFormRef\}/u);
    assert.match(
      source,
      /focusChatComposerInput\(composerFormRef\.current\);/u,
    );
  });

  it("requires the effective family time zone throughout chat rendering", () => {
    assert.match(source, /timeZone: string;/u);
    assert.doesNotMatch(source, /timeZone: string \| null;/u);
    assert.match(
      pageSource,
      /timeZone=\{effectiveTimeZone\(app\?\.family\.time_zone\)\}/u,
    );
  });
});
